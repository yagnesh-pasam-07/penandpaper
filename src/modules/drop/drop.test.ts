import { describe, expect, it } from "vitest";
import { droppedToday, linkify, rollover, type DropPaper } from "./logic";

const t = (id: string, text: string, status: "open" | "done", carriedFrom: string | null = null) => ({
  id,
  text,
  status,
  shape: 1,
  createdAt: "2026-10-17T04:00:00.000Z",
  doneAt: status === "done" ? "2026-10-17T09:00:00.000Z" : null,
  carriedFrom,
  x: null,
  y: null,
});

describe("rollover", () => {
  const yesterday: DropPaper = {
    date: "2026-10-17",
    thoughts: [t("a", "call bank", "done"), t("b", "renew passport", "open"), t("c", "old idea", "open", "2026-10-15")],
  };
  let n = 0;
  const carried = rollover(yesterday, () => `new${++n}`);

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
    expect(droppedToday({ date: "2026-10-18", thoughts: carried })).toBe(0);
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
