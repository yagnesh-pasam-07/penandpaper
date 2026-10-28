"use client";

import { uid } from "@/lib/mutations";
import { call } from "./chrome";
import type { PaperMeta, Thought } from "./logic";

/** Where the homepage's "try it here" paper lives, in the visitor's browser only. */
export const TRY_KEY = "pp-try-paper";

/** What the paper they made on the homepage is called once it is theirs. */
export const TRY_PAPER_NAME = "From my first visit";

export type TryPaper = { thoughts: Thought[] };

export function readTryPaper(): TryPaper | null {
  try {
    const raw = localStorage.getItem(TRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TryPaper;
    return Array.isArray(parsed?.thoughts) ? { thoughts: parsed.thoughts } : null;
  } catch {
    return null;
  }
}

/**
 * Brings what a visitor tried on the homepage onto a paper of their own after
 * they sign up: each thought (struck ones struck), on a new paper named "From
 * my first visit". When the paper they landed on is brand new and still blank,
 * that one becomes it, so no empty paper is left behind. Runs once: the browser
 * copy is cleared first, so a reload never imports twice. Returns the id of the
 * paper the thoughts went to, or null when there was nothing to bring.
 */
export async function importTryPaper(current: { id: string; blank: boolean }): Promise<string | null> {
  const tried = readTryPaper();
  if (!tried || tried.thoughts.length === 0) return null;
  try {
    localStorage.removeItem(TRY_KEY);
  } catch {}
  let paperId = current.id;
  try {
    if (current.blank) {
      await call(`/api/drop/papers/${current.id}`, { method: "PATCH", body: JSON.stringify({ name: TRY_PAPER_NAME }) });
    } else {
      paperId = (await call<PaperMeta>("/api/drop/papers", { method: "POST", body: JSON.stringify({ name: TRY_PAPER_NAME }) })).id;
    }
    // Oldest first, so they land in the order they were written.
    for (const t of [...tried.thoughts].reverse()) {
      const id = uid();
      await call("/api/drop/thoughts", { method: "POST", body: JSON.stringify({ paperId, id, text: t.text.slice(0, 1000), shape: t.shape % 6 }) });
      if (t.status === "done") await call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify({ paperId, status: "done" }) });
    }
  } catch {
    // Whatever made it in stays; the rest isn't worth an error on a first visit.
  }
  return paperId;
}
