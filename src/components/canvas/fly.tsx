"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Plays a note flying from where it was written (a point on screen) to where
 * it lands, then settling. With reduced motion it simply appears in place.
 */
export function Fly({ from, children }: { from?: { x: number; y: number } | null; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = el.current;
    if (!from || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = node.getBoundingClientRect();
    // On a zoomed canvas the note is scaled: the offset is on screen, the animation is in the note's own units.
    const k = node.offsetWidth ? r.width / node.offsetWidth : 1;
    const dx = (from.x - (r.left + r.width / 2)) / k;
    const dy = (from.y - (r.top + r.height / 2)) / k;
    node.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(0.92)`, opacity: 0.7 },
        { transform: "translate(0, 0) scale(1.03)", opacity: 1, offset: 0.8 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
    // Only on arrival: later renders leave it where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={el}>{children}</div>;
}
