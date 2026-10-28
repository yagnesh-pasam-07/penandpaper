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
};

/** One paper: a canvas the person made, with the thoughts dropped on it. */
export type DropPaper = {
  id: string;
  /** Optional; blank papers read as "Untitled". */
  name: string | null;
  /** ISO time it was made: the date the library and header show. */
  createdAt: string;
  /** Set while it is put away (archived). */
  archivedAt: string | null;
  thoughts: Thought[];
};

/** A paper in a list (the switcher): no thoughts, just how many. */
export type PaperMeta = {
  id: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
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
