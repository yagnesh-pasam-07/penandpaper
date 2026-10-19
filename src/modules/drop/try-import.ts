"use client";

import { uid } from "@/lib/mutations";
import { call } from "./chrome";
import { membersOf, type DropPaper, type Stack, type Thought } from "./logic";

/** Where the homepage's "try it here" paper lives, in the visitor's browser only. */
export const TRY_KEY = "pp-try-paper";

export type TryPaper = { thoughts: Thought[]; stacks: Stack[] };

export function readTryPaper(): TryPaper | null {
  try {
    const raw = localStorage.getItem(TRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TryPaper;
    return Array.isArray(parsed?.thoughts) ? { thoughts: parsed.thoughts, stacks: Array.isArray(parsed.stacks) ? parsed.stacks : [] } : null;
  } catch {
    return null;
  }
}

/**
 * Brings what a visitor tried on the homepage onto their real paper after they
 * sign up: each thought (struck ones struck), stacked as they were. Runs once:
 * the browser copy is cleared first, so a reload never imports twice. Returns
 * today's paper as saved, or null when there was nothing to bring.
 */
export async function importTryPaper(): Promise<DropPaper | null> {
  const tried = readTryPaper();
  if (!tried || tried.thoughts.length === 0) return null;
  try {
    localStorage.removeItem(TRY_KEY);
  } catch {}
  const ids = new Map<string, string>();
  try {
    // Oldest first, so they land in the order they were written.
    for (const t of [...tried.thoughts].reverse()) {
      const id = uid();
      ids.set(t.id, id);
      await call("/api/drop/thoughts", { method: "POST", body: JSON.stringify({ id, text: t.text.slice(0, 1000), shape: t.shape % 6, kind: t.kind === "pencil" ? "pencil" : "pen" }) });
      if (t.status === "done" && t.kind !== "pencil") await call(`/api/drop/thoughts/${id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
    }
    for (const s of tried.stacks) {
      const members = membersOf({ thoughts: tried.thoughts }, s.id)
        .reverse()
        .map((m) => ids.get(m.id))
        .filter((x): x is string => !!x);
      if (members.length < 2) continue;
      const stackId = uid();
      await call("/api/drop/stacks", { method: "POST", body: JSON.stringify({ kind: "stack", thought: members[1], onto: members[0], newStackId: stackId }) });
      for (const m of members.slice(2)) await call("/api/drop/stacks", { method: "POST", body: JSON.stringify({ kind: "stack", thought: m, onto: stackId, newStackId: uid() }) });
      if (s.name) await call("/api/drop/stacks", { method: "POST", body: JSON.stringify({ kind: "rename", stack: stackId, name: s.name }) });
    }
  } catch {
    // Whatever made it in stays; the rest isn't worth an error on a first visit.
  }
  return call<DropPaper>("/api/drop/today");
}
