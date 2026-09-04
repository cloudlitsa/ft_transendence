// Profile routes. Mounted under /api/profile by server.ts, so these are:
//
//     PATCH  /api/profile         rename yourself
//     GET    /api/profile/:id     view someone's public profile
//     POST   /api/profile/avatar  upload or replace your avatar
//     DELETE /api/profile/avatar  remove your avatar
//
// Every route here requires login. What differs is whose data you may touch:
// the PATCH and avatar routes always act on the logged-in user, never on an
// id from the URL, so there is nothing to authorise beyond "are you signed
// in". GET /:id is the exception, and it answers with public fields only.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authedUserId, requireAuth } from "../lib/requireAuth.js";
import { isOnline } from "../lib/wsRegistry.js";

import {
  MAX_AVATAR_BYTES,
  PUBLIC_UPLOADS_DIR,
  removeFile,
  storeFile,
} from "../lib/fileStorage.js";


// ---------- How an avatar is addressed ----------
// The database stores a URL path, never image bytes:
//
//     on disk   /app/uploads/<uuid>.png
//     in the DB users.avatar_url = "/api/uploads/<uuid>.png"
//     in the UI <img src="/api/uploads/<uuid>.png">
//
// @fastify/static serves that whole directory under /api/uploads/, with no
// auth — which is right for a profile picture, since an <img> tag cannot send
// credentials anyway. Chat attachments deliberately do NOT live there; see
// lib/fileStorage.ts for why the two are kept apart.
//
// The prefix is a constant because it is used three ways: to build a new URL,
// and — twice — to turn a stored URL back into a filename when deleting.

const AVATAR_URL_PREFIX = "/api/uploads/";


// ---------- Input validation ----------
// The same displayName rules as signup, so a name can't pass one door and
// fail the other.

const updateProfileSchema = z.object({
    displayName: z
        .string()
        .min(1, "Display name is required")
        .max(50, "Display name too long")
        .trim(),
});


export async function profileRoutes(fastify:FastifyInstance) {
    // Plugin-wide guard: requireAuth runs before every route below. The hook
    // is scoped to this plugin, so it does not apply to anything registered
    // elsewhere in server.ts — including the static /api/uploads/ handler.
    fastify.addHook("preHandler", requireAuth);

    // ---------- PATCH /api/profile ----------
    // Rename yourself. The target is always the logged-in user, taken from
    // the token — there is no id in the URL to tamper with.

    fastify.patch("/", async (request, reply) =>{
        const parsed = updateProfileSchema.safeParse(request.body);
        if (!parsed.success){
            // Field-level detail is safe to return here: it describes the
            // caller's own input, not anyone else's data.
            return reply.code(400).send({
                error: "Invalid input",
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const me = authedUserId(request);
        const user = await prisma.user.update({
            where: { id: me },
            data: { displayName: parsed.data.displayName },
            select: { id: true, email: true, displayName: true, avatarUrl : true },
        });
        return reply.send ({ user });
    });

    // ---------- GET /api/profile/:id ----------
    // Someone else's profile. The only route in this file that reads another
    // user's row, so it is the only one that has to be careful about which
    // columns leave the backend.
    //
    // A malformed id answers with the same 404 as a missing user: a caller
    // should not be able to tell "not a uuid" from "no such person".

    fastify.get("/:id", async (request, reply) => {
        const params = z
            .object({ id: z.string().uuid()})
            .safeParse(request.params);
        if (!params.success){
            return reply.code(404).send({ error: "User not found"});
        }

        const user = await prisma.user.findUnique({
            where: { id: params.data.id },
            // Public fields ONLY — no passwordHash, and no email. Listing
            // columns explicitly is what stops a new column from leaking by
            // default the day someone adds one.
            select: {id: true, displayName: true, avatarUrl: true },
        });
        if (!user ){
            return reply.code(404).send({ error: "User not found " });
        }
        // `online` is not a column. It is computed from the WebSocket
        // registry at request time, so it can never go stale in the database.
        // `...user` spreads the row's fields, then online is added alongside.
        return reply.send({ user: { ...user, online: isOnline(user.id) } });
    });

    // ---------- POST /api/profile/avatar ----------
    // Upload or replace the logged-in user's avatar. Five stages:
    //
    //     1. read the upload into memory      413 if over the limit
    //     2. validate and write it to disk    400 / 413 / 415
    //     3. remember the old avatar URL      before the update overwrites it
    //     4. point the user row at the new file
    //     5. delete the old file              best-effort, after the commit
    //
    // Stages 3-5 are in that order on purpose: the row is updated before the
    // old file is removed, so a failed unlink leaves a harmless orphan rather
    // than a user whose avatar is a broken image.

    fastify.post("/avatar", async (request, reply) => {
        const me = authedUserId(request);

        // request.file() is the single-file shortcut from @fastify/multipart.
        // The chat route uses request.parts() instead, because it has a text
        // field to read as well.
        const data = await request.file();
        if (!data){
            return reply.code(400).send({ error: "No file uploaded "});
        }

        // 1. Read the whole file, so its real bytes can be checked before
        //    anything is written. toBuffer() throws if the 2MB limit
        //    registered in server.ts is hit mid-stream.
        let buffer: Buffer;
        try {
            buffer = await data.toBuffer();
        } catch {
            return reply.code(413).send({ error: "File too large (max 2MB)" });
        }

        // 2. Validate and write, through the engine shared with chat
        //    attachments. This route used to check only the mimetype the
        //    client claimed; sharing the engine is what gave it the
        //    magic-byte check, so a file whose contents disagree with its
        //    declared type is now refused.
        const stored = await storeFile({
            buffer,
            mimeType: data.mimetype,
            dir: PUBLIC_UPLOADS_DIR,
            maxBytes: MAX_AVATAR_BYTES,
        });
        if (!stored.ok) {
            return reply.code(stored.status).send({ error: stored.error });
        }

        // 3. Read the old URL first — the update below is about to overwrite
        //    it, and without it there would be no way to find the old file.
        const prev =  await prisma.user.findUnique({
            where: { id: me},
            select: { avatarUrl: true },
        });

        // 4. Point the row at the new file. Only now is the new avatar live.
        const avatarUrl = `${AVATAR_URL_PREFIX}${stored.file.filename}`;
        const user = await prisma.user.update({
            where: { id: me },
            data: { avatarUrl },
            select: { id: true, email: true, displayName: true, avatarUrl: true },
        });

        // 5. Remove the file the old URL pointed at, so the volume does not
        //    accumulate orphans.
        //
        //    The startsWith() guard matters: it means we only ever hand
        //    removeFile a name we generated ourselves. Slicing an arbitrary
        //    stored string would be handing a caller-influenced value to a
        //    filesystem call.
        if (prev?.avatarUrl?.startsWith(AVATAR_URL_PREFIX)) {
            await removeFile(PUBLIC_UPLOADS_DIR, prev.avatarUrl.slice(AVATAR_URL_PREFIX.length));
        }
        return reply.send({ user });
    });

  // ---------- DELETE /api/profile/avatar ----------
  // Remove the logged-in user's avatar. Same shape as stages 3-5 above, minus
  // the upload: read the old URL, null the column, then unlink the file.
  // A null avatar_url renders the default avatar in the UI rather than a
  // broken image, so there is nothing else to clean up.

  fastify.delete("/avatar", async (request, reply) => {
    const me = authedUserId(request);

    const prev = await prisma.user.findUnique({
      where: { id: me },
      select: { avatarUrl: true },
    });

    const user = await prisma.user.update({
      where: { id: me },
      data: { avatarUrl: null },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });

    // Best-effort, and only ever a file we wrote ourselves — same guard as
    // stage 5 above.
    if (prev?.avatarUrl?.startsWith(AVATAR_URL_PREFIX)) {
      await removeFile(PUBLIC_UPLOADS_DIR, prev.avatarUrl.slice(AVATAR_URL_PREFIX.length));
    }

    return reply.send({ user });
  });
}
