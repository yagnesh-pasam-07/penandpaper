import { describe, expect, it } from "vitest";
import { digestItems } from "./digest";
import { applyStackOp, droppedToday, linkify, membersOf, rollover, StackError, type DropPaper, type Stack, type Thought } from "./logic";

const t = (id: string, text: string, status: "open" | "done", carriedFrom: string | null = null, more: Partial<Thought> = {}): Thought => ({
  id,
  text,
  status,
  shape: 1,
  createdAt: "2026-10-17T04:00:00.000Z",
  doneAt: status === "done" ? "2026-10-17T09:00:00.000Z" : null,
  carriedFrom,
  x: null,
  y: null,
  stackId: null,
  stackOrder: 0,
  ...more,
});

const stack = (id: string, more: Partial<Stack> = {}): Stack => ({ id, name: null, x: 0.5, y: 200, createdAt: "2026-10-17T05:00:00.000Z", carriedFrom: null, ...more });

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
    expect(after.stacks).toEqual([{ id: "s1", name: null, x: 0.2, y: 100, createdAt: now, carriedFrom: null }]);
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
