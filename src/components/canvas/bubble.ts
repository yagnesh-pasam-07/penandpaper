import type { CSSProperties } from "react";

/**
 * Bubble looks, shared by every module that puts thoughts on paper (Drop's
 * personal paper, the team planner). Each slot is a tint and a slight tilt;
 * the outline itself is drawn by hand from a seed, so no two bubbles share
 * the same wobble and none is a perfect shape.
 */
export const BUBBLE_SHAPES: { rotate: number; tint: string }[] = [
  { rotate: -1.2, tint: "var(--t1)" },
  { rotate: 0.8, tint: "var(--t2)" },
  { rotate: 1.4, tint: "var(--t3)" },
  { rotate: -0.7, tint: "var(--t5)" },
  { rotate: -1.6, tint: "var(--t4)" },
  { rotate: 1, tint: "var(--t2)" },
];

/** 0..1, the same for the same text everywhere. */
function rand(seed: string, salt: number): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h >>> 0) / 0xffffffff;
}

/**
 * A hand-drawn outline: each corner pairs a long sweep with a tight turn, the
 * way a pen goes round a note, so the edges bow and wobble a little.
 */
export function handRadius(seed: string): string {
  // Shares of the bubble's own size, kept under 100% per side so the browser
  // never scales the wobble away on a small bubble.
  const sweep = (i: number) => Math.round(38 + rand(seed, i) * 30);
  const turn = (i: number) => Math.round(6 + rand(seed, i) * 14);
  const flip = rand(seed, 99) > 0.5;
  const h = [0, 1, 2, 3].map((i) => ((i % 2 === 0) !== flip ? sweep(i) : turn(i)));
  const v = [0, 1, 2, 3].map((i) => ((i % 2 === 0) !== flip ? turn(i + 4) : sweep(i + 4)));
  return `${h.map((n) => `${n}%`).join(" ")} / ${v.map((n) => `${n}%`).join(" ")}`;
}

export function bubbleStyle(shape: number, lifted = false, seed = String(shape)): CSSProperties {
  const s = BUBBLE_SHAPES[Math.abs(shape) % BUBBLE_SHAPES.length];
  return {
    borderRadius: handRadius(seed),
    background: s.tint,
    // A faint ink edge, like the outline of a sketched note (lighter than the fill in the dark theme).
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--ink) 16%, transparent)${lifted ? ", 0 24px 40px -18px var(--shadow)" : ""}`,
    transform: lifted ? "rotate(-7deg)" : `rotate(${s.rotate}deg)`,
  };
}
