import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });
config({ path: resolve(process.cwd(), "../../.env.local"), override: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });

async function main() {
  const migrationsDir = resolve(process.cwd(), "../../supabase/migrations");
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const migration = await readFile(join(migrationsDir, file), "utf8");
    await sql.unsafe(migration);
    console.log(`Applied ${file}`);
  }
  console.log("All migrations applied successfully");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
