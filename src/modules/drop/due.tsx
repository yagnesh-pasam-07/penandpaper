"use client";

import { useEffect, useRef, useState } from "react";
import { dueLabel } from "./logic";

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

/** "YYYY-MM-DD" and "HH:MM" in a zone, for the inputs. */
function partsIn(d: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** A wall-clock time in a zone, as an instant (ISO). */
export function zonedIso(date: string, time: string, tz: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  // How far the zone is from UTC at that moment, then correct once (good across DST edges too).
  const seen = partsIn(guess, tz);
  const diff = Date.parse(`${seen.date}T${seen.time}:00Z`) - guess.getTime();
  return new Date(guess.getTime() - diff).toISOString();
}

/**
 * Pick a day, and a time if it should remind you: quick choices first
 * (Today, Tomorrow, Next Monday), then the exact day and time. One small card.
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
  const start = partsIn(dueAt ? new Date(dueAt) : now, tz);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(hasTime ? start.time : "");
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

  const dayOffset = (n: number) => partsIn(new Date(now.getTime() + n * 86_400_000), tz).date;
  const nextMonday = () => {
    const wd = new Date(`${partsIn(now, tz).date}T12:00:00Z`).getUTCDay();
    return dayOffset(((8 - wd) % 7) || 7);
  };
  const save = (d: string, t: string) => onSave({ at: zonedIso(d, t || "00:00", tz), hasTime: !!t });
  const quick: [string, string, string][] = [
    ["Today", dayOffset(0), ""],
    ["Tomorrow", dayOffset(1), ""],
    ["Next Monday", nextMonday(), ""],
    ["In an hour", ...(Object.values(partsIn(new Date(now.getTime() + 3_600_000), tz)) as [string, string])],
  ];

  return (
    <div
      ref={card}
      role="dialog"
      aria-label="Due date and reminder"
      data-no-pan=""
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="absolute top-full left-0 z-40 mt-2 w-[260px] rounded-2xl border border-line bg-raised p-3 font-sans shadow-[0_18px_40px_-18px_var(--shadow)]"
    >
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {quick.map(([label, d, t]) => (
          <button key={label} type="button" onClick={() => save(d, t)} className="rounded-lg bg-soft px-2 py-1.5 text-left text-[13px] font-medium text-ink hover:bg-red-soft hover:text-red-text">
            {label}
          </button>
        ))}
      </div>
      <label className="mb-1 block text-[12px] text-mute" htmlFor="due-date">
        Day
      </label>
      <input id="due-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mb-2 h-9 w-full rounded-lg border border-line-strong bg-sheet px-2 text-[14px] text-ink" />
      <label className="mb-1 block text-[12px] text-mute" htmlFor="due-time">
        Remind me at <span className="text-graphite">(optional)</span>
      </label>
      <input id="due-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mb-3 h-9 w-full rounded-lg border border-line-strong bg-sheet px-2 text-[14px] text-ink" />
      <div className="flex items-center gap-2">
        <button type="button" disabled={!date} onClick={() => save(date, time)} className="h-9 rounded-[10px] bg-ink px-3.5 text-sm font-semibold text-bg disabled:opacity-40">
          Save
        </button>
        {dueAt && (
          <button type="button" onClick={() => onSave(null)} className="h-9 rounded-[10px] px-3 text-sm font-medium text-red-text hover:bg-red-soft">
            Remove
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onClose} className="h-9 rounded-[10px] px-2 text-sm text-mute hover:text-ink">
          Cancel
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-graphite">With a time, it reminds you on this device (and by email if notifications are off).</p>
    </div>
  );
}
