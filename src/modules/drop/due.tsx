"use client";

import { useEffect, useRef, useState } from "react";
import { dueLabel, parseReminder, partsIn, zonedIso } from "./logic";

/** A to-do's date on the note, like Slack's: "Today, 6:00 PM", red once late, warm when soon. */
export function DueChip({ dueAt, hasTime, tz, onClick }: { dueAt: string; hasTime: boolean; tz: string; onClick?: () => void }) {
  // Re-read every minute so "Today" turns late on time.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const d = dueLabel(dueAt, hasTime, now, tz);
  return (
    <button
      type="button"
      data-drag=""
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      aria-label={`Due ${d.text}${d.late ? ", late" : ""}. Change`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-[12px] font-medium ${
        d.late ? "bg-red-soft text-red-text" : d.soon ? "bg-amber-soft text-amber" : "bg-soft text-mute"
      }`}
    >
      <ClockIcon />
      {d.text}
    </button>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="6" cy="6" r="4.8" />
      <path d="M6 3.4V6l1.8 1.1" />
    </svg>
  );
}

export { zonedIso };

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const TIMES: [string, string][] = [
  ["09:00", "9 AM"],
  ["12:00", "Noon"],
  ["15:00", "3 PM"],
  ["18:00", "6 PM"],
  ["21:00", "9 PM"],
];
const plusDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};

/** A hand-drawn ring, like a red pen circling a day in a diary. */
function Circled({ seed }: { seed: number }) {
  const r = (n: number) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1) * 0.9;
  return (
    <svg viewBox="0 0 36 36" className="pointer-events-none absolute inset-0 size-full" fill="none" aria-hidden="true">
      <path
        d={`M${19 + r(1)} ${4.5 + r(2)}c7.6.4 12.8 5.6 12.4 ${12.6 + r(3)}-.5 7.6-6.6 12.6-13.4 12.3C11.3 ${29.2 + r(4)} 5.6 24 5.9 17.6 6.2 10.4 12 5 ${20.6 + r(5)} 5.4`}
        className="stroke-red-text"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * When it should come back: like a page of a pocket diary. Write it in your
 * own words ("fri 5pm", "in 2 hours"), tap a quick day, or circle one on the
 * month; a time is a tap too. One line at the top says exactly when.
 */
export function DuePicker({
  dueAt,
  hasTime,
  tz,
  onSave,
  onClose,
}: {
  dueAt: string | null;
  hasTime: boolean;
  tz: string;
  onSave: (due: { at: string; hasTime: boolean } | null) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const today = partsIn(now, tz).date;
  const start = dueAt ? partsIn(new Date(dueAt), tz) : null;
  const [day, setDay] = useState<string | null>(start?.date ?? null);
  const [time, setTime] = useState<string | null>(hasTime && start ? start.time : null);
  const [month, setMonth] = useState((start?.date ?? today).slice(0, 7));
  const [words, setWords] = useState("");
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = (e: PointerEvent) => {
      if (card.current && !card.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", off, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", off, true);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  // Words typed win: "fri 5pm" is read the same way "remind me fri 5pm" is.
  const heard = words.trim() ? parseReminder(`x remind me ${words}`, now, tz) : null;
  const heardParts = heard ? partsIn(new Date(heard.at), tz) : null;
  const finalDay = heardParts?.date ?? day;
  const finalTime = heardParts ? heardParts.time : time;
  const ready = !!finalDay;
  const when = finalDay ? dueLabel(zonedIso(finalDay, finalTime ?? "00:00", tz), !!finalTime, now, tz).text : null;

  const save = () => {
    if (!finalDay) return;
    onSave({ at: zonedIso(finalDay, finalTime ?? "00:00", tz), hasTime: !!finalTime });
  };
  const pick = (d: string, t?: string | null) => {
    setWords("");
    setDay(d);
    setMonth(d.slice(0, 7));
    if (t !== undefined) setTime(t);
  };

  const nextMonday = plusDays(today, ((7 - weekdayOf(today)) % 7) || 7);
  const inHour = partsIn(new Date(now.getTime() + 3_600_000), tz);
  const quick: { label: string; sub: string; run: () => void; on: boolean }[] = [
    { label: "Today", sub: shortDay(today).split(" ")[0], run: () => pick(today), on: !heard && day === today },
    { label: "Tomorrow", sub: shortDay(plusDays(today, 1)).split(" ")[0], run: () => pick(plusDays(today, 1)), on: !heard && day === plusDays(today, 1) },
    { label: "Next Mon", sub: `${Number(nextMonday.slice(8))} ${shortDay(nextMonday).split(" ")[2]}`, run: () => pick(nextMonday), on: !heard && day === nextMonday },
    { label: "In 1 hr", sub: clock(inHour.time), run: () => pick(inHour.date, inHour.time), on: false },
  ];

  // The month as a diary page: Monday first, blanks before the 1st.
  const first = `${month}-01`;
  const lead = weekdayOf(first);
  const daysIn = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shiftMonth = (n: number) => {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const monthName = new Date(`${first}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div
      ref={card}
      role="dialog"
      aria-label="When should it come back?"
      data-no-pan=""
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="absolute top-full left-0 z-40 mt-2 w-[300px] overflow-hidden rounded-2xl border border-line bg-raised font-sans text-ink shadow-[0_24px_50px_-22px_var(--shadow)]"
    >
      {/* The answer first, in the hand the note is written in. */}
      <div className="border-b border-line bg-sheet px-4 pt-3.5 pb-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-mute uppercase">Bring it back</p>
        <p className={`font-hand text-[26px] leading-tight ${when ? "text-red-text" : "text-graphite"}`}>{when ?? "when?"}</p>
        <label htmlFor="due-words" className="sr-only">
          Say when
        </label>
        <input
          id="due-words"
          autoFocus
          value={words}
          onChange={(e) => setWords(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Type it: fri 5pm, in 2 hours, 12 nov…"
          className="mt-1.5 h-9 w-full rounded-lg border border-line bg-raised px-2.5 text-[14px] placeholder:text-mute focus:border-line-strong focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="grid grid-cols-4 gap-1.5">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={q.run}
              className={`flex flex-col items-start rounded-xl px-2 py-1.5 text-left whitespace-nowrap transition-colors ${q.on ? "bg-red-soft text-red-text" : "bg-soft hover:bg-red-soft hover:text-red-text"}`}
            >
              <span className="text-[12px] leading-tight font-semibold">{q.label}</span>
              <span className="text-[11px] leading-tight opacity-70">{q.sub}</span>
            </button>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-hand text-[18px] text-ink">{monthName}</span>
            <span className="flex">
              <button type="button" onClick={() => shiftMonth(-1)} disabled={month <= today.slice(0, 7)} aria-label="Previous month" className="size-7 rounded-lg text-mute hover:bg-soft hover:text-ink disabled:opacity-30">
                ‹
              </button>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="size-7 rounded-lg text-mute hover:bg-soft hover:text-ink">
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
            {cells.map((d, i) =>
              d ? (
                <button
                  key={d}
                  type="button"
                  disabled={d < today}
                  onClick={() => pick(d)}
                  aria-pressed={finalDay === d}
                  aria-label={shortDay(d)}
                  className={`relative mx-auto flex size-8 items-center justify-center text-[13px] tabular-nums disabled:text-graphite/40 ${
                    finalDay === d ? "font-semibold text-red-text" : d === today ? "font-semibold text-ink underline decoration-red-text/60 decoration-2 underline-offset-4" : "text-ink hover:text-red-text"
                  }`}
                >
                  {Number(d.slice(8))}
                  {finalDay === d && <Circled seed={Number(d.slice(8))} />}
                </button>
              ) : (
                <span key={`b${i}`} />
              ),
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-mute uppercase">Remind me at</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setWords("");
                setTime(null);
              }}
              className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${!finalTime ? "bg-ink text-bg" : "bg-soft text-mute hover:text-ink"}`}
            >
              Any time
            </button>
            {TIMES.map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setWords("");
                  if (!day) setDay(heardParts?.date ?? today);
                  setTime(t);
                }}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${finalTime === t ? "bg-red text-on-red" : "bg-soft text-ink hover:bg-red-soft hover:text-red-text"}`}
              >
                {label}
              </button>
            ))}
            {finalTime && !TIMES.some(([t]) => t === finalTime) && <span className="rounded-full bg-red px-2.5 py-1 text-[12px] font-medium text-on-red">{clock(finalTime)}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-4 py-2.5">
        {dueAt && (
          <button type="button" onClick={() => onSave(null)} className="h-9 rounded-[10px] px-2 text-[13px] font-medium text-red-text hover:bg-red-soft">
            Remove
          </button>
        )}
        <span className="flex-1 text-[11px] leading-snug text-graphite">{finalTime ? "A nudge then, here or by email." : "On its day, in your morning."}</span>
        <button type="button" onClick={onClose} className="h-9 rounded-[10px] px-2.5 text-[13px] text-mute hover:text-ink">
          Cancel
        </button>
        <button type="button" disabled={!ready} onClick={save} className="h-9 rounded-[10px] bg-red px-3.5 text-[13px] font-semibold text-on-red disabled:opacity-40">
          Set
        </button>
      </div>
    </div>
  );
}
