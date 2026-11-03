/** Drop: the personal brain-dump paper. Shared by browser, server and tests. */

export type Thought = {
  id: string;
  text: string;
  /** Struck out with the red pen, or not. A struck thought stays exactly where it is. */
  status: "open" | "done";
  shape: number;
  /** ISO time it was first dropped. */
  createdAt: string;
  doneAt: string | null;
  /** Spot on the sheet once dragged (x: share of the reading column's width, y: px); null while it flows. */
  x: number | null;
  y: number | null;
  /** A pasted or dropped picture (a small data URL), taped on like a photo; the text is its caption. */
  image?: string | null;
  /** "note" (a hand-cut note) or "text" (words written straight on the paper with the Text tool). Missing means "note". */
  kind?: ThoughtKind;
  /** Written text's size, as a multiple of the base (1 = 22 px). Missing means 1. */
  size?: number;
  /** One of the five inks (written text). Missing means "ink". */
  color?: InkName;
  /** A to-do's day (ISO); with `dueHasTime`, a reminder at that moment. */
  dueAt?: string | null;
  dueHasTime?: boolean;
  /** When it happens (a countdown): a day, and optionally the last day. Any kind of thought. */
  happensOn?: string | null;
  happensUntil?: string | null;
};

/** "note": a hand-cut note (a to-do). "text": words written on the paper (a drop). "todo": written text with a checkbox (a to-do that keeps its handwriting). */
export type ThoughtKind = "note" | "text" | "todo";

/** A line drawn on a paper. Tied at either end to a thought (a connector), or free. */
export type Stroke = {
  id: string;
  /** Canvas px, in the sheet's own units; for a tied end, the point is where it was when drawn. */
  points: [number, number][];
  fromId: string | null;
  toId: string | null;
  /** One of the five inks. Missing means "ink". */
  color?: InkName;
  /** A shape instead of a freehand line: `points` is two opposite corners. */
  shape?: ShapeKind | null;
  /** Words inside a shape. */
  label?: string | null;
};

/**
 * The five inks: one neutral that does most of the work, four pigments that
 * each mean something. Kept by name, so a line drawn by day re-colours itself
 * at night (each has a deep day value and a luminous night value, see THEME.md).
 */
export const INKS = ["ink", "vermilion", "cobalt", "viridian", "saffron"] as const;
export type InkName = (typeof INKS)[number];
export const INK_MEANING: Record<InkName, string> = { ink: "Ink", vermilion: "Vermilion · urgent", cobalt: "Cobalt · a decision", viridian: "Viridian · done", saffron: "Saffron · an idea" };
export const isInk = (v: unknown): v is InkName => typeof v === "string" && (INKS as readonly string[]).includes(v);

export const SHAPES = ["rect", "ellipse"] as const;
export type ShapeKind = (typeof SHAPES)[number];
export const MAX_LABEL = 300;

/** Text size limits (multiples of 22 px: about 14 px to 96 px). */
export const MIN_TEXT_SIZE = 0.64;
export const MAX_TEXT_SIZE = 4.4;
export const clampSize = (n: number) => Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, Math.round(n * 100) / 100));

/** One paper: a canvas the person made, with the thoughts dropped on it. */
export type DropPaper = {
  id: string;
  /** Optional; blank papers read as "Untitled". */
  name: string | null;
  /** ISO time it was made: the date the library and header show. */
  createdAt: string;
  /** Set while it is put away (archived). */
  archivedAt: string | null;
  /** The paper's own dates (a trip), shown as a countdown beside its name. */
  happensOn?: string | null;
  happensUntil?: string | null;
  thoughts: Thought[];
  /** Lines and connectors drawn on it. */
  strokes?: Stroke[];
};

/** A paper in a list (the switcher): no thoughts, just how many. */
export type PaperMeta = {
  id: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  happensOn?: string | null;
  happensUntil?: string | null;
  count: number;
};

/** A thought as a small mark on a library card. */
export type PreviewNote = { id: string; text: string; left: number; top: number; done: boolean };

/** A library card: the paper's details and the little picture of its canvas. */
export type PaperCardData = PaperMeta & { notes: PreviewNote[] };

/** One hit from searching every paper. */
export type SearchHit = { thoughtId: string; text: string; paperId: string; paperName: string | null; paperCreatedAt: string };

/** The 9 PM email's day, and how dates read, follow this zone. */
export const DROP_TIMEZONE = "Asia/Kolkata";

export const MAX_THOUGHT = 1000;
export const MAX_PAPER_NAME = 80;
/** Searching starts at two letters, and shows at most this many hits. */
export const MIN_SEARCH = 2;
export const MAX_SEARCH = 100;
export const SEARCH_LIMIT = 50;
/** A picture's data URL, after it's been shrunk in the browser. */
export const MAX_IMAGE = 1_500_000;
/** Crumpled thoughts are kept this long (for undo and mistakes), then removed for good. */
export const CRUMPLE_KEEP_DAYS = 7;

export { firstLink, firstYoutube, isOnlyYoutube, linkify, youtubeId, type TextPart } from "@/lib/linkify";

/**
 * A drop is kept to look at, not to do: a picture (with or without a caption),
 * or words written straight on the paper with the Text tool. It can't be
 * struck, and Tonight's paper and the morning resurface pass it by. Every
 * other note is a to-do.
 */
export function isDrop(t: { image?: string | null; kind?: ThoughtKind | null }): boolean {
  // "todo" is written text with a checkbox: a to-do, not a drop.
  return Boolean(t.image) || t.kind === "text";
}

/* ---------- Mentions ---------- */

/** Emails mentioned as "@name@company.com" (or a bare address after @), lower-cased, at most five. */
export function mentionedEmails(text: string): string[] {
  const found = text.match(/@([a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/gi) ?? [];
  return [...new Set(found.map((m) => m.slice(1).toLowerCase()))].slice(0, 5);
}

/* ---------- Due dates and reminders ---------- */

/** The calendar day (YYYY-MM-DD) an instant falls on in a zone. */
export function dayIn(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * How a due date reads on a note, like Slack's: "Today", "Tomorrow", "Fri",
 * "12 Nov", with the time when it has one; and whether it is late.
 */
export function dueLabel(dueAt: string, hasTime: boolean, now: Date, tz: string): { text: string; late: boolean; soon: boolean } {
  const due = new Date(dueAt);
  const today = dayIn(now, tz);
  const day = dayIn(due, tz);
  const dayMs = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const diff = Math.round((dayMs(day) - dayMs(today)) / 86_400_000);
  let text: string;
  if (diff === 0) text = "Today";
  else if (diff === 1) text = "Tomorrow";
  else if (diff === -1) text = "Yesterday";
  else if (diff > 1 && diff < 7) text = due.toLocaleDateString("en-GB", { weekday: "short", timeZone: tz });
  else text = due.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}), timeZone: tz });
  if (hasTime) text += `, ${due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })}`;
  const late = hasTime ? due.getTime() < now.getTime() : diff < 0;
  return { text, late, soon: !late && diff <= 1 };
}

/** "YYYY-MM-DD" and "HH:MM" of an instant in a zone. */
export function partsIn(d: Date, tz: string): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** A wall-clock time in a zone, as an instant (ISO). */
export function zonedIso(date: string, time: string, tz: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  const seen = partsIn(guess, tz);
  const diff = Date.parse(`${seen.date}T${seen.time}:00Z`) - guess.getTime();
  return new Date(guess.getTime() - diff).toISOString();
}

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * "call Ravi, remind me tomorrow at 5" → the words without the ask, and when.
 * Understands today / tonight / tomorrow / a weekday / "12 nov", "at 5", "5:30pm",
 * "17:00", morning / noon / evening, and "in 20 minutes / 2 hours / 3 days".
 * A day with no time reminds at 9 AM; a time with no day is the next one to come;
 * "remind me" alone is tomorrow at 9 AM. Null when the words don't ask.
 */
export function parseReminder(text: string, now: Date, tz: string): { text: string; at: string } | null {
  const m = /(?:^|[\s,.;:–—-])remind me\b([\s\S]*)$/i.exec(text);
  if (!m) return null;
  const ask = m[1].toLowerCase().replace(/[.!]+$/, " ").trim();
  const before = text.slice(0, m.index + (/^[\s,.;:–—-]/.test(m[0]) ? 0 : 0)).replace(/[\s,.;:–—-]+$/, "").trim();
  const rest = before || text.trim();

  const rel = /\bin\s+(\d+|an?|one)\s*(m|mins?|minutes?|h|hrs?|hours?|d|days?)\b/.exec(ask);
  if (rel) {
    const n = /^\d+$/.test(rel[1]) ? Number(rel[1]) : 1;
    const unit = rel[2][0] === "m" ? 60_000 : rel[2][0] === "h" ? 3_600_000 : 86_400_000;
    return { text: rest, at: new Date(now.getTime() + n * unit).toISOString() };
  }

  const today = partsIn(now, tz).date;
  const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  let day: string | null = null;
  let time: string | null = null;

  if (/\btomorrow\b|\btmrw\b/.test(ask)) day = addDays(today, 1);
  else if (/\btoday\b/.test(ask)) day = today;
  else if (/\btonight\b/.test(ask)) {
    day = today;
    time = "20:00";
  } else {
    const wd = DAYS.findIndex((d) => new RegExp(`\\b${d.slice(0, 3)}(${d.slice(3)})?\\b`).test(ask));
    if (wd >= 0) {
      const nowWd = new Date(`${today}T12:00:00Z`).getUTCDay();
      day = addDays(today, ((wd - nowWd + 7) % 7) || 7);
    } else {
      const dm = /\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})\b/.exec(ask);
      if (dm) {
        const dd = Number(dm[1] ?? dm[4]);
        const mm = MONTHS.indexOf(dm[2] ?? dm[3]) + 1;
        let y = Number(today.slice(0, 4));
        const cand = (yy: number) => `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        if (cand(y) < today) y += 1;
        day = cand(y);
      }
    }
  }

  if (!time) {
    if (/\bmorning\b/.test(ask)) time = "09:00";
    else if (/\bnoon\b|\blunch\b/.test(ask)) time = "12:00";
    else if (/\bafternoon\b/.test(ask)) time = "15:00";
    else if (/\bevening\b/.test(ask)) time = "18:00";
    else if (/\bnight\b/.test(ask)) time = "20:00";
    else {
      const t = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?=\s|$)/.exec(ask.replace(/\b\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/g, ""));
      const explicit = t && (t[2] || t[3] || /\bat\s+\d/.test(ask));
      if (t && explicit) {
        let h = Number(t[1]);
        const min = t[2] ?? "00";
        const ap = t[3]?.[0];
        if (ap === "p" && h < 12) h += 12;
        if (ap === "a" && h === 12) h = 0;
        if (!ap && !t[2] && h < 8) h += 12;
        if (h < 24) time = `${String(h).padStart(2, "0")}:${min}`;
      }
    }
  }

  if (!day && !time) {
    day = addDays(today, 1);
    time = "09:00";
  } else if (!day) {
    day = zonedIso(today, time!, tz) > now.toISOString() ? today : addDays(today, 1);
  } else if (!time) time = "09:00";
  return { text: rest, at: zonedIso(day, time!, tz) };
}

/** Whether a reminder is owed: it has a time, that time has come (within the window), it's open and not yet reminded. */
export function reminderDue(t: { dueAt: string | null; dueHasTime: boolean; remindedAt: string | null; status: "open" | "done" }, now: Date, windowMs: number): boolean {
  if (!t.dueAt || t.status !== "open" || t.remindedAt) return false;
  const at = new Date(t.dueAt).getTime();
  return at <= now.getTime() && at > now.getTime() - windowMs;
}

/** Most points a line keeps, and how far (canvas px) a line can reach, for the API's sanity checks. */
export const MAX_STROKE_POINTS = 2000;
export const STROKE_LIMIT = 400_000;

/** What a thought reads as in lists: its words, or "Image" for a picture with no caption. */
export function thoughtLabel(t: Pick<Thought, "text" | "image">): string {
  return t.text || (t.image ? "Image" : "");
}

/* ---------- Papers ---------- */

/** What a paper is called: its name, or "Untitled". */
export function paperTitle(p: { name: string | null }): string {
  return p.name?.trim() || "Untitled";
}

/** A name as it is kept: spaces tidied, cut to length, and nothing at all becomes no name. */
export function cleanName(raw: string | null | undefined): string | null {
  const name = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PAPER_NAME).trim();
  return name || null;
}

/** The day something was made, as people read it: "28 Oct 2026", in the given time zone. */
export function madeOn(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
}

/** A paper's heading in the email: its name, or when it was made. */
export function digestTitle(p: { name: string | null; createdAt: string }, tz: string): string {
  return p.name?.trim() || `Paper from ${madeOn(p.createdAt, tz)}`;
}

/** Escapes the characters LIKE treats as wildcards, so a search for "50%" means "50%". */
export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** A search term as it is used: tidied, and nothing if it is too short to search. */
export function searchTerm(raw: string | null | undefined): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH);
  return q.length >= MIN_SEARCH ? q : null;
}

/** The part of a thought around the first match, with "…" where it was cut. */
export function snippetAround(text: string, query: string, radius = 36): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0 || flat.length <= radius * 2 + query.length) return flat.slice(0, radius * 2 + query.length) + (flat.length > radius * 2 + query.length ? "…" : "");
  const from = Math.max(0, at - radius);
  const to = Math.min(flat.length, at + query.length + radius);
  return `${from > 0 ? "…" : ""}${flat.slice(from, to)}${to < flat.length ? "…" : ""}`;
}

/** Splits a snippet so the match can be marked, whatever its case. */
export function splitMatch(text: string, query: string): { text: string; match: boolean }[] {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0 || !query) return [{ text, match: false }];
  return [
    { text: text.slice(0, at), match: false },
    { text: text.slice(at, at + query.length), match: true },
    { text: text.slice(at + query.length), match: false },
  ].filter((p) => p.text);
}

/**
 * Where each thought sits on a library card, as shares of its width and height.
 * Thoughts that were dragged keep their relative places; ones that were never
 * moved fall into rows, like on the sheet. Capped so a crowded paper stays a picture.
 */
export function previewNotes(thoughts: Pick<Thought, "id" | "text" | "status" | "x" | "y">[], max = 24): PreviewNote[] {
  const shown = thoughts.slice(0, max);
  const placed = shown.filter((t) => t.x !== null && t.y !== null);
  const deepest = Math.max(1, ...placed.map((t) => t.y!));
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  let flowed = 0;
  return shown.map((t) => {
    const text = (t.text || "Image").replace(/\s+/g, " ").slice(0, 26);
    if (t.x !== null && t.y !== null) {
      return { id: t.id, text, left: clamp(6 + t.x * 78, 4, 80), top: clamp(8 + (t.y / deepest) * 72, 6, 84), done: t.status === "done" };
    }
    const i = flowed++;
    return { id: t.id, text, left: 6 + (i % 3) * 30, top: 8 + Math.floor(i / 3) * 14, done: t.status === "done" };
  });
}

/** One thought in the evening email, with the paper it is on. */
export type DigestRow = {
  paperId: string;
  paperName: string | null;
  paperCreatedAt: string;
  thought: Pick<Thought, "id" | "text" | "status" | "image">;
};

export type DigestGroup = { paperId: string; title: string; thoughts: DigestRow["thought"][] };

/**
 * Groups a day's thoughts by paper, in the order each paper first got one
 * (the rows come oldest first). `latestPaperId` is the paper of the last
 * thought written: the one "Open my paper" goes to.
 */
export function groupDigest(rows: DigestRow[], tz: string): { groups: DigestGroup[]; latestPaperId: string | null } {
  const groups = new Map<string, DigestGroup>();
  for (const r of rows) {
    const g = groups.get(r.paperId) ?? { paperId: r.paperId, title: digestTitle({ name: r.paperName, createdAt: r.paperCreatedAt }, tz), thoughts: [] };
    g.thoughts.push(r.thought);
    groups.set(r.paperId, g);
  }
  return { groups: [...groups.values()], latestPaperId: rows.length ? rows[rows.length - 1].paperId : null };
}


/* ---------- Countdowns ---------- */

/** A calendar day, YYYY-MM-DD. */
export const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** Whole days from `a` to `b` (both YYYY-MM-DD): calendar days, so no clock or zone can make it 9.6. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** "13 Nov", "13–17 Nov", "30 Nov – 2 Dec"; with the year only when it isn't this year. */
export function dayRange(on: string, until: string | null | undefined, today: string): string {
  const f = (d: string, month = true, year = false) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", ...(month ? { month: "short" } : {}), ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
  const yearOf = (d: string) => d.slice(0, 4);
  const showYear = yearOf(on) !== yearOf(today) || (!!until && yearOf(until) !== yearOf(today));
  if (!until || until === on) return f(on, true, showYear);
  if (on.slice(0, 7) === until.slice(0, 7)) return `${f(on, false)}–${f(until, true, showYear)}`;
  return `${f(on, true, showYear && yearOf(on) !== yearOf(until))} – ${f(until, true, showYear)}`;
}

/**
 * The countdown, in words, as it stands `today` (the viewer's own day):
 * before, "in 10 days" / "Tomorrow"; during, "Today" or "Day 2 of 5";
 * after, "Yesterday" / "3 days ago" / "2 weeks ago". `phase` sets its colour.
 */
export function countdown(on: string, until: string | null | undefined, today: string): { left: string; phase: "ahead" | "soon" | "now" | "past"; days: number } {
  const end = until && until > on ? until : on;
  const ahead = daysBetween(today, on);
  if (ahead > 0) {
    const left = ahead === 1 ? "Tomorrow" : ahead < 14 ? `${ahead} days to go` : ahead < 60 ? `${Math.round(ahead / 7)} weeks to go` : `${Math.round(ahead / 30)} months to go`;
    return { left, phase: ahead <= 3 ? "soon" : "ahead", days: ahead };
  }
  const since = daysBetween(end, today);
  if (since <= 0) {
    const total = daysBetween(on, end) + 1;
    return { left: total === 1 ? "Today" : `Day ${daysBetween(on, today) + 1} of ${total}`, phase: "now", days: 0 };
  }
  const left = since === 1 ? "Yesterday" : since < 14 ? `${since} days ago` : since < 60 ? `${Math.round(since / 7)} weeks ago` : `${Math.round(since / 30)} months ago`;
  return { left, phase: "past", days: -since };
}
