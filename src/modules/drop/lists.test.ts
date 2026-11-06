import { describe, expect, it } from "vitest";
import { listLines, MAX_INDENT, posBetween, todoLists } from "./logic";

const line = (id: string, more: { listId?: string | null; listPos?: number | null; at?: string } = {}) => ({
  id,
  listId: more.listId ?? null,
  listPos: more.listPos ?? null,
  createdAt: more.at ?? "2026-11-06T10:00:00.000Z",
});

describe("todoLists", () => {
  it("gathers lines that share a list under the first, in place order", () => {
    const { heads, inList } = todoLists([line("c", { listId: "a", listPos: 2 }), line("a", { listId: "a", listPos: 0 }), line("b", { listId: "a", listPos: 1 }), line("x")]);
    expect([...heads.keys()]).toEqual(["a"]);
    expect(heads.get("a")!.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect([...inList].sort()).toEqual(["b", "c"]);
  });

  it("a line written above the first takes the list's place", () => {
    const { heads } = todoLists([line("a", { listId: "a", listPos: 0 }), line("n", { listId: "a", listPos: -1 })]);
    expect([...heads.keys()]).toEqual(["n"]);
    expect(heads.get("n")!.map((l) => l.id)).toEqual(["n", "a"]);
  });

  it("when the first line is gone, the next leads", () => {
    const { heads, inList } = todoLists([line("b", { listId: "a", listPos: 1 }), line("c", { listId: "a", listPos: 2 })]);
    expect(heads.get("b")!.map((l) => l.id)).toEqual(["b", "c"]);
    expect(inList.has("b")).toBe(false);
  });

  it("a list of one is just a line on its own", () => {
    const { heads, inList } = todoLists([line("a", { listId: "a", listPos: 0 })]);
    expect(heads.size).toBe(0);
    expect(inList.size).toBe(0);
  });

  it("the same place falls back to when each was written", () => {
    const { heads } = todoLists([line("b", { listId: "a", listPos: 1, at: "2026-11-06T10:01:00.000Z" }), line("a", { listId: "a", listPos: 1 })]);
    expect(heads.get("a")!.map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("posBetween", () => {
  it("goes after the last, or halfway between two", () => {
    expect(posBetween(3, null)).toBe(4);
    expect(posBetween(1, 2)).toBe(1.5);
    expect(posBetween(null, undefined)).toBe(1);
  });
});

describe("listLines", () => {
  it("one to-do per line, with boxes, dashes and numbers taken off", () => {
    expect(listLines("[ ] Documents\n- Data migration\n• Export\n2. Import\n[x] Done one\n\n")).toEqual([
      { text: "Documents", indent: 0 },
      { text: "Data migration", indent: 0 },
      { text: "Export", indent: 0 },
      { text: "Import", indent: 0 },
      { text: "Done one", indent: 0 },
    ]);
  });

  it("indented lines are sub-to-dos, one level only", () => {
    expect(listLines("Plan\n  users\n\t\tdeep")).toEqual([
      { text: "Plan", indent: 0 },
      { text: "users", indent: 1 },
      { text: "deep", indent: MAX_INDENT },
    ]);
  });
});
