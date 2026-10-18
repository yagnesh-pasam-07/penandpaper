/** Drop: the personal brain-dump paper. Shared by browser, server and tests. */

export type Thought = {
  id: string;
  text: string;
  status: "open" | "done";
  shape: number;
  /** ISO time it was first dropped. */
  createdAt: string;
  doneAt: string | null;
  /** YYYY-MM-DD it was first dropped, when it rolled over to a later paper. */
  carriedFrom: string | null;
};

export type DropPaper = { date: string; thoughts: Thought[] };

/** Day boundaries and the 9 PM email follow this zone. */
export const DROP_TIMEZONE = "Asia/Kolkata";

export const MAX_THOUGHT = 1000;

/**
 * Yesterday's unstruck thoughts, ready for today's paper. They keep their text,
 * look and first-drop time, and remember the day they were first dropped.
 */
export function rollover(previous: DropPaper, newId: () => string): Thought[] {
  return previous.thoughts
    .filter((t) => t.status === "open")
    .map((t) => ({ ...t, id: newId(), doneAt: null, carriedFrom: t.carriedFrom ?? previous.date }));
}

export { linkify, type TextPart } from "@/lib/linkify";

/** Only thoughts dropped today count toward "did they drop anything" (not carried ones). */
export function droppedToday(paper: DropPaper): number {
  return paper.thoughts.filter((t) => !t.carriedFrom).length;
}
