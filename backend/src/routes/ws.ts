// WebSocket endpoint: GET /api/ws (upgraded to a socket connection).
// Mounted by server.ts. Auth happens in preValidation — BEFORE the
// upgrade completes — so an unauthenticated client never gets a socket.
import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { addClient, removeClient, broadcastToUsers } from "../lib/wsRegistry.js";
import { AUTH_COOKIE, verifyToken } from "../lib/auth.js";
import { prisma } from "../prisma.js";
import { getFriendIds } from "../lib/friendships.js";


const HEARTBEAT_MS = 30_000;

export async function wsRoutes(fastify: FastifyInstance) {
  await fastify.register(websocket);

  fastify.get(
    "/",
    {
      // preValidation, NOT preHandler: for websocket routes the handshake
      // is tied to this phase — replying with 401 here refuses the upgrade
      // cleanly. A preHandler would be too late.
      preValidation: async (request, reply) => {
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
      },
      websocket: true,
    },
    (socket, request) => {
      // By the time we're here, preValidation passed: userId is set.
      const userId = request.userId as string;

      const wasOffline = addClient(userId, socket);
      if (wasOffline) {
        getFriendIds(userId)
          .then((ids) => broadcastToUsers(ids, { type: "presence", userId, online: true }))
          .catch((err) => request.log.error({ err }, "presence broadcast failed"));
      }
      request.log.info({ userId }, "ws connected");
      // ---- Heartbeat: detecting dead connections ----
      // TCP doesn't tell you when the other end vanishes (laptop lid closed,
      // wifi dropped). Without this, dead sockets pile up in the registry and
      // the user looks online forever. The ws library answers "ping" with
      // "pong" automatically at the protocol level — so: mark the socket
      // not-alive, ping it, and if no pong arrived by the next sweep, it's dead.
      let alive = true;
      socket.on("pong", () => { alive = true; });

      const heartbeat = setInterval(() => {
        if (!alive) {
          socket.terminate(); // hard-close; fires "close" below, cleaning up
          return;
        }
        alive = false;
        socket.ping();
      }, HEARTBEAT_MS);

      // ---- Graceful disconnection (subject requirement, verbatim) ----
      socket.on("close", () => {
        clearInterval(heartbeat);
        const nowOffline = removeClient(userId, socket);
        if (nowOffline) {
          getFriendIds(userId)
            .then((ids) => broadcastToUsers(ids, { type: "presence", userId, online: false }))
            .catch((err) => request.log.error({ err }, "presence broadcast failed"));
        }
        request.log.info({ userId }, "ws disconnected");
      });
      
      socket.on("error", (err: Error) => {
        request.log.error({ err }, "websocket error");
        socket.close();                  // triggers "close" → cleanup runs once
      });

      // A hello confirms the pipe works end-to-end — useful for verification
      // now, harmless later.
      socket.send(JSON.stringify({ type: "connected" }));
    }
  );
}