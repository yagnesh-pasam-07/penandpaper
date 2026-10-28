/** Drop: the personal brain-dump paper. Shared by browser, server and tests. */

import { addDays, weekday } from "@/lib/time";

/** Pen is a commitment (a task); pencil is a loose idea, kept but never "done". */
export type Kind = "pen" | "pencil";

export type Thought = {
  id: string;
  text: string;
  status: "open" | "done";
  kind: Kind;
  shape: number;
  /** ISO time it was first dropped. */
  createdAt: string;
  doneAt: string | null;
  /** YYYY-MM-DD it was first dropped, when it rolled over to a later paper. */
  carriedFrom: string | null;
  /** Spot on the sheet once dragged (x: share of the reading column's width, y: px); null while it flows. */
  x: number | null;
  y: number | null;
  /** YYYY-MM-DD it's folded away till; it shows from that day on. */
  scheduledFor: string | null;
  /** A pasted or dropped picture (a small data URL), taped on like a photo; the text is its caption. */
  image?: string | null;
  /** Earlier days the same words were written afresh (not carried): it presses through, darker each time. */
  echoes?: string[];
};

export type DropPaper = {
  date: string;
  thoughts: Thought[];
  /** When the desk was cleared that day (the evening ritual), if it was. */
  clearedAt?: string | null;
};

/** Day boundaries and the 9 PM email follow this zone. */
export const DROP_TIMEZONE = "Asia/Kolkata";

export const MAX_THOUGHT = 1000;
/** A picture's data URL, after it's been shrunk in the browser. */
export const MAX_IMAGE = 1_500_000;
/** Crumpled thoughts are kept this long (for undo and mistakes), then removed for good. */
export const CRUMPLE_KEEP_DAYS = 7;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- Folding (scheduling) ---------- */

/** Folded away for later: scheduled for a day after this paper's. */
export function isFolded(x: { scheduledFor: string | null }, date: string): boolean {
  return !!x.scheduledFor && x.scheduledFor > date;
}

/** What the paper shows today: folded thoughts are tucked away. */
export function visiblePaper(paper: DropPaper): DropPaper {
  return { ...paper, thoughts: paper.thoughts.filter((t) => !isFolded(t, paper.date)) };
}

export type FoldedItem = { id: string; label: string; on: string };

/** Everything folded for later, soonest first. */
export function foldedItems(paper: DropPaper): FoldedItem[] {
  return paper.thoughts
    .filter((t) => isFolded(t, paper.date))
    .map((t) => ({ id: t.id, label: thoughtLabel(t), on: t.scheduledFor! }))
    .sort((a, b) => a.on.localeCompare(b.on));
}

/** "Today", "Tomorrow", "Sat", or "Fri, 30 Oct" further out: how a scheduled day reads from `today`. */
export function whenLabel(on: string, today: string): string {
  if (on === today) return "Today";
  if (on === addDays(today, 1)) return "Tomorrow";
  if (on <= addDays(today, 6)) return weekday(on).slice(0, 3);
  const [, m, d] = on.split("-").map(Number);
  return `${weekday(on).slice(0, 3)}, ${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
}

/** The coming Saturday ("This weekend"); today itself on a Saturday. */
export function thisWeekend(today: string): string {
  let d = today;
  while (weekday(d) !== "Saturday") d = addDays(d, 1);
  return d;
}

/* ---------- Rollover ---------- */

export type Rollover = {
  /** Copies for the new paper: the open thoughts. */
  thoughts: Thought[];
  /**
   * Folded ones travel to the new paper as they are (same ids), so today
   * always knows what's folded. They remember the day they first left
   * (`carriedFrom`, set once), like a carried thought.
   */
  move: { thoughts: { id: string; carriedFrom: string }[] };
};

/**
 * The next paper's start, from the last one. Open thoughts come along, keeping
 * their text, look and first-drop time, and remembering the day they were
 * first dropped (pencil ideas too, just without a "carried" mark). Thoughts
 * folded for a later day move across untouched until their day comes; once it
 * has, they carry like any other.
 */
export function rollover(previous: DropPaper, newId: () => string): Rollover {
  const day = previous.date;
  const thoughts = previous.thoughts
    .filter((t) => t.status === "open" && !isFolded(t, day))
    .map((t): Thought => ({ ...t, id: newId(), doneAt: null, scheduledFor: null, carriedFrom: t.carriedFrom ?? day }));
  const move: Rollover["move"] = { thoughts: previous.thoughts.filter((t) => isFolded(t, day)).map((t) => ({ id: t.id, carriedFrom: t.carriedFrom ?? day })) };
  return { thoughts, move };
}

export { firstLink, firstYoutube, isOnlyYoutube, linkify, youtubeId, type TextPart } from "@/lib/linkify";

/** Only thoughts dropped today count toward "did they drop anything" (not carried ones). */
export function droppedToday(paper: DropPaper): number {
  return paper.thoughts.filter((t) => !t.carriedFrom).length;
}

/** The counts line: open tasks, ideas, and what's been struck. */
export function counts(paper: DropPaper): { open: number; ideas: number; done: number } {
  const shown = visiblePaper(paper).thoughts;
  return {
    open: shown.filter((t) => t.kind === "pen" && t.status === "open").length,
    ideas: shown.filter((t) => t.kind === "pencil").length,
    done: shown.filter((t) => t.status === "done").length,
  };
}

/* ---------- Changes ---------- */

export type PaperOp =
  /** Fold a thought away till a day (or bring it back: null). */
  | { kind: "schedule"; id: string; on: string | null }
  /** Ink a pencil idea into a task, or pencil a task back into an idea. */
  | { kind: "ink"; thought: string; to: Kind };

export class PaperError extends Error {}

/**
 * Applies one change to today's paper. The browser runs it to show the
 * change at once; the server runs the same thing on what's saved.
 */
export function applyPaperOp(paper: DropPaper, op: PaperOp): DropPaper {
  const thought = (id: string) => {
    const t = paper.thoughts.find((x) => x.id === id);
    if (!t) throw new PaperError("That thought isn't on today's paper.");
    return t;
  };
  const put = (id: string, change: Partial<Thought>): DropPaper => ({ ...paper, thoughts: paper.thoughts.map((t) => (t.id === id ? { ...t, ...change } : t)) });

  switch (op.kind) {
    case "schedule":
      if (op.on !== null && (!DATE.test(op.on) || op.on < paper.date)) throw new PaperError("Pick today or a later day.");
      return put(thought(op.id).id, { scheduledFor: op.on });
    case "ink": {
      const t = thought(op.thought);
      // An idea is never "done": pencilling a struck task brings it back open.
      return put(t.id, op.to === "pencil" ? { kind: "pencil", status: "open", doneAt: null } : { kind: "pen" });
    }
  }
}

/* ---------- Pencil thinks, pen commits ---------- */

/** Whole days between two YYYY-MM-DD dates. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** How strongly a pencil thought still shows: it fades a little each night it isn't inked (never below 0.4). Ink never fades. */
export function pencilFade(t: Pick<Thought, "kind" | "status" | "carriedFrom" | "createdAt">, date: string): number {
  if (t.kind !== "pencil" || t.status !== "open") return 1;
  const first = t.carriedFrom ?? t.createdAt.slice(0, 10);
  return Math.max(0.4, 1 - 0.12 * Math.max(0, daysBetween(first, date)));
}

/** What a thought reads as in lists: its words, or "Image" for a picture with no caption. */
export function thoughtLabel(t: Pick<Thought, "text" | "image">): string {
  return t.text || (t.image ? "Image" : "");
}

/* ---------- Clear desk ---------- */

/** One card in the evening clear-out: a loose open task. */
export type DeskCard = { id: string; text: string };

/** What's still open in pen on today's paper, one card per thought (pencil ideas are already kept). */
export function deskCards(paper: DropPaper): DeskCard[] {
  return visiblePaper(paper)
    .thoughts.filter((t) => t.status === "open" && t.kind === "pen")
    .map((t) => ({ id: t.id, text: thoughtLabel(t) }));
}

export type DeskChoice = "tomorrow" | "keep" | "crumple" | "done";

export function deskSummary(choices: DeskChoice[]): string {
  const n = (c: DeskChoice) => choices.filter((x) => x === c).length;
  const parts = [
    n("tomorrow") && `${n("tomorrow")} to tomorrow`,
    n("keep") && `${n("keep")} kept as ${n("keep") === 1 ? "an idea" : "ideas"}`,
    n("done") && `${n("done")} done`,
    n("crumple") && `${n("crumple")} crumpled`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Nothing left on your desk.";
}
