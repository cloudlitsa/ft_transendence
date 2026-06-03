import Fastify from "fastify";
import pg from "pg";

const fastify = Fastify({ logger: true });

// Shared Postgres connection pool. DATABASE_URL comes from docker-compose.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Health endpoint: proves the whole chain (browser -> backend -> DB) works.
fastify.get("/api/health", async (request, reply) => {
  try {
    const result = await pool.query<{ time: Date }>("SELECT NOW() as time");
    return {
      status: "ok",
      backend: "alive",
      database: "connected",
      db_time: result.rows[0].time,
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

fastify.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`backend listening on ${address}`);
});
