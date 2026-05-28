import Fastify from "fastify";
import pg from "pg";

const fastify = Fastify({ logger: true });

// One shared connection pool to Postgres.
// DATABASE_URL is injected by docker-compose from the .env file.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Simple endpoint the frontend calls to prove the whole chain works:
// browser -> backend -> database -> back again.
fastify.get("/api/health", async (request, reply) => {
  try {
    // ask the database for the current time. if this works,
    // the backend can reach the DB.
    const result = await pool.query("SELECT NOW() as time");
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
      detail: err.message,
    };
  }
});

const port = process.env.PORT || 3000;

// listen on 0.0.0.0 (not localhost) so the container is reachable
// from other containers and the host.
fastify.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`backend listening on ${address}`);
});
