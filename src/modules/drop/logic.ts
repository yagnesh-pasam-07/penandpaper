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
  /** Its place in today's order (1 is first), if numbered. A few are; most aren't. */
  rank: number | null;
  /** Picked for tomorrow's top 3 at Clear desk: arrives with this number. */
  nextRank: number | null;
  /** A pasted or dropped picture (a small data URL), taped on like a photo; the text is its caption. */
  image?: string | null;
};

/** An ink line from one thought or stack to another, maybe with a few words on it. */
export type Link = {
  id: string;
  from: string;
  to: string;
  label: string | null;
  /** An arrowhead at the `to` end; otherwise a plain line. */
  arrow: boolean;
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
  /** Numbered as a whole. */
  rank: number | null;
  nextRank: number | null;
};

export type DropPaper = {
  date: string;
  thoughts: Thought[];
  stacks: Stack[];
  /** Lines joining thoughts and stacks. */
  links?: Link[];
  /** When the desk was cleared that day (the evening ritual), if it was. */
  clearedAt?: string | null;
};

/** Day boundaries and the 9 PM email follow this zone. */
export const DROP_TIMEZONE = "Asia/Kolkata";

export const MAX_THOUGHT = 1000;
export const MAX_STACK_NAME = 60;
export const MAX_LINK_LABEL = 40;
/** A picture's data URL, after it's been shrunk in the browser. */
export const MAX_IMAGE = 1_500_000;
/** Crumpled thoughts are kept this long (for undo and mistakes), then removed for good. */
export const CRUMPLE_KEEP_DAYS = 7;
/** Numbering has no real limit; this only keeps the numbers sane. */
export const MAX_RANK = 99;
/** Clear desk's "tomorrow's top 3". */
export const MAX_NEXT_RANK = 3;

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
    if (isFolded(t, paper.date) && !(t.stackId && hiddenStacks.has(t.stackId))) out.push({ id: t.id, kind: "thought", label: thoughtLabel(t), count: 1, on: t.scheduledFor! });
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
  /** Lines whose two ends both came along (pointing at the copies). */
  links: Link[];
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
    // Numbers belong to a paper: only tomorrow's picks arrive numbered.
    stacks.push({ ...s, id, scheduledFor: null, carriedFrom: s.carriedFrom ?? day, rank: s.nextRank, nextRank: null });
  }
  const thoughtIds = new Map<string, string>();
  const thoughts = carryable.map((t): Thought => {
    const id = newId();
    thoughtIds.set(t.id, id);
    const carried = { ...t, id, doneAt: null, scheduledFor: null, carriedFrom: t.carriedFrom ?? day, rank: t.stackId ? null : t.nextRank, nextRank: null };
    if (!t.stackId) return carried;
    const stackId = copied.get(t.stackId);
    if (stackId) return { ...carried, stackId };
    const was = previous.stacks.find((s) => s.id === t.stackId);
    return { ...carried, stackId: null, stackOrder: 0, x: was?.x ?? null, y: was?.y ?? null, rank: was?.nextRank ?? null };
  });

  const move: Rollover["move"] = { stacks: [...foldedStacks], thoughts: [] };
  for (const t of previous.thoughts) {
    if (!isFolded(t, day) || inFoldedStack(t)) continue;
    move.thoughts.push({ id: t.id, stackId: t.stackId ? (copied.get(t.stackId) ?? null) : null, carriedFrom: t.carriedFrom ?? day });
  }
  // Folded ones keep their ids, so a line to one still finds it.
  const kept = new Set([...move.stacks, ...move.thoughts.map((m) => m.id)]);
  const end = (id: string) => thoughtIds.get(id) ?? copied.get(id) ?? (kept.has(id) ? id : undefined);
  const links = (previous.links ?? []).flatMap((l) => {
    const from = end(l.from);
    const to = end(l.to);
    return from && to ? [{ ...l, id: newId(), from, to }] : [];
  });
  return { ...renumberList(thoughts, stacks), links, move };
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
  | { kind: "ink"; thought: string; to: Kind }
  /** Give a thought or stack a place in the order (the others shift), or take its number away (null). */
  | { kind: "rank"; id: string; rank: number | null }
  /** Number these, in this order; everything else loses its number. */
  | { kind: "order"; ids: string[] }
  /** Tomorrow's top 3, in order (from Clear desk). */
  | { kind: "nextRank"; ids: string[] }
  /** Join two thoughts or stacks with an ink line. */
  | { kind: "link"; id: string; from: string; to: string }
  | { kind: "unlink"; id: string }
  /** Words on a line, or an arrow or plain line. */
  | { kind: "linkStyle"; id: string; label?: string | null; arrow?: boolean };

export class StackError extends Error {}

/**
 * Applies one change to today's paper. The browser runs it to show the
 * change at once; the server runs the same thing on what's saved. A stack
 * left with one thought dissolves into it; an empty one goes.
 */
export function applyStackOp(paper: DropPaper, op: StackOp, now = new Date().toISOString()): DropPaper {
  let thoughts = paper.thoughts;
  let stacks = paper.stacks;
  let links = paper.links ?? [];
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
        // The new stack takes the target's spot, and its number.
        stacks = [...stacks, { id: op.newStackId, name: null, x: target!.x, y: target!.y, createdAt: now, carriedFrom: null, scheduledFor: null, rank: target!.rank, nextRank: null }];
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
    case "rank": {
      const order = rankedIds({ thoughts, stacks });
      const at = order.indexOf(op.id);
      if (!thoughts.some((t) => t.id === op.id && !t.stackId) && !stacks.some((s) => s.id === op.id)) throw new StackError("Only a loose thought or a stack can be numbered.");
      if (at === -1 && op.rank !== null && order.length >= MAX_RANK) throw new StackError(`That's ${MAX_RANK} numbered already.`);
      if (at !== -1) order.splice(at, 1);
      if (op.rank !== null) order.splice(Math.max(0, Math.min(op.rank - 1, order.length)), 0, op.id);
      ({ thoughts, stacks } = withRanks({ thoughts, stacks }, order));
      break;
    }
    case "order": {
      const ids = [...new Set(op.ids)].filter((id) => thoughts.some((t) => t.id === id && !t.stackId) || stacks.some((s) => s.id === id));
      if (ids.length > MAX_RANK) throw new StackError(`That's more than ${MAX_RANK}.`);
      ({ thoughts, stacks } = withRanks({ thoughts, stacks }, ids));
      break;
    }
    case "nextRank": {
      const ids = [...new Set(op.ids)].slice(0, MAX_NEXT_RANK);
      const pick = (id: string) => (ids.includes(id) ? ids.indexOf(id) + 1 : null);
      thoughts = thoughts.map((t) => ({ ...t, nextRank: pick(t.id) }));
      stacks = stacks.map((s) => ({ ...s, nextRank: pick(s.id) }));
      break;
    }
    case "link": {
      const exists = (id: string) => thoughts.some((t) => t.id === id) || stacks.some((s) => s.id === id);
      if (!exists(op.from) || !exists(op.to)) throw new StackError("That isn't on today's paper.");
      if (op.from === op.to) throw new StackError("A thought can't connect to itself.");
      if (links.some((l) => l.id === op.id)) throw new StackError("That id is taken.");
      // One line between two notes is enough.
      if (links.some((l) => (l.from === op.from && l.to === op.to) || (l.from === op.to && l.to === op.from))) break;
      links = [...links, { id: op.id, from: op.from, to: op.to, label: null, arrow: true }];
      break;
    }
    case "unlink": {
      links = links.filter((l) => l.id !== op.id);
      break;
    }
    case "linkStyle": {
      if (!links.some((l) => l.id === op.id)) throw new StackError("That line isn't on today's paper.");
      const label = op.label === undefined ? undefined : op.label?.trim().slice(0, MAX_LINK_LABEL) || null;
      links = links.map((l) => (l.id === op.id ? { ...l, ...(label !== undefined ? { label } : {}), ...(op.arrow !== undefined ? { arrow: op.arrow } : {}) } : l));
      break;
    }
  }
  // Numbering sets the order on the sheet too: numbered ones move to the top
  // row, first to last; the rest stay where they were put.
  if (op.kind === "rank" || op.kind === "order") {
    const lifted = new Set(rankedIds({ thoughts, stacks }));
    thoughts = thoughts.map((t) => (lifted.has(t.id) ? { ...t, x: null, y: null } : t));
    stacks = stacks.map((s) => (lifted.has(s.id) ? { ...s, x: null, y: null } : s));
  }
  // Folded away: it gives up its place in today's order.
  if (op.kind === "schedule" && op.on && op.on > paper.date) {
    thoughts = thoughts.map((t) => (t.id === op.id ? { ...t, rank: null } : t));
    stacks = stacks.map((s) => (s.id === op.id ? { ...s, rank: null } : s));
  }
  return settleStacks({ ...paper, thoughts, stacks, links });
}

/**
 * A stack with one thought left dissolves into it (at the stack's spot, with
 * its number); an empty stack goes. Then the numbers close up: 1, 2, 3…
 */
export function settleStacks(paper: DropPaper): DropPaper {
  let thoughts = paper.thoughts;
  const stacks = paper.stacks.filter((s) => {
    const members = thoughts.filter((t) => t.stackId === s.id);
    if (members.length >= 2) return true;
    if (members.length === 1) {
      thoughts = thoughts.map((t) => (t.id === members[0].id ? { ...t, stackId: null, stackOrder: 0, x: s.x, y: s.y, rank: s.rank } : t));
    }
    return false;
  });
  // A line goes with either of its ends.
  const ends = new Set([...thoughts.map((t) => t.id), ...stacks.map((s) => s.id)]);
  const links = (paper.links ?? []).filter((l) => ends.has(l.from) && ends.has(l.to));
  return { ...paper, ...renumberList(thoughts, stacks), links };
}

/* ---------- Numbering ---------- */

/** Loose thoughts and stacks that carry a number, first to last. */
export function rankedIds(paper: Pick<DropPaper, "thoughts" | "stacks">): string[] {
  const all = [
    ...paper.thoughts.filter((t) => t.rank !== null && !t.stackId).map((t) => ({ id: t.id, rank: t.rank! })),
    ...paper.stacks.filter((s) => s.rank !== null).map((s) => ({ id: s.id, rank: s.rank! })),
  ];
  return all.sort((a, b) => a.rank - b.rank).map((x) => x.id);
}

function withRanks(paper: { thoughts: Thought[]; stacks: Stack[] }, order: string[]): { thoughts: Thought[]; stacks: Stack[] } {
  const rankOf = (id: string) => (order.includes(id) ? order.indexOf(id) + 1 : null);
  return {
    thoughts: paper.thoughts.map((t) => ({ ...t, rank: t.stackId ? null : rankOf(t.id) })),
    stacks: paper.stacks.map((s) => ({ ...s, rank: rankOf(s.id) })),
  };
}

/** Numbers close up after something leaves (1, 3 → 1, 2); a thought inside a stack has none of its own. */
function renumberList(thoughts: Thought[], stacks: Stack[]): { thoughts: Thought[]; stacks: Stack[] } {
  const live = { thoughts: thoughts.map((t) => (t.stackId ? { ...t, rank: null } : t)), stacks };
  return withRanks(live, rankedIds(live));
}

/* ---------- Connections ---------- */

/** What's drawn on the sheet for a thought: itself, or the stack it's in. */
export function sheetIdOf(paper: Pick<DropPaper, "thoughts">, id: string): string {
  return paper.thoughts.find((t) => t.id === id)?.stackId ?? id;
}

/**
 * Everything joined to `start` by lines, as a tree from it (depth first):
 * each with how deep it sits. Ids are sheet ids (a thought in a stack counts as its stack).
 */
export function threadOf(paper: DropPaper, start: string): { id: string; depth: number }[] {
  const next = new Map<string, Set<string>>();
  for (const l of paper.links ?? []) {
    const a = sheetIdOf(paper, l.from);
    const b = sheetIdOf(paper, l.to);
    if (a === b) continue;
    next.set(a, (next.get(a) ?? new Set()).add(b));
    next.set(b, (next.get(b) ?? new Set()).add(a));
  }
  const root = sheetIdOf(paper, start);
  if (!next.has(root)) return [];
  const out: { id: string; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number) => {
    seen.add(id);
    out.push({ id, depth });
    for (const n of next.get(id) ?? []) if (!seen.has(n)) walk(n, depth + 1);
  };
  walk(root, 0);
  return out;
}

/** What a thought reads as in lists: its words, or "Image" for a picture with no caption. */
export function thoughtLabel(t: Pick<Thought, "text" | "image">): string {
  return t.text || (t.image ? "Image" : "");
}

/** In number mode, a tap: the next number if it has none, otherwise its number comes off. */
export function tapRank(paper: DropPaper, id: string): StackOp {
  const order = rankedIds(paper);
  return { kind: "rank", id, rank: order.includes(id) ? null : order.length + 1 };
}

export type NextUp = { id: string; rank: number; label: string };

/** The first numbered thing that isn't done yet: "Next: ② call naga". */
export function nextUp(paper: DropPaper): NextUp | null {
  const shown = visiblePaper(paper);
  for (const id of rankedIds(shown)) {
    const t = shown.thoughts.find((x) => x.id === id);
    if (t) {
      if (t.status === "open") return { id, rank: t.rank!, label: thoughtLabel(t) };
      continue;
    }
    const s = shown.stacks.find((x) => x.id === id);
    const open = s ? membersOf(shown, s.id).filter((m) => m.status === "open") : [];
    if (s && open.length) return { id, rank: s.rank!, label: stackLabel(s, open.length) };
  }
  return null;
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
    if (open.length) cards.push({ kind: "stack", id: s.id, label: stackLabel(s, open.length), open: open.map((t) => ({ id: t.id, text: thoughtLabel(t) })) });
  }
  for (const t of shown.thoughts) {
    if (!t.stackId && t.status === "open" && t.kind === "pen") cards.push({ kind: "thought", id: t.id, text: thoughtLabel(t) });
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
