import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { env } from "./env.js";
import { ensureSchemaPatches } from "./db/ensure-schema.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSpinRoutes } from "./routes/spin.js";

const app = Fastify({ logger: true });

const uploadsRoot = join(process.cwd(), "uploads");
await mkdir(uploadsRoot, { recursive: true });

await app.register(cors, {
  origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
await app.register(fastifyStatic, {
  root: uploadsRoot,
  prefix: "/uploads/",
  decorateReply: false,
});

// Register health before anything else so Railway can probe while DB warms up.
app.get("/health", async () => ({ ok: true }));

await registerAuthRoutes(app);
await registerSpinRoutes(app);

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  console.log(`API listening on 0.0.0.0:${env.API_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Run after listen so healthchecks pass even if Supabase is slow/unavailable at boot.
try {
  await ensureSchemaPatches();
  console.log("[db] Schema patches ok");
} catch (err) {
  app.log.error({ err }, "[db] Schema patch failed (API is still up)");
}
