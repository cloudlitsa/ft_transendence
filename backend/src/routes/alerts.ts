// Alerts routes: send, list, acknowledge, close.
// Mounted under /api/alerts by server.ts. ALL routes require login —
// plugin-wide preHandler, same pattern as friends.ts.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth, authedUserId } from "../lib/requireAuth.js";

// ---------- Validation ----------
// z.enum matches the Prisma AlertType enum values exactly. Invalid types
// are rejected here with a 400 before touching the DB (which would also
// reject them — Postgres enum — but with an uglier 500).
const sendAlertSchema = z.object({
  alertType: z.enum(["need_chat", "not_okay", "reach_out"]),
  note: z.string().max(500).trim().optional(),
});

export async function alertsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAuth);

  
  // ---------- POST /api/alerts ----------
  // Send a check-in alert to my friends. One active alert per user:
  // if I already have one, 409 — close it first, then send a new one.
  fastify.post("/", async (request, reply) => {
    const parsed = sendAlertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    const { alertType, note } = parsed.data;
    const me = authedUserId(request);

    // One-active-per-user check. findFirst, not findUnique — "sender +
    // status" isn't a unique key, we just want to know if any exists.
    const existing = await prisma.alert.findFirst({
      where: { senderId: me, status: "active" },
      select: { id: true },
    });
    if (existing) {
      return reply.code(409).send({
        error: "You already have an active alert. Close it before sending a new one.",
      });
    }

    const alert = await prisma.alert.create({
      data: {
        senderId: me,
        alertType,
        note, // undefined → column stays NULL, Prisma handles it
        // status defaults to "active" per the schema
      },
      select: { id: true, alertType: true, note: true, status: true, createdAt: true },
    });

    return reply.code(201).send({ alert });
  });
}