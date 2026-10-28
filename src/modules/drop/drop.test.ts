import { describe, expect, it } from "vitest";
import { CANVASES, CANVAS_IDS, DEFAULT_CANVAS, parseCanvas, parseThemeMode, resolveTheme } from "@/lib/canvases";
import { digestItems } from "./digest";
import {
  applyPaperOp,
  counts,
  deskCards,
  deskSummary,
  droppedToday,
  foldedItems,
  firstLink,
  firstYoutube,
  isOnlyYoutube,
  linkify,
  rollover,
  PaperError,
  thoughtLabel,
  pencilFade,
  thisWeekend,
  visiblePaper,
  whenLabel,
  youtubeId,
  type DropPaper,
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
  scheduledFor: null,
  ...more,
});

const paper = (thoughts: Thought[]): DropPaper => ({ date: "2026-10-17", thoughts });

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
    expect(droppedToday({ date: "2026-10-18", thoughts: carried })).toBe(0);
  });
});

/** The next day's paper, as the server builds it: carried copies plus whatever moved across. */
function nextPaper(prev: DropPaper, date: string, newId: () => string): DropPaper {
  const r = rollover(prev, newId);
  const moved = prev.thoughts.flatMap((t) => {
    const m = r.move.thoughts.find((x) => x.id === t.id);
    return m ? [{ ...t, carriedFrom: m.carriedFrom }] : [];
  });
  return { date, thoughts: [...r.thoughts, ...moved] };
}

describe("folding till later (scheduling)", () => {
  const mon = "2026-10-19";
  const tue = "2026-10-20";
  const base = paper([t("a", "call bank", "open"), t("m", "milk", "open"), t("e", "eggs", "open"), t("x", "pay rent", "open")]);
  const today = { ...base, date: mon };
  let folded = applyPaperOp(today, { kind: "schedule", id: "a", on: tue });
  folded = applyPaperOp(folded, { kind: "schedule", id: "m", on: tue });

  it("folds thoughts away from today", () => {
    const shown = visiblePaper(folded);
    expect(shown.thoughts.map((x) => x.id)).toEqual(["e", "x"]);
    expect(foldedItems(folded).map((f) => [f.label, f.on])).toEqual([
      ["call bank", tue],
      ["milk", tue],
    ]);
    expect(counts(folded).open).toBe(2);
  });

  it("brings them onto tomorrow's paper (same ids), marked scheduled", () => {
    let n = 0;
    const next = nextPaper(folded, tue, () => `n${++n}`);
    const shown = visiblePaper(next);
    expect(next.thoughts.find((x) => x.id === "a")).toMatchObject({ scheduledFor: tue });
    // Their day has come, so they show.
    expect(shown.thoughts.filter((x) => ["a", "m"].includes(x.id))).toHaveLength(2);
    // The ones left open today carry over as usual.
    expect(shown.thoughts.some((x) => x.text === "pay rent" && x.carriedFrom === mon)).toBe(true);
  });

  it("keeps folding forward until the day comes, then carries like any other", () => {
    const later = applyPaperOp({ ...base, date: mon }, { kind: "schedule", id: "a", on: "2026-10-22" });
    let n = 0;
    const tuePaper = nextPaper(later, tue, () => `n${++n}`);
    expect(visiblePaper(tuePaper).thoughts.some((x) => x.id === "a")).toBe(false);
    const thu = nextPaper(nextPaper(tuePaper, "2026-10-21", () => `n${++n}`), "2026-10-22", () => `n${++n}`);
    expect(visiblePaper(thu).thoughts.find((x) => x.id === "a")).toMatchObject({ scheduledFor: "2026-10-22" });
    const fri = nextPaper(thu, "2026-10-23", () => `n${++n}`);
    expect(fri.thoughts.find((x) => x.text === "call bank")).toMatchObject({ scheduledFor: null, carriedFrom: mon });
  });

  it("refuses a day in the past", () => {
    expect(() => applyPaperOp(today, { kind: "schedule", id: "a", on: "2026-10-18" })).toThrow(PaperError);
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
    expect(applyPaperOp(p, { kind: "ink", thought: "i", to: "pen" }).thoughts[0].kind).toBe("pen");
    expect(applyPaperOp(p, { kind: "ink", thought: "b", to: "pencil" }).thoughts[2]).toMatchObject({ kind: "pencil", status: "open", doneAt: null });
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
    ],
  );
  it("reviews open pen thoughts only (not ideas, done or folded)", () => {
    expect(deskCards(p)).toEqual([{ id: "a", text: "call bank" }]);
  });
  it("sums up the decisions in plain words", () => {
    expect(deskSummary(["tomorrow", "tomorrow", "keep", "crumple"])).toBe("2 to tomorrow · 1 kept as an idea · 1 crumpled");
    expect(deskSummary([])).toBe("Nothing left on your desk.");
  });
});

describe("digest", () => {
  it("lists open tasks first, then struck ones", () => {
    const p = paper([t("e", "eggs", "done"), t("l", "call bank", "open")]);
    expect(digestItems(p)).toEqual([
      { text: "call bank", done: false },
      { text: "eggs", done: true },
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

  it("fades pencil a little each night, never ink", () => {
    const old = pencil("a", "x", { carriedFrom: "2026-10-14" });
    expect(pencilFade(pencil("a", "x"), "2026-10-17")).toBe(1);
    expect(pencilFade(old, "2026-10-17")).toBeCloseTo(0.64);
    expect(pencilFade({ ...old, carriedFrom: "2026-09-01" }, "2026-10-17")).toBe(0.4);
    expect(pencilFade({ ...old, kind: "pen" }, "2026-10-17")).toBe(1);
  });

});

describe("youtube previews", () => {
  it("reads the video id from watch, short, shorts and embed links", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://m.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]) {
      expect(youtubeId(url)).toBe("dQw4w9WgXcQ");
    }
  });
  it("ignores other sites and malformed ids", () => {
    expect(youtubeId("https://vimeo.com/76979871")).toBeNull();
    expect(youtubeId("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=short")).toBeNull();
  });
  it("knows when a note is only a video link", () => {
    expect(isOnlyYoutube("  https://youtu.be/dQw4w9WgXcQ?si=abc\n")).toBe(true);
    expect(isOnlyYoutube("watch https://youtu.be/dQw4w9WgXcQ")).toBe(false);
    expect(isOnlyYoutube("https://docs.stripe.com")).toBe(false);
  });
  it("finds the first video in a note", () => {
    expect(firstYoutube("watch this: www.youtube.com/watch?v=dQw4w9WgXcQ later")).toEqual({ id: "dQw4w9WgXcQ", href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(firstYoutube("read https://docs.stripe.com")).toBeNull();
  });
});

describe("link previews", () => {
  it("takes the first link apart into its site and path", () => {
    expect(firstLink("read https://www.docs.stripe.com/webhooks/signatures/ later")).toEqual({
      href: "https://www.docs.stripe.com/webhooks/signatures/",
      host: "docs.stripe.com",
      path: "webhooks/signatures",
    });
    expect(firstLink("see www.neon.tech")).toEqual({ href: "https://www.neon.tech", host: "neon.tech", path: "" });
  });
  it("is null when there's no link", () => {
    expect(firstLink("just words, no link.com")).toBeNull();
  });
});

describe("appearance", () => {
  it("falls back to Dotted for anything it doesn't know", () => {
    expect(parseCanvas("ruled")).toBe("ruled");
    expect(parseCanvas("sparkles")).toBe(DEFAULT_CANVAS);
    expect(parseCanvas("grid")).toBe("grid");
    expect(parseCanvas(null)).toBe("dotted");
  });
  it("keeps one entry per canvas id, each with tokens for both themes", () => {
    expect(new Set(CANVAS_IDS).size).toBe(CANVASES.length);
    for (const c of CANVASES) expect(c.tokens.light.length && c.tokens.dark.length).toBeTruthy();
  });
  it("reads the theme mode, defaulting to System", () => {
    expect(parseThemeMode("dark")).toBe("dark");
    expect(parseThemeMode("blue")).toBe("system");
  });
  it("resolves System from the OS, and explicit choices as they are", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
