import { eq } from "drizzle-orm";
import { hashPassword } from "../src/auth/jwt.js";
import { db } from "../src/db/client.js";
import {
  adminUsers,
  raffleCampaigns,
  rafflePrizes,
  raffleSettings,
} from "../src/db/schema.js";
import { env } from "../src/env.js";
import { rebalanceProbabilitiesFromStock } from "../src/services/spin.js";

const DEMO_PRIZES = [
  { name: "Tumbler", stock: 20, image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&q=80" },
  { name: "Voucher 50K", stock: 15, image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80" },
  { name: "T-Shirt", stock: 10, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80" },
  { name: "Sticker Pack", stock: 30, image: "https://images.unsplash.com/photo-1611532736597-de2d0365baa3?w=400&q=80" },
  { name: "Grand Prize", stock: 2, image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=400&q=80" },
];

async function main() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const [existingUser] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);

  if (!existingUser) {
    await db.insert(adminUsers).values({
      email,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      name: env.ADMIN_NAME,
    });
    console.log(`Created admin user: ${email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  await db
    .insert(raffleSettings)
    .values({ id: 1, enabled: true })
    .onConflictDoUpdate({
      target: raffleSettings.id,
      set: { enabled: true, updatedAt: new Date() },
    });

  const existingCampaigns = await db.select().from(raffleCampaigns).limit(1);
  if (existingCampaigns.length > 0) {
    console.log("Campaign already seeded, skipping demo data");
    process.exit(0);
  }

  const [campaign] = await db
    .insert(raffleCampaigns)
    .values({
      name: "Launch Raffle",
      status: "active",
      onePerUser: true,
      oddsMode: "auto",
    })
    .returning();

  for (const prize of DEMO_PRIZES) {
    await db.insert(rafflePrizes).values({
      campaignId: campaign!.id,
      name: prize.name,
      stock: prize.stock,
      imageUrl: prize.image,
      enabled: true,
    });
  }

  await rebalanceProbabilitiesFromStock(campaign!.id);
  console.log("Seeded demo campaign with prizes");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
