import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { prisma } from "./prisma.js";
import { authRoutes } from "./routes/auth.js";
import { friendsRoutes } from "./routes/friends.js";
import { alertsRoutes } from "./routes/alerts.js";

const fastify = Fastify({ logger: true });

// Cookie support — needed to set/read the httpOnly auth cookie.
await fastify.register(cookie);

// Auth endpoints live under /api/auth/*
await fastify.register(authRoutes, { prefix: "/api/auth" });

// Friends endpoints live under /api/friends/*
await fastify.register(friendsRoutes, { prefix: "/api/friends" });

// Alerts endpoints live under /api/alerts/*
await fastify.register(alertsRoutes, { prefix: "/api/alerts" });

// Health endpoint: proves the whole chain (browser -> backend -> DB) works.
fastify.get("/api/health", async (request, reply) => {
  try {
    const result = await prisma.$queryRaw<{ time: Date }[]>`SELECT NOW() as time`;
    return {
      status: "ok",
      backend: "alive",
      database: "connected",
      orm: "prisma",
      db_time: result[0].time,
    };
  } catch (err) {
    request.log.error(err);
    reply.code(500);
    return {
      status: "error",
      backend: "alive",
      database: "unreachable",
      detail: (err as Error).message,
    };
  }
});

const port = Number(process.env.PORT) || 3000;

// Graceful shutdown: close DB connections cleanly when the container stops.
const shutdown = async () => {
  await prisma.$disconnect();
  await fastify.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

fastify.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`backend listening on ${address}`);
});
