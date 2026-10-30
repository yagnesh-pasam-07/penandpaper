import { describe, expect, it } from "vitest";
import { agoText, groupRewind, isSunday, nextDue, resolve, rewindLine, weekStart, type RewindThought } from "./resurface";

const at = new Date("2026-10-30T09:00:00Z");
const day = 24 * 60 * 60 * 1000;

describe("the rhythm", () => {
  it("comes back 1, then 7, then 30 days later, then rests", () => {
    expect(nextDue(at, 0)?.getTime()).toBe(at.getTime() + day);
    expect(nextDue(at, 1)?.getTime()).toBe(at.getTime() + 7 * day);
    expect(nextDue(at, 2)?.getTime()).toBe(at.getTime() + 30 * day);
    expect(nextDue(at, 3)).toBeNull();
  });
  it("keep moves one step further", () => {
    expect(resolve({ step: 0, dueAt: "x" }, "keep", at)).toEqual({ step: 1, dueAt: new Date(at.getTime() + 7 * day).toISOString(), strike: false });
    expect(resolve({ step: 2, dueAt: "x" }, "keep", at)).toEqual({ step: 3, dueAt: null, strike: false });
  });
  it("act strikes it and let go retires it; neither comes back", () => {
    expect(resolve({ step: 1, dueAt: "x" }, "act", at)).toEqual({ step: 1, dueAt: null, strike: true });
    expect(resolve({ step: 1, dueAt: "x" }, "let_go", at)).toEqual({ step: 1, dueAt: null, strike: false });
  });
  it("later brings the same thought back tomorrow", () => {
    expect(resolve({ step: 1, dueAt: "x" }, "later", at)).toEqual({ step: 1, dueAt: new Date(at.getTime() + day).toISOString(), strike: false });
  });
});

describe("agoText", () => {
  it("says how long ago, in plain words", () => {
    expect(agoText(new Date(at.getTime() - day), at)).toBe("Yesterday");
    expect(agoText(new Date(at.getTime() - 3 * day), at)).toBe("3 days ago");
    expect(agoText(new Date(at.getTime() - 8 * day), at)).toBe("A week ago");
    expect(agoText(new Date(at.getTime() - 21 * day), at)).toBe("3 weeks ago");
    expect(agoText(new Date(at.getTime() - 31 * day), at)).toBe("A month ago");
  });
});

describe("the rewind", () => {
  const t = (id: string, paperId: string, status: "open" | "done", createdAt: string): RewindThought => ({ id, text: id, status, createdAt, paperId, paperName: paperId, hasImage: false });

  it("starts the week on Monday", () => {
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // a Sunday
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // a Monday
    expect(isSunday("2026-11-01")).toBe(true);
    expect(isSunday("2026-10-30")).toBe(false);
  });
  it("groups by paper, busiest open paper first, open before done, oldest first", () => {
    const groups = groupRewind([t("a", "p1", "done", "2026-10-27"), t("b", "p2", "open", "2026-10-28"), t("c", "p2", "open", "2026-10-26"), t("d", "p1", "open", "2026-10-29")]);
    expect(groups.map((g) => g.paperId)).toEqual(["p2", "p1"]);
    expect(groups[0].open.map((x) => x.id)).toEqual(["c", "b"]);
    expect(groups[1].open.map((x) => x.id)).toEqual(["d"]);
    expect(groups[1].done.map((x) => x.id)).toEqual(["a"]);
    expect(rewindLine(groups)).toBe("4 thoughts this week · 3 still open");
    expect(rewindLine([])).toBe("Nothing written this week yet.");
  });
});
