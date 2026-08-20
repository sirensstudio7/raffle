"use client";

import { useEffect, useRef, useState } from "react";
import { CanvasConfetti } from "@/components/canvas-confetti";
import { BottomDecor, SideDecor } from "@/components/side-decor";
import {
  SpinWidget,
  type SpinPublicConfig,
  type SpinWinResult,
} from "@/components/spin-widget";
import { cn } from "@/lib/cn";
import { matchesSpinKeybinding } from "@/lib/keybinding";

type FlowStep = "thankYou" | "spin" | "opening" | "reveal";

const OPEN_HOLD_MS = 2800;
const BOX_SHAKE_DELAY_MS = 700;
const BOX_SHAKE_SOUND_MS = 1800;
const CONFETTI_SOUND_SRC = "/sounds/lucky-spin-confetti.mp3";
const BOX_SHAKE_SOUND_SRC = "/sounds/box-shake.mp3";

function playConfettiSound() {
  try {
    const audio = new Audio(CONFETTI_SOUND_SRC);
    audio.volume = 0.85;
    void audio.play().catch(() => {});
  } catch {
    // ignore autoplay / missing file
  }
}

function playBoxShakeSound(): HTMLAudioElement | null {
  try {
    const audio = new Audio(BOX_SHAKE_SOUND_SRC);
    audio.loop = true;
    audio.volume = 0.95;
    void audio.play().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}

function FlowHeader() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex w-full items-center justify-between gap-2 px-3 pt-[max(0.65rem,env(safe-area-inset-top))] sm:gap-3 sm:px-8 sm:pt-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/google.png"
        alt="Google"
        className="h-5 w-auto shrink-0 object-contain sm:h-8"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/team-google.png"
        alt="#TeamGoogle Google Student Ambassador"
        className="h-10 w-auto max-w-[46%] object-contain object-right sm:h-20 sm:max-w-[58%]"
      />
    </header>
  );
}

function FloatingDoodles() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <span className="gift-doodle gift-doodle-a" />
      <span className="gift-doodle gift-doodle-b" />
      <span className="gift-doodle gift-doodle-c" />
      <span className="gift-doodle gift-doodle-d" />
      <span className="gift-doodle gift-doodle-e" />
      <span className="gift-doodle gift-doodle-f" />
      <span className="gift-doodle gift-doodle-g" />
      <span className="gift-doodle gift-doodle-h" />
    </div>
  );
}

function PrizePill({ label }: { label: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const fit = () => {
      const maxPx = window.matchMedia("(min-width: 640px)").matches ? 30 : 24;
      const minPx = 12;
      let size = maxPx;
      text.style.fontSize = `${size}px`;
      text.style.whiteSpace = "nowrap";

      while (size > minPx && text.scrollWidth > box.clientWidth) {
        size -= 1;
        text.style.fontSize = `${size}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [label]);

  return (
    <div
      className="relative h-[clamp(3.25rem,9dvh,4.75rem)] w-full max-w-[min(92vw,26rem)] shrink-0"
      role="img"
      aria-label={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/flow/prize-ribbon.png?v=2"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        draggable={false}
        aria-hidden
      />
      <span
        ref={boxRef}
        className="absolute inset-y-0 left-1/2 z-10 flex w-[72%] -translate-x-1/2 items-center justify-center overflow-hidden"
      >
        <span
          ref={textRef}
          className="text-center font-bold leading-none tracking-wide text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.55)]"
        >
          {label}
        </span>
      </span>
    </div>
  );
}

type GiftCollectionFlowProps = {
  config: SpinPublicConfig;
  onWin?: (result: SpinWinResult) => void;
  className?: string;
};

export function GiftCollectionFlow({ config, onWin, className }: GiftCollectionFlowProps) {
  const [step, setStep] = useState<FlowStep>("thankYou");
  const [result, setResult] = useState<SpinWinResult | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const actionRef = useRef<() => void>(() => {});

  const campaignName = config.campaign?.name ?? "Hadiah";
  const spinKeybinding = config.spin_keybinding?.trim() ?? "";

  function advanceFromThankYou() {
    if (step !== "thankYou") return;
    // Nudge API awake before the spin screen mounts and prefetches.
    void fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/health`).catch(
      () => {},
    );
    setStep("spin");
  }

  function restartForAnotherPrize() {
    if (step !== "reveal") return;
    setResult(null);
    setStep("thankYou");
  }

  function handleWin(win: SpinWinResult) {
    setResult(win);
    onWin?.(win);
    setStep("opening");
  }

  actionRef.current = () => {
    if (step === "thankYou") advanceFromThankYou();
    else if (step === "reveal") restartForAnotherPrize();
  };

  useEffect(() => {
    if (step !== "opening") return;
    let shakeAudio: HTMLAudioElement | null = null;
    const shakeStart = window.setTimeout(() => {
      shakeAudio = playBoxShakeSound();
    }, BOX_SHAKE_DELAY_MS);
    const shakeStop = window.setTimeout(() => {
      if (!shakeAudio) return;
      try {
        shakeAudio.pause();
        shakeAudio.currentTime = 0;
      } catch {
        // ignore
      }
      shakeAudio = null;
    }, BOX_SHAKE_DELAY_MS + BOX_SHAKE_SOUND_MS);
    const timer = window.setTimeout(() => {
      setConfettiKey((key) => key + 1);
      playConfettiSound();
      setStep("reveal");
    }, OPEN_HOLD_MS);
    return () => {
      window.clearTimeout(shakeStart);
      window.clearTimeout(shakeStop);
      window.clearTimeout(timer);
      if (shakeAudio) {
        try {
          shakeAudio.pause();
        } catch {
          // ignore
        }
      }
    };
  }, [step]);

  useEffect(() => {
    if (!spinKeybinding) return;
    if (step !== "thankYou" && step !== "reveal") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!matchesSpinKeybinding(event, spinKeybinding)) return;
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
      event.stopPropagation();
      actionRef.current();
    };

    // Capture so Enter/Space still work even if Mulai (or another control) is focused.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [spinKeybinding, step]);

  return (
    <div
      className={cn(
        "relative flex h-full w-full min-h-0 flex-col items-center overflow-hidden",
        className,
      )}
    >
      <FloatingDoodles />
      <FlowHeader />

      <SideDecor side="left" />
      <SideDecor side="right" />

      <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[4.25rem] sm:px-4 sm:pb-6 sm:pt-24">
        {step === "thankYou" ? (
          <div className="gift-step-in flex w-full max-w-2xl flex-col items-center gap-4 text-center sm:gap-8">
            <div className="w-full space-y-3 sm:space-y-5">
              <h1 className="gift-thankyou-title font-bold leading-[1.15] tracking-tight text-slate-900">
                <span className="block max-sm:whitespace-normal whitespace-nowrap">
                  Terima kasih telah
                </span>
                <span className="block max-sm:whitespace-normal whitespace-nowrap">
                  menyelesaikan misimu.
                </span>
              </h1>
              <div className="relative">
                <p className="gift-thankyou-title font-bold leading-[1.15] tracking-tight text-slate-900">
                  <span className="block max-sm:whitespace-normal whitespace-nowrap">
                    Klik tombol di bawah
                  </span>
                  <span className="block max-sm:whitespace-normal whitespace-nowrap">
                    untuk dapatkan hadiah.
                  </span>
                </p>
                <BottomDecor />
              </div>
            </div>
            <button
              type="button"
              onClick={advanceFromThankYou}
              aria-label="Mulai"
              className="relative z-20 mt-4 max-w-[min(100%,18rem)] transition active:scale-[0.98] hover:opacity-95 sm:mt-10 sm:max-w-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/flow/mulai-button.png"
                alt="Mulai"
                className="mx-auto h-14 w-auto max-w-full object-contain sm:h-20"
                draggable={false}
              />
            </button>
          </div>
        ) : null}

        {step === "spin" ? (
          <div className="gift-step-in flex w-full max-w-lg flex-col items-center gap-2 sm:gap-4">
            <PrizePill label={campaignName} />
            <SpinWidget variant="mysteryBoxes" config={config} onWin={handleWin} />
          </div>
        ) : null}

        {step === "opening" ? (
          <div className="gift-step-in flex w-full max-w-sm flex-col items-center gap-6">
            <div className="gift-box-opening gift-box-open-shake">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/flow/mystery-box-open.webp?v=1"
                alt=""
                className="h-44 w-44 object-contain drop-shadow-xl sm:h-64 sm:w-64"
                draggable={false}
              />
            </div>
          </div>
        ) : null}

        {step === "reveal" && result ? (
          <div className="gift-reveal-in flex max-h-full w-full max-w-xl flex-col items-center justify-center gap-1.5 text-center sm:gap-3">
            <CanvasConfetti active burstKey={confettiKey} />
            <div className="space-y-1.5 sm:space-y-3">
              <h1 className="gift-reveal-title font-bold tracking-tight text-slate-900">
                Selamat!
              </h1>
              <p className="gift-reveal-subtitle font-bold leading-none tracking-tight text-slate-900">
                <span className="block max-sm:whitespace-normal whitespace-nowrap">
                  Kamu mendapatkan
                </span>
                <span className="block max-sm:whitespace-normal whitespace-nowrap">1 buah</span>
              </p>
            </div>
            <PrizePill label={result.prize.name} />
            <div className="gift-reveal-prize flex shrink-0 items-center justify-center">
              <div className="gift-prize-pop flex size-full items-center justify-center">
                {result.prize.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.prize.image_url}
                    alt={result.prize.name}
                    className="gift-prize-shake max-h-full max-w-full object-contain drop-shadow-xl"
                    draggable={false}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center rounded-2xl bg-white/50 text-3xl font-bold text-slate-500">
                    {result.prize.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={restartForAnotherPrize}
              className="mt-0.5 shrink-0 text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
            >
              Ambil hadiah lagi
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
