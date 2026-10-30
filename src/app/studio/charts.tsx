"use client";

import { useState } from "react";

/**
 * One series of bars over time or categories: one ink colour (no legend: the
 * title names it), thin bars with 4px rounded tops on the baseline, a 2px gap,
 * a recessive baseline, and a hover/focus tooltip on every bar. A table view
 * sits beside it for screen readers and exact numbers.
 */
export function Bars({ title, data, unit, height = 160 }: { title: string; data: { label: string; short: string; value: number }[]; unit: string; height?: number }) {
  const [at, setAt] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const hot = at === null ? null : data[at];
  // Label a handful of ticks, never every bar.
  const every = Math.max(1, Math.ceil(data.length / 6));
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-mute">{title}</span>
        <span aria-live="polite" className="text-[13px] text-ink tabular-nums">
          {hot ? `${hot.label}: ${hot.value.toLocaleString()} ${unit}` : `peak ${max.toLocaleString()}`}
        </span>
      </figcaption>
      <div className="relative" style={{ height }} onMouseLeave={() => setAt(null)}>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-line" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-dashed border-line/70" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <button
              key={d.label}
              type="button"
              aria-label={`${d.label}: ${d.value} ${unit}`}
              onMouseEnter={() => setAt(i)}
              onFocus={() => setAt(i)}
              onBlur={() => setAt(null)}
              // The hit target is the whole column, not just the bar.
              className="group flex h-full min-w-0 flex-1 items-end focus-visible:outline-2 focus-visible:outline-red-text"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${at === i ? "bg-red" : "bg-ink/70 group-hover:bg-ink"}`}
                style={{ height: d.value ? `max(2px, ${(d.value / max) * 100}%)` : 0 }}
              />
            </button>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-[2px] text-[11px] text-mute tabular-nums">
        {data.map((d, i) => (
          <span key={d.label} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {i % every === 0 || i === data.length - 1 ? d.short : ""}
          </span>
        ))}
      </div>
      <details className="text-[13px] text-mute">
        <summary className="cursor-pointer select-none hover:text-ink">Table</summary>
        <table className="mt-2 w-full max-w-[360px] tabular-nums">
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b border-line/60">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right text-ink">{d.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Where thoughts come from: one bar per source, longest first, the share written beside it. */
export function SourceBars({ data }: { data: { label: string; value: number; total: number }[] }) {
  const sum = data.reduce((n, d) => n + d.value, 0);
  const max = Math.max(1, ...data.map((d) => d.value));
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((d) => (
        <li key={d.label} className="grid grid-cols-[132px_1fr_88px] items-center gap-3 text-[14px]" title={`${d.label}: ${d.value} this week, ${d.total} in all`}>
          <span className="truncate">{d.label}</span>
          <span className="h-3 rounded-r-[4px] bg-soft">
            <span className="block h-3 rounded-r-[4px] bg-ink/70" style={{ width: d.value ? `max(3px, ${(d.value / max) * 100}%)` : 0 }} />
          </span>
          <span className="text-right text-mute tabular-nums">
            <span className="text-ink">{d.value.toLocaleString()}</span> · {sum ? Math.round((d.value / sum) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}
