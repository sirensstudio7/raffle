import postgres from "postgres";
import { env } from "../env.js";

const PATCHES: Array<{ column: string; ddl: string }> = [
  {
    column: "screen_ratio",
    ddl: `ALTER TABLE raffle_settings ADD COLUMN screen_ratio VARCHAR(10) NOT NULL DEFAULT 'auto'`,
  },
  {
    column: "spin_keybinding",
    ddl: `ALTER TABLE raffle_settings ADD COLUMN spin_keybinding VARCHAR(32) NOT NULL DEFAULT 'Space'`,
  },
  {
    column: "spin_duration_ms",
    ddl: `ALTER TABLE raffle_settings ADD COLUMN spin_duration_ms INTEGER NOT NULL DEFAULT 5000`,
  },
];

/** Ensure optional columns exist (safe for dev when migrations were skipped). */
export async function ensureSchemaPatches(): Promise<void> {
  const sql = postgres(env.DATABASE_URL, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
  });
  try {
    for (const patch of PATCHES) {
      const cols = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'raffle_settings'
          AND column_name = ${patch.column}
      `;
      if (cols.length === 0) {
        await sql.unsafe(patch.ddl);
        console.log(`[db] Added missing raffle_settings.${patch.column} column`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
