/**
 * A paper, live: everyone who has it open sees each change as it's saved, and
 * where the others are pointing. Pure, so the browser, the server and the tests share it.
 *
 * Every save on the server sends one small event on the paper's channel
 * (Postgres NOTIFY); each open paper listens (a server-sent event stream) and
 * folds the events into what it shows with `applyLive`. An event too big for a
 * NOTIFY (a picture, a very long line) goes as `sync`: "fetch the paper again".
 */

import type { DropPaper, InkName, Stroke, Thought } from "./logic";

/** Someone with the paper open: one per tab. `uid` groups a person's tabs; never an email. */
export type Peer = { sid: string; uid: string; name: string; ink: InkName; role: "owner" | "edit" | "view" };

export type LiveEvent =
  | { type: "thought"; thought: Thought }
  | { type: "gone"; id: string }
  | { type: "moved"; placements: { id: string; x: number | null; y: number | null }[] }
  | { type: "stroke"; stroke: Stroke }
  | { type: "stroke-edit"; id: string; change: Partial<Pick<Stroke, "points" | "color" | "label" | "fromId" | "toId">> }
  | { type: "stroke-gone"; id: string }
  | { type: "sync" }
  /** Who can open the paper changed: streams re-check theirs. */
  | { type: "access"; email: string }
  | { type: "join"; peer: Peer }
  | { type: "here"; peer: Peer }
  | { type: "leave"; sid: string }
  /** Where they are pointing, as a saved spot (x a share of the reading column, y px), or null when off the paper. */
  | { type: "cursor"; sid: string; at: { x: number; y: number } | null };

/** What goes over the wire: the event, and the tab that caused it (so it skips its own echo). */
export type Envelope = LiveEvent & { by?: string };

/** The paper's channel name: fixed letters and the id's hex, so it is a safe identifier. */
export function channelOf(paperId: string): string {
  return `pp_${paperId.replace(/[^0-9a-f]/gi, "").toLowerCase()}`;
}

/** Postgres refuses a NOTIFY payload of 8000 bytes or more; keep well under it. */
export const MAX_PAYLOAD = 7000;

/** The envelope as sent: itself, or `sync` when it would be too big. */
export function wire(ev: Envelope): string {
  const raw = JSON.stringify(ev);
  return new TextEncoder().encode(raw).length <= MAX_PAYLOAD ? raw : JSON.stringify({ type: "sync", by: ev.by });
}

/** A person's ink for their cursor: one of the four pigments, the same on every screen. */
const PEER_INKS: InkName[] = ["cobalt", "vermilion", "viridian", "saffron"];
export function inkFor(uid: string): InkName {
  let h = 0;
  for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PEER_INKS[h % PEER_INKS.length];
}

/** Folds one change someone else made into the paper on screen. Presence and cursors don't touch it. */
export function applyLive(paper: DropPaper, ev: LiveEvent): DropPaper {
  switch (ev.type) {
    case "thought": {
      const has = paper.thoughts.some((t) => t.id === ev.thought.id);
      return { ...paper, thoughts: has ? paper.thoughts.map((t) => (t.id === ev.thought.id ? { ...t, ...ev.thought } : t)) : [...paper.thoughts, ev.thought] };
    }
    case "gone":
      return paper.thoughts.some((t) => t.id === ev.id) ? { ...paper, thoughts: paper.thoughts.filter((t) => t.id !== ev.id) } : paper;
    case "moved": {
      const at = new Map(ev.placements.map((p) => [p.id, p]));
      return { ...paper, thoughts: paper.thoughts.map((t) => (at.has(t.id) ? { ...t, x: at.get(t.id)!.x, y: at.get(t.id)!.y } : t)) };
    }
    case "stroke": {
      const strokes = paper.strokes ?? [];
      return { ...paper, strokes: [...strokes.filter((s) => s.id !== ev.stroke.id), ev.stroke] };
    }
    case "stroke-edit":
      return { ...paper, strokes: (paper.strokes ?? []).map((s) => (s.id === ev.id ? { ...s, ...ev.change } : s)) };
    case "stroke-gone":
      return { ...paper, strokes: (paper.strokes ?? []).filter((s) => s.id !== ev.id) };
    default:
      return paper;
  }
}

/** A peer is gone when nothing has been heard from them for this long (each stream says "here" every 20 s). */
export const PEER_TIMEOUT_MS = 50_000;
/** A cursor that hasn't moved for this long fades out (the person stays in the row of faces). */
export const CURSOR_IDLE_MS = 15_000;
/** Cursor positions go out at most this often. */
export const CURSOR_EVERY_MS = 90;
