import type { FastifyInstance } from "fastify";
import { getCurrentUser, sendAuthError } from "../auth/jwt.js";
import { convertPrizeImageToWebp } from "../storage/image.js";
import {
  ALLOWED_IMAGE_TYPES,
  uploadToStorage,
} from "../storage/index.js";
import {
  campaignOut,
  createCampaign,
  createPrize,
  deleteCampaign,
  deletePrize,
  getOrCreateRaffleSettings,
  getRaffleAnalytics,
  getRafflePublicConfig,
  listCampaigns,
  listPrizes,
  listWinners,
  performSpin,
  prizeOut,
  raffleSettingsOut,
  redeemVoucher,
  sumEnabledProbability,
  updateCampaign,
  updatePrize,
  updateRaffleSettings,
  winnerOut,
} from "../services/spin.js";

const PRIZE_BUCKET = "raffle-prizes";
const MAX_PRIZE_IMAGE_BYTES = 2 * 1024 * 1024;

function statusFromError(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err) {
    return Number((err as { statusCode?: number }).statusCode) || 500;
  }
  return 500;
}

async function requireAdmin(request: Parameters<typeof getCurrentUser>[0]) {
  return getCurrentUser(request);
}

export async function registerSpinRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/spin/settings", async (request, reply) => {
    try {
      await requireAdmin(request);
      const settings = await getOrCreateRaffleSettings();
      return raffleSettingsOut(settings);
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.patch("/admin/spin/settings", async (request, reply) => {
    try {
      await requireAdmin(request);
      const body = request.body as {
        enabled?: boolean;
        screen_ratio?: string;
        spin_keybinding?: string;
        spin_duration_ms?: number;
      };
      if (
        typeof body.enabled !== "boolean" &&
        body.screen_ratio === undefined &&
        body.spin_keybinding === undefined &&
        body.spin_duration_ms === undefined
      ) {
        return reply.status(400).send({ detail: "No settings provided" });
      }
      const settings = await updateRaffleSettings({
        ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
        ...(body.screen_ratio !== undefined
          ? { screen_ratio: body.screen_ratio as "auto" | "9:16" | "16:9" }
          : {}),
        ...(body.spin_keybinding !== undefined ? { spin_keybinding: body.spin_keybinding } : {}),
        ...(body.spin_duration_ms !== undefined
          ? { spin_duration_ms: body.spin_duration_ms as 3000 | 5000 | 7000 }
          : {}),
      });
      return raffleSettingsOut(settings);
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to update settings",
      });
    }
  });

  app.get("/admin/spin/campaigns", async (request, reply) => {
    try {
      await requireAdmin(request);
      const rows = await listCampaigns();
      return { items: rows.map(campaignOut) };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post("/admin/spin/campaigns", async (request, reply) => {
    try {
      await requireAdmin(request);
      const body = request.body as Parameters<typeof createCampaign>[0];
      const created = await createCampaign(body);
      return reply.status(201).send(campaignOut(created));
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to create campaign",
      });
    }
  });

  app.patch("/admin/spin/campaigns/:campaignId", async (request, reply) => {
    try {
      const { campaignId } = request.params as { campaignId: string };
      await requireAdmin(request);
      const body = request.body as Parameters<typeof updateCampaign>[1];
      const updated = await updateCampaign(campaignId, body);
      return campaignOut(updated);
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to update campaign",
      });
    }
  });

  app.delete("/admin/spin/campaigns/:campaignId", async (request, reply) => {
    try {
      const { campaignId } = request.params as { campaignId: string };
      await requireAdmin(request);
      await deleteCampaign(campaignId);
      return reply.status(204).send();
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to delete campaign",
      });
    }
  });

  app.get("/admin/spin/campaigns/:campaignId/prizes", async (request, reply) => {
    try {
      const { campaignId } = request.params as { campaignId: string };
      await requireAdmin(request);
      const prizes = await listPrizes(campaignId);
      const total = await sumEnabledProbability(campaignId);
      return { items: prizes.map(prizeOut), probability_total: total };
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post("/admin/spin/campaigns/:campaignId/prizes", async (request, reply) => {
    try {
      const { campaignId } = request.params as { campaignId: string };
      await requireAdmin(request);
      const body = request.body as Parameters<typeof createPrize>[1];
      const created = await createPrize(campaignId, body);
      return reply.status(201).send(prizeOut(created));
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to create prize",
      });
    }
  });

  app.patch("/admin/spin/campaigns/:campaignId/prizes/:prizeId", async (request, reply) => {
    try {
      const { campaignId, prizeId } = request.params as {
        campaignId: string;
        prizeId: string;
      };
      await requireAdmin(request);
      const body = request.body as Parameters<typeof updatePrize>[2];
      const updated = await updatePrize(campaignId, prizeId, body);
      return prizeOut(updated);
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to update prize",
      });
    }
  });

  app.delete("/admin/spin/campaigns/:campaignId/prizes/:prizeId", async (request, reply) => {
    try {
      const { campaignId, prizeId } = request.params as {
        campaignId: string;
        prizeId: string;
      };
      await requireAdmin(request);
      await deletePrize(campaignId, prizeId);
      return reply.status(204).send();
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to delete prize",
      });
    }
  });

  app.post("/admin/spin/campaigns/:campaignId/prizes/:prizeId/image", async (request, reply) => {
    try {
      const { campaignId, prizeId } = request.params as {
        campaignId: string;
        prizeId: string;
      };
      await requireAdmin(request);
      const file = await request.file();
      if (!file) return reply.status(400).send({ detail: "Image file is required" });
      if (!(file.mimetype in ALLOWED_IMAGE_TYPES) || file.mimetype === "image/gif") {
        return reply.status(400).send({ detail: "Use PNG, JPG, or WEBP" });
      }
      const buffer = await file.toBuffer();
      if (buffer.byteLength > MAX_PRIZE_IMAGE_BYTES) {
        return reply.status(400).send({ detail: "Image must be 2MB or smaller" });
      }
      let webp: Buffer;
      try {
        webp = await convertPrizeImageToWebp(buffer);
      } catch {
        return reply.status(400).send({ detail: "Could not process image. Use a valid PNG, JPG, or WEBP." });
      }
      const path = `${campaignId}/${prizeId}.webp`;
      const url = await uploadToStorage(PRIZE_BUCKET, path, webp, "image/webp");
      const updated = await updatePrize(campaignId, prizeId, { image_url: url });
      return prizeOut(updated);
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to upload image",
      });
    }
  });

  app.get("/admin/spin/winners", async (request, reply) => {
    try {
      await requireAdmin(request);
      const query = request.query as { search?: string; limit?: string; offset?: string };
      return await listWinners({
        search: query.search,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.post("/admin/spin/redeem", async (request, reply) => {
    try {
      const user = await requireAdmin(request);
      const body = request.body as { voucher_code?: string };
      return await redeemVoucher({
        voucherCode: body.voucher_code ?? "",
        redeemedBy: user.id,
      });
    } catch (err) {
      const status = statusFromError(err);
      if (status === 401 || status === 403) return sendAuthError(reply, err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Failed to redeem voucher",
      });
    }
  });

  app.get("/admin/spin/analytics", async (request, reply) => {
    try {
      await requireAdmin(request);
      return await getRaffleAnalytics();
    } catch (err) {
      return sendAuthError(reply, err);
    }
  });

  app.get("/public/spin/state", async (_request, reply) => {
    try {
      return await getRafflePublicConfig();
    } catch (err) {
      return reply.status(500).send({
        detail: err instanceof Error ? err.message : "Failed to load spin state",
      });
    }
  });

  app.post("/public/spin/spin", async (request, reply) => {
    try {
      const body = (request.body as { phone?: string; name?: string } | null) ?? {};
      const result = await performSpin({ phone: body.phone, name: body.name });
      return {
        voucher_code: result.winner.voucherCode,
        status: result.winner.status,
        prize: prizeOut(result.prize),
        winner: winnerOut(result.winner, result.prize),
      };
    } catch (err) {
      const status = statusFromError(err);
      return reply.status(status).send({
        detail: err instanceof Error ? err.message : "Spin failed",
      });
    }
  });
}
