const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SpinOddsMode = "auto" | "manual";
export type ScreenRatio = "auto" | "9:16" | "16:9";
export type SpinDurationMs = 3000 | 5000 | 7000;

export type SpinCampaign = {
  id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  daily_limit: number | null;
  total_limit: number | null;
  one_per_user: boolean;
  odds_mode: SpinOddsMode;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SpinPrize = {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  image_url: string;
  probability: number;
  stock: number;
  voucher_prefix: string;
  expires_at: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: string;
};

export type SpinWinner = {
  id: string;
  campaign_id: string;
  prize_id: string | null;
  prize_name: string | null;
  prize_image_url: string;
  customer_identifier: string;
  customer_name: string;
  voucher_code: string;
  status: string;
  won_at: string;
  redeemed_at: string | null;
};

export type SpinAnalytics = {
  total_spins: number;
  spins_today: number;
  unique_users: number;
  redemption_rate: number;
  redeemed_count: number;
  remaining_stock: number;
  top_prize: string | null;
  stock_by_prize: Array<{ name: string; stock: number }>;
};

function authHeaders(token: string, hasJsonBody = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
  };
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const hasJsonBody = Boolean(init.body);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(token, hasJsonBody), ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const text = await response.text();
    let detail = "Request failed";
    try {
      detail = (JSON.parse(text) as { detail?: string }).detail ?? detail;
    } catch {
      detail = text || detail;
    }
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function uploadRequest<T>(path: string, token: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error((JSON.parse(text) as { detail?: string }).detail ?? "Upload failed");
  }
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error((JSON.parse(text) as { detail?: string }).detail ?? "Invalid credentials");
  }
  return response.json() as Promise<{
    access_token: string;
    user: { id: string; email: string; name: string };
  }>;
}

export const api = {
  getSpinSettings: (token: string) =>
    request<{
      enabled: boolean;
      screen_ratio: ScreenRatio;
      spin_keybinding: string;
      spin_duration_ms: SpinDurationMs;
      updated_at: string;
    }>("/admin/spin/settings", token),

  updateSpinSettings: (
    token: string,
    body: {
      enabled?: boolean;
      screen_ratio?: ScreenRatio;
      spin_keybinding?: string;
      spin_duration_ms?: SpinDurationMs;
    },
  ) =>
    request<{
      enabled: boolean;
      screen_ratio: ScreenRatio;
      spin_keybinding: string;
      spin_duration_ms: SpinDurationMs;
      updated_at: string;
    }>("/admin/spin/settings", token, { method: "PATCH", body: JSON.stringify(body) }),

  listCampaigns: (token: string) =>
    request<{ items: SpinCampaign[] }>("/admin/spin/campaigns", token),

  createCampaign: (
    token: string,
    body: {
      name: string;
      status?: string;
      one_per_user?: boolean;
      odds_mode?: SpinOddsMode;
    },
  ) =>
    request<SpinCampaign>("/admin/spin/campaigns", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateCampaign: (
    token: string,
    campaignId: string,
    body: Partial<{
      name: string;
      status: string;
      odds_mode: SpinOddsMode;
    }>,
  ) =>
    request<SpinCampaign>(`/admin/spin/campaigns/${campaignId}`, token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteCampaign: (token: string, campaignId: string) =>
    request<void>(`/admin/spin/campaigns/${campaignId}`, token, { method: "DELETE" }),

  listPrizes: (token: string, campaignId: string) =>
    request<{ items: SpinPrize[]; probability_total: number }>(
      `/admin/spin/campaigns/${campaignId}/prizes`,
      token,
    ),

  createPrize: (
    token: string,
    campaignId: string,
    body: { name: string; stock: number; probability?: number; enabled?: boolean },
  ) =>
    request<SpinPrize>(`/admin/spin/campaigns/${campaignId}/prizes`, token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updatePrize: (
    token: string,
    campaignId: string,
    prizeId: string,
    body: Partial<{ name: string; stock: number; probability: number; enabled: boolean }>,
  ) =>
    request<SpinPrize>(`/admin/spin/campaigns/${campaignId}/prizes/${prizeId}`, token, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deletePrize: (token: string, campaignId: string, prizeId: string) =>
    request<void>(`/admin/spin/campaigns/${campaignId}/prizes/${prizeId}`, token, {
      method: "DELETE",
    }),

  uploadPrizeImage: (token: string, campaignId: string, prizeId: string, file: File) =>
    uploadRequest<SpinPrize>(
      `/admin/spin/campaigns/${campaignId}/prizes/${prizeId}/image`,
      token,
      file,
    ),

  listWinners: (token: string, search?: string) =>
    request<{ items: SpinWinner[]; total: number }>(
      `/admin/spin/winners${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      token,
    ),

  redeemVoucher: (token: string, voucher_code: string) =>
    request<SpinWinner>("/admin/spin/redeem", token, {
      method: "POST",
      body: JSON.stringify({ voucher_code }),
    }),

  getAnalytics: (token: string) =>
    request<SpinAnalytics>("/admin/spin/analytics", token),
};
