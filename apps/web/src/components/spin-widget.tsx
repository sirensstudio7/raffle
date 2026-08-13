"use client";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PRIZE_ITEM_SIZE = 168;
const PRIZE_ITEM_GAP = 20;
const MYSTERY_ITEM_SIZE = 112;
const MYSTERY_ITEM_SIZE_PORTRAIT = 196;
const MYSTERY_ITEM_GAP = 8;
const MYSTERY_ITEM_GAP_PORTRAIT = 56;
const MYSTERY_VISIBLE = 4;
const PRIZE_VISIBLE = 3;
const LOOPS = 48;
const SPIN_SPEED = 9;
const MIN_SPIN_MS = 2000;
const STOP_MS = 1400;
const WIN_ANIM_MS = 5000;
const SPIN_SOUND_SRC = "/sounds/lucky-spin-wheel.mp3";
const WIN_SOUND_SRC = "/sounds/lucky-spin-win.mp3";
const CONFETTI_SOUND_SRC = "/sounds/lucky-spin-confetti.mp3";
const CONFETTI_COLORS = [
  "#fb923c",
  "#fbbf24",
  "#34d399",
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#ffffff",
  "#facc15",
];

export type SpinWidgetVariant = "prizes" | "mysteryBoxes";

function mysteryLayoutForViewport(width: number, height: number): { itemSize: number; itemGap: number } {
  const portrait = height >= width;
  if (!portrait) {
    return { itemSize: MYSTERY_ITEM_SIZE, itemGap: MYSTERY_ITEM_GAP };
  }

  // Phones: fit reel + header/pill/button inside the viewport (desktop portrait unchanged).
  const phone = width < 480;
  if (phone) {
    const itemGap = Math.max(10, Math.round(height * 0.018));
    // Header, prize pill, Spin button, vertical padding/gaps.
    const reserved = Math.min(300, Math.max(220, Math.round(height * 0.4)));
    const available = Math.max(240, height - reserved);
    const fitted = Math.floor((available - itemGap * (MYSTERY_VISIBLE - 1)) / MYSTERY_VISIBLE);
    const maxSize = Math.min(148, Math.round(width * 0.36));
    const itemSize = Math.max(72, Math.min(maxSize, fitted));
    return { itemSize, itemGap };
  }

  const itemGap = MYSTERY_ITEM_GAP_PORTRAIT;
  // Scale up on tall portrait screens while keeping 4 boxes on screen.
  const fitted = Math.floor((height * 0.72 - itemGap * (MYSTERY_VISIBLE - 1)) / MYSTERY_VISIBLE);
  const itemSize = Math.max(MYSTERY_ITEM_SIZE, Math.min(MYSTERY_ITEM_SIZE_PORTRAIT, fitted));
  return { itemSize, itemGap };
}

function layoutForVariant(
  variant: SpinWidgetVariant,
  mysterySize = MYSTERY_ITEM_SIZE,
  mysteryGap = MYSTERY_ITEM_GAP,
) {
  const itemSize = variant === "mysteryBoxes" ? mysterySize : PRIZE_ITEM_SIZE;
  const itemGap = variant === "mysteryBoxes" ? mysteryGap : PRIZE_ITEM_GAP;
  const visible = variant === "mysteryBoxes" ? MYSTERY_VISIBLE : PRIZE_VISIBLE;
  const stride = itemSize + itemGap;
  const viewportH = itemSize * visible + itemGap * (visible - 1);
  // Mystery reel is top-aligned so all N boxes fill the viewport (no empty pad on top).
  const centerPad = variant === "mysteryBoxes" ? 0 : (viewportH - itemSize) / 2;
  return { itemSize, itemGap, visible, stride, viewportH, centerPad };
}

function offsetForPosition(position: number, stride: number, centerPad: number): number {
  return -(position * stride) + centerPad;
}

function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API_URL.replace(/\/$/, "")}${url}`;
  return url;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export type SpinPublicConfig = {
  active: boolean;
  enabled: boolean;
  screen_ratio?: "auto" | "9:16" | "16:9";
  spin_keybinding?: string;
  campaign: { id: string; name: string } | null;
  prizes: Array<{ id: string; name: string; image_url: string; probability: number }>;
};

export type SpinWinResult = {
  voucher_code: string;
  prize: { id: string; name: string; image_url: string; description: string };
};

export function SpinWinCard({
  result,
  className,
}: {
  result: SpinWinResult;
  className?: string;
}) {
  return (
    <div
      className={[
        "lucky-spin-win-card relative overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-3 px-3.5 pt-3.5">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
          {result.prize.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.prize.image_url}
              alt=""
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-xs font-semibold text-slate-400">
              {result.prize.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-slate-500">You pulled</p>
          <p className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight text-slate-900">
            {result.prize.name}
          </p>
        </div>
      </div>
      <div
        className="relative mx-3.5 my-3 h-px"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(148 163 184) 1px, transparent 1.5px)",
          backgroundSize: "8px 2px",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
        }}
      >
        <span className="absolute -left-[1.15rem] top-1/2 size-3 -translate-y-1/2 rounded-full bg-slate-100 ring-1 ring-slate-200" />
        <span className="absolute -right-[1.15rem] top-1/2 size-3 -translate-y-1/2 rounded-full bg-slate-100 ring-1 ring-slate-200" />
      </div>
      <div className="px-3.5 pb-3.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">
              Redeem code
            </p>
            <p className="mt-1 font-mono text-base font-semibold tracking-[0.14em] text-slate-900">
              {result.voucher_code}
            </p>
          </div>
          <span className="mb-0.5 shrink-0 text-[11px] font-medium text-orange-600">
            Show staff
          </span>
        </div>
      </div>
    </div>
  );
}

export function shouldShowSpin(config: SpinPublicConfig | null | undefined): boolean {
  return Boolean(config?.active && config.enabled && config.campaign);
}

type PrizeItem = { id: string; name: string; image_url: string; probability: number };

type SpinWidgetProps = {
  config: SpinPublicConfig;
  className?: string;
  onWin?: (result: SpinWinResult) => void;
  variant?: SpinWidgetVariant;
};

type ConfettiPiece = {
  id: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
  rotate: number;
  round: boolean;
};

export function WinConfetti({ burstKey }: { burstKey: number }) {
  const [mounted, setMounted] = useState(false);
  const pieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: 100 }, (_, i) => ({
      id: `${burstKey}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2.8 + Math.random() * 2.2,
      size: 8 + Math.random() * 10,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      drift: (Math.random() - 0.5) * 240,
      rotate: 360 + Math.random() * 720,
      round: Math.random() > 0.5,
    }));
  }, [burstKey]);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="lucky-spin-confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              width: piece.round ? piece.size : Math.max(4, piece.size * 0.45),
              height: piece.size,
              borderRadius: piece.round ? "999px" : "2px",
              backgroundColor: piece.color,
              animationDuration: `${piece.duration}s`,
              animationDelay: `${piece.delay}s`,
              "--confetti-x": `${piece.drift}px`,
              "--confetti-rot": `${piece.rotate}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>,
    document.body,
  );
}

function PrizeVisual({
  prize,
  focused,
  motion,
  celebrate,
  celebrateKey,
  variant = "prizes",
  itemSize,
}: {
  prize: PrizeItem;
  focused: boolean;
  motion: "idle" | "spinning" | "stopping";
  celebrate?: boolean;
  celebrateKey?: number;
  variant?: SpinWidgetVariant;
  itemSize: number;
}) {
  const mysteryMode = variant === "mysteryBoxes";
  const tone = mysteryMode
    ? "scale-100 opacity-100"
    : motion !== "idle"
      ? "scale-100 opacity-90"
      : focused
        ? "scale-100 opacity-100"
        : "scale-[0.72] opacity-40 blur-[1.5px]";

  const imageSrc = mysteryMode ? "/flow/mystery-box.webp?v=1" : prize.image_url;
  const imageAlt = mysteryMode ? "Mystery box" : prize.name;

  return (
    <div
      className={[
        "relative flex items-center justify-center bg-transparent",
        celebrate ? "" : "transition-all duration-300",
        tone,
      ].join(" ")}
      style={{ width: itemSize, height: itemSize }}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={celebrate ? `win-${celebrateKey}` : `idle-${prize.id}`}
          src={imageSrc}
          alt={imageAlt}
          className={[
            "bg-transparent object-contain",
            mysteryMode
              ? "h-full w-full"
              : focused && motion === "idle"
                ? "h-[92%] w-[92%]"
                : "h-[78%] w-[78%]",
            celebrate ? "lucky-spin-win-pop" : "",
          ].join(" ")}
          style={
            celebrate
              ? {
                  animationName: "lucky-spin-win-pop",
                  animationDuration: "5s",
                  animationTimingFunction: "linear",
                  animationFillMode: "both",
                  transformOrigin: "center center",
                }
              : undefined
          }
          draggable={false}
        />
      ) : (
        <span
          key={celebrate ? `win-text-${celebrateKey}` : `idle-text-${prize.id}`}
          className={[
            "text-sm font-semibold text-slate-600",
            celebrate ? "lucky-spin-win-pop inline-block" : "",
          ].join(" ")}
        >
          {prize.name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function SpinWidget({
  config,
  className,
  onWin,
  variant = "prizes",
}: SpinWidgetProps) {
  const mysteryMode = variant === "mysteryBoxes";
  const [mysterySize, setMysterySize] = useState(MYSTERY_ITEM_SIZE);
  const [mysteryGap, setMysteryGap] = useState(MYSTERY_ITEM_GAP);
  const layout = useMemo(
    () => layoutForVariant(variant, mysterySize, mysteryGap),
    [variant, mysterySize, mysteryGap],
  );
  const { itemSize, itemGap, stride, viewportH, centerPad } = layout;
  const [motion, setMotion] = useState<"idle" | "spinning" | "stopping">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpinWinResult | null>(null);
  const [position, setPosition] = useState(0);
  const [offsetY, setOffsetY] = useState(() => {
    const initial = layoutForVariant(variant, MYSTERY_ITEM_SIZE, MYSTERY_ITEM_GAP);
    return offsetForPosition(0, initial.stride, initial.centerPad);
  });
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  const positionRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const confettiAudioRef = useRef<HTMLAudioElement | null>(null);
  const spinFnRef = useRef<() => void>(() => {});
  const busy = motion !== "idle";

  useEffect(() => {
    if (!mysteryMode) return;
    const update = () => {
      const next = mysteryLayoutForViewport(window.innerWidth, window.innerHeight);
      setMysterySize(next.itemSize);
      setMysteryGap(next.itemGap);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mysteryMode]);

  useEffect(() => {
    setOffsetY(offsetForPosition(positionRef.current, stride, centerPad));
  }, [stride, centerPad]);

  function ensureSpinAudio() {
    if (typeof window === "undefined") return null;
    if (!spinAudioRef.current) {
      const audio = new Audio(SPIN_SOUND_SRC);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.85;
      spinAudioRef.current = audio;
    }
    return spinAudioRef.current;
  }

  function ensureWinAudio() {
    if (typeof window === "undefined") return null;
    if (!winAudioRef.current) {
      const audio = new Audio(WIN_SOUND_SRC);
      audio.preload = "auto";
      audio.volume = 0.9;
      winAudioRef.current = audio;
    }
    return winAudioRef.current;
  }

  function ensureConfettiAudio() {
    if (typeof window === "undefined") return null;
    if (!confettiAudioRef.current) {
      const audio = new Audio(CONFETTI_SOUND_SRC);
      audio.preload = "auto";
      audio.volume = 0.85;
      confettiAudioRef.current = audio;
    }
    return confettiAudioRef.current;
  }

  function playOneShot(audio: HTMLAudioElement | null) {
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }

  function startSpinSound() {
    const audio = ensureSpinAudio();
    if (!audio) return;
    try {
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    } catch {
      // ignore
    }
  }

  function stopSpinSound() {
    const audio = spinAudioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  }

  const prizes = useMemo<PrizeItem[]>(() => {
    const list = config.prizes.length
      ? config.prizes
      : [{ id: "empty", name: "Prize", image_url: "", probability: 100 }];
    return list.map((prize) => ({
      ...prize,
      image_url: resolveAssetUrl(prize.image_url),
    }));
  }, [config.prizes]);

  const strip = useMemo(() => {
    const items: PrizeItem[] = [];
    for (let loop = 0; loop < LOOPS; loop += 1) {
      for (const prize of prizes) items.push(prize);
    }
    return items;
  }, [prizes]);

  function applyPosition(next: number) {
    positionRef.current = next;
    setPosition(next);
    setOffsetY(offsetForPosition(next, stride, centerPad));
  }

  function stopRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function startLoopSpin() {
    stopRaf();
    let last = performance.now();
    const cycle = Math.max(prizes.length, 1);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let next = positionRef.current + SPIN_SPEED * dt;
      const wrapAt = cycle * (LOOPS - 8);
      if (next > wrapAt) next = cycle * 2 + (next % cycle);
      applyPosition(next);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }

  function easeOutCubic(t: number) {
    return 1 - (1 - t) ** 3;
  }

  function animateTo(target: number, durationMs: number) {
    stopRaf();
    const from = positionRef.current;
    const start = performance.now();

    return new Promise<void>((resolve) => {
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        applyPosition(from + (target - from) * easeOutCubic(t));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          rafRef.current = null;
          applyPosition(target);
          resolve();
        }
      };
      rafRef.current = requestAnimationFrame(frame);
    });
  }

  async function onSpin() {
    if (busy || celebrating || prizes.length === 0) return;
    setError(null);
    setResult(null);
    setCelebrating(false);
    setMotion("spinning");
    ensureWinAudio();
    ensureConfettiAudio();
    startSpinSound();
    startLoopSpin();

    try {
      const [response] = await Promise.all([
        fetch(`${API_URL}/public/spin/spin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
        sleep(MIN_SPIN_MS),
      ]);
      const data = (await response.json()) as { detail?: string } & SpinWinResult;
      if (!response.ok) throw new Error(data.detail || "Spin failed");

      const prizeIndex = Math.max(
        0,
        prizes.findIndex((prize) => prize.id === data.prize.id),
      );
      const cycle = prizes.length;
      const current = positionRef.current;
      let target = Math.floor(current) + 1;
      while (target % cycle !== prizeIndex) target += 1;
      target += cycle * 2;

      setMotion("stopping");
      await animateTo(target, STOP_MS);
      stopSpinSound();

      const winResult: SpinWinResult = {
        ...data,
        prize: { ...data.prize, image_url: resolveAssetUrl(data.prize.image_url) },
      };
      setResult(winResult);
      setMotion("idle");

      if (mysteryMode) {
        onWin?.(winResult);
        applyPosition(cycle * 2 + prizeIndex);
        return;
      }

      playOneShot(ensureWinAudio());
      playOneShot(ensureConfettiAudio());
      setCelebrateKey((key) => key + 1);
      setCelebrating(true);
      onWin?.(winResult);

      await sleep(WIN_ANIM_MS);
      setCelebrating(false);
      applyPosition(cycle * 2 + prizeIndex);
    } catch (err) {
      stopRaf();
      stopSpinSound();
      setCelebrating(false);
      setMotion("idle");
      setError(err instanceof Error ? err.message : "Spin failed");
    }
  }

  spinFnRef.current = () => {
    void onSpin();
  };

  const spinKeybinding = config.spin_keybinding?.trim() ?? "";

  useEffect(() => {
    return () => {
      stopRaf();
      stopSpinSound();
      spinAudioRef.current = null;
      winAudioRef.current = null;
      confettiAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!spinKeybinding) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== spinKeybinding) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      event.preventDefault();
      spinFnRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spinKeybinding]);

  const focusedIndex = Math.round(position);

  return (
    <div
      className={[
        "pointer-events-auto flex w-[min(90vw,24rem)] flex-col items-center text-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {celebrating ? <WinConfetti burstKey={celebrateKey} /> : null}

      <div
        className="relative w-full touch-none overflow-hidden bg-transparent select-none"
        style={{ height: viewportH }}
      >
        <div
          className="absolute inset-x-0 top-0 flex flex-col items-center overflow-hidden bg-transparent will-change-transform"
          style={{ transform: `translate3d(0, ${offsetY}px, 0)`, gap: itemGap }}
        >
          {strip.map((prize, index) => {
            const focused = motion === "idle" && index === focusedIndex;
            const celebrate = Boolean(celebrating && focused);
            return (
              <div
                key={`${prize.id}-${index}`}
                className="flex shrink-0 items-center justify-center"
                style={{ height: itemSize, width: itemSize }}
              >
                <PrizeVisual
                  prize={prize}
                  focused={focused}
                  motion={motion}
                  celebrate={celebrate}
                  celebrateKey={celebrateKey}
                  variant={variant}
                  itemSize={itemSize}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex w-full flex-col items-center gap-2 sm:mt-5 sm:gap-3">
        <button
          type="button"
          disabled={busy || celebrating}
          onClick={() => void onSpin()}
          className="inline-flex items-center gap-2 rounded-full border border-sky-600/25 bg-white/90 px-7 py-2.5 text-sm font-semibold text-sky-900 shadow-[0_8px_24px_rgba(91,185,232,0.35)] backdrop-blur-md transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowPathIcon className={["size-4", busy ? "animate-spin" : ""].join(" ")} aria-hidden />
          {busy ? "Spinning…" : result ? "Spin Again" : "Spin"}
        </button>
        {error ? (
          <p className="rounded-full bg-red-500/80 px-3 py-1 text-center text-xs font-medium text-white">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
