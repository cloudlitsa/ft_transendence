// Friends routes: request, accept, decline, list, pending, remove.
// Mounted under /api/friends by server.ts. ALL routes require login —
// the plugin-wide preHandler below guards every route in this file.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../lib/requireAuth.js";

// ---------- Validation ----------
const requestSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
}); // this is the same as the schema used in the frontend, but we don't import it from there to avoid circular dependencies.
// what it does is validate that the email is a string, is a valid email address, and is no longer than 254 characters (the maximum length of an email address according to RFC 5321).

// The response we send whether or not the target account exists.
// Identical in both cases so the endpoint can't be used to probe
// which emails have accounts (same principle as login's single error).
const NEUTRAL_RESPONSE = {
  message: "If that person has an account, they'll receive your request.",
};

export async function friendsRoutes(fastify: FastifyInstance) {
  // Plugin-wide guard: every route in this file runs requireAuth first.
  fastify.addHook("preHandler", requireAuth); 

  // ---------- POST /api/friends/request ----------
  // Send a friend request to a user identified by email.
  fastify.post("/request", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    const { email } = parsed.data;
    const me = request.userId; // attached by requireAuth

    // Look up the target. If they don't exist, we still return the
    // neutral response — from outside, "no such user" and "request
    // sent" must be indistinguishable.
    const target = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!target) {
      return reply.send(NEUTRAL_RESPONSE);
    }

    // You can't befriend yourself. This IS a distinguishable error,
    // but it leaks nothing — you already know your own email exists.
    if (target.id === me) {
      return reply.code(400).send({ error: "You can't send a request to yourself" });
    }

    // Enforce the ordering convention: the smaller UUID is always
    // userIdA. String comparison of UUIDs is fine — it's the same
    // ordering the database CHECK constraint uses.
    const [userIdA, userIdB] = me < target.id ? [me, target.id] : [target.id, me];

    // Does a friendship row already exist for this pair (in any status)?
    const existing = await prisma.friendship.findUnique({
      where: { userIdA_userIdB: { userIdA, userIdB } },
    });

    if (existing) {
      // Already friends, already pending, or blocked — in every case we
      // return the SAME neutral response. Explaining which case it is
      // would leak information (e.g. "they blocked you").
      return reply.send(NEUTRAL_RESPONSE);
    }

    await prisma.friendship.create({
      data: {
        userIdA,
        userIdB,
        requestedBy: me, // who initiated — needed to tell incoming from outgoing
        // status defaults to "pending" per the schema
      },
    });

    return reply.send(NEUTRAL_RESPONSE);
  });
  // ---------- GET /api/friends ----------
  // Accepted friends only.
  fastify.get("/", async (request, reply) => {
    const me = request.userId;

    // Find every accepted row where I'm one of the two participants.
    // We include both userA and userB so we can pick "the other one".
    const rows = await prisma.friendship.findMany({
      where: {
        status: "accepted",
        OR: [{ userIdA: me }, { userIdB: me }],
      },
      select: {
        id: true,
        userIdA: true,
        userIdB: true,
        userA: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        userB: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    // For each row, pick whichever side ISN'T me — that's the friend.
    const friends = rows.map((row) => ({
      friendshipId: row.id,
      user: row.userIdA === me ? row.userB : row.userA,
    }));

    return reply.send({ friends });
  });

  // ---------- GET /api/friends/pending ----------
  // Split pending rows into incoming (I can accept) and outgoing (waiting).
  fastify.get("/pending", async (request, reply) => {
    const me = request.userId;

    const rows = await prisma.friendship.findMany({
      where: {
        status: "pending",
        OR: [{ userIdA: me }, { userIdB: me }],
      },
      select: {
        id: true,
        userIdA: true,
        userIdB: true,
        requestedBy: true,
        userA: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        userB: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    const incoming: Array<{ friendshipId: string; user: typeof rows[0]["userA"] }> = [];
    const outgoing: Array<{ friendshipId: string; user: typeof rows[0]["userA"] }> = []; 

    for (const row of rows) {
      const otherUser = row.userIdA === me ? row.userB : row.userA;
      const entry = { friendshipId: row.id, user: otherUser };

      // If I'm the requester, it's outgoing (I'm waiting for them).
      // Otherwise, it's incoming (they're waiting for me).
      if (row.requestedBy === me) {
        outgoing.push(entry);
      } else {
        incoming.push(entry);
      }
    }

    return reply.send({ incoming, outgoing });
  });
}

