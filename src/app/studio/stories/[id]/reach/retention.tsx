"use client";

import { useState } from "react";

export type RetentionPoint = { pct: number; kind: string; preview: string };

/**
 * Where readers stop: one bar per block of the story, in reading order, the
 * share of readers who reached it. The block where the most people left is
 * marked; hover or focus any bar to see which paragraph it is.
 */
export function Retention({ points, dropAt }: { points: RetentionPoint[]; dropAt: number | null }) {
  const [at, setAt] = useState<number | null>(dropAt);
  const shown = at ?? 0;
  const p = points[shown];
  const height = 180;
  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-end gap-[2px]" style={{ height }} role="list" aria-label="Share of readers who reached each paragraph">
        {[25, 50, 75, 100].map((g) => (
          <span key={g} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ bottom: `${g}%` }}>
            <span className="absolute -top-2 -left-0.5 -translate-x-full pr-1.5 text-[10px] text-mute">{g}%</span>
          </span>
        ))}
        {points.map((pt, i) => {
          const isDrop = i === dropAt;
          const active = i === at;
          return (
            <button
              key={i}
              type="button"
              role="listitem"
              aria-label={`Paragraph ${i + 1}: ${pt.pct}% of readers reached it`}
              onMouseEnter={() => setAt(i)}
              onFocus={() => setAt(i)}
              className="relative h-full min-w-[3px] flex-1 cursor-default rounded-t-[3px] outline-none"
            >
              <span
                className="absolute inset-x-0 bottom-0 rounded-t-[3px] transition-[height]"
                style={{
                  height: `${Math.max(pt.pct, 1)}%`,
                  background: isDrop ? "var(--red)" : "var(--studio-blue)",
                  opacity: active || isDrop ? 1 : pt.kind === "img" ? 0.45 : 0.75,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-mute">
        <span>Top of the story</span>
        <span>The end</span>
      </div>
      {p && (
        <div className="flex flex-col gap-1 rounded-xl bg-soft px-4 py-3">
          <span className="text-[12px] text-mute">
            {shown === dropAt ? "Most readers leave after this · " : ""}
            {p.kind === "img" ? "Picture" : p.kind === "h" ? "Heading" : p.kind === "quote" ? "Quote" : "Paragraph"} {shown + 1} of {points.length} · <span className="font-semibold text-ink">{p.pct}%</span> of readers got here
          </span>
          <span className="story-serif line-clamp-2 text-[15px] leading-snug text-ink">{p.preview || "—"}</span>
        </div>
      )}
    </div>
  );
}
