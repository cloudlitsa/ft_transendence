// Auth routes: signup, login, logout, me.
// Mounted under /api/auth by server.ts.

import type { FastifyInstance } from "fastify"; // for type checking not code execution
import bcrypt from "bcryptjs"; // bcryptjs is pure JS, works in Node 18+ without native modules
import { z } from "zod";
import { prisma } from "../prisma.js";
import { signToken, AUTH_COOKIE, cookieOptions } from "../lib/auth.js";
import { requireAuth, authedUserId } from "../lib/requireAuth.js";

// ---------- Validation schemas (Zod) ----------
// These define what a VALID request body looks like. Anything that doesn't
// match is rejected before our logic runs. Never trust client input.

const signupSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password too long"), // bcrypt ignores input beyond 72 bytes
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(50, "Display name too long")
    .trim(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(72),
});

// bcrypt cost factor: 12 is the current sensible default. Higher = slower
// for attackers but also for your own logins. 12 ≈ 250ms per hash.
const BCRYPT_ROUNDS = 12;

export async function authRoutes(fastify: FastifyInstance) {
  // ---------- POST /api/auth/signup ----------
  fastify.post("/signup", async (request, reply) => {
    // 1. Validate input shape.
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { email, password, displayName } = parsed.data;

    // 2. Reject duplicate emails with a clear message.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    // 3. Hash the password. NEVER store the plain text.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 4. Create the user.
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName },
      select: { id: true, email: true, displayName: true, createdAt: true },
      // select limits what comes back — passwordHash never leaves the DB layer
    });

    // 5. Issue a JWT in an httpOnly cookie. The user is now logged in.
    const token = signToken({ userId: user.id });
    reply.setCookie(AUTH_COOKIE, token, cookieOptions);

    return reply.code(201).send({ user });
  });

  // ---------- POST /api/auth/login ----------
  fastify.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // SECURITY: same error for "no such user" and "wrong password".
    // Different errors would let an attacker probe which emails have accounts.
    if (!user) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const token = signToken({ userId: user.id });
    reply.setCookie(AUTH_COOKIE, token, cookieOptions);

    return reply.send({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  });

  // ---------- POST /api/auth/logout ----------
  fastify.post("/logout", async (_request, reply) => {
    // Clearing the cookie logs the user out. The token itself remains valid
    // until expiry (stateless JWTs can't be revoked without a denylist), but
    // the browser no longer has it.
    reply.clearCookie(AUTH_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });

  // ---------- GET /api/auth/me ----------
  // "Who am I?" — guarded by requireAuth, which handles all the 401 cases
  // and attaches request.userId.
  fastify.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: authedUserId(request) },
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });

    // requireAuth already confirmed the user exists, but between that check
    // and this query the account could theoretically be deleted. Handle it.
    if (!user) {
      reply.clearCookie(AUTH_COOKIE, { path: "/" });
      return reply.code(401).send({ error: "Account no longer exists" });
    }

    return reply.send({ user });
  });
}
