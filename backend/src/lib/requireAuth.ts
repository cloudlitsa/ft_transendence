// requireAuth: a Fastify preHandler hook that guards routes behind login.
//
// Registered in a plugin with fastify.addHook("preHandler", requireAuth),
// it runs BEFORE every route handler in that plugin. If the request has a
// valid session cookie, it attaches userId to the request and lets the
// handler run. If not, it replies 401 and the handler never executes.

import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, AUTH_COOKIE } from "./auth.js";
import { prisma } from "../prisma.js";

// ---------- Module augmentation ----------
// TypeScript doesn't know we're adding a `userId` field to Fastify's request
// object. This block extends Fastify's own type definition so that
// `request.userId` type-checks everywhere. It adds NO runtime code — it's
// purely a message to the compiler.
declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  // 1. Is there a cookie at all?
  const token = request.cookies[AUTH_COOKIE];
  if (!token) {
    return reply.code(401).send({ error: "Not logged in" });
  }

  // 2. Is the token valid? (not expired, not tampered, signed by us)
  const payload = verifyToken(token);
  if (!payload) {
    reply.clearCookie(AUTH_COOKIE, { path: "/" });
    return reply.code(401).send({ error: "Session expired" });
  }

  // 3. Does the user still exist? (account could have been deleted
  //    after the token was issued — GDPR delete, for example)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true }, // we only need to know they exist
  });
  if (!user) {
    reply.clearCookie(AUTH_COOKIE, { path: "/" });
    return reply.code(401).send({ error: "Account no longer exists" });
  }

  // 4. All good. Attach the userId so handlers know who's asking.
  request.userId = user.id;
  // Note: we do NOT return anything here. In a Fastify hook, sending a
  // reply short-circuits the request; returning normally means "continue
  // to the handler".
}