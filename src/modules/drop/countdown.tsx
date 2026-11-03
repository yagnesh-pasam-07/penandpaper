"use client";

import { useEffect, useRef, useState } from "react";
import { countdown, dayRange, partsIn } from "./logic";

/** The viewer's day, kept fresh: it turns over at their midnight, so "10 days" becomes "9" without a reload. */
export function useToday(tz: string): string {
  const [today, setToday] = useState(() => partsIn(new Date(), tz).date);
  useEffect(() => {
    const t = setInterval(() => setToday(partsIn(new Date(), tz).date), 60_000);
    return () => clearInterval(t);
  }, [tz]);
  return today;
}

const PHASE = {
  ahead: "text-ink",
  soon: "text-red-text",
  now: "text-[var(--ink-viridian)]",
  past: "text-mute",
} as const;

/**
 * A countdown, like the stub of a ticket: the date on the left, how long to
 * go on the right, a perforation between. "13 Nov ┆ 10 days to go".
 * Red when it's three days or less; green while it's happening.
 */
export function CountdownStub({ on, until, today, onClick, size = "sm" }: { on: string; until?: string | null; today: string; onClick?: () => void; size?: "sm" | "lg" }) {
  const c = countdown(on, until, today);
  const when = dayRange(on, until, today);
  const big = size === "lg";
  const inner = (
    <>
      <span className={`flex items-center gap-1 ${big ? "px-3" : "px-2"} font-sans font-semibold tracking-[0.02em] uppercase ${big ? "text-[12px]" : "text-[10.5px]"} text-mute`}>
        <svg width={big ? 12 : 10} height={big ? 12 : 10} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="1.5" y="2.5" width="9" height="8" rx="1.5" />
          <path d="M1.5 5h9M4 1.2v2.4M8 1.2v2.4" strokeLinecap="round" />
        </svg>
        {when}
      </span>
      {/* The perforation. */}
      <span aria-hidden="true" className="self-stretch border-l-[1.5px] border-dashed border-line-strong" />
      <span className={`${big ? "px-3 text-[22px]" : "px-2 text-[17px]"} font-hand leading-none font-bold whitespace-nowrap ${PHASE[c.phase]}`}>{c.left}</span>
    </>
  );
  const cls = `inline-flex items-center ${big ? "h-10" : "h-7"} rounded-md border border-line bg-sheet shadow-[0_1px_0_var(--line)]`;
  const label = `${when}: ${c.left}${onClick ? ". Change the date" : ""}`;
  return onClick ? (
    <button
      type="button"
      data-drag=""
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-label={label}
      className={`${cls} hover:border-line-strong`}
    >
      {inner}
    </button>
  ) : (
    <span role="note" aria-label={label} className={cls}>
      {inner}
    </span>
  );
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/**
 * When it happens: a month like a pocket diary. Tap a day for one day; tap a
 * second to make it a stretch (a trip: 13–17 Nov). The answer is written at
 * the top as it'll show on the paper.
 */
export function CountdownPicker({
  on,
  until,
  tz,
  title = "Count down to",
  onSave,
  onClose,
  align = "left",
}: {
  on: string | null;
  until: string | null;
  tz: string;
  title?: string;
  onSave: (v: { on: string; until: string | null } | null) => void;
  onClose: () => void;
  align?: "left" | "right";
}) {
  const today = partsIn(new Date(), tz).date;
  const [start, setStart] = useState<string | null>(on);
  const [end, setEnd] = useState<string | null>(until && on && until > on ? until : null);
  const [month, setMonth] = useState((on ?? today).slice(0, 7));
  const [hover, setHover] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = (e: PointerEvent) => card.current && !card.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", off, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", off, true);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  // One tap: a day. A second, later tap: the end of the stretch. A tap before the start begins again.
  const pick = (d: string) => {
    if (!start || end || d < start) {
      setStart(d);
      setEnd(null);
    } else if (d === start) setEnd(null);
    else setEnd(d);
  };
  const quick: [string, string][] = [
    ["This weekend", plusDays(today, (5 - weekdayOf(today) + 7) % 7 || 7)],
    ["Next week", plusDays(today, 7 - weekdayOf(today))],
    ["In a month", plusDays(today, 30)],
  ];

  const first = `${month}-01`;
  const lead = weekdayOf(first);
  const daysIn = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shift = (n: number) => setMonth(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1)).toISOString().slice(0, 7));
  const monthName = new Date(`${first}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  // While choosing the end, the stretch follows the pointer.
  const lastShown = end ?? (start && hover && hover > start ? hover : null);
  const inStretch = (d: string) => !!start && !!lastShown && d > start && d < lastShown;

  return (
    <div
      ref={card}
      role="dialog"
      aria-label={title}
      data-no-pan=""
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={`absolute top-full ${align === "right" ? "right-0" : "left-0"} z-50 mt-2 w-[300px] overflow-hidden rounded-2xl border border-line bg-raised font-sans text-ink shadow-[0_24px_50px_-22px_var(--shadow)]`}
    >
      <div className="flex flex-col gap-2 border-b border-line bg-sheet px-4 pt-3.5 pb-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-mute uppercase">{title}</p>
        {start ? <CountdownStub on={start} until={end} today={today} size="lg" /> : <p className="font-hand text-[26px] leading-tight text-graphite">pick a day</p>}
        <p className="text-[12px] text-mute">{start && !end ? "Tap another day to make it a few days (a trip)." : start ? `${label(start)} to ${label(end!)}` : "One day, or tap two for a stretch."}</p>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="grid grid-cols-3 gap-1.5">
          {quick.map(([name, d]) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setStart(d);
                setEnd(null);
                setMonth(d.slice(0, 7));
              }}
              className={`rounded-xl px-2 py-1.5 text-left text-[12px] leading-tight font-semibold ${start === d && !end ? "bg-red-soft text-red-text" : "bg-soft hover:bg-red-soft hover:text-red-text"}`}
            >
              {name}
              <span className="block text-[11px] font-normal opacity-70">{label(d).replace(/^\w+ /, "")}</span>
            </button>
          ))}
        </div>

        <div onPointerLeave={() => setHover(null)}>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-hand text-[18px]">{monthName}</span>
            <span className="flex">
              <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="size-7 rounded-lg text-mute hover:bg-soft hover:text-ink">
                ‹
              </button>
              <button type="button" onClick={() => shift(1)} aria-label="Next month" className="size-7 rounded-lg text-mute hover:bg-soft hover:text-ink">
                ›
              </button>
            </span>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-graphite">
            {WEEK.map((w, i) => (
              <span key={i} className="py-0.5">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 text-center">
            {cells.map((d, i) => {
              if (!d) return <span key={`b${i}`} />;
              const isEdge = d === start || d === lastShown;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  onPointerEnter={() => setHover(d)}
                  aria-pressed={isEdge || inStretch(d)}
                  aria-label={label(d)}
                  className={`relative flex h-8 items-center justify-center text-[13px] tabular-nums ${
                    isEdge ? "rounded-md bg-red font-semibold text-on-red" : inStretch(d) ? "bg-red-soft text-red-text" : d === today ? "font-semibold underline decoration-red-text/60 decoration-2 underline-offset-4" : d < today ? "text-graphite/60 hover:text-ink" : "hover:text-red-text"
                  }`}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
        {on && (
          <button type="button" onClick={() => onSave(null)} className="h-9 rounded-[10px] px-2 text-[13px] font-medium text-red-text hover:bg-red-soft">
            Remove
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onClose} className="h-9 rounded-[10px] px-2.5 text-[13px] text-mute hover:text-ink">
          Cancel
        </button>
        <button type="button" disabled={!start} onClick={() => start && onSave({ on: start, until: end })} className="h-9 rounded-[10px] bg-red px-3.5 text-[13px] font-semibold text-on-red disabled:opacity-40">
          Set
        </button>
      </div>
    </div>
  );
}
