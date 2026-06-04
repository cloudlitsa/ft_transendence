import Fastify from "fastify";
import { prisma } from "./prisma.js";

const fastify = Fastify({ logger: true });

// Health endpoint, now using Prisma instead of raw pg.
// $queryRaw lets us run arbitrary SQL when we don't have a model yet.
// In stage 3+ we'll use prisma.user.findMany() etc. — typed and safer.
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
