// Chat messages on an alert. Mounted under /api/alerts by server.ts.
// A message belongs to one alert; the audience is everyone who can see
// that alert (sender + accepted friends). Messages are immutable — no
// PATCH, no DELETE. Closed alerts still accept messages by design.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, authedUserId } from "../lib/requireAuth.js";
import { getFriendIds } from "../lib/friendships.js";
import { broadcastToUsers } from "../lib/wsRegistry.js";

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

// ---------- Validation ----------
const idParamSchema = z.object({
  id: z.string().uuid("Invalid alert id"),
});

const sendMessageSchema = z.object({
  // trim BEFORE min/max — same order bug that was fixed in alerts.ts.
  content: z.string().trim().min(1).max(2000),
});

export async function messagesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAuth);

  // ---------- POST /api/alerts/:id/messages ----------
  fastify.post("/:id/messages", async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params);

    if (!parsedParams.success) {
        return reply.code(400).send({ error: "Invalid alert id" });
    }

    const parsedBody = sendMessageSchema.safeParse(request.body);
    if (!parsedBody.success) {
        return reply.code(400).send({ error: "Invalid input" });
    }

    const { id } = parsedParams.data;
    const { content } = parsedBody.data;
    const me = authedUserId(request);

    const senderId = await canAccessAlert(id, me);
    if (senderId === null) {
        return reply.code(404).send({ error: "Alert not found" });
    }

    const message = await prisma.message.create({
      data: { alertId: id, senderId: me, content },
      select: {
        id: true,
        alertId: true,
        content: true,
        createdAt: true,
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Real-time: push to everyone on this alert's conversation except the
    // poster. The audience is the same trust boundary as canAccessAlert —
    // the alert's sender plus the sender's accepted friends — so anyone who
    // can read the thread gets the live update. `me` is removed because they
    // already have this message in the POST response; re-sending would show
    // it twice in their own UI. Best-effort: a socket failure must not fail
    // the request — the message is already committed and a later GET returns it.
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
        select: {
        id: true,
        alertId: true,
        content: true,
        createdAt: true,
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        },
    });

    return reply.send({ messages });
  });
}
