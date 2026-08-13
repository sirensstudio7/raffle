import { randomBytes, randomUUID } from "node:crypto";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  raffleAnalyticsEvents,
  raffleCampaigns,
  rafflePrizes,
  raffleSettings,
  raffleWinners,
  type RaffleCampaign,
  type RafflePrize,
  type RaffleSettings,
  type RaffleWinner,
} from "../db/schema.js";

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

export type RaffleOddsMode = "auto" | "manual";

function prizeProbability(prize: RafflePrize): number {
  return Number(prize.probability) || 0;
}

function normalizeOddsMode(raw: string | null | undefined): RaffleOddsMode {
  return raw === "manual" ? "manual" : "auto";
}

function parseOddsMode(raw: unknown): RaffleOddsMode {
  if (raw === undefined || raw === null || raw === "") return "auto";
  if (raw === "auto" || raw === "manual") return raw;
  throw httpError('odds_mode must be "auto" or "manual"', 400);
}

export type ScreenRatio = "auto" | "9:16" | "16:9";

function normalizeScreenRatio(raw: string | null | undefined): ScreenRatio {
  if (raw === "9:16" || raw === "16:9") return raw;
  return "auto";
}

function parseScreenRatio(raw: unknown): ScreenRatio {
  if (raw === undefined || raw === null || raw === "") return "auto";
  if (raw === "auto" || raw === "9:16" || raw === "16:9") return raw;
  throw httpError('screen_ratio must be "auto", "9:16", or "16:9"', 400);
}


function normalizeSpinKeybinding(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  return value;
}

function parseSpinKeybinding(raw: unknown): string {
  if (raw === undefined || raw === null) return "Space";
  if (typeof raw !== "string") throw httpError("spin_keybinding must be a string", 400);
  const value = raw.trim();
  if (value === "" || value === "none") return "";
  if (!/^Key[A-Z]$/.test(value) && !["Space", "Enter", "Digit0", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"].includes(value)) {
    throw httpError("Invalid spin_keybinding", 400);
  }
  return value;
}

export function raffleSettingsOut(settings: RaffleSettings) {
  return {
    enabled: settings.enabled,
    screen_ratio: normalizeScreenRatio(settings.screenRatio),
    spin_keybinding: normalizeSpinKeybinding(settings.spinKeybinding),
    updated_at: settings.updatedAt.toISOString(),
  };
}

export function campaignOut(campaign: RaffleCampaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    start_at: campaign.startAt?.toISOString() ?? null,
    end_at: campaign.endAt?.toISOString() ?? null,
    daily_limit: campaign.dailyLimit,
    total_limit: campaign.totalLimit,
    one_per_user: campaign.onePerUser,
    odds_mode: normalizeOddsMode(campaign.oddsMode),
    status: campaign.status,
    created_at: campaign.createdAt.toISOString(),
    updated_at: campaign.updatedAt.toISOString(),
  };
}

export function prizeOut(prize: RafflePrize) {
  return {
    id: prize.id,
    campaign_id: prize.campaignId,
    name: prize.name,
    description: prize.description,
    image_url: prize.imageUrl ?? "",
    probability: prizeProbability(prize),
    stock: prize.stock,
    voucher_prefix: prize.voucherPrefix,
    expires_at: prize.expiresAt?.toISOString() ?? null,
    enabled: prize.enabled,
    sort_order: prize.sortOrder,
    created_at: prize.createdAt.toISOString(),
  };
}

export function winnerOut(winner: RaffleWinner, prize?: RafflePrize | null) {
  return {
    id: winner.id,
    campaign_id: winner.campaignId,
    prize_id: winner.prizeId,
    prize_name: prize?.name || winner.prizeName || null,
    prize_image_url: prize?.imageUrl ?? "",
    customer_identifier: winner.customerIdentifier,
    customer_name: winner.customerName ?? "",
    voucher_code: winner.voucherCode,
    status: winner.status,
    won_at: winner.wonAt.toISOString(),
    redeemed_at: winner.redeemedAt?.toISOString() ?? null,
  };
}

export async function getOrCreateRaffleSettings(): Promise<RaffleSettings> {
  const [existing] = await db.select().from(raffleSettings).where(eq(raffleSettings.id, 1)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(raffleSettings).values({ id: 1 }).returning();
  return created!;
}

export type RafflePublicConfig = {
  active: boolean;
  enabled: boolean;
  screen_ratio: ScreenRatio;
  spin_keybinding: string;
  campaign: ReturnType<typeof campaignOut> | null;
  prizes: Array<ReturnType<typeof prizeOut>>;
};

export async function getRafflePublicConfig(): Promise<RafflePublicConfig> {
  const settings = await getOrCreateRaffleSettings();
  const screen_ratio = normalizeScreenRatio(settings.screenRatio);
  const spin_keybinding = normalizeSpinKeybinding(settings.spinKeybinding);
  if (!settings.enabled) {
    return { active: true, enabled: false, screen_ratio, spin_keybinding, campaign: null, prizes: [] };
  }

  const campaign = await getActiveCampaign();
  if (!campaign) {
    return { active: true, enabled: true, screen_ratio, spin_keybinding, campaign: null, prizes: [] };
  }
  const prizes = await listPrizes(campaign.id);
  return {
    active: true,
    enabled: true,
    screen_ratio,
    spin_keybinding,
    campaign: campaignOut(campaign),
    prizes: prizes.filter((p) => p.enabled && prizeProbability(p) > 0).map(prizeOut),
  };
}

export async function updateRaffleSettings(input: {
  enabled?: boolean;
  screen_ratio?: ScreenRatio;
  spin_keybinding?: string;
}): Promise<RaffleSettings> {
  if (
    input.enabled === undefined &&
    input.screen_ratio === undefined &&
    input.spin_keybinding === undefined
  ) {
    throw httpError("No settings to update", 400);
  }
  const existing = await getOrCreateRaffleSettings();
  const [updated] = await db
    .update(raffleSettings)
    .set({
      enabled: input.enabled === undefined ? existing.enabled : input.enabled,
      screenRatio:
        input.screen_ratio === undefined
          ? existing.screenRatio
          : parseScreenRatio(input.screen_ratio),
      spinKeybinding:
        input.spin_keybinding === undefined
          ? existing.spinKeybinding
          : parseSpinKeybinding(input.spin_keybinding),
      updatedAt: new Date(),
    })
    .where(eq(raffleSettings.id, existing.id))
    .returning();
  return updated!;
}

export async function listCampaigns(): Promise<RaffleCampaign[]> {
  return db.select().from(raffleCampaigns).orderBy(desc(raffleCampaigns.createdAt));
}

export async function getCampaign(campaignId: string): Promise<RaffleCampaign> {
  const [row] = await db
    .select()
    .from(raffleCampaigns)
    .where(eq(raffleCampaigns.id, campaignId))
    .limit(1);
  if (!row) throw httpError("Campaign not found", 404);
  return row;
}

async function getActiveCampaign(): Promise<RaffleCampaign | null> {
  const now = new Date();
  const rows = await db
    .select()
    .from(raffleCampaigns)
    .where(eq(raffleCampaigns.status, "active"))
    .orderBy(desc(raffleCampaigns.updatedAt))
    .limit(5);
  for (const row of rows) {
    if (row.startAt && row.startAt.getTime() > now.getTime()) continue;
    if (row.endAt && row.endAt.getTime() < now.getTime()) continue;
    return row;
  }
  return null;
}

export async function createCampaign(input: {
  name: string;
  start_at?: string | null;
  end_at?: string | null;
  daily_limit?: number | null;
  total_limit?: number | null;
  one_per_user?: boolean;
  odds_mode?: RaffleOddsMode;
  status?: string;
}): Promise<RaffleCampaign> {
  const name = input.name?.trim();
  if (!name) throw httpError("Campaign name is required", 400);
  const status = input.status ?? "draft";
  if (!["draft", "active", "ended"].includes(status)) {
    throw httpError("Invalid campaign status", 400);
  }
  const oddsMode = parseOddsMode(input.odds_mode);
  if (status === "active") await ensureSingleActiveCampaign();
  const [created] = await db
    .insert(raffleCampaigns)
    .values({
      name,
      startAt: input.start_at ? new Date(input.start_at) : null,
      endAt: input.end_at ? new Date(input.end_at) : null,
      dailyLimit: input.daily_limit ?? null,
      totalLimit: input.total_limit ?? null,
      onePerUser: input.one_per_user ?? true,
      oddsMode,
      status,
    })
    .returning();
  return created!;
}

export async function updateCampaign(
  campaignId: string,
  input: {
    name?: string;
    start_at?: string | null;
    end_at?: string | null;
    daily_limit?: number | null;
    total_limit?: number | null;
    one_per_user?: boolean;
    odds_mode?: RaffleOddsMode;
    status?: string;
  },
): Promise<RaffleCampaign> {
  const existing = await getCampaign(campaignId);
  const nextStatus = input.status ?? existing.status;
  if (!["draft", "active", "ended"].includes(nextStatus)) {
    throw httpError("Invalid campaign status", 400);
  }
  const prevOddsMode = normalizeOddsMode(existing.oddsMode);
  const nextOddsMode =
    input.odds_mode === undefined ? prevOddsMode : parseOddsMode(input.odds_mode);

  if (nextOddsMode !== prevOddsMode) {
    await db
      .update(raffleCampaigns)
      .set({ oddsMode: nextOddsMode, updatedAt: new Date() })
      .where(eq(raffleCampaigns.id, campaignId));
    if (nextOddsMode === "auto") await rebalanceProbabilitiesFromStock(campaignId);
  }

  const activating = nextStatus === "active" && existing.status !== "active";
  const manualModeChangedWhileActive =
    nextStatus === "active" &&
    existing.status === "active" &&
    input.odds_mode !== undefined &&
    nextOddsMode === "manual";

  if (activating || manualModeChangedWhileActive) {
    await ensureProbabilityValid(campaignId);
  }
  if (activating) await ensureSingleActiveCampaign(campaignId);

  const [updated] = await db
    .update(raffleCampaigns)
    .set({
      name: input.name?.trim() || existing.name,
      startAt:
        input.start_at === undefined
          ? existing.startAt
          : input.start_at
            ? new Date(input.start_at)
            : null,
      endAt:
        input.end_at === undefined
          ? existing.endAt
          : input.end_at
            ? new Date(input.end_at)
            : null,
      dailyLimit: input.daily_limit === undefined ? existing.dailyLimit : input.daily_limit,
      totalLimit: input.total_limit === undefined ? existing.totalLimit : input.total_limit,
      onePerUser: input.one_per_user ?? existing.onePerUser,
      oddsMode: nextOddsMode,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(raffleCampaigns.id, campaignId))
    .returning();
  return updated!;
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  await getCampaign(campaignId);
  await db.delete(raffleCampaigns).where(eq(raffleCampaigns.id, campaignId));
}

async function ensureSingleActiveCampaign(exceptId?: string): Promise<void> {
  const actives = await db
    .select()
    .from(raffleCampaigns)
    .where(eq(raffleCampaigns.status, "active"));
  for (const row of actives) {
    if (exceptId && row.id === exceptId) continue;
    await db
      .update(raffleCampaigns)
      .set({ status: "ended", updatedAt: new Date() })
      .where(eq(raffleCampaigns.id, row.id));
  }
}

export async function listPrizes(campaignId: string): Promise<RafflePrize[]> {
  return db
    .select()
    .from(rafflePrizes)
    .where(eq(rafflePrizes.campaignId, campaignId))
    .orderBy(rafflePrizes.sortOrder, rafflePrizes.createdAt);
}

export async function sumEnabledProbability(campaignId: string): Promise<number> {
  const prizes = await listPrizes(campaignId);
  return prizes.filter((p) => p.enabled).reduce((sum, p) => sum + prizeProbability(p), 0);
}

export async function rebalanceProbabilitiesFromStock(campaignId: string): Promise<void> {
  const prizes = await listPrizes(campaignId);
  const enabled = prizes.filter((p) => p.enabled);
  if (enabled.length === 0) return;

  const stockTotal = enabled.reduce((sum, p) => sum + Math.max(0, p.stock), 0);
  let assigned = 0;
  for (let i = 0; i < enabled.length; i++) {
    const prize = enabled[i]!;
    const isLast = i === enabled.length - 1;
    let share: number;
    if (stockTotal <= 0) {
      share = isLast
        ? Number((100 - assigned).toFixed(2))
        : Number((100 / enabled.length).toFixed(2));
    } else if (isLast) {
      share = Number((100 - assigned).toFixed(2));
    } else {
      share = Number(((Math.max(0, prize.stock) / stockTotal) * 100).toFixed(2));
    }
    assigned = Number((assigned + share).toFixed(2));
    await db
      .update(rafflePrizes)
      .set({ probability: share.toFixed(2) })
      .where(eq(rafflePrizes.id, prize.id));
  }

  for (const prize of prizes.filter((p) => !p.enabled)) {
    if (prizeProbability(prize) === 0) continue;
    await db
      .update(rafflePrizes)
      .set({ probability: "0.00" })
      .where(eq(rafflePrizes.id, prize.id));
  }
}

async function ensureProbabilityValid(campaignId: string): Promise<void> {
  const [campaign] = await db
    .select()
    .from(raffleCampaigns)
    .where(eq(raffleCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw httpError("Campaign not found", 404);

  const mode = normalizeOddsMode(campaign.oddsMode);
  if (mode === "auto") await rebalanceProbabilitiesFromStock(campaignId);

  const prizes = await listPrizes(campaignId);
  if (!prizes.some((p) => p.enabled && p.stock > 0)) {
    throw httpError("Active campaign needs at least one prize with stock", 400);
  }
  if (
    mode === "manual" &&
    !prizes.some((p) => p.enabled && p.stock > 0 && prizeProbability(p) > 0)
  ) {
    throw httpError(
      "Active campaign needs at least one prize with stock and win probability",
      400,
    );
  }
  const total = await sumEnabledProbability(campaignId);
  if (Math.abs(total - 100) > 0.01) {
    throw httpError(
      mode === "manual"
        ? `Manual odds must total 100% (currently ${total.toFixed(2)}%). Adjust prize percentages.`
        : `Enabled prize probabilities must total 100% (currently ${total.toFixed(2)}%)`,
      400,
    );
  }
}

function voucherPrefixFromName(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase();
  return clean || "SPIN";
}

export async function createPrize(
  campaignId: string,
  input: {
    name: string;
    description?: string;
    image_url?: string | null;
    probability?: number;
    stock?: number;
    voucher_prefix?: string;
    expires_at?: string | null;
    enabled?: boolean;
  },
): Promise<RafflePrize> {
  const campaign = await getCampaign(campaignId);
  const oddsMode = normalizeOddsMode(campaign.oddsMode);
  const name = input.name?.trim();
  if (!name) throw httpError("Prize name is required", 400);
  const stock = Number(input.stock ?? 0);
  if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
    throw httpError("Total must be a whole number ≥ 0", 400);
  }
  if (stock < 1) throw httpError("Total must be at least 1", 400);

  let probability = 0;
  if (oddsMode === "manual") {
    if (input.probability === undefined) {
      throw httpError("Probability is required in manual odds mode", 400);
    }
    probability = Number(input.probability);
    if (Number.isNaN(probability) || probability < 0 || probability > 100) {
      throw httpError("Probability must be between 0 and 100", 400);
    }
  }

  const [created] = await db
    .insert(rafflePrizes)
    .values({
      campaignId,
      name,
      description: input.description?.trim() ?? "",
      imageUrl: input.image_url || null,
      probability: probability.toFixed(2),
      stock,
      voucherPrefix: (input.voucher_prefix?.trim() || voucherPrefixFromName(name))
        .slice(0, 20)
        .toUpperCase(),
      expiresAt: input.expires_at ? new Date(input.expires_at) : null,
      enabled: input.enabled ?? true,
    })
    .returning();

  if (oddsMode === "auto") {
    await rebalanceProbabilitiesFromStock(campaignId);
    const [refreshed] = await db
      .select()
      .from(rafflePrizes)
      .where(eq(rafflePrizes.id, created!.id))
      .limit(1);
    return refreshed ?? created!;
  }
  return created!;
}

export async function updatePrize(
  campaignId: string,
  prizeId: string,
  input: {
    name?: string;
    description?: string;
    image_url?: string | null;
    probability?: number;
    stock?: number;
    voucher_prefix?: string;
    expires_at?: string | null;
    enabled?: boolean;
  },
): Promise<RafflePrize> {
  const campaign = await getCampaign(campaignId);
  const oddsMode = normalizeOddsMode(campaign.oddsMode);
  const [existing] = await db
    .select()
    .from(rafflePrizes)
    .where(and(eq(rafflePrizes.id, prizeId), eq(rafflePrizes.campaignId, campaignId)))
    .limit(1);
  if (!existing) throw httpError("Prize not found", 404);

  let probability = prizeProbability(existing);
  if (input.probability !== undefined) {
    if (oddsMode === "auto") {
      throw httpError("Switch campaign odds mode to Manual to set percentages", 400);
    }
    probability = Number(input.probability);
    if (Number.isNaN(probability) || probability < 0 || probability > 100) {
      throw httpError("Probability must be between 0 and 100", 400);
    }
  }
  const stock = input.stock === undefined ? existing.stock : Number(input.stock);
  if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
    throw httpError("Total must be a whole number ≥ 0", 400);
  }

  const shouldRebalance =
    oddsMode === "auto" && (input.stock !== undefined || input.enabled !== undefined);

  const [updated] = await db
    .update(rafflePrizes)
    .set({
      name: input.name?.trim() || existing.name,
      description: input.description === undefined ? existing.description : input.description.trim(),
      imageUrl: input.image_url === undefined ? existing.imageUrl : input.image_url || null,
      probability: probability.toFixed(2),
      stock,
      voucherPrefix:
        input.voucher_prefix === undefined
          ? existing.voucherPrefix
          : (input.voucher_prefix.trim() || "SPIN").slice(0, 20).toUpperCase(),
      expiresAt:
        input.expires_at === undefined
          ? existing.expiresAt
          : input.expires_at
            ? new Date(input.expires_at)
            : null,
      enabled: input.enabled ?? existing.enabled,
    })
    .where(eq(rafflePrizes.id, prizeId))
    .returning();

  if (shouldRebalance) {
    await rebalanceProbabilitiesFromStock(campaignId);
    const [refreshed] = await db
      .select()
      .from(rafflePrizes)
      .where(eq(rafflePrizes.id, prizeId))
      .limit(1);
    return refreshed ?? updated!;
  }
  return updated!;
}

export async function deletePrize(campaignId: string, prizeId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  const [existing] = await db
    .select()
    .from(rafflePrizes)
    .where(and(eq(rafflePrizes.id, prizeId), eq(rafflePrizes.campaignId, campaignId)))
    .limit(1);
  if (!existing) throw httpError("Prize not found", 404);

  await db
    .delete(rafflePrizes)
    .where(and(eq(rafflePrizes.id, prizeId), eq(rafflePrizes.campaignId, campaignId)));
  if (normalizeOddsMode(campaign.oddsMode) === "auto") {
    await rebalanceProbabilitiesFromStock(campaignId);
  }
}

function normalizeCustomerIdentifier(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return `guest-${randomBytes(8).toString("hex")}`;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 16) return digits;
  if (/^[A-Za-z0-9._:-]{6,64}$/.test(trimmed)) return trimmed;
  throw httpError("Enter a valid phone number", 400);
}

function generateVoucherCode(prefix: string): string {
  const part = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  const clean = (prefix || "SPIN").replace(/[^A-Z0-9]/gi, "").slice(0, 12) || "SPIN";
  return `${clean}-${part}`;
}

function pickWeightedPrize(prizes: RafflePrize[]): RafflePrize {
  const eligible = prizes.filter(
    (p) => p.enabled && prizeProbability(p) > 0 && p.stock > 0,
  );
  if (eligible.length === 0) throw httpError("No prizes available (check stock)", 409);
  const total = eligible.reduce((sum, p) => sum + prizeProbability(p), 0);
  let roll = Math.random() * total;
  for (const prize of eligible) {
    roll -= prizeProbability(prize);
    if (roll <= 0) return prize;
  }
  return eligible[eligible.length - 1]!;
}

export async function performSpin(params: { phone?: string; name?: string }): Promise<{
  winner: RaffleWinner;
  prize: RafflePrize;
  campaign: RaffleCampaign;
}> {
  const cfg = await getRafflePublicConfig();
  if (!cfg.active || !cfg.enabled) throw httpError("Spin wheel is not available", 403);

  const campaign = await getActiveCampaign();
  if (!campaign) throw httpError("No active campaign", 404);

  const customerIdentifier = normalizeCustomerIdentifier(params.phone);
  const name = params.name?.trim() || null;

  if (campaign.onePerUser) {
    const [existing] = await db
      .select()
      .from(raffleWinners)
      .where(
        and(
          eq(raffleWinners.campaignId, campaign.id),
          eq(raffleWinners.customerIdentifier, customerIdentifier),
        ),
      )
      .limit(1);
    if (existing) throw httpError("You already spun in this campaign", 409);
  }

  if (campaign.dailyLimit != null) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [daily] = await db
      .select({ value: count() })
      .from(raffleWinners)
      .where(
        and(
          eq(raffleWinners.campaignId, campaign.id),
          eq(raffleWinners.customerIdentifier, customerIdentifier),
          gte(raffleWinners.wonAt, startOfDay),
        ),
      );
    if ((daily?.value ?? 0) >= campaign.dailyLimit) {
      throw httpError("Daily spin limit reached", 429);
    }
  }

  if (campaign.totalLimit != null) {
    const [total] = await db
      .select({ value: count() })
      .from(raffleWinners)
      .where(eq(raffleWinners.campaignId, campaign.id));
    if ((total?.value ?? 0) >= campaign.totalLimit) {
      throw httpError("Campaign spin limit reached", 429);
    }
  }

  const prizes = await listPrizes(campaign.id);
  const picked = pickWeightedPrize(prizes);

  const result = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(rafflePrizes)
      .where(eq(rafflePrizes.id, picked.id))
      .for("update")
      .limit(1);
    if (!locked || locked.stock <= 0) {
      throw httpError("Prize just ran out — try again", 409);
    }

    await tx
      .update(rafflePrizes)
      .set({ stock: locked.stock - 1 })
      .where(eq(rafflePrizes.id, locked.id));

    let voucher = generateVoucherCode(locked.voucherPrefix);
    for (let i = 0; i < 5; i += 1) {
      const [clash] = await tx
        .select()
        .from(raffleWinners)
        .where(eq(raffleWinners.voucherCode, voucher))
        .limit(1);
      if (!clash) break;
      voucher = generateVoucherCode(locked.voucherPrefix);
    }

    const [winner] = await tx
      .insert(raffleWinners)
      .values({
        campaignId: campaign.id,
        prizeId: locked.id,
        prizeName: locked.name,
        customerIdentifier,
        customerName: name,
        voucherCode: voucher,
        status: "active",
      })
      .returning();

    return { winner: winner!, prize: { ...locked, stock: locked.stock - 1 } };
  });

  await db.insert(raffleAnalyticsEvents).values({
    eventName: "spin_won",
    metadataJson: JSON.stringify({
      campaign_id: campaign.id,
      prize_id: result.prize.id,
      voucher_code: result.winner.voucherCode,
    }),
  });

  if (normalizeOddsMode(campaign.oddsMode) === "auto") {
    await rebalanceProbabilitiesFromStock(campaign.id);
  }

  return { winner: result.winner, prize: result.prize, campaign };
}

export async function listWinners(opts: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: ReturnType<typeof winnerOut>[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const [totalRow] = await db.select({ value: count() }).from(raffleWinners);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select({ winner: raffleWinners, prize: rafflePrizes })
    .from(raffleWinners)
    .leftJoin(rafflePrizes, eq(rafflePrizes.id, raffleWinners.prizeId))
    .orderBy(desc(raffleWinners.wonAt))
    .limit(limit)
    .offset(offset);

  let items = rows.map((r) => winnerOut(r.winner, r.prize));
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    items = items.filter(
      (w) =>
        w.voucher_code.toLowerCase().includes(q) ||
        w.customer_identifier.includes(q) ||
        (w.customer_name || "").toLowerCase().includes(q) ||
        (w.prize_name || "").toLowerCase().includes(q),
    );
  }
  return { items, total };
}

export async function redeemVoucher(params: {
  voucherCode: string;
  redeemedBy?: string;
}): Promise<ReturnType<typeof winnerOut>> {
  const code = params.voucherCode.trim().toUpperCase();
  if (!code) throw httpError("Voucher code is required", 400);

  const [row] = await db
    .select({ winner: raffleWinners, prize: rafflePrizes })
    .from(raffleWinners)
    .leftJoin(rafflePrizes, eq(rafflePrizes.id, raffleWinners.prizeId))
    .where(eq(raffleWinners.voucherCode, code))
    .limit(1);

  if (!row) throw httpError("Voucher not found", 404);

  const now = new Date();
  if (row.prize?.expiresAt && row.prize.expiresAt.getTime() < now.getTime()) {
    if (row.winner.status === "active") {
      await db
        .update(raffleWinners)
        .set({ status: "expired" })
        .where(eq(raffleWinners.id, row.winner.id));
    }
    throw httpError("Voucher expired", 410);
  }
  if (row.winner.status === "redeemed") throw httpError("Voucher already redeemed", 409);
  if (row.winner.status === "expired") throw httpError("Voucher expired", 410);

  const [updated] = await db
    .update(raffleWinners)
    .set({
      status: "redeemed",
      redeemedAt: now,
      redeemedBy: params.redeemedBy ?? null,
    })
    .where(eq(raffleWinners.id, row.winner.id))
    .returning();

  await db.insert(raffleAnalyticsEvents).values({
    eventName: "spin_redeemed",
    metadataJson: JSON.stringify({ voucher_code: code }),
  });

  return winnerOut(updated!, row.prize);
}

export async function getRaffleAnalytics() {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [totalSpins] = await db.select({ value: count() }).from(raffleWinners);

  const [spinsToday] = await db
    .select({ value: count() })
    .from(raffleWinners)
    .where(gte(raffleWinners.wonAt, startOfDay));

  const [uniqueUsers] = await db
    .select({
      value: sql<number>`count(distinct ${raffleWinners.customerIdentifier})`,
    })
    .from(raffleWinners);

  const [redeemed] = await db
    .select({ value: count() })
    .from(raffleWinners)
    .where(eq(raffleWinners.status, "redeemed"));

  const total = totalSpins?.value ?? 0;
  const redeemedCount = redeemed?.value ?? 0;

  const stockRows = await db
    .select({
      name: rafflePrizes.name,
      stock: rafflePrizes.stock,
    })
    .from(rafflePrizes);

  const topPrizeRows = await db
    .select({ name: raffleWinners.prizeName, value: count() })
    .from(raffleWinners)
    .groupBy(raffleWinners.prizeName)
    .orderBy(desc(count()))
    .limit(1);

  return {
    total_spins: total,
    spins_today: spinsToday?.value ?? 0,
    unique_users: Number(uniqueUsers?.value ?? 0),
    redemption_rate: total > 0 ? Math.round((redeemedCount / total) * 1000) / 10 : 0,
    redeemed_count: redeemedCount,
    remaining_stock: stockRows.reduce((sum, r) => sum + r.stock, 0),
    top_prize: topPrizeRows[0]?.name || null,
    stock_by_prize: stockRows.map((r) => ({ name: r.name, stock: r.stock })),
  };
}
