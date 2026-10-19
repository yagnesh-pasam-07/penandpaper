import type { CSSProperties } from "react";

/**
 * Bubble looks, shared by every module that puts thoughts on paper (Drop's
 * personal paper, the team planner). Kept quiet on purpose: a full day can
 * hold dozens of thoughts, so they're notes and pills with a slight tilt, told
 * apart by tint. Picked by a stored number so a thought keeps its look.
 */
export const BUBBLE_SHAPES: { radius: string; rotate: number; tint: string }[] = [
  { radius: "18px", rotate: -1, tint: "var(--t1)" },
  { radius: "999px", rotate: 0.6, tint: "var(--t2)" },
  { radius: "18px", rotate: 1, tint: "var(--t3)" },
  { radius: "22px 22px 22px 6px", rotate: -0.6, tint: "var(--t5)" },
  { radius: "999px", rotate: -0.8, tint: "var(--t4)" },
  { radius: "22px 22px 6px 22px", rotate: 0.8, tint: "var(--t2)" },
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
