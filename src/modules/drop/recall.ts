/**
 * Thought of the Day: one past thought a day, back on a fresh paper at the
 * moment of making. The pure rules (which thought, when, and whether today's
 * is due), with no database and no browser, so they are tested on their own.
 *
 * It builds on the morning resurface (resurface.ts): the same per-thought
 * rhythm, but "Tomorrow" spaces further out each time (1 → 3 → 7 → 21 → 60
 * days, like flashcards), and when nothing is due a forgotten thought older
 * than a week comes back instead, so the library never goes silent.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far each "Tomorrow" pushes a thought out, by how many times it has been sent back. */
export const SPACING_DAYS = [1, 3, 7, 21, 60] as const;

/** At most this many thoughts a day ("Show another" up to the cap): never a feed. */
export const DAILY_CAP = 3;

/** The recall time new people start with: 9 in the morning, the start of making. */
export const DEFAULT_RECALL_TIME = "09:00";

/** A recall time as "HH:MM" (24-hour), or null when it isn't one. */
export function parseRecallTime(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw.trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

/** The weekdays it may come, 0 = Sunday … 6 = Saturday; every day by default. */
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;

/** Weekdays as a clean, sorted list, or every day when the input is empty or wrong. */
export function parseDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...EVERY_DAY];
  const days = [...new Set(raw.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  return days.length ? days : [...EVERY_DAY];
}

/** The local date (YYYY-MM-DD), weekday and minutes past midnight of `now` in `tz`. */
export function localClock(tz: string, now: Date = new Date()): { date: string; weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export type RecallPrefs = {
  /** "HH:MM" local, or null for "only when I open the app" (no notification). */
  time: string | null;
  days: number[];
  /** The local date the day's thought was last opened (or dismissed), so it greets only once a day. */
  seenOn: string | null;
};

/**
 * Whether today's thought should greet the person now: on one of their days,
 * not yet seen today, and past their time (or any time, for "when I open").
 */
export function isDue(prefs: RecallPrefs, tz: string, now: Date = new Date()): boolean {
  const c = localClock(tz, now);
  if (!prefs.days.includes(c.weekday)) return false;
  if (prefs.seenOn === c.date) return false;
  return prefs.time === null || c.minutes >= minutesOf(prefs.time);
}

/**
 * Whether the daily notification goes out in this run: their time has passed
 * in the last `windowMin` minutes (the job's own period), on one of their days,
 * and nothing went out today already. A job that runs once a day uses a
 * 24-hour window, so it reaches everyone whose time has come.
 */
export function shouldNotify(prefs: RecallPrefs & { notifiedOn: string | null }, tz: string, now: Date, windowMin: number): boolean {
  if (prefs.time === null) return false;
  const c = localClock(tz, now);
  if (!prefs.days.includes(c.weekday)) return false;
  if (prefs.notifiedOn === c.date || prefs.seenOn === c.date) return false;
  const since = c.minutes - minutesOf(prefs.time);
  return since >= 0 && since < windowMin;
}

/** A thought as the picker sees it. */
export type Candidate = {
  id: string;
  createdAt: string;
  /** When it is due again (ISO); null means "a day after it was written". */
  dueAt: string | null;
  lastShownAt: string | null;
};

/**
 * The one thought for today, or null:
 *  1. due thoughts (their own due date, or a day after they were written), oldest due first;
 *  2. if none is due, one older than a week, picked by the day (the same all day, a different one tomorrow),
 *     so forgotten ideas come back;
 * never one shown in the last 24 hours or already passed over today (`skip`).
 */
export function pickThought(candidates: Candidate[], now: Date, seed: string, skip: string[] = []): Candidate | null {
  const t = now.getTime();
  const fresh = (c: Candidate) => !skip.includes(c.id) && (!c.lastShownAt || t - new Date(c.lastShownAt).getTime() >= DAY_MS);
  const dueTime = (c: Candidate) => (c.dueAt ? new Date(c.dueAt).getTime() : new Date(c.createdAt).getTime() + DAY_MS);
  const due = candidates.filter((c) => fresh(c) && dueTime(c) <= t).sort((a, b) => dueTime(a) - dueTime(b) || a.id.localeCompare(b.id));
  if (due.length) return due[0];
  const old = candidates.filter((c) => fresh(c) && t - new Date(c.createdAt).getTime() >= 7 * DAY_MS).sort((a, b) => a.id.localeCompare(b.id));
  if (!old.length) return null;
  return old[hash(seed) % old.length];
}

/** When a thought sent back with "Tomorrow" for the `count`-th time is due again (the last gap repeats). */
export function nextShow(count: number, now: Date = new Date()): string {
  const days = SPACING_DAYS[Math.min(Math.max(count, 0), SPACING_DAYS.length - 1)];
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

/** "You wrote this 12 days ago", "You wrote this yesterday". */
export function wroteAgo(createdAt: string, now: Date = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS));
  if (days === 0) return "You wrote this today";
  if (days === 1) return "You wrote this yesterday";
  if (days < 60) return `You wrote this ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `You wrote this ${months} months ago`;
  return `You wrote this ${Math.floor(days / 365)} years ago`;
}

/** The notification's words: a promise, then the first few words of the thought. */
export function notificationText(text: string, max = 80): { title: string; body: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  const body = clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean || "A picture you kept.";
  return { title: "Your thought for today is ready", body };
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
