import { addDays, todayIn, zonedTime } from "@/lib/time";
import { DROP_TIMEZONE } from "./logic";

/**
 * Tonight's paper: the pure rules (time zones, what a card's choice does, the
 * words on the screen and in the email). No database and no browser in here,
 * so the same code runs on the server, in the page and in the tests.
 */

/** What can be decided about a thought in the evening review. */
export type Decision = "strike" | "keep" | "crumple";
export type Counts = { struck: number; kept: number; crumpled: number };

/** The review opens from this hour (local) for the header's "Tonight" button. */
export const EVENING_HOUR = 18;

/** The cookie the browser sets so the server knows the viewer's time zone. */
export const TZ_COOKIE = "pp-tz";

/** More than this many cards in one load is cut (oldest first). */
export const MAX_CARDS = 300;

function isZone(name: string): boolean {
  if (!name || name.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(name)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** A usable IANA zone: the one given if the runtime knows it, else the fallback, else UTC. */
export function resolveTz(name: string | null | undefined, fallback: string = DROP_TIMEZONE): string {
  if (name && isZone(name)) return name;
  return isZone(fallback) ? fallback : "UTC";
}

/** The local day (YYYY-MM-DD) an instant falls on in a zone. */
export function localDate(tz: string, at: Date = new Date()): string {
  return todayIn(resolveTz(tz), at);
}

/** The instants a local day starts and ends (end is the next midnight, so a day is 23, 24 or 25 hours). */
export function dayRange(tz: string, date: string): { start: Date; end: Date } {
  const zone = resolveTz(tz);
  return { start: zonedTime(date, 0, 0, zone), end: zonedTime(addDays(date, 1), 0, 0, zone) };
}

/** The hour on the clock in a zone (0-23). */
export function hourIn(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: resolveTz(tz), hour: "2-digit", hourCycle: "h23" }).formatToParts(at);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

/** Whether it is evening (18:00 or later) on the clock in a zone. */
export function isEveningLocal(at: Date, tz: string): boolean {
  return hourIn(tz, at) >= EVENING_HOUR;
}

/** The day a thought belongs to for the review: the local day it was dropped. */
export function reviewDateOf(createdAt: Date | string, tz: string): string {
  return localDate(tz, new Date(createdAt));
}

/* ---------- What a thought's state says ---------- */

type State = { reviewedAt: unknown | null; crumpledAt: unknown | null; status: "open" | "done" };

/** The choice already made for a thought in the ritual, or null if it hasn't been reviewed. */
export function decisionOf(s: State): Decision | null {
  if (!s.reviewedAt) return null;
  if (s.crumpledAt) return "crumple";
  return s.status === "done" ? "strike" : "keep";
}

/**
 * Whether a thought belongs in the review: not reviewed yet and still open and
 * uncrumpled, or already reviewed (so Back can change its mind). One struck or
 * crumpled outside the ritual is skipped.
 */
export function isInReview(s: State): boolean {
  return Boolean(s.reviewedAt) || (!s.crumpledAt && s.status === "open");
}

/** The state a choice leaves a thought in. `undo` puts it back as it was before the ritual. */
export function stateFor(action: Decision | "undo"): { reviewed: boolean; struck: boolean; crumpled: boolean } {
  switch (action) {
    case "strike":
      return { reviewed: true, struck: true, crumpled: false };
    case "keep":
      return { reviewed: true, struck: false, crumpled: false };
    case "crumple":
      return { reviewed: true, struck: false, crumpled: true };
    default:
      return { reviewed: false, struck: false, crumpled: false };
  }
}

/* ---------- Counts ---------- */

export const noCounts: Counts = { struck: 0, kept: 0, crumpled: 0 };

const slot = (d: Decision): keyof Counts => (d === "strike" ? "struck" : d === "keep" ? "kept" : "crumpled");

/** The counts after a thought moves from one choice (or none) to another (or none, for Back and Undo). Never below zero. */
export function adjustCounts(counts: Counts, from: Decision | null, to: Decision | null): Counts {
  const next = { ...counts };
  if (from) next[slot(from)] = Math.max(0, next[slot(from)] - 1);
  if (to) next[slot(to)] += 1;
  return next;
}

/** Counts from a list of choices (undecided ones are left out). */
export function countsOf(decisions: (Decision | null)[]): Counts {
  return decisions.reduce<Counts>((c, d) => (d ? adjustCounts(c, null, d) : c), { ...noCounts });
}

/* ---------- Words ---------- */

/** "4 struck · 3 kept · 2 crumpled"; a part with none is left out. */
export function summaryText(c: Counts): string {
  const parts = [c.struck && `${c.struck} struck`, c.kept && `${c.kept} kept`, c.crumpled && `${c.crumpled} crumpled`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing to review";
}

/** "3 of 9": `index` is the card on screen, counting from 0. */
export function progressText(index: number, total: number): string {
  if (total <= 0) return "0 of 0";
  return `${Math.min(Math.max(index, 0) + 1, total)} of ${total}`;
}

/** "9 thoughts", "1 thought". */
export function thoughtsText(n: number): string {
  return `${n} ${n === 1 ? "thought" : "thoughts"}`;
}

/** The evening email's subject. */
export function emailSubject(n: number): string {
  return `Tonight's paper · ${thoughtsText(n)}`;
}
