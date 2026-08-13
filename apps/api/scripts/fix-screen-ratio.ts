import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL, { prepare: false, max: 1 });
  const cols = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'raffle_settings'
    ORDER BY ordinal_position
  `;
  console.log("columns:", cols.map((c) => c.column_name).join(", "));

  if (!cols.some((c) => c.column_name === "screen_ratio")) {
    await sql.unsafe(`
      ALTER TABLE raffle_settings
      ADD COLUMN screen_ratio VARCHAR(10) NOT NULL DEFAULT 'auto'
    `);
    console.log("Added screen_ratio column");
  } else {
    console.log("screen_ratio already exists");
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
