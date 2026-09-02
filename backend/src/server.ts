import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { prisma } from "./prisma.js";
import { authRoutes } from "./routes/auth.js";
import { friendsRoutes } from "./routes/friends.js";
import { alertsRoutes } from "./routes/alerts.js";
import { messagesRoutes } from "./routes/messages.js";
import { gdprRoutes } from "./routes/gdpr.js";
import { wsRoutes } from "./routes/ws.js";
import { profileRoutes } from "./routes/profile.js";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import oauthPlugin from "@fastify/oauth2";

const fastify = Fastify({ logger: true });

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
  throw new Error("Google OAuth env vars are not set. Check .env against .env.example.");
}

// Cookie support — needed to set/read the httpOnly auth cookie.
await fastify.register(cookie);

const UPLOAD_DIR = "/app/uploads";
//multipart lets Fastify parse file uploads (handle binary).
await fastify.register(multipart, {
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});
await fastify.register(fastifyStatic, {
  root: UPLOAD_DIR,
  prefix: "/api/uploads/",
});

// Auth endpoints live under /api/auth/*
await fastify.register(authRoutes, { prefix: "/api/auth" });

// Friends endpoints live under /api/friends/*
await fastify.register(friendsRoutes, { prefix: "/api/friends" });

// Alerts endpoints live under /api/alerts/*
await fastify.register(alertsRoutes, { prefix: "/api/alerts" });
await fastify.register(messagesRoutes, { prefix: "/api/alerts" });
await fastify.register(gdprRoutes, { prefix: "/api/account" });

await fastify.register(wsRoutes, { prefix: "/api/ws" });

await fastify.register(profileRoutes, { prefix: "/api/profile"});

//Oauth checks
await fastify.register(oauthPlugin, {
  name: "googleOAuth2",
  scope: ["profile", "email"],
  credentials: {
    client: {
      id: process.env.GOOGLE_CLIENT_ID!,
      secret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    auth: oauthPlugin.GOOGLE_CONFIGURATION,
  },
  startRedirectPath: "/api/auth/google",
  callbackUri: process.env.GOOGLE_CALLBACK_URL!,
});

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
