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
  /** Spot on the sheet once dragged (x: share of width, y: px); null while it flows, or while it's in a stack. */
  x: number | null;
  y: number | null;
  /** The stack it's piled in, if any. */
  stackId: string | null;
  /** Place in its stack; higher is nearer the top. */
  stackOrder: number;
  /** YYYY-MM-DD it's folded away till; it shows from that day on. */
  scheduledFor: string | null;
};

/** Thoughts piled together like sticky notes. Lives on one paper; its thoughts point at it. */
export type Stack = {
  id: string;
  name: string | null;
  x: number | null;
  y: number | null;
  createdAt: string;
  /** YYYY-MM-DD the stack was first made, when it rolled over to a later paper. */
  carriedFrom: string | null;
  /** YYYY-MM-DD the whole stack is folded away till. */
  scheduledFor: string | null;
};

export type DropPaper = {
  date: string;
  thoughts: Thought[];
  stacks: Stack[];
  /** When the desk was cleared that day (the evening ritual), if it was. */
  clearedAt?: string | null;
};

/** Day boundaries and the 9 PM email follow this zone. */
export const DROP_TIMEZONE = "Asia/Kolkata";

export const MAX_THOUGHT = 1000;
export const MAX_STACK_NAME = 60;
/** Crumpled thoughts are kept this long (for undo and mistakes), then removed for good. */
export const CRUMPLE_KEEP_DAYS = 7;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- Folding (scheduling) ---------- */

/** Folded away for later: scheduled for a day after this paper's. */
export function isFolded(x: { scheduledFor: string | null }, date: string): boolean {
  return !!x.scheduledFor && x.scheduledFor > date;
}

/**
 * What the paper shows today: folded thoughts and stacks are tucked away, and
 * a stack whose thoughts are all folded goes with them.
 */
export function visiblePaper(paper: DropPaper): DropPaper {
  const hiddenStacks = new Set(paper.stacks.filter((s) => isFolded(s, paper.date)).map((s) => s.id));
  const thoughts = paper.thoughts.filter((t) => !isFolded(t, paper.date) && !(t.stackId && hiddenStacks.has(t.stackId)));
  const stacks = paper.stacks.filter((s) => !hiddenStacks.has(s.id) && thoughts.some((t) => t.stackId === s.id));
  return { ...paper, thoughts, stacks };
}

export type FoldedItem = { id: string; kind: "thought" | "stack"; label: string; count: number; on: string };

/** Everything folded for later, soonest first. */
export function foldedItems(paper: DropPaper): FoldedItem[] {
  const out: FoldedItem[] = [];
  const hiddenStacks = new Set<string>();
  for (const s of paper.stacks) {
    if (!isFolded(s, paper.date)) continue;
    hiddenStacks.add(s.id);
    const n = paper.thoughts.filter((t) => t.stackId === s.id).length;
    out.push({ id: s.id, kind: "stack", label: stackLabel(s, n), count: n, on: s.scheduledFor! });
  }
  for (const t of paper.thoughts) {
    if (isFolded(t, paper.date) && !(t.stackId && hiddenStacks.has(t.stackId))) out.push({ id: t.id, kind: "thought", label: t.text, count: 1, on: t.scheduledFor! });
  }
  return out.sort((a, b) => a.on.localeCompare(b.on));
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
  /** Copies for the new paper: open thoughts and the stacks they're in. */
  thoughts: Thought[];
  stacks: Stack[];
  /**
   * Folded ones travel to the new paper as they are (same ids), so today
   * always knows what's folded. They remember the day they first left
   * (`carriedFrom`, set once), like a carried thought.
   */
  move: { stacks: string[]; thoughts: { id: string; stackId: string | null; carriedFrom: string }[] };
};

/**
 * The next paper's start, from the last one. Open thoughts come along, keeping
 * their text, look and first-drop time, and remembering the day they were
 * first dropped (pencil ideas too, just without a "carried" mark). A stack
 * comes with its open thoughts (same name and spot); with fewer than two open,
 * the one left goes loose where the stack was. Thoughts and stacks folded for
 * a later day move across untouched until their day comes; once it has, they
 * carry like any other.
 */
export function rollover(previous: DropPaper, newId: () => string): Rollover {
  const day = previous.date;
  const foldedStacks = new Set(previous.stacks.filter((s) => isFolded(s, day)).map((s) => s.id));
  const inFoldedStack = (t: Thought) => !!t.stackId && foldedStacks.has(t.stackId);
  const carryable = previous.thoughts.filter((t) => t.status === "open" && !isFolded(t, day) && !inFoldedStack(t));

  const stacks: Stack[] = [];
  const copied = new Map<string, string>();
  for (const s of previous.stacks) {
    if (foldedStacks.has(s.id) || carryable.filter((t) => t.stackId === s.id).length < 2) continue;
    const id = newId();
    copied.set(s.id, id);
    stacks.push({ ...s, id, scheduledFor: null, carriedFrom: s.carriedFrom ?? day });
  }
  const thoughts = carryable.map((t): Thought => {
    const carried = { ...t, id: newId(), doneAt: null, scheduledFor: null, carriedFrom: t.carriedFrom ?? day };
    if (!t.stackId) return carried;
    const stackId = copied.get(t.stackId);
    if (stackId) return { ...carried, stackId };
    const was = previous.stacks.find((s) => s.id === t.stackId);
    return { ...carried, stackId: null, stackOrder: 0, x: was?.x ?? null, y: was?.y ?? null };
  });

  const move: Rollover["move"] = { stacks: [...foldedStacks], thoughts: [] };
  for (const t of previous.thoughts) {
    if (!isFolded(t, day) || inFoldedStack(t)) continue;
    move.thoughts.push({ id: t.id, stackId: t.stackId ? (copied.get(t.stackId) ?? null) : null, carriedFrom: t.carriedFrom ?? day });
  }
  return { thoughts, stacks, move };
}

export { linkify, type TextPart } from "@/lib/linkify";

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

/* ---------- Stacks and other changes ---------- */

/** A stack's thoughts, top first: open ones by place, then the done ones sunk to the bottom. */
export function membersOf(paper: Pick<DropPaper, "thoughts">, stackId: string): Thought[] {
  return paper.thoughts
    .filter((t) => t.stackId === stackId)
    .sort((a, b) => (a.status === b.status ? b.stackOrder - a.stackOrder : a.status === "open" ? -1 : 1));
}

export function stackLabel(stack: Pick<Stack, "name">, count: number): string {
  return stack.name ?? `Stack of ${count}`;
}

export type StackOp =
  /** Drop a thought onto a thought (they become a stack at the target's spot) or onto a stack (it joins on top). */
  | { kind: "stack"; thought: string; onto: string; newStackId: string }
  /** Drag one out of its stack onto the sheet. */
  | { kind: "takeOut"; thought: string; x: number | null; y: number | null }
  /** Every thought goes loose, at the given spots (near the stack). */
  | { kind: "unstack"; stack: string; spots: { id: string; x: number; y: number }[] }
  | { kind: "rename"; stack: string; name: string | null }
  /** Throw the whole pile away. */
  | { kind: "crumple"; stack: string }
  /** Fold a thought or stack away till a day (or bring it back: null). */
  | { kind: "schedule"; id: string; on: string | null }
  /** Ink a pencil idea into a task, or pencil a task back into an idea. */
  | { kind: "ink"; thought: string; to: Kind };

export class StackError extends Error {}

/**
 * Applies one change to today's paper. The browser runs it to show the
 * change at once; the server runs the same thing on what's saved. A stack
 * left with one thought dissolves into it; an empty one goes.
 */
export function applyStackOp(paper: DropPaper, op: StackOp, now = new Date().toISOString()): DropPaper {
  let thoughts = paper.thoughts;
  let stacks = paper.stacks;
  const thought = (id: string) => {
    const t = thoughts.find((x) => x.id === id);
    if (!t) throw new StackError("That thought isn't on today's paper.");
    return t;
  };
  const stack = (id: string) => {
    const s = stacks.find((x) => x.id === id);
    if (!s) throw new StackError("That stack isn't on today's paper.");
    return s;
  };
  const put = (id: string, change: Partial<Thought>) => {
    thoughts = thoughts.map((t) => (t.id === id ? { ...t, ...change } : t));
  };
  const topOf = (stackId: string) => Math.max(-1, ...thoughts.filter((t) => t.stackId === stackId).map((t) => t.stackOrder));

  switch (op.kind) {
    case "stack": {
      const moving = thought(op.thought);
      if (op.onto === moving.id) throw new StackError("A thought can't stack on itself.");
      const ontoStack = stacks.find((s) => s.id === op.onto);
      const target = ontoStack ? null : thought(op.onto);
      const into = ontoStack?.id ?? target?.stackId;
      if (into) {
        if (moving.stackId === into) break;
        put(moving.id, { stackId: into, stackOrder: topOf(into) + 1, x: null, y: null });
      } else {
        if (stacks.some((s) => s.id === op.newStackId) || thoughts.some((t) => t.id === op.newStackId)) throw new StackError("That id is taken.");
        stacks = [...stacks, { id: op.newStackId, name: null, x: target!.x, y: target!.y, createdAt: now, carriedFrom: null, scheduledFor: null }];
        put(target!.id, { stackId: op.newStackId, stackOrder: 0, x: null, y: null });
        put(moving.id, { stackId: op.newStackId, stackOrder: 1, x: null, y: null });
      }
      break;
    }
    case "takeOut": {
      const t = thought(op.thought);
      if (!t.stackId) break;
      put(t.id, { stackId: null, stackOrder: 0, x: op.x, y: op.y });
      break;
    }
    case "unstack": {
      const s = stack(op.stack);
      const spot = new Map(op.spots.map((p) => [p.id, p]));
      for (const t of thoughts.filter((x) => x.stackId === s.id)) {
        const at = spot.get(t.id);
        put(t.id, { stackId: null, stackOrder: 0, x: at?.x ?? s.x, y: at?.y ?? s.y });
      }
      stacks = stacks.filter((x) => x.id !== s.id);
      break;
    }
    case "rename": {
      const s = stack(op.stack);
      const name = op.name?.trim().slice(0, MAX_STACK_NAME) || null;
      stacks = stacks.map((x) => (x.id === s.id ? { ...x, name } : x));
      break;
    }
    case "crumple": {
      const s = stack(op.stack);
      thoughts = thoughts.filter((t) => t.stackId !== s.id);
      stacks = stacks.filter((x) => x.id !== s.id);
      break;
    }
    case "schedule": {
      if (op.on !== null && (!DATE.test(op.on) || op.on < paper.date)) throw new StackError("Pick today or a later day.");
      const s = stacks.find((x) => x.id === op.id);
      if (s) stacks = stacks.map((x) => (x.id === s.id ? { ...x, scheduledFor: op.on } : x));
      else put(thought(op.id).id, { scheduledFor: op.on });
      break;
    }
    case "ink": {
      const t = thought(op.thought);
      // An idea is never "done": pencilling a struck task brings it back open.
      put(t.id, op.to === "pencil" ? { kind: "pencil", status: "open", doneAt: null } : { kind: "pen" });
      break;
    }
  }
  return settleStacks({ ...paper, thoughts, stacks });
}

/** A stack with one thought left dissolves into it (at the stack's spot); an empty stack goes. */
export function settleStacks(paper: DropPaper): DropPaper {
  let thoughts = paper.thoughts;
  const stacks = paper.stacks.filter((s) => {
    const members = thoughts.filter((t) => t.stackId === s.id);
    if (members.length >= 2) return true;
    if (members.length === 1) {
      thoughts = thoughts.map((t) => (t.id === members[0].id ? { ...t, stackId: null, stackOrder: 0, x: s.x, y: s.y } : t));
    }
    return false;
  });
  return { ...paper, thoughts, stacks };
}

/* ---------- Clear desk ---------- */

/** One card in the evening clear-out: a loose open task, or a stack with open tasks. */
export type DeskCard = { kind: "thought"; id: string; text: string } | { kind: "stack"; id: string; label: string; open: { id: string; text: string }[] };

/** What's still open in pen on today's paper, one card per loose thought or stack (pencil ideas are already kept). */
export function deskCards(paper: DropPaper): DeskCard[] {
  const shown = visiblePaper(paper);
  const cards: DeskCard[] = [];
  for (const s of shown.stacks) {
    const open = membersOf(shown, s.id).filter((t) => t.status === "open" && t.kind === "pen");
    if (open.length) cards.push({ kind: "stack", id: s.id, label: stackLabel(s, open.length), open: open.map((t) => ({ id: t.id, text: t.text })) });
  }
  for (const t of shown.thoughts) {
    if (!t.stackId && t.status === "open" && t.kind === "pen") cards.push({ kind: "thought", id: t.id, text: t.text });
  }
  return cards;
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
