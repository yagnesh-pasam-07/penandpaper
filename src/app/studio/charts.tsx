"use client";

import { useState } from "react";

/**
 * Studio's charts. One series each, in the Studio blue (validated against both
 * surfaces), so no legend is needed: the tab or title names it. Thin bars with
 * 4px rounded tops on the baseline, a 2px gap, recessive gridlines, a hover and
 * focus tooltip on every bar, and a table view for exact numbers.
 */

export type Series = { key: string; label: string; unit: string; values: { label: string; short: string; value: number }[] };

/** The main chart: tabs across the top (like the headline cards), one bar per day. */
export function TabbedChart({ series, height = 220 }: { series: Series[]; height?: number }) {
  const [tab, setTab] = useState(0);
  const s = series[tab];
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Chart" className="flex flex-wrap gap-1">
        {series.map((x, i) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors ${i === tab ? "bg-[var(--studio-blue)] text-white" : "text-mute hover:bg-soft hover:text-ink"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <Bars data={s.values} unit={s.unit} height={height} />
    </div>
  );
}

export function Bars({ data, unit, height = 160 }: { data: { label: string; short: string; value: number }[]; unit: string; height?: number }) {
  const [at, setAt] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const hot = at === null ? null : data[at];
  const every = Math.max(1, Math.ceil(data.length / 7));
  const total = data.reduce((k, d) => k + d.value, 0);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex h-5 items-baseline justify-end text-[13px] tabular-nums">
        <span aria-live="polite" className={hot ? "text-ink" : "text-mute"}>
          {hot ? `${hot.label} · ${hot.value.toLocaleString()} ${unit}` : `${total.toLocaleString()} ${unit} in all · peak ${max.toLocaleString()}`}
        </span>
      </figcaption>
      <div className="relative" style={{ height }} onMouseLeave={() => setAt(null)}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <div key={f} aria-hidden="true" className="absolute inset-x-0 border-t border-line/50" style={{ bottom: `${f * 100}%` }} />
        ))}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-line" />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <button
              key={d.label}
              type="button"
              aria-label={`${d.label}: ${d.value} ${unit}`}
              onMouseEnter={() => setAt(i)}
              onFocus={() => setAt(i)}
              onBlur={() => setAt(null)}
              className="group flex h-full min-w-0 flex-1 items-end focus-visible:outline-2 focus-visible:outline-[var(--studio-blue)]"
            >
              <span
                className={`block w-full rounded-t-[4px] transition-opacity ${at !== null && at !== i ? "opacity-45" : ""}`}
                style={{ height: d.value ? `max(2px, ${(d.value / max) * 100}%)` : 0, background: "var(--studio-blue)" }}
              />
            </button>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex gap-[2px] text-[11px] text-mute tabular-nums">
        {data.map((d, i) => (
          <span key={d.label} className="min-w-0 flex-1 text-center whitespace-nowrap">
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

/** A thin horizontal bar with the number and its change beside it, longest first. */
export function RankBars({ data }: { data: { label: string; now: number; before: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.now));
  const sum = data.reduce((k, d) => k + d.now, 0);
  return (
    <ul className="flex flex-col gap-3.5">
      {[...data]
        .sort((a, b) => b.now - a.now)
        .map((d) => (
          <li key={d.label} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-[14px]">
            <span className="truncate">{d.label}</span>
            <span className="h-2 rounded-full bg-soft">
              <span className="block h-2 rounded-full" style={{ width: d.now ? `max(4px, ${(d.now / max) * 100}%)` : 0, background: "var(--studio-blue)" }} />
            </span>
            <span className="flex w-[104px] items-baseline justify-end gap-2 tabular-nums">
              <span className="font-semibold">{d.now.toLocaleString()}</span>
              <span className="text-[12px] text-mute">{sum ? Math.round((d.now / sum) * 100) : 0}%</span>
            </span>
          </li>
        ))}
    </ul>
  );
}

/** When people think: one row of seven days, one of 24 hours, darker = more. */
export function Rhythm({ weekdays, hours }: { weekdays: number[]; hours: number[] }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cell = (v: number, max: number) => ({ background: "var(--studio-blue)", opacity: max ? 0.12 + 0.88 * (v / max) : 0.12 });
  const dmax = Math.max(...weekdays);
  const hmax = Math.max(...hours);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-mute">By day</span>
        <div className="grid grid-cols-7 gap-1.5">
          {weekdays.map((v, i) => (
            <span key={i} className="flex flex-col items-center gap-1" title={`${days[i]}: ${v} thoughts`}>
              <span className="h-9 w-full rounded-md" style={cell(v, dmax)} />
              <span className="text-[11px] text-mute">{days[i]}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[12px] text-mute">By hour</span>
        <div className="grid grid-cols-24 gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {hours.map((v, i) => (
            <span key={i} className="h-7 rounded-[3px]" style={cell(v, hmax)} title={`${i}:00: ${v} thoughts`} />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-mute tabular-nums">
          <span>12 am</span>
          <span>6 am</span>
          <span>12 pm</span>
          <span>6 pm</span>
          <span>11 pm</span>
        </div>
      </div>
    </div>
  );
}
