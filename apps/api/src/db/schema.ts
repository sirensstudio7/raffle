import { randomUUID } from "node:crypto";
import {
  boolean,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const adminUsers = pgTable("admin_users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const raffleSettings = pgTable("raffle_settings", {
  id: smallint("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(false),
  screenRatio: varchar("screen_ratio", { length: 10 }).notNull().default("auto"),
  spinKeybinding: varchar("spin_keybinding", { length: 32 }).notNull().default("Space"),
  spinDurationMs: integer("spin_duration_ms").notNull().default(5000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const raffleCampaigns = pgTable("raffle_campaigns", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  dailyLimit: integer("daily_limit"),
  totalLimit: integer("total_limit"),
  onePerUser: boolean("one_per_user").notNull().default(true),
  oddsMode: varchar("odds_mode", { length: 20 }).notNull().default("auto"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rafflePrizes = pgTable("raffle_prizes", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  campaignId: varchar("campaign_id", { length: 36 })
    .notNull()
    .references(() => raffleCampaigns.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  probability: numeric("probability", { precision: 5, scale: 2 }).notNull().default("0"),
  stock: integer("stock").notNull().default(0),
  voucherPrefix: varchar("voucher_prefix", { length: 20 }).notNull().default("SPIN"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const raffleWinners = pgTable("raffle_winners", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  campaignId: varchar("campaign_id", { length: 36 })
    .notNull()
    .references(() => raffleCampaigns.id, { onDelete: "cascade" }),
  prizeId: varchar("prize_id", { length: 36 }).references(() => rafflePrizes.id, {
    onDelete: "set null",
  }),
  prizeName: varchar("prize_name", { length: 255 }).notNull().default(""),
  customerIdentifier: varchar("customer_identifier", { length: 255 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  voucherCode: varchar("voucher_code", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  wonAt: timestamp("won_at", { withTimezone: true }).notNull().defaultNow(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
  redeemedBy: varchar("redeemed_by", { length: 36 }),
});

export const raffleAnalyticsEvents = pgTable("raffle_analytics_events", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  eventName: varchar("event_name", { length: 100 }).notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type RaffleSettings = typeof raffleSettings.$inferSelect;
export type RaffleCampaign = typeof raffleCampaigns.$inferSelect;
export type RafflePrize = typeof rafflePrizes.$inferSelect;
export type RaffleWinner = typeof raffleWinners.$inferSelect;
