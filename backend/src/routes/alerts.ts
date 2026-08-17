// Alerts routes: send, list, acknowledge, close.
// Mounted under /api/alerts by server.ts. ALL routes require login —
// plugin-wide preHandler, same pattern as friends.ts.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, authedUserId } from "../lib/requireAuth.js";
import { getFriendIds } from "../lib/friendships.js";
import { Prisma } from "@prisma/client";
import { broadcastToUsers } from "../lib/wsRegistry.js";

// ---------- Validation ----------
// z.enum matches the Prisma AlertType enum values exactly. Invalid types
// are rejected here with a 400 before touching the DB (which would also
// reject them — Postgres enum — but with an uglier 500).
const sendAlertSchema = z.object({
  alertType: z.enum(["need_chat", "not_okay", "reach_out"]),
  // trim BEFORE max: Zod validators run in order, so ".max(500).trim()"
  // would measure the raw string and reject a 498-char note with trailing
  // whitespace. We mean "500 characters of actual content".
  note: z.string().trim().max(500).optional(),
});

export async function alertsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAuth);

  // ---------- POST /api/alerts ----------
  // Send a check-in alert to my friends. One active alert per user:
  // if I already have one, 409 — close it first, then send a new one.
  //
  // The one-active-per-user rule is enforced by a PARTIAL UNIQUE INDEX in
  // the database (migration 20260811085441_one_active_alert_index), not by
  // a read-then-write check in application code. A findFirst-then-create
  // is raceable: two concurrent requests can both see "no active alert"
  // before either inserts. The index makes the constraint atomic.
  fastify.post("/", async (request, reply) => {
    const parsed = sendAlertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    const { alertType, note } = parsed.data;
    const me = authedUserId(request);

    try {
      const alert = await prisma.alert.create({
        data: {
          senderId: me,
          alertType,
          note, // undefined → column stays NULL, Prisma handles it
          // status defaults to "active" per the schema
        },
        select: { 
          id: true, 
          alertType: true, 
          note: true, 
          status: true, 
          createdAt: true,
          sender: { select: { id: true, displayName: true, avatarUrl: true } }, 
        },
      });

      // Tell the sender's friends in real time. Same trust boundary as the
      // GET endpoint — only accepted friends, not every connected socket.
      // Offline friends simply aren't in the registry; nothing to do.
      const friendIds = await getFriendIds(me);
      broadcastToUsers(friendIds, { type: "alert:new", alert });

      return reply.code(201).send({ alert });
    } catch (err) {
      // P2002 = unique constraint violation. With the partial index, this
      // fires only when an ACTIVE alert already exists for this sender —
      // the DB enforces atomically what findFirst-then-check could not.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.code(409).send({
          error: "You already have an active alert. Close it before sending a new one.",
        });
      }
      throw err; // anything else is a real error — let Fastify log it
    }
  });

  // ---------- GET /api/alerts ----------
  // Returns my own active alert (with acknowledgers) + my friends' active alerts.
  fastify.get("/", async (request, reply) => {
    const me = authedUserId(request);

    // 1. Who are my accepted friends? Shared helper (lib/friendships.ts) so
    //    this endpoint and the WebSocket broadcast can't drift apart on who
    //    counts as a friend.
    const friendIds = await getFriendIds(me);

    // 2. My own active alert (if any), with who has acknowledged it.
    const myAlert = await prisma.alert.findFirst({
      where: { senderId: me, status: "active" },
      select: {
        id: true,
        alertType: true,
        note: true,
        status: true,
        createdAt: true,
        acknowledgements: {
          select: {
            acknowledgedAt: true,
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    // 3. Active alerts from my friends. `in: friendIds` — if I have no
    //    friends, this is an empty array and Prisma returns nothing (correct).
    const friendsAlerts = await prisma.alert.findMany({
      where: {
        status: "active",
        senderId: { in: friendIds },
      },
      select: {
        id: true,
        alertType: true,
        note: true,
        createdAt: true,
        sender: { select: { id: true, displayName: true, avatarUrl: true } },
        // Whether *I* have already acknowledged this one — lets the UI
        // show "you've responded" vs an Acknowledge button.
        acknowledgements: {
          where: { userId: me },
          select: { acknowledgedAt: true },
        },
      },
    });

    return reply.send({ myAlert, friendsAlerts });
  });

  // ---------- Validation for :id ----------
  const idParamSchema = z.object({
    id: z.string().uuid("Invalid alert id"),
  });

  // ---------- POST /api/alerts/:id/acknowledge ----------
  // A friend marks the sender's alert "I see you". Idempotent: acknowledging
  // twice is harmless (the composite PK stops a duplicate row).
  fastify.post("/:id/acknowledge", async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid alert id" });
    }
    const { id } = parsed.data;
    const me = authedUserId(request);

    // Fetch the alert to check it exists, is active, and who sent it.
    const alert = await prisma.alert.findUnique({
      where: { id },
      select: { id: true, senderId: true, status: true },
    });

    // 404 for missing OR closed — same anti-probing pattern as friends.
    if (!alert || alert.status !== "active") {
      return reply.code(404).send({ error: "Alert not found" });
    }

    // You can't acknowledge your own alert.
    if (alert.senderId === me) {
      return reply.code(400).send({ error: "You can't acknowledge your own alert" });
    }

    // You can only acknowledge a friend's alert. Reuse the accepted-friendship
    // check: is there an accepted row pairing me and the sender?
    const [a, b] = me < alert.senderId ? [me, alert.senderId] : [alert.senderId, me];
    const friendship = await prisma.friendship.findUnique({
      where: { userIdA_userIdB: { userIdA: a, userIdB: b } },
      select: { status: true },
    });
    if (!friendship || friendship.status !== "accepted") {
      // Not their friend → same 404 as "no such alert". Don't reveal the
      // alert exists to a non-friend.
      return reply.code(404).send({ error: "Alert not found" });
    }

    // Insert the acknowledgement. If I've already acknowledged, the composite
    // PK (alertId, userId) throws P2002 — which we treat as success, because
    // the desired state ("I've acknowledged this") is already true.
    try {
      await prisma.acknowledgement.create({
        data: { alertId: id, userId: me },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return reply.send({ ok: true, alreadyAcknowledged: true });
      }
      throw err;
    }

    return reply.send({ ok: true });
  });

  // ---------- POST /api/alerts/:id/close ----------
  // "All clear" — sender only. Sets closed + timestamp.
  fastify.post("/:id/close", async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid alert id" });
    }
    const { id } = parsed.data;
    const me = authedUserId(request);

    // updateMany with the ownership + status conditions in the WHERE:
    // it only updates a row that exists, is mine, and is still active.
    // count tells us whether anything matched — one query, no race.
    const result = await prisma.alert.updateMany({
      where: { id, senderId: me, status: "active" },
      data: { status: "closed", closedAt: new Date() },
    });

    if (result.count === 0) {
      // Missing, not mine, or already closed — same 404 for all three.
      return reply.code(404).send({ error: "Alert not found" });
    }

    return reply.send({ ok: true });
  });
}
