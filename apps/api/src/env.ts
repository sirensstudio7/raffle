import { config } from "dotenv";
import { resolve } from "node:path";

// Local monorepo .env (ignored in Docker/Render where vars are injected).
config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), "../../.env.local"), override: true });
config({ path: resolve(process.cwd(), ".env") });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required env: ${name}. Set it in Render → Environment (DATABASE_URL, JWT_SECRET, etc).`,
    );
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  SUPABASE_URL: process.env.SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRE_HOURS: Number(process.env.JWT_EXPIRE_HOURS ?? 168),
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@example.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin123",
  ADMIN_NAME: process.env.ADMIN_NAME ?? "Admin",
  // Railway/Render/Fly set PORT; fall back to API_PORT for local.
  API_PORT: Number(process.env.PORT ?? process.env.API_PORT ?? 8000),
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export function hasSupabaseStorage(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}
