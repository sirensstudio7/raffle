const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SpinClaimResult = {
  voucher_code: string;
  prize: { id: string; name: string; image_url: string; description: string };
};

let pendingClaim: Promise<SpinClaimResult> | null = null;

function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API_URL.replace(/\/$/, "")}${url}`;
  return url;
}

async function claimPrize(): Promise<SpinClaimResult> {
  const response = await fetch(`${API_URL}/public/spin/spin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = (await response.json()) as { detail?: string } & SpinClaimResult;
  if (!response.ok) throw new Error(data.detail || "Spin failed");
  const result = {
    ...data,
    prize: { ...data.prize, image_url: resolveAssetUrl(data.prize.image_url) },
  };
  preloadPrizeImage(result.prize.image_url);
  return result;
}

/** Warm the winning (or catalog) image so reveal does not wait on Supabase. */
export function preloadPrizeImage(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

/** Start (or reuse) the prize claim. Safe to call from thank-you so Preparing is often done by Spin. */
export function ensureSpinClaim(): Promise<SpinClaimResult> {
  if (!pendingClaim) {
    pendingClaim = claimPrize().catch((err) => {
      pendingClaim = null;
      throw err;
    });
  }
  return pendingClaim;
}

/** Wake Render free-tier dyno without waiting. */
export function wakeSpinApi(): void {
  void fetch(`${API_URL}/health`).catch(() => {});
}

/** Drop the current claim after it has been consumed (or on campaign change). */
export function clearSpinClaim(): void {
  pendingClaim = null;
}

export function takeSpinClaim(): Promise<SpinClaimResult> {
  const claim = ensureSpinClaim();
  pendingClaim = null;
  return claim;
}
