// Profile routes: view a user's public profile, update your own profile.
// Mounted under /api/profile by server.ts. Every route requires login.


import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authedUserId, requireAuth } from "../lib/requireAuth.js";
import { isOnline } from "../lib/wsRegistry.js";


import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const UPLOADS_DIR = "/app/uploads";

// we choose the safe extension of files (don't use the client's filename).
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

//the same displayName rules as in signup
const updateProfileSchema = z.object({
    displayName: z
        .string()
        .min(1, "Display name is required")
        .max(50, "Display name too long")
        .trim(),
});

export async function profileRoutes(fastify:FastifyInstance) {
    //plugin-wide quard: requireAuth fisrt check before go to every route
    fastify.addHook("preHandler", requireAuth);

    fastify.patch("/", async (request, reply) =>{
        const parsed = updateProfileSchema.safeParse(request.body);
        if (!parsed.success){
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

    fastify.get("/:id", async (request, reply) => {
        const params = z
            .object({ id: z.string().uuid()})
            .safeParse(request.params);
        if (!params.success){
            return reply.code(404).send({ error: "User not found"});
        }

        const user = await prisma.user.findUnique({
            where: { id: params.data.id },
            //ONLY public fields (no passwordHash, no email)
            select: {id: true, displayName: true, avatarUrl: true },
        });
        if (!user ){
            return reply.code(404).send({ error: "User not found " });
        }
        // not stored, it is online from WebSocket registry
        return reply.send({ user: { ...user, online: isOnline(user.id) } });
    });

    //upload a new avatar for the logged-in user
    fastify.post("/avatar", async (request, reply) => {
        const me = authedUserId(request);

        const data = await request.file(); // provided by @fastify/multipart
        if (!data){
            return reply.code(400).send({ error: "No file uploaded "});
        }
        //1. validate type SERVER-SIDE 
        const ext = ALLOWED_TYPES.get(data.mimetype);
        if (!ext){
            return reply
            .code(415)
            .send({error: "Unsupported file type. Use jpeg, png, or webp"});
        }
        //2. generate filename 
        const filename = `${randomUUID()}.${ext}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        //3. upload to disk
        try{
            await pipeline(data.file, createWriteStream(filepath));
        } catch {
            await unlink(filepath).catch(() => {})
            return reply.code(413).send({ error: "File too large (max 2MB)"});
        }
        //if 2MB limit was hit in the middle of stream
        if (data.file.truncated) {
            await unlink(filepath).catch(() => {})
            return reply.code(413).send({ error: "File too large (max 2MB)"});
        }
        //4. save old avatar (to be deleted later)
        const prev =  await prisma.user.findUnique({
            where: { id: me},
            select: { avatarUrl: true },
        });
        // 5. save new URL path to the Db
        const avatarUrl = `/api/uploads/${filename}`;
        const user = await prisma.user.update({
            where: { id: me },
            data: { avatarUrl },
            select: { id: true, email: true, displayName: true, avatarUrl: true },
        });
        //6. clean up
        if (prev?.avatarUrl?.startsWith("/api/uploads/")) {
            const oldName = prev.avatarUrl.slice("/api/uploads/".length);
        await unlink(path.join(UPLOADS_DIR, oldName)).catch(() => {});
        }
        return reply.send({ user });
    });
  // Remove the logged-in user's avatar (falls back to the default in the UI).
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

    // Delete the file from disk (best-effort, only our own files).
    if (prev?.avatarUrl?.startsWith("/api/uploads/")) {
      const oldName = prev.avatarUrl.slice("/api/uploads/".length);
      await unlink(path.join(UPLOADS_DIR, oldName)).catch(() => {});
    }

    return reply.send({ user });
  });
}