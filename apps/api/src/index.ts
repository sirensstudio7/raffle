import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";

async function main(): Promise<void> {
  // Import env inside main so missing-var errors print a clear line (not a bare stack).
  const { env } = await import("./env.js");
  const { ensureSchemaPatches } = await import("./db/ensure-schema.js");
  const { registerAuthRoutes } = await import("./routes/auth.js");
  const { registerSpinRoutes } = await import("./routes/spin.js");

  const app = Fastify({ logger: true });

  const uploadsRoot = join(process.cwd(), "uploads");
  await mkdir(uploadsRoot, { recursive: true });

  await app.register(cors, {
    // Allow configured origins, any *.vercel.app preview/prod host, or all if unset.
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (env.CORS_ORIGINS.length === 0) {
        cb(null, true);
        return;
      }
      if (env.CORS_ORIGINS.includes(origin)) {
        cb(null, true);
        return;
      }
      try {
        const host = new URL(origin).hostname;
        if (host.endsWith(".vercel.app") || host === "vercel.app") {
          cb(null, true);
          return;
        }
      } catch {
        /* ignore bad Origin */
      }
      cb(null, false);
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  await app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: "/uploads/",
    decorateReply: false,
  });

  // Register health before anything else so Render can probe while DB warms up.
  app.get("/health", async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerSpinRoutes(app);

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  console.log(`API listening on 0.0.0.0:${env.API_PORT}`);

  // Run after listen so healthchecks pass even if Supabase is slow/unavailable at boot.
  try {
    await ensureSchemaPatches();
    console.log("[db] Schema patches ok");
  } catch (err) {
    app.log.error({ err }, "[db] Schema patch failed (API is still up)");
  }
}

main().catch((err) => {
  console.error("[fatal] API failed to start:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
