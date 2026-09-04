// Chat attachments. Mounted under /api/attachments by server.ts:
//
//     GET    /api/attachments/:id    stream the file
//     DELETE /api/attachments/:id    the sender removes their own attachment
//
// These two routes are the ONLY way to reach an attachment. The files live in
// /app/private, which no static handler serves, so unlike an avatar there is
// no second URL that bypasses the check below. That is the whole point of the
// directory split — see lib/fileStorage.ts.
//
// The audience is the same as the conversation the attachment sits in: an
// attachment is not a resource of its own, it belongs to a message, which
// belongs to an alert. So the gate is canAccessAlert, exactly as for the
// message text itself.

import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, authedUserId } from "../lib/requireAuth.js";
import { canAccessAlert } from "../lib/alertAccess.js";
import { getFriendIds } from "../lib/friendships.js";
import { broadcastToUsers } from "../lib/wsRegistry.js";
import { ATTACHMENTS_DIR, removeFile } from "../lib/fileStorage.js";

const idParamSchema = z.object({
  id: z.string().uuid("Invalid attachment id"),
});


// ---------- Loading an attachment with its context ----------
// One query, because neither route can decide anything without the message it
// hangs off: GET needs the alert id to run the access check, and DELETE also
// needs the message's author to check ownership.

async function loadAttachment(id: string) {
  return prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
      deletedAt: true,
      message: { select: { alertId: true, senderId: true } },
    },
  });
}


// ---------- Content-Disposition ----------
// `inline` so an <img> renders the image rather than downloading it, plus the
// original filename for anyone who does choose "save as".
//
// The filename came from the client, so it goes out twice: a stripped ASCII
// version for old clients, and the RFC 5987 encoded form that modern browsers
// prefer. Without the encoding, a name with a quote or a non-ASCII character
// could break out of the header value.

function contentDisposition(originalName: string): string {
  const ascii = originalName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;
}


export async function attachmentsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAuth);

  // ---------- GET /api/attachments/:id ----------
  // Five gates before a byte is sent:
  //
  //     1. is :id a uuid?                     404
  //     2. does the attachment exist?         404
  //     3. may this user see the alert?       404   <- the real gate
  //     4. has the sender removed it?         410
  //     5. is the file actually on disk?      404
  //
  // The first three all answer 404, and identically, so a caller cannot tell
  // a malformed id from a stranger's attachment.

  fastify.get("/:id", async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(404).send({ error: "Attachment not found" });
    }

    const me = authedUserId(request);
    const attachment = await loadAttachment(parsed.data.id);
    if (!attachment) {
      return reply.code(404).send({ error: "Attachment not found" });
    }

    if ((await canAccessAlert(attachment.message.alertId, me)) === null) {
      return reply.code(404).send({ error: "Attachment not found" });
    }

    // 410 Gone, not 404. The caller can already see this attachment exists —
    // it comes back in the message payload with deletedAt set — so there is
    // nothing to hide, and 410 lets the UI tell "removed" from "broken".
    if (attachment.deletedAt) {
      return reply.code(410).send({ error: "Attachment removed" });
    }

    // A row with no file means an earlier cleanup half-finished. Log it,
    // because it should not happen, and answer 404 rather than hanging on a
    // read stream that will immediately error.
    const filepath = path.join(ATTACHMENTS_DIR, attachment.filename);
    let stats;
    try {
      stats = await stat(filepath);
    } catch {
      request.log.error({ attachmentId: attachment.id }, "attachment row has no file on disk");
      return reply.code(404).send({ error: "Attachment not found" });
    }

    // Content-Type is the mimetype recorded at upload, which storeFile had
    // already checked against the file's own bytes — so it is not a client
    // claim being echoed back.
    //
    // nosniff stops a browser from second-guessing that type and treating the
    // response as something executable.
    //
    // Cache-Control is `private`, never `public`: this file is behind an
    // access check, and a shared cache holding a copy would undo it.
    return reply
      .header("Content-Type", attachment.mimeType)
      .header("Content-Length", stats.size)
      .header("Content-Disposition", contentDisposition(attachment.originalName))
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "private, max-age=3600")
      .send(createReadStream(filepath));
  });


  // ---------- DELETE /api/attachments/:id ----------
  // The sender un-shares an image they regret. Message text stays immutable;
  // only the attachment can go.
  //
  // "Sender" means the author of the MESSAGE, not the sender of the alert —
  // a friend who posted a photo into someone else's check-in owns that photo.
  //
  // A soft delete: the row survives with deletedAt set, so the bubble can
  // render a "removed" placeholder. Deleting the row outright would make the
  // message indistinguishable from one that never had an attachment, and the
  // conversation would quietly rewrite itself.

  fastify.delete("/:id", async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(404).send({ error: "Attachment not found" });
    }

    const me = authedUserId(request);
    const attachment = await loadAttachment(parsed.data.id);
    if (!attachment) {
      return reply.code(404).send({ error: "Attachment not found" });
    }

    const alertSenderId = await canAccessAlert(attachment.message.alertId, me);
    if (alertSenderId === null) {
      return reply.code(404).send({ error: "Attachment not found" });
    }

    if (attachment.message.senderId !== me) {
      return reply.code(403).send({ error: "Only the sender can remove this attachment" });
    }

    if (attachment.deletedAt) {
      return reply.send({ ok: true, alreadyRemoved: true });
    }

    // Database first, then the file — the reverse of the upload path, and for
    // the same reason.
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { deletedAt: new Date() },
    });
    await removeFile(ATTACHMENTS_DIR, attachment.filename);

    // Push the removal to everyone with this conversation open, so the image
    // disappears from their screen rather than lingering until they refresh.
    // Un-sharing that only takes effect on reload would miss the moment the
    // feature exists for.
    //
    // Unlike message:new, `me` is NOT filtered out: the deleter may have the
    // same conversation open on another device, and those screens need the
    // update too.
    try {
      const friendIds = await getFriendIds(alertSenderId);
      broadcastToUsers([alertSenderId, ...friendIds], {
        type: "attachment:deleted",
        attachment: { id: attachment.id, alertId: attachment.message.alertId },
      });
    } catch (err) {
      // Best-effort: the delete is already committed and a later GET returns
      // 410 either way.
      request.log.error({ err }, "failed to broadcast attachment:deleted");
    }

    return reply.send({ ok: true });
  });
}
