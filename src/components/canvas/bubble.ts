import type { CSSProperties } from "react";

/**
 * Hand-drawn bubble looks, shared by every module that puts thoughts on paper
 * (Drop's personal paper, the team planner). Pick one by a stored number so a
 * thought keeps its look across reloads.
 */
export const BUBBLE_SHAPES: { radius: string; rotate: number; tint: string }[] = [
  { radius: "58% 42% 55% 45% / 50% 58% 42% 50%", rotate: -3, tint: "var(--t1)" },
  { radius: "50%", rotate: 2, tint: "var(--t2)" },
  { radius: "20px", rotate: -1, tint: "var(--t3)" },
  { radius: "999px 999px 20px 20px", rotate: 3, tint: "var(--t5)" },
  { radius: "40% 60% 35% 65% / 60% 40% 60% 40%", rotate: -2, tint: "var(--t4)" },
  { radius: "58% 42% 55% 45% / 50% 58% 42% 50%", rotate: 4, tint: "var(--t2)" },
];

export function bubbleStyle(shape: number, lifted = false): CSSProperties {
  const s = BUBBLE_SHAPES[Math.abs(shape) % BUBBLE_SHAPES.length];
  return {
    borderRadius: s.radius,
    background: s.tint,
    transform: lifted ? "rotate(-7deg)" : `rotate(${s.rotate}deg)`,
    boxShadow: lifted ? "0 24px 40px -18px var(--shadow)" : undefined,
  };
}
