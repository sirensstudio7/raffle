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

await app.register(cors, {
  origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
await app.register(fastifyStatic, {
  root: join(process.cwd(), "uploads"),
  prefix: "/uploads/",
  decorateReply: false,
});

app.get("/health", async () => ({ ok: true }));

await registerAuthRoutes(app);
await registerSpinRoutes(app);

await ensureSchemaPatches();

try {
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  console.log(`API listening on http://localhost:${env.API_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
