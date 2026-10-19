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
  /** Spot on the sheet once dragged (x: share of width, y: px); null while it flows, or while it's in a stack. */
  x: number | null;
  y: number | null;
  /** The stack it's piled in, if any. */
  stackId: string | null;
  /** Place in its stack; higher is nearer the top. */
  stackOrder: number;
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
};

export type DropPaper = { date: string; thoughts: Thought[]; stacks: Stack[] };

/** Day boundaries and the 9 PM email follow this zone. */
export const DROP_TIMEZONE = "Asia/Kolkata";

export const MAX_THOUGHT = 1000;
export const MAX_STACK_NAME = 60;

/**
 * The next paper's start, from the last one: its open thoughts, keeping their
 * text, look and first-drop time, and remembering the day they were first
 * dropped. A stack comes along with its open thoughts (same name and spot);
 * if fewer than two are open, the one left goes loose where the stack was.
 */
export function rollover(previous: DropPaper, newId: () => string): { thoughts: Thought[]; stacks: Stack[] } {
  const open = previous.thoughts.filter((t) => t.status === "open");
  const stacks: Stack[] = [];
  const moved = new Map<string, string>();
  for (const s of previous.stacks) {
    if (open.filter((t) => t.stackId === s.id).length < 2) continue;
    const id = newId();
    moved.set(s.id, id);
    stacks.push({ ...s, id, carriedFrom: s.carriedFrom ?? previous.date });
  }
  const thoughts = open.map((t): Thought => {
    const carried = { ...t, id: newId(), doneAt: null, carriedFrom: t.carriedFrom ?? previous.date };
    if (!t.stackId) return carried;
    const stackId = moved.get(t.stackId);
    if (stackId) return { ...carried, stackId };
    const was = previous.stacks.find((s) => s.id === t.stackId);
    return { ...carried, stackId: null, stackOrder: 0, x: was?.x ?? null, y: was?.y ?? null };
  });
  return { thoughts, stacks };
}

export { linkify, type TextPart } from "@/lib/linkify";

/** Only thoughts dropped today count toward "did they drop anything" (not carried ones). */
export function droppedToday(paper: DropPaper): number {
  return paper.thoughts.filter((t) => !t.carriedFrom).length;
}

/* ---------- Stacks ---------- */

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
  | { kind: "crumple"; stack: string };

export class StackError extends Error {}

/**
 * Applies one change to a paper's stacks. The browser runs it to show the
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
        stacks = [...stacks, { id: op.newStackId, name: null, x: target!.x, y: target!.y, createdAt: now, carriedFrom: null }];
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
