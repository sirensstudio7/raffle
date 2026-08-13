"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const THEME_COLORS = [
  "#f44336",
  "#e91e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#2196f3",
  "#03a9f4",
  "#00bcd4",
  "#009688",
  "#4CAF50",
  "#8BC34A",
  "#CDDC39",
  "#FFEB3B",
  "#FFC107",
  "#FF9800",
  "#FF5722",
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickColor() {
  return THEME_COLORS[Math.floor(Math.random() * THEME_COLORS.length)]!;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  friction: number;
  size: number;
  color: string;
  shape: 0 | 1;
  priseFacteur: number;
  multFacteur: number;
  priseAngle: number;
  priseVitesse: number;
};

function createParticle(width: number): Particle {
  return {
    x: rand(0, width),
    y: rand(-20, -100),
    vx: rand(-6, 6),
    vy: rand(-10, 2),
    friction: rand(0.995, 0.98),
    size: Math.round(rand(5, 15)),
    color: pickColor(),
    shape: Math.round(rand(0, 1)) as 0 | 1,
    priseFacteur: rand(-0.02, 0.02),
    multFacteur: rand(0.01, 0.08),
    priseAngle: 0,
    priseVitesse: 0.05,
  };
}

function resetParticle(p: Particle, width: number) {
  p.x = rand(0, width);
  p.y = rand(-20, -100);
  p.vx = rand(-6, 6);
  p.vy = rand(-10, 2);
  p.friction = rand(0.995, 0.98);
  p.size = Math.round(rand(5, 15));
  p.color = pickColor();
  p.shape = Math.round(rand(0, 1)) as 0 | 1;
}

export function CanvasConfetti({
  active,
  burstKey,
  count = 220,
}: {
  active: boolean;
  burstKey: number;
  count?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!active || !mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let raf = 0;
    const gravityY = 0.1;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles = Array.from({ length: count }, () => createParticle(width));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        const prise = p.priseFacteur + Math.cos(p.priseAngle) * p.multFacteur;
        p.priseAngle += p.priseVitesse;

        p.vy += gravityY;
        p.vx += prise;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;

        if (p.y > height || p.x < 0 || p.x > width + 10) {
          resetParticle(p, width);
        }

        const flap = 0.5 + Math.sin(p.vy * 20) * 0.5;
        const half = p.size / 2;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.vx * 2);
        ctx.scale(1, flap);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        if (p.shape === 0) {
          ctx.rect(-half, -half, p.size, p.size);
        } else {
          ctx.ellipse(0, 0, half, half, 0, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }

      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active, burstKey, count, mounted]);

  if (!active || !mounted) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      key={burstKey}
      className="pointer-events-none fixed inset-0 z-[9999]"
      aria-hidden
    />,
    document.body,
  );
}
