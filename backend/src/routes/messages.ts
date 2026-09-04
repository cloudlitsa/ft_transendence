// Chat messages on an alert. Mounted under /api/alerts by server.ts, so the
// two routes below are really:
//
//     POST /api/alerts/:id/messages    send a message, optionally with an image
//     GET  /api/alerts/:id/messages    read the whole conversation
//
// A message belongs to one alert and has NO recipient field. Its audience is
// everyone who can see that alert — the sender, plus the sender's accepted
// friends. Chat is one group conversation, not a set of per-friend threads.
//
// Message text is immutable: no PATCH, no DELETE. An attachment is a separate
// resource and its sender may delete it. Closed alerts still accept messages,
// by design — status describes the alert, not the conversation.
//
// POST takes two body shapes on one endpoint:
//
//     Content-Type: application/json       { "content": "..." }
//     Content-Type: multipart/form-data    content + one optional file
//
// One endpoint rather than two, so a message and its attachment commit in the
// same transaction. A separate upload endpoint would leave a window where an
// uploaded file belongs to no message yet, and would need a cleanup job for
// the uploads that never got claimed.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, authedUserId } from "../lib/requireAuth.js";
import { getFriendIds } from "../lib/friendships.js";
import { broadcastToUsers } from "../lib/wsRegistry.js";
import {
  ATTACHMENTS_DIR,
  MAX_ATTACHMENT_BYTES,
  removeFile,
  safeOriginalName,
  storeFile,
  type StoredFile,
} from "../lib/fileStorage.js";


// ---------- Access check (shared by both routes) ----------

// The alert must exist, and `me` must be the sender OR an accepted friend
// of the sender. Status is deliberately NOT checked. Returns the sender's
// id on success; null means "refuse with 404".

async function canAccessAlert(alertId: string, me: string): Promise<string | null> {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    select: { senderId: true },
  });
  if (!alert) return null;

  if (alert.senderId === me) return alert.senderId;

  const [a, b] = me < alert.senderId ? [me, alert.senderId] : [alert.senderId, me];
  const friendship = await prisma.friendship.findUnique({
    where: { userIdA_userIdB: { userIdA: a, userIdB: b } },
    select: { status: true },
  });
  if (!friendship || friendship.status !== "accepted") return null;

  return alert.senderId;
}


// ---------- Input validation ----------
// Zod runs before anything else touches the data, so no code further down has
// to wonder whether `id` is really a uuid or `content` is really a non-empty
// string. `safeParse` returns a result object instead of throwing.

const idParamSchema = z.object({
  id: z.string().uuid("Invalid alert id"),
});

const sendMessageSchema = z.object({
  // trim BEFORE min/max — checks run in order, so ".max(2000).trim()" would
  // measure the untrimmed string. Same order bug that was fixed in alerts.ts.
  //
  // min(1) still holds now that attachments exist: an image always rides
  // alongside a caption, never instead of one, so there is no empty-message
  // case to handle anywhere downstream.
  content: z.string().trim().min(1).max(2000),
});


// ---------- Shared shape of a message in responses ----------
// POST, GET and the WebSocket broadcast all select through this one object,
// so all three return an identical shape. Previously each route wrote its own
// select and adding a field meant remembering every copy.
//
// `filename` is deliberately absent from the attachment select. It addresses
// the file on disk and never leaves the backend; clients refer to an
// attachment by id and fetch it through GET /api/attachments/:id, which runs
// its own access check. Same discipline as never selecting passwordHash.
//
// `satisfies` type-checks this against Prisma.MessageSelect while keeping the
// exact literal types, so Prisma can still infer the precise return shape. A
// plain `: Prisma.MessageSelect` annotation would widen it and lose that.

const messageSelect = {
  id: true,
  alertId: true,
  content: true,
  createdAt: true,
  sender: { select: { id: true, displayName: true, avatarUrl: true } },
  attachments: {
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      // Non-null means the sender removed it; the bubble renders a
      // "removed" placeholder rather than dropping it from the record.
      deletedAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.MessageSelect;


// ---------- Reading a multipart body ----------
// JSON cannot carry binary, so a message with an image arrives as
// multipart/form-data: several named parts in one body.
//
//     name="content"    the caption — a plain text field
//     name="file"       the image — with its own filename and Content-Type
//
// Both of those come from the client, which is why the filename is sanitised
// on the way in and the content type is later checked against the file's own
// bytes.
//
// Returns a result object rather than throwing, so the route can map each
// failure to its own status code: 413 for the size limit, 400 for anything
// else that went wrong while parsing.

type Upload = { buffer: Buffer; mimeType: string; originalName: string };

type MultipartResult =
  | { ok: true; content: string | undefined; upload: Upload | null }
  | { ok: false; status: 400 | 413; error: string };

const TOO_LARGE = `File too large (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB)`;

async function readMultipartBody(request: FastifyRequest): Promise<MultipartResult> {
  let content: string | undefined;
  let upload: Upload | null = null;

  try {
    // Limits passed here apply to THIS request only. server.ts registers
    // @fastify/multipart with a 2MB cap that suits avatars; raising it there
    // would raise it for every upload in the app, so chat sets its own
    // ceiling locally instead.
    const parts = request.parts({
      limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 5 },
    });

    // The body is a stream and the parts arrive in order, so this loop reads
    // them one at a time rather than all at once.
    for await (const part of parts) {
      if (part.type === "file") {
        if (part.fieldname !== "file" || upload !== null) {
          // Not a part we want. It still has to be read to the end: skip a
          // file part without consuming it and the parser never reaches the
          // end of the body, so the request hangs.
          await part.toBuffer();
          continue;
        }
        const buffer = await part.toBuffer();
        upload = {
          buffer,
          mimeType: part.mimetype,
          originalName: safeOriginalName(part.filename),
        };
      } else if (part.fieldname === "content") {
        content = String(part.value);
      }
    }
  } catch (err) {
    // The only client error we can name precisely is the size limit; a body
    // that fails to parse for any other reason is still the client's fault,
    // so it gets a 400 rather than bubbling up as a 500.
    if ((err as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      return { ok: false, status: 413, error: TOO_LARGE };
    }
    request.log.warn({ err }, "failed to parse multipart message body");
    return { ok: false, status: 400, error: "Invalid input" };
  }

  return { ok: true, content, upload };
}


export async function messagesRoutes(fastify: FastifyInstance) {
  // Plugin-wide guard: every route below requires a logged-in user. The hook
  // is scoped to this plugin, so it does not affect anything registered
  // elsewhere in server.ts.
  fastify.addHook("preHandler", requireAuth);

  // ---------- POST /api/alerts/:id/messages ----------
  // Six stages, in this order. Each one can refuse, and the ORDER is the
  // design — not an accident of how it was written:
  //
  //     1. is :id a uuid?                    400
  //     2. may this user post here?          404   <- before the body is read
  //     3. read and validate the body        400 / 413
  //     4. validate and store the file       400 / 413 / 415
  //     5. commit message + attachment       one transaction
  //     6. broadcast, then reply             201
  //
  fastify.post("/:id/messages", async (request, reply) => {
    // 1. The id has to be a uuid before it is worth a database round trip.
    const parsedParams = idParamSchema.safeParse(request.params);

    if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid alert id" });
    }

    const { id } = parsedParams.data;
    const me = authedUserId(request);

    // 2. Access check BEFORE the body is read. Someone with no business in
    //    this conversation should not get to stream 5MB at us, and should
    //    never have a file written to disk on their behalf. Refusing here
    //    costs one indexed query.
    const senderId = await canAccessAlert(id, me);
    if (senderId === null) {
        return reply.code(404).send({ error: "Alert not found" });
    }

    // 3. Branch on the body shape. Both paths end with the same two values,
    //    so everything below this point is shared. The JSON path is
    //    unchanged from before attachments existed.
    let content: string;
    let upload: Upload | null = null;

    if (request.isMultipart()) {
      const body = await readMultipartBody(request);
      if (!body.ok) {
        return reply.code(body.status).send({ error: body.error });
      }
      const parsed = sendMessageSchema.safeParse({ content: body.content });
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid input" });
      }
      content = parsed.data.content;
      upload = body.upload;
    } else {
      const parsed = sendMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid input" });
      }
      content = parsed.data.content;
    }

    // 4. The file goes to disk BEFORE the transaction opens.
    //
    //    Disk and database cannot share a transaction, so a crash between
    //    them always leaves the two disagreeing. The only choice is which
    //    disagreement to have:
    //
    //      db first  -> a committed row pointing at a missing file. Visible
    //                   as a permanently broken image, and unfixable: a
    //                   commit cannot be undone.
    //      disk first -> a file nothing references. Invisible, and deletable
    //                   in the catch below.
    let stored: StoredFile | null = null;
    if (upload) {
      const result = await storeFile({
        buffer: upload.buffer,
        mimeType: upload.mimeType,
        dir: ATTACHMENTS_DIR,
        maxBytes: MAX_ATTACHMENT_BYTES,
      });
      if (!result.ok) {
        return reply.code(result.status).send({ error: result.error });
      }
      stored = result.file;
    }

    // 5. One transaction: the message and its attachment commit together or
    //    not at all. If the attachment insert failed on its own, the message
    //    would still post — and nobody reading the thread could tell "the
    //    image failed" from "there was no image".
    //
    //    Everything inside uses `tx`, not `prisma`. A query on the outer
    //    client would run outside the transaction and survive a rollback.
    let message;
    try {
      message = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: { alertId: id, senderId: me, content },
          select: { id: true },
        });

        if (stored && upload) {
          await tx.attachment.create({
            data: {
              messageId: created.id,
              filename: stored.filename,
              originalName: upload.originalName,
              mimeType: stored.mimeType,
              size: stored.size,
            },
          });
        }

        // Re-read inside the transaction, so the response is exactly what
        // was committed — attachments included.
        return tx.message.findUniqueOrThrow({
          where: { id: created.id },
          select: messageSelect,
        });
      });
    } catch (err) {
      // Nothing committed, so the file on disk is now an orphan. Remove it,
      // then let the error surface as a 500 — this is a server fault, not a
      // client one.
      if (stored) await removeFile(ATTACHMENTS_DIR, stored.filename);
      throw err;
    }

    // 6. Real-time delivery. The audience is the same trust boundary as
    //    canAccessAlert — the alert's sender plus the sender's accepted
    //    friends — so anyone who can read the thread gets the live update.
    //
    //    `me` is filtered out because they already have this message in the
    //    201 response below; re-sending would show it twice in their own UI.
    //
    //    Best-effort on purpose: the message is already committed, so a
    //    socket failure must not fail the request. A later GET returns it
    //    either way.
    try {
      const friendIds = await getFriendIds(senderId);
      const recipients = [senderId, ...friendIds].filter((uid) => uid !== me);
      broadcastToUsers(recipients, { type: "message:new", message });
    } catch (err) {
      request.log.error({ err }, "failed to broadcast message:new");
    }

    return reply.code(201).send({ message });
  });


  // ---------- GET /api/alerts/:id/messages ----------
  // The same two gates as POST — valid id, then access — and then the whole
  // conversation, oldest first. No pagination yet: a check-in thread is short
  // by nature. The (alert_id, created_at) index on messages is what makes
  // this ordering cheap.

  fastify.get("/:id/messages", async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params);
    if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid alert id" });
    }

    const { id } = parsedParams.data;
    const me = authedUserId(request);

    const senderId = await canAccessAlert(id, me);
    if (senderId === null) {
        return reply.code(404).send({ error: "Alert not found" });
    }

    const messages = await prisma.message.findMany({
        where: { alertId: id },
        orderBy: { createdAt: "asc" },
        select: messageSelect,
    });

    return reply.send({ messages });
  });
}
