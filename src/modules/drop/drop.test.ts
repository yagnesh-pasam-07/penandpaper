import { describe, expect, it } from "vitest";
import { digestItems } from "./digest";
import {
  applyStackOp,
  counts,
  deskCards,
  deskSummary,
  droppedToday,
  foldedItems,
  linkify,
  membersOf,
  nextUp,
  rankedIds,
  rollover,
  tapRank,
  StackError,
  threadOf,
  thoughtLabel,
  guessLinks,
  keywords,
  pencilFade,
  themeOf,
  tomorrowIds,
  thisWeekend,
  visiblePaper,
  whenLabel,
  type DropPaper,
  type Stack,
  type Thought,
} from "./logic";

const t = (id: string, text: string, status: "open" | "done", carriedFrom: string | null = null, more: Partial<Thought> = {}): Thought => ({
  id,
  text,
  status,
  kind: "pen",
  shape: 1,
  createdAt: "2026-10-17T04:00:00.000Z",
  doneAt: status === "done" ? "2026-10-17T09:00:00.000Z" : null,
  carriedFrom,
  x: null,
  y: null,
  stackId: null,
  stackOrder: 0,
  scheduledFor: null,
  rank: null,
  nextRank: null,
  ...more,
});

/** Each id with its number, in rank order. */
const ranks = (p: DropPaper) => rankedIds(p).map((id) => [id, p.thoughts.find((t) => t.id === id)?.rank ?? p.stacks.find((s) => s.id === id)?.rank]);

const stack = (id: string, more: Partial<Stack> = {}): Stack => ({ id, name: null, x: 0.5, y: 200, createdAt: "2026-10-17T05:00:00.000Z", carriedFrom: null, scheduledFor: null, rank: null, nextRank: null, ...more });

const paper = (thoughts: Thought[], stacks: Stack[] = []): DropPaper => ({ date: "2026-10-17", thoughts, stacks });

describe("rollover", () => {
  const yesterday = paper([t("a", "call bank", "done"), t("b", "renew passport", "open"), t("c", "old idea", "open", "2026-10-15")]);
  let n = 0;
  const carried = rollover(yesterday, () => `new${++n}`).thoughts;

  it("brings only unstruck thoughts", () => {
    expect(carried.map((x) => x.text)).toEqual(["renew passport", "old idea"]);
  });
  it("marks them carried from the day they were first dropped", () => {
    expect(carried.map((x) => x.carriedFrom)).toEqual(["2026-10-17", "2026-10-15"]);
  });
  it("gives them new ids and keeps the first drop time", () => {
    expect(carried.every((x) => x.id.startsWith("new"))).toBe(true);
    expect(carried[0].createdAt).toBe("2026-10-17T04:00:00.000Z");
  });
  it("doesn't count carried thoughts as dropped today", () => {
    expect(droppedToday({ date: "2026-10-18", thoughts: carried, stacks: [] })).toBe(0);
  });
});

describe("stack rollover", () => {
  const yesterday = paper(
    [
      t("m", "milk", "open", null, { stackId: "s1", stackOrder: 0 }),
      t("e", "eggs", "open", null, { stackId: "s1", stackOrder: 1 }),
      t("b", "bread", "done", null, { stackId: "s1", stackOrder: 2 }),
      t("p", "pack bag", "open", null, { stackId: "s2", stackOrder: 0 }),
      t("q", "passport", "done", null, { stackId: "s2", stackOrder: 1 }),
    ],
    [stack("s1", { name: "Groceries", x: 0.3, y: 180 }), stack("s2", { x: 0.7, y: 240 })],
  );
  let n = 0;
  const next = rollover(yesterday, () => `n${++n}`);

  it("carries a stack with its open thoughts only (2 open + 1 done → 2)", () => {
    expect(next.stacks).toHaveLength(1);
    const [s] = next.stacks;
    expect(s).toMatchObject({ name: "Groceries", x: 0.3, y: 180, carriedFrom: "2026-10-17" });
    expect(membersOf(next, s.id).map((x) => x.text)).toEqual(["eggs", "milk"]);
  });
  it("leaves the old paper's stack untouched (it keeps all 3)", () => {
    expect(membersOf(yesterday, "s1")).toHaveLength(3);
  });
  it("lets a stack with one open thought go loose where the stack was", () => {
    const pack = next.thoughts.find((x) => x.text === "pack bag")!;
    expect(pack).toMatchObject({ stackId: null, x: 0.7, y: 240 });
  });
});

describe("stack changes", () => {
  const base = paper([t("a", "milk", "open", null, { x: 0.2, y: 100 }), t("b", "eggs", "open"), t("c", "bread", "open")]);
  const now = "2026-10-17T10:00:00.000Z";

  it("drops a thought onto another: a stack at the target's spot", () => {
    const after = applyStackOp(base, { kind: "stack", thought: "b", onto: "a", newStackId: "s1" }, now);
    expect(after.stacks).toEqual([{ id: "s1", name: null, x: 0.2, y: 100, createdAt: now, carriedFrom: null, scheduledFor: null, rank: null, nextRank: null }]);
    expect(membersOf(after, "s1").map((x) => x.id)).toEqual(["b", "a"]);
    expect(after.thoughts.find((x) => x.id === "a")).toMatchObject({ x: null, y: null });
  });

  it("drops a thought onto a stack (or a thought in one): it joins on top", () => {
    const pair = applyStackOp(base, { kind: "stack", thought: "b", onto: "a", newStackId: "s1" }, now);
    const three = applyStackOp(pair, { kind: "stack", thought: "c", onto: "a", newStackId: "unused" }, now);
    expect(three.stacks).toHaveLength(1);
    expect(membersOf(three, "s1")[0].id).toBe("c");
  });

  it("sinks done thoughts to the bottom of a stack", () => {
    const s = paper(
      [t("a", "a", "done", null, { stackId: "s", stackOrder: 2 }), t("b", "b", "open", null, { stackId: "s", stackOrder: 0 })],
      [stack("s")],
    );
    expect(membersOf(s, "s").map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("dissolves a stack taken down to one thought, leaving it where the stack was", () => {
    const pair = applyStackOp(base, { kind: "stack", thought: "b", onto: "a", newStackId: "s1" }, now);
    const out = applyStackOp(pair, { kind: "takeOut", thought: "b", x: 0.8, y: 300 }, now);
    expect(out.stacks).toEqual([]);
    expect(out.thoughts.find((x) => x.id === "b")).toMatchObject({ stackId: null, x: 0.8, y: 300 });
    expect(out.thoughts.find((x) => x.id === "a")).toMatchObject({ stackId: null, x: 0.2, y: 100 });
  });

  it("dissolves the old stack when its second-last thought joins another", () => {
    let p = applyStackOp(base, { kind: "stack", thought: "b", onto: "a", newStackId: "s1" }, now);
    p = applyStackOp(paper([...p.thoughts, t("d", "jam", "open")], p.stacks), { kind: "stack", thought: "b", onto: "d", newStackId: "s2" }, now);
    expect(p.stacks.map((s) => s.id)).toEqual(["s2"]);
  });

  it("unstacks into loose thoughts near the stack", () => {
    const three = applyStackOp(applyStackOp(base, { kind: "stack", thought: "b", onto: "a", newStackId: "s1" }, now), { kind: "stack", thought: "c", onto: "s1", newStackId: "x" }, now);
    const loose = applyStackOp(three, { kind: "unstack", stack: "s1", spots: [{ id: "c", x: 0.25, y: 120 }] }, now);
    expect(loose.stacks).toEqual([]);
    expect(loose.thoughts.find((x) => x.id === "c")).toMatchObject({ x: 0.25, y: 120, stackId: null });
    expect(loose.thoughts.find((x) => x.id === "a")).toMatchObject({ x: 0.2, y: 100, stackId: null });
  });

  it("names a stack (trimmed; blank clears it) and crumples it with its thoughts", () => {
    const pair = applyStackOp(base, { kind: "stack", thought: "b", onto: "a", newStackId: "s1" }, now);
    expect(applyStackOp(pair, { kind: "rename", stack: "s1", name: "  Groceries " }, now).stacks[0].name).toBe("Groceries");
    expect(applyStackOp(pair, { kind: "rename", stack: "s1", name: "   " }, now).stacks[0].name).toBeNull();
    const gone = applyStackOp(pair, { kind: "crumple", stack: "s1" }, now);
    expect(gone.stacks).toEqual([]);
    expect(gone.thoughts.map((x) => x.id)).toEqual(["c"]);
  });

  it("refuses a thought stacking on itself", () => {
    expect(() => applyStackOp(base, { kind: "stack", thought: "a", onto: "a", newStackId: "s1" }, now)).toThrow(StackError);
  });
});

/** The next day's paper, as the server builds it: carried copies plus whatever moved across. */
function nextPaper(prev: DropPaper, date: string, newId: () => string): DropPaper {
  const r = rollover(prev, newId);
  const since = (x: { carriedFrom: string | null }) => x.carriedFrom ?? prev.date;
  const movedStacks = prev.stacks.filter((s) => r.move.stacks.includes(s.id)).map((s) => ({ ...s, carriedFrom: since(s) }));
  const moved = prev.thoughts.flatMap((t) => {
    if (t.stackId && r.move.stacks.includes(t.stackId)) return [{ ...t, carriedFrom: since(t) }];
    const m = r.move.thoughts.find((x) => x.id === t.id);
    return m ? [{ ...t, stackId: m.stackId, carriedFrom: m.carriedFrom }] : [];
  });
  return { date, thoughts: [...r.thoughts, ...moved], stacks: [...r.stacks, ...movedStacks] };
}

describe("folding till later (scheduling)", () => {
  const mon = "2026-10-19";
  const tue = "2026-10-20";
  const base = paper([t("a", "call bank", "open"), t("m", "milk", "open"), t("e", "eggs", "open"), t("x", "pay rent", "open")]);
  const today = { ...base, date: mon };
  const stacked = applyStackOp(today, { kind: "stack", thought: "e", onto: "m", newStackId: "s1" }, "2026-10-19T08:00:00.000Z");
  let folded = applyStackOp(stacked, { kind: "schedule", id: "a", on: tue });
  folded = applyStackOp(folded, { kind: "schedule", id: "s1", on: tue });

  it("folds a thought and a stack away from today", () => {
    const shown = visiblePaper(folded);
    expect(shown.thoughts.map((x) => x.id)).toEqual(["x"]);
    expect(shown.stacks).toEqual([]);
    expect(foldedItems(folded).map((f) => [f.label, f.on])).toEqual([
      ["Stack of 2", tue],
      ["call bank", tue],
    ]);
    expect(counts(folded).open).toBe(1);
  });

  it("brings them onto tomorrow's paper (same ids, stack intact), marked scheduled", () => {
    let n = 0;
    const next = nextPaper(folded, tue, () => `n${++n}`);
    const shown = visiblePaper(next);
    expect(shown.thoughts.find((x) => x.id === "a")).toMatchObject({ scheduledFor: tue });
    expect(shown.stacks.map((x) => x.id)).toEqual(["s1"]);
    expect(membersOf(shown, "s1")).toHaveLength(2);
    // The one left open today carries over as usual.
    expect(shown.thoughts.some((x) => x.text === "pay rent" && x.carriedFrom === mon)).toBe(true);
  });

  it("keeps folding forward until the day comes, then carries like any other", () => {
    const later = applyStackOp({ ...base, date: mon }, { kind: "schedule", id: "a", on: "2026-10-22" });
    let n = 0;
    const tuePaper = nextPaper(later, tue, () => `n${++n}`);
    expect(visiblePaper(tuePaper).thoughts.some((x) => x.id === "a")).toBe(false);
    const thu = nextPaper(nextPaper(tuePaper, "2026-10-21", () => `n${++n}`), "2026-10-22", () => `n${++n}`);
    expect(visiblePaper(thu).thoughts.find((x) => x.id === "a")).toMatchObject({ scheduledFor: "2026-10-22" });
    const fri = nextPaper(thu, "2026-10-23", () => `n${++n}`);
    expect(fri.thoughts.find((x) => x.text === "call bank")).toMatchObject({ scheduledFor: null, carriedFrom: mon });
  });

  it("refuses a day in the past", () => {
    expect(() => applyStackOp(today, { kind: "schedule", id: "a", on: "2026-10-18" })).toThrow(StackError);
  });

  it("reads days as people say them", () => {
    expect(whenLabel(mon, mon)).toBe("Today");
    expect(whenLabel(tue, mon)).toBe("Tomorrow");
    expect(whenLabel("2026-10-24", mon)).toBe("Sat");
    expect(whenLabel("2026-11-02", mon)).toBe("Mon, 2 Nov");
    expect(thisWeekend(mon)).toBe("2026-10-24");
    expect(thisWeekend("2026-10-24")).toBe("2026-10-24");
  });
});

describe("pencil and pen", () => {
  const p = paper([t("i", "weekend photo walk", "open", null, { kind: "pencil" }), t("a", "call bank", "open"), t("b", "renew passport", "done")]);

  it("counts only pen as open, and ideas apart", () => {
    expect(counts(p)).toEqual({ open: 1, ideas: 1, done: 1 });
  });
  it("inks an idea into a task, and pencils a task (struck or not) back into an idea", () => {
    expect(applyStackOp(p, { kind: "ink", thought: "i", to: "pen" }).thoughts[0].kind).toBe("pen");
    expect(applyStackOp(p, { kind: "ink", thought: "b", to: "pencil" }).thoughts[2]).toMatchObject({ kind: "pencil", status: "open", doneAt: null });
  });
  it("carries pencil ideas over quietly, still in pencil", () => {
    const next = rollover(p, () => "n").thoughts;
    expect(next.find((x) => x.text === "weekend photo walk")).toMatchObject({ kind: "pencil" });
  });
});

describe("clear desk", () => {
  const p = paper(
    [
      t("a", "call bank", "open"),
      t("i", "idea", "open", null, { kind: "pencil" }),
      t("d", "done one", "done"),
      t("f", "later", "open", null, { scheduledFor: "2026-10-30" }),
      t("m", "milk", "open", null, { stackId: "s1", stackOrder: 1 }),
      t("e", "eggs", "done", null, { stackId: "s1" }),
    ],
    [stack("s1", { name: "Groceries" })],
  );
  it("reviews open pen thoughts only (not ideas, done or folded), stacks as one card", () => {
    expect(deskCards(p)).toEqual([
      { kind: "stack", id: "s1", label: "Groceries", open: [{ id: "m", text: "milk" }] },
      { kind: "thought", id: "a", text: "call bank" },
    ]);
  });
  it("sums up the decisions in plain words", () => {
    expect(deskSummary(["tomorrow", "tomorrow", "keep", "crumple"])).toBe("2 to tomorrow · 1 kept as an idea · 1 crumpled");
    expect(deskSummary([])).toBe("Nothing left on your desk.");
  });
});

describe("number it", () => {
  const base = paper(["a", "b", "c", "d", "e", "f", "g"].map((id) => t(id, `thought ${id}`, "open")));
  const tap = (p: DropPaper, id: string) => applyStackOp(p, tapRank(p, id));

  it("numbers in the order tapped, and a second tap takes the number off and closes the gap", () => {
    let p = tap(tap(tap(base, "c"), "a"), "e");
    expect(ranks(p)).toEqual([["c", 1], ["a", 2], ["e", 3]]);
    p = tap(p, "c");
    expect(ranks(p)).toEqual([["a", 1], ["e", 2]]);
  });

  it("sets a number directly and shifts the others", () => {
    let p = tap(tap(tap(base, "a"), "b"), "c");
    p = applyStackOp(p, { kind: "rank", id: "c", rank: 1 });
    expect(ranks(p)).toEqual([["c", 1], ["a", 2], ["b", 3]]);
    p = applyStackOp(p, { kind: "rank", id: "d", rank: 2 });
    expect(ranks(p)).toEqual([["c", 1], ["d", 2], ["a", 3], ["b", 4]]);
    p = applyStackOp(p, { kind: "rank", id: "a", rank: null });
    expect(ranks(p)).toEqual([["c", 1], ["d", 2], ["b", 3]]);
  });

  it("moves numbered ones into the top row (their placed spots let go), in order", () => {
    const placed = paper([t("a", "a", "open", null, { x: 0.8, y: 300 }), t("b", "b", "open", null, { x: 0.2, y: 120 })]);
    const p = applyStackOp(applyStackOp(placed, { kind: "rank", id: "b", rank: 1 }), { kind: "rank", id: "a", rank: 2 });
    expect(p.thoughts.map((x) => [x.id, x.x, x.y, x.rank])).toEqual([
      ["a", null, null, 2],
      ["b", null, null, 1],
    ]);
  });

  it("has no six limit: a seventh gets 7, and giving a new one 2 shifts the rest down", () => {
    let p = paper(["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => t(id, `thought ${id}`, "open")));
    for (const id of ["a", "b", "c", "d", "e", "f", "g"]) p = tap(p, id);
    expect(ranks(p).at(-1)).toEqual(["g", 7]);
    p = applyStackOp(p, { kind: "rank", id: "h", rank: 2 });
    expect(ranks(p).map(([id]) => id)).toEqual(["a", "h", "b", "c", "d", "e", "f", "g"]);
    expect(ranks(p).map(([, n]) => n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("closes up when a numbered thought is crumpled, folded or stacked; a new stack takes the target's number", () => {
    let p = { ...tap(tap(tap(base, "a"), "b"), "c"), date: "2026-10-19" };
    p = applyStackOp(p, { kind: "schedule", id: "a", on: "2026-10-22" });
    expect(ranks(p)).toEqual([["b", 1], ["c", 2]]);
    p = applyStackOp(p, { kind: "stack", thought: "b", onto: "c", newStackId: "s1" });
    expect(ranks(p)).toEqual([["s1", 1]]);
  });

  it("shows the first numbered thing not done yet as Next", () => {
    let p = tap(tap(base, "b"), "a");
    expect(nextUp(p)).toMatchObject({ id: "b", rank: 1 });
    p = { ...p, thoughts: p.thoughts.map((x) => (x.id === "b" ? { ...x, status: "done" as const } : x)) };
    expect(nextUp(p)).toMatchObject({ id: "a", rank: 2, label: "thought a" });
  });

  it("clears numbers at rollover, except tomorrow's top 3 picked at Clear desk", () => {
    let p = tap(tap(tap(base, "a"), "b"), "c");
    p = applyStackOp(p, { kind: "nextRank", ids: ["e", "a"] });
    let n = 0;
    const next = rollover(p, () => `n${++n}`).thoughts;
    const byText = (s: string) => next.find((x) => x.text === s)!;
    expect(byText("thought e").rank).toBe(1);
    expect(byText("thought a").rank).toBe(2);
    expect(byText("thought b").rank).toBeNull();
    expect(next.every((x) => x.nextRank === null)).toBe(true);
  });
});

describe("digest", () => {
  it("groups thoughts under their stack, then the loose ones", () => {
    const p = paper(
      [
        t("m", "milk", "open", null, { stackId: "s1", stackOrder: 0 }),
        t("e", "eggs", "done", null, { stackId: "s1", stackOrder: 1 }),
        t("x", "a", "open", null, { stackId: "s2" }),
        t("y", "b", "open", null, { stackId: "s2", stackOrder: 1 }),
        t("l", "call bank", "open"),
      ],
      [stack("s1", { name: "Groceries" }), stack("s2")],
    );
    expect(digestItems(p)).toEqual([
      { group: "Groceries" },
      { text: "milk", done: false },
      { text: "eggs", done: true },
      { group: "Stack of 2" },
      { text: "b", done: false },
      { text: "a", done: false },
      { group: "Loose thoughts" },
      { text: "call bank", done: false },
    ]);
  });
  it("lists numbered thoughts first, in order, with their numbers", () => {
    const p = paper([t("a", "call bank", "open", null, { rank: 2 }), t("b", "pay rent", "done", null, { rank: 1 }), t("c", "renew passport", "open")]);
    expect(digestItems(p)).toEqual([
      { text: "1. pay rent", done: true },
      { text: "2. call bank", done: false },
      { group: "Loose thoughts" },
      { text: "renew passport", done: false },
    ]);
  });
  it("puts ideas and what's coming up this week at the bottom", () => {
    const p = { ...paper([t("l", "call bank", "open"), t("i", "photo walk", "open", null, { kind: "pencil" }), t("f", "pay rent", "open", null, { scheduledFor: "2026-10-20" })]), date: "2026-10-19" };
    expect(digestItems(p)).toEqual([
      { text: "call bank", done: false },
      { group: "Ideas" },
      { text: "photo walk", done: false, quiet: true },
      { group: "Coming up" },
      { text: "Tomorrow · pay rent", done: false, quiet: true },
    ]);
  });
});

describe("linkify", () => {
  it("finds http(s) and www links, leaving punctuation out", () => {
    expect(linkify("read https://docs.stripe.com/webhooks, then www.neon.tech.")).toEqual([
      { kind: "text", value: "read " },
      { kind: "link", value: "https://docs.stripe.com/webhooks", href: "https://docs.stripe.com/webhooks" },
      { kind: "text", value: ", then " },
      { kind: "link", value: "www.neon.tech", href: "https://www.neon.tech" },
      { kind: "text", value: "." },
    ]);
  });
  it("never makes a javascript: link", () => {
    expect(linkify("javascript:alert(1)").every((p) => p.kind === "text")).toBe(true);
  });
});

describe("connections", () => {
  const base = paper([t("a", "world map", "open"), t("b", "india map", "open"), t("c", "kerala trip", "open"), t("d", "radiation", "open")]);

  it("joins two notes once, labels and restyles the line, and removes it", () => {
    let p = applyStackOp(base, { kind: "link", id: "l1", from: "a", to: "b" });
    p = applyStackOp(p, { kind: "link", id: "l2", from: "b", to: "a" });
    expect(p.links).toEqual([{ id: "l1", from: "a", to: "b", label: null, arrow: true }]);
    p = applyStackOp(p, { kind: "linkStyle", id: "l1", label: "  for the trip  ", arrow: false });
    expect(p.links?.[0]).toMatchObject({ label: "for the trip", arrow: false });
    p = applyStackOp(p, { kind: "unlink", id: "l1" });
    expect(p.links).toEqual([]);
  });

  it("won't join a note to itself or to something not on the paper", () => {
    expect(() => applyStackOp(base, { kind: "link", id: "l1", from: "a", to: "a" })).toThrow(StackError);
    expect(() => applyStackOp(base, { kind: "link", id: "l1", from: "a", to: "zz" })).toThrow(StackError);
  });

  it("drops a line when one of its ends is crumpled", () => {
    let p = applyStackOp(base, { kind: "link", id: "l1", from: "a", to: "b" });
    p = applyStackOp(applyStackOp(p, { kind: "stack", thought: "c", onto: "b", newStackId: "s1" }), { kind: "crumple", stack: "s1" });
    expect(p.links).toEqual([]);
  });

  it("follows a whole thread, through a stack", () => {
    let p = applyStackOp(base, { kind: "link", id: "l1", from: "a", to: "b" });
    p = applyStackOp(p, { kind: "link", id: "l2", from: "b", to: "c" });
    expect(threadOf(p, "c")).toEqual([
      { id: "c", depth: 0 },
      { id: "b", depth: 1 },
      { id: "a", depth: 2 },
    ]);
    expect(threadOf(p, "d")).toEqual([]);
    p = applyStackOp(p, { kind: "stack", thought: "d", onto: "a", newStackId: "s1" });
    expect(threadOf(p, "b").map((x) => x.id)).toEqual(["b", "s1", "c"]);
  });

  it("carries lines whose two ends both carry over", () => {
    let p = applyStackOp(base, { kind: "link", id: "l1", from: "a", to: "b" });
    p = applyStackOp(p, { kind: "link", id: "l2", from: "b", to: "c" });
    p = { ...p, thoughts: p.thoughts.map((x) => (x.id === "c" ? { ...x, status: "done" as const } : x)) };
    let n = 0;
    const next = rollover(p, () => `n${++n}`);
    const idOf = (text: string) => next.thoughts.find((x) => x.text === text)!.id;
    expect(next.links).toHaveLength(1);
    expect(next.links[0]).toMatchObject({ from: idOf("world map"), to: idOf("india map") });
  });
});

describe("pictures", () => {
  it("read as their caption, or as Image without one", () => {
    expect(thoughtLabel({ text: "leave page bug", image: "data:image/webp;base64,AA" })).toBe("leave page bug");
    expect(thoughtLabel({ text: "", image: "data:image/webp;base64,AA" })).toBe("Image");
  });
  it("carry over with their picture", () => {
    const p = paper([t("a", "", "open", null, { image: "data:image/webp;base64,AA" })]);
    expect(rollover(p, () => "n1").thoughts[0].image).toBe("data:image/webp;base64,AA");
  });
});

describe("pencil thinks, pen commits", () => {
  const pencil = (id: string, text: string, more: Partial<Thought> = {}) => t(id, text, "open", null, { kind: "pencil", ...more });
  const base = paper([pencil("a", "Sravanthi mam tasks"), pencil("b", "Ravi anna about payroll"), pencil("c", "tanuj issue"), pencil("d", "data migration")]);

  it("inks a thought into tomorrow where it's dropped; the rest move down, no limit", () => {
    let p = applyStackOp(base, { kind: "shape", id: "a", at: 1 });
    p = applyStackOp(p, { kind: "shape", id: "b", at: 2 });
    p = applyStackOp(p, { kind: "shape", id: "c", at: 3 });
    p = applyStackOp(p, { kind: "shape", id: "d", at: 3 });
    expect(tomorrowIds(p)).toEqual(["a", "b", "d", "c"]);
    expect(p.thoughts.filter((x) => x.kind === "pen").map((x) => x.id).sort()).toEqual(["a", "b", "c", "d"]);
    p = applyStackOp(p, { kind: "shape", id: "b", at: null });
    expect(tomorrowIds(p)).toEqual(["a", "d", "c"]);
  });

  it("wakes up numbered, in ink, in that order", () => {
    let p = applyStackOp(base, { kind: "shape", id: "c", at: 1 });
    p = applyStackOp(p, { kind: "shape", id: "a", at: 2 });
    let n = 0;
    const next = rollover(p, () => `n${++n}`).thoughts;
    const byText = (s: string) => next.find((x) => x.text === s)!;
    expect([byText("tanuj issue").rank, byText("Sravanthi mam tasks").rank, byText("data migration").rank]).toEqual([1, 2, null]);
    expect(byText("tanuj issue").kind).toBe("pen");
    expect(byText("data migration").kind).toBe("pencil");
  });

  it("fades pencil a little each night, never ink", () => {
    const old = pencil("a", "x", { carriedFrom: "2026-10-14" });
    expect(pencilFade(pencil("a", "x"), "2026-10-17")).toBe(1);
    expect(pencilFade(old, "2026-10-17")).toBeCloseTo(0.64);
    expect(pencilFade({ ...old, carriedFrom: "2026-09-01" }, "2026-10-17")).toBe(0.4);
    expect(pencilFade({ ...old, kind: "pen" }, "2026-10-17")).toBe(1);
  });

  it("guesses related thoughts by a shared telling word, skipping joined and waved-off pairs", () => {
    const p = paper([pencil("a", "world map of places"), pencil("b", "india map"), pencil("c", "travel planning using the maps"), pencil("d", "radiation")]);
    expect(keywords("travel planning using the maps")).toEqual(new Set(["travel", "planning", "map"]));
    const g = guessLinks(p);
    expect(g.map((x) => [x.from, x.to].sort().join())).toEqual(["a,b", "a,c", "b,c"]);
    const linked = applyStackOp(p, { kind: "link", id: "l1", from: "a", to: "b" });
    expect(guessLinks(linked, new Set(["a|c"])).map((x) => [x.from, x.to].sort().join())).toEqual(["b,c"]);
  });

  it("notices a word that keeps coming up (four or more)", () => {
    const p = paper(["india map", "world map", "map of trips", "maps for travel", "radiation"].map((text, i) => pencil(`t${i}`, text)));
    expect(themeOf(p)).toEqual({ word: "map", ids: ["t0", "t1", "t2", "t3"] });
    expect(themeOf(paper([pencil("a", "india map")]))).toBeNull();
  });
});
