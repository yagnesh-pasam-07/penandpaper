/**
 * Thoughts that come back. The pure rules for the morning resurface (one old
 * thought a day, on a 1 → 7 → 30 day rhythm) and the Sunday rewind (the week,
 * grouped). No database and no browser, so the rules are tested on their own.
 */

/** How long after it was written (or last kept) a thought is due again, by how many times it has come back already. */
export const RHYTHM_DAYS = [1, 7, 30] as const;

/** After the last step a kept thought stops coming back on its own (the rewind still shows it). */
export const MAX_STEP = RHYTHM_DAYS.length;

/** What someone can do with a thought that came back. */
export type Resolution = "act" | "keep" | "let_go" | "later";

export type ResurfaceState = {
  /** How many times it has already come back and been kept (0 = never). */
  step: number;
  /** When it is due next (ISO); null once it is done coming back. */
  dueAt: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a thought written (or kept) at `from` is first due, at step `step`. Null when the rhythm is over. */
export function nextDue(from: Date, step: number): Date | null {
  const days = RHYTHM_DAYS[step];
  return days === undefined ? null : new Date(from.getTime() + days * DAY_MS);
}

/**
 * What a choice does to a thought's rhythm.
 * - act: it's done (struck); never comes back.
 * - keep: one step further, so it comes back later (1 → 7 → 30 days), then rests.
 * - let_go: never comes back; it stays on its paper.
 * - later: "not now", the same thought again tomorrow.
 */
export function resolve(state: ResurfaceState, choice: Resolution, now: Date = new Date()): ResurfaceState & { strike: boolean } {
  switch (choice) {
    case "act":
      return { step: state.step, dueAt: null, strike: true };
    case "let_go":
      return { step: state.step, dueAt: null, strike: false };
    case "later":
      return { step: state.step, dueAt: new Date(now.getTime() + DAY_MS).toISOString(), strike: false };
    case "keep": {
      const step = state.step + 1;
      const due = nextDue(now, step);
      return { step, dueAt: due ? due.toISOString() : null, strike: false };
    }
  }
}

/** "Yesterday", "A week ago", "3 weeks ago": how long ago a thought was written, in the words a card shows. */
export function agoText(createdAt: Date | string, now: Date = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / DAY_MS));
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "A week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "A month ago";
  return `${Math.floor(days / 30)} months ago`;
}

/* ---------- The Sunday rewind ---------- */

export type RewindThought = { id: string; text: string; status: "open" | "done"; createdAt: string; paperId: string; paperName: string | null; hasImage: boolean };
export type RewindGroup = { paperId: string; paperName: string | null; open: RewindThought[]; done: RewindThought[] };

/** The Monday that starts the week a local date falls in (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/**
 * The week's thoughts, one group per paper: papers with the most still-open
 * thoughts first; inside each, open thoughts before done ones, oldest first.
 */
export function groupRewind(thoughts: RewindThought[]): RewindGroup[] {
  const byPaper = new Map<string, RewindGroup>();
  for (const t of [...thoughts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const g = byPaper.get(t.paperId) ?? { paperId: t.paperId, paperName: t.paperName, open: [], done: [] };
    (t.status === "open" ? g.open : g.done).push(t);
    byPaper.set(t.paperId, g);
  }
  return [...byPaper.values()].sort((a, b) => b.open.length - a.open.length || b.done.length - a.done.length);
}

/** "12 thoughts this week · 5 still open", the line under the rewind's title. */
export function rewindLine(groups: RewindGroup[]): string {
  const open = groups.reduce((k, g) => k + g.open.length, 0);
  const all = groups.reduce((k, g) => k + g.open.length + g.done.length, 0);
  if (!all) return "Nothing written this week yet.";
  return `${all} ${all === 1 ? "thought" : "thoughts"} this week · ${open} still open`;
}

/** Whether a local date is a Sunday: the rewind's day in the evening email. */
export function isSunday(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}
