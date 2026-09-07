import type { FastifyInstance } from "fastify";
import { requireAuth, authedUserId } from "../lib/requireAuth.js";
import { prisma } from "../prisma.js";
import { AUTH_COOKIE } from "../lib/auth.js";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sendMail } from "../lib/mail.js";
import { ATTACHMENTS_DIR, PUBLIC_UPLOADS_DIR, removeFile } from "../lib/fileStorage.js";
import { AVATAR_URL_PREFIX } from "./profile.js";


export async function gdprRoutes(fastify: FastifyInstance) {
  // Every route in this file requires the user to be logged in.
  fastify.addHook("preHandler", requireAuth);

  fastify.get("/export", async (request, reply) => {
    const me = authedUserId(request);
    const user = await prisma.user.findUnique({
      where: {id: me},
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const friendships =  await prisma.friendship.findMany({
      where: {OR: [{userIdA: me}, {userIdB: me}]},
    })

    const alerts = await prisma.alert.findMany({ where: { senderId: me } });
    const acknowledgements = await prisma.acknowledgement.findMany({ where: { userId: me } });
    const messages = await prisma.message.findMany({ where: { senderId: me } });
    // Everything except `filename` — that's the internal <uuid>.<ext> on disk, not something the user uploaded or would recognise.
    const attachments = await prisma.attachment.findMany({
      where: { message: { senderId: me } },
      omit: { filename: true },
    });

    const payload = { exportedAt: new Date().toISOString(), user, friendships, alerts, acknowledgements, messages, attachments };
    
    // Confirmation email for the export (fire-and-forget: never block the export).
    if (user) {
      sendMail(
        user.email,
        "Your data export is ready",
        `Hi ${user.displayName},\n\nYou requested a copy of your data and it was exported successfully.\n\n— Check-in`,
      ).catch((err) => request.log.error({ err }, "export email failed"));
    }
    return reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", 'attachment; filename="my-data.json"')
      .send(JSON.stringify(payload, null, 2));
  });

  const confirmSchema = z.object({
    password: z.string().min(1, "Password is required to confirm deletion"),
  });

  fastify.delete("/", async (request, reply) => {
    // 1. validate the body — must contain a password
    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Password required to confirm deletion" });
    }

    const me = authedUserId(request);

    // 2. fetch the stored hash (the ONE place we read passwordHash)
    const user = await prisma.user.findUnique({
      where: { id: me },
      select: { passwordHash: true, email: true, displayName: true, avatarUrl: true },
    });
    if (!user) {
      return reply.code(404).send({ error: "Account not found" });
    }

    // 3. compare typed password against stored hash — SAME check as login
    const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!passwordOk) {
      return reply.code(403).send({ error: "Incorrect password" });
    }
    // 4. collect all the attachments that will be deleted (for cleanup after the DB delete)
    const doomed = await prisma.attachment.findMany({
      where: {
        deletedAt: null,
        message: { OR: [{ senderId: me }, { alert: { senderId: me } }] },
      },
      select: { filename: true },
    });
    // 5. confirmed — delete (cascade wipes everything)
    await prisma.user.delete({ where: { id: me } });
    reply.clearCookie(AUTH_COOKIE, { path: "/" });

    for (const { filename } of doomed) {
      await removeFile(ATTACHMENTS_DIR, filename).catch((err) =>
        request.log.error({ err, filename }, "attachment file left behind"),
      );
    }
    if (user.avatarUrl?.startsWith(AVATAR_URL_PREFIX)) {
      await removeFile(
        PUBLIC_UPLOADS_DIR,
        user.avatarUrl.slice(AVATAR_URL_PREFIX.length),
      ).catch((err) => request.log.error({ err }, "avatar file left behind"));
    }
    // Confirmation email for the deletion (user captured above, before delete).
    sendMail(
      user.email,
      "Your account has been deleted",
      `Hi ${user.displayName},\n\nYour account and all associated data have been permanently deleted.\n\n— Check-in`,
    ).catch((err) => request.log.error({ err }, "deletion email failed"));
    return reply.send({ ok: true });
  });
}
