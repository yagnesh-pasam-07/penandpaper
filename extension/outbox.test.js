import { describe, expect, it } from "vitest";
import { backoffMs, dueItems, enqueue, failed, keptDraft, MAX_OUTBOX, remove, retryable } from "./outbox.js";

describe("backoffMs", () => {
  it("doubles from 30 seconds and stops at an hour", () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(backoffMs(20)).toBe(3_600_000);
    expect(backoffMs(0)).toBe(30_000);
    expect(backoffMs(NaN)).toBe(30_000);
  });
});

describe("enqueue and remove", () => {
  it("adds a thought once, ready to send now", () => {
    const a = enqueue([], { id: "ext-1", text: "hello" }, 1000);
    expect(a).toEqual([{ id: "ext-1", text: "hello", createdAt: 1000, attempts: 0, nextAt: 0 }]);
    expect(enqueue(a, { id: "ext-1", text: "other" }, 2000)).toBe(a);
  });
  it("keeps the newest when it is full", () => {
    let list = [];
    for (let i = 0; i < MAX_OUTBOX + 5; i++) list = enqueue(list, { id: `ext-${i}`, text: "x" }, i);
    expect(list).toHaveLength(MAX_OUTBOX);
    expect(list[0].id).toBe("ext-5");
    expect(list.at(-1).id).toBe(`ext-${MAX_OUTBOX + 4}`);
  });
  it("removes by id and leaves the list alone for an unknown one", () => {
    const list = enqueue(enqueue([], { id: "a1b2c3", text: "1" }, 1), { id: "d4e5f6", text: "2" }, 2);
    expect(remove(list, "a1b2c3").map((x) => x.id)).toEqual(["d4e5f6"]);
    expect(remove(list, "nope")).toBe(list);
  });
});

describe("failed and dueItems", () => {
  it("a failure pushes the next try back, a forced one goes anyway", () => {
    const list = failed(enqueue([], { id: "a1b2c3", text: "1" }, 0), "a1b2c3", 10_000);
    expect(list[0]).toMatchObject({ attempts: 1, nextAt: 40_000 });
    expect(dueItems(list, 20_000)).toEqual([]);
    expect(dueItems(list, 40_000)).toHaveLength(1);
    expect(dueItems(list, 20_000, "a1b2c3")).toHaveLength(1);
  });
  it("oldest first", () => {
    const list = enqueue(enqueue([], { id: "bbbbbb", text: "2" }, 5), { id: "aaaaaa", text: "1" }, 3);
    expect(dueItems(list, 10).map((x) => x.id)).toEqual(["aaaaaa", "bbbbbb"]);
  });
  it("a second failure waits longer", () => {
    let list = enqueue([], { id: "a1b2c3", text: "1" }, 0);
    list = failed(failed(list, "a1b2c3", 0), "a1b2c3", 0);
    expect(list[0]).toMatchObject({ attempts: 2, nextAt: 60_000 });
  });
});

describe("retryable", () => {
  it("tries again when the thought might get through later", () => {
    for (const s of [0, 401, 403, 408, 429, 500, 502, 503]) expect(retryable(s)).toBe(true);
  });
  it("gives up on what the site will never take", () => {
    for (const s of [400, 404, 409, 413, 422]) expect(retryable(s)).toBe(false);
  });
});

describe("keptDraft", () => {
  it("keeps the words, drops empty ones", () => {
    expect(keptDraft("  half a thought\r\n")).toBe("half a thought");
    expect(keptDraft("   \n ")).toBe("");
    expect(keptDraft(undefined)).toBe("");
  });
});

describe("enqueue with a picture", () => {
  it("keeps the picture address with the thought, and nothing when there is none", () => {
    expect(enqueue([], { id: "ext-1", text: "post", imageUrl: "https://a.co/p.jpg" }, 1)[0].imageUrl).toBe("https://a.co/p.jpg");
    expect("imageUrl" in enqueue([], { id: "ext-2", text: "x" }, 1)[0]).toBe(false);
  });
});
