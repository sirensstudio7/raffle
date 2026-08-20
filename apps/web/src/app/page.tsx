"use client";

import { useEffect, useState } from "react";
import { GiftCollectionFlow } from "@/components/gift-collection-flow";
import { shouldShowSpin, type SpinPublicConfig } from "@/components/spin-widget";
import { spinFrameClass, spinPageWrapperClass, spinShellClass } from "@/lib/screen-ratio";
import { cn } from "@/lib/cn";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchSpinConfig(): Promise<SpinPublicConfig> {
  const res = await fetch(`${API_URL}/public/spin/state`);
  if (!res.ok) {
    const body = await res.text();
    let detail = "Failed to load spin wheel";
    try {
      detail = (JSON.parse(body) as { detail?: string }).detail ?? detail;
    } catch {
      if (body) detail = body;
    }
    throw new Error(detail);
  }
  return res.json() as Promise<SpinPublicConfig>;
}

export default function HomePage() {
  const [config, setConfig] = useState<SpinPublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Wake the API early (Render free tier cold starts are slow).
    void fetch(`${API_URL}/health`).catch(() => {});

    async function loadConfig(options?: { silent?: boolean }) {
      try {
        const data = await fetchSpinConfig();
        if (!cancelled) {
          setConfig(data);
          setError(null);
        }
      } catch (err) {
        if (cancelled || options?.silent) return;
        const message =
          err instanceof TypeError && /fetch/i.test(err.message)
            ? `Cannot reach API at ${API_URL}. Make sure the API is running (npm run dev:api).`
            : err instanceof Error
              ? err.message
              : "Failed to load";
        setError(message);
      } finally {
        if (!cancelled && !options?.silent) setLoading(false);
      }
    }

    void loadConfig();
    const interval = window.setInterval(() => void loadConfig({ silent: true }), 5000);
    const onFocus = () => void loadConfig({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadConfig({ silent: true });
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const ratio = config?.screen_ratio ?? "auto";
  const shellClass = spinShellClass(ratio);
  const frameClass = spinFrameClass(ratio);
  const isFixedRatio = ratio === "9:16" || ratio === "16:9";

  const pageWrapperClass = spinPageWrapperClass(isFixedRatio);
  const frameBaseClass =
    "spin-page-bg relative flex h-full w-full min-h-0 flex-col items-center overflow-hidden";

  if (loading) {
    return (
      <div className={cn(shellClass, pageWrapperClass)}>
        <div className={cn(frameBaseClass, frameClass, "justify-center")}>
          <p className="text-sm text-slate-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(shellClass, pageWrapperClass, !isFixedRatio && "px-6")}>
        <div className={cn(frameBaseClass, frameClass, "justify-center px-6 py-8")}>
          <p className="rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!shouldShowSpin(config)) {
    return (
      <div className={cn(shellClass, pageWrapperClass, !isFixedRatio && "px-6")}>
        <div
          className={cn(
            frameBaseClass,
            frameClass,
            "justify-center gap-3 text-center px-6 py-12",
          )}
        >
          <h1 className="text-2xl font-semibold text-slate-900">Raffle Spin</h1>
          <p className="max-w-md text-sm text-slate-600">
            The spin wheel is not available right now. Check back soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(shellClass, pageWrapperClass)}>
      <div className={cn(frameBaseClass, frameClass)}>
        <GiftCollectionFlow config={config!} />
      </div>
    </div>
  );
}
