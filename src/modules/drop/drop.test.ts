import { describe, expect, it } from "vitest";
import { CANVASES, CANVAS_IDS, DEFAULT_CANVAS, parseCanvas, parseThemeMode, resolveTheme } from "@/lib/canvases";
import { digestItems } from "./digest";
import { viewKey } from "@/components/canvas/view";
import {
  cleanName,
  countdown,
  dayRange,
  isDay,
  digestTitle,
  escapeLike,
  firstLink,
  firstYoutube,
  groupDigest,
  isOnlyYoutube,
  linkify,
  madeOn,
  MAX_PAPER_NAME,
  MAX_SEARCH,
  paperTitle,
  previewNotes,
  searchTerm,
  snippetAround,
  splitMatch,
  isDrop,
  thoughtLabel,
  youtubeId,
  type DigestRow,
} from "./logic";

const row = (paperId: string, text: string, status: "open" | "done" = "open", more: { name?: string | null; madeAt?: string } = {}): DigestRow => ({
  paperId,
  paperName: more.name ?? null,
  paperCreatedAt: more.madeAt ?? "2026-10-17T04:00:00.000Z",
  thought: { id: `${paperId}-${text}`, text, status, image: null },
});

describe("digest", () => {
  it("groups what was dropped by paper, in the order each paper first got a thought, struck ones struck", () => {
    const { groups, latestPaperId } = groupDigest(
      [row("a", "eggs", "done", { name: "Groceries" }), row("b", "call bank"), row("a", "milk", "open", { name: "Groceries" }), row("b", "pay rent")],
      "Asia/Kolkata",
    );
    expect(digestItems(groups)).toEqual([
      { group: "Groceries" },
      { text: "eggs", done: true },
      { text: "milk", done: false },
      { group: "Paper from 17 Oct 2026" },
      { text: "call bank", done: false },
      { text: "pay rent", done: false },
    ]);
    // "Open my paper" goes to the paper written on last.
    expect(latestPaperId).toBe("b");
  });
  it("reads a picture with no words as Image", () => {
    const { groups } = groupDigest([{ ...row("a", ""), thought: { id: "i", text: "", status: "open", image: "data:image/webp;base64,AA" } }], "UTC");
    expect(digestItems(groups)).toEqual([{ group: "Paper from 17 Oct 2026" }, { text: "Image", done: false }]);
  });
  it("is empty when nothing was dropped", () => {
    expect(groupDigest([], "UTC")).toEqual({ groups: [], latestPaperId: null });
    expect(digestItems([])).toEqual([]);
  });
  it("dates a paper by the day it was made in the given zone", () => {
    // 20:00 UTC on the 17th is already the 18th in Kolkata.
    expect(digestTitle({ name: null, createdAt: "2026-10-17T20:00:00.000Z" }, "Asia/Kolkata")).toBe("Paper from 18 Oct 2026");
    expect(digestTitle({ name: null, createdAt: "2026-10-17T20:00:00.000Z" }, "UTC")).toBe("Paper from 17 Oct 2026");
    expect(digestTitle({ name: "  Trip  ", createdAt: "2026-10-17T20:00:00.000Z" }, "UTC")).toBe("Trip");
  });
});

describe("papers", () => {
  it("names a paper, or calls it Untitled", () => {
    expect(paperTitle({ name: "Groceries" })).toBe("Groceries");
    expect(paperTitle({ name: "   " })).toBe("Untitled");
    expect(paperTitle({ name: null })).toBe("Untitled");
  });
  it("keeps a name tidy: spaces collapsed, cut to length, and nothing at all means no name", () => {
    expect(cleanName("  my   trip \n plan ")).toBe("my trip plan");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName(null)).toBeNull();
    expect(cleanName("x".repeat(MAX_PAPER_NAME + 20))).toHaveLength(MAX_PAPER_NAME);
  });
  it("shows the day a paper was made in the reader's zone", () => {
    expect(madeOn("2026-10-28T01:00:00.000Z", "Asia/Kolkata")).toBe("28 Oct 2026");
    expect(madeOn("2026-10-27T20:00:00.000Z", "Asia/Kolkata")).toBe("28 Oct 2026");
    expect(madeOn("2026-10-27T20:00:00.000Z", "UTC")).toBe("27 Oct 2026");
  });
  it("keeps each paper's zoom and pan under its own key", () => {
    expect(viewKey("a")).not.toBe(viewKey("b"));
    expect(viewKey("abc")).toBe("pp-drop-view:abc");
  });
});

describe("search", () => {
  it("only searches from two letters, tidying spaces", () => {
    expect(searchTerm("a")).toBeNull();
    expect(searchTerm("   ")).toBeNull();
    expect(searchTerm(null)).toBeNull();
    expect(searchTerm("  video   idea ")).toBe("video idea");
    expect(searchTerm("x".repeat(500))).toHaveLength(MAX_SEARCH);
  });
  it("treats % _ and \\ in a search as plain characters", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });
  it("cuts a long thought to the part around the match", () => {
    const long = "the very long start of a thought about nothing in particular then the youtube video I wanted and then a long tail that goes on and on";
    const snip = snippetAround(long, "YouTube");
    expect(snip.toLowerCase()).toContain("youtube");
    expect(snip.startsWith("…")).toBe(true);
    expect(snip.endsWith("…")).toBe(true);
    expect(snip.length).toBeLessThan(long.length);
    expect(snippetAround("short one", "short")).toBe("short one");
  });
  it("splits a snippet at the match, whatever its case", () => {
    expect(splitMatch("Watch the YouTube talk", "youtube")).toEqual([
      { text: "Watch the ", match: false },
      { text: "YouTube", match: true },
      { text: " talk", match: false },
    ]);
    expect(splitMatch("nothing here", "zzz")).toEqual([{ text: "nothing here", match: false }]);
  });
});

describe("library previews", () => {
  const th = (id: string, text: string, x: number | null, y: number | null, status: "open" | "done" = "open") => ({ id, text, status, x, y });
  it("keeps dragged notes in proportion and flows the rest into rows", () => {
    const notes = previewNotes([th("a", "top left", 0, 0), th("b", "bottom right", 1, 600, "done"), th("c", "never moved", null, null), th("d", "also loose", null, null)]);
    const by = Object.fromEntries(notes.map((n) => [n.id, n]));
    expect(by.a.left).toBeLessThan(by.b.left);
    expect(by.a.top).toBeLessThan(by.b.top);
    expect(by.b.done).toBe(true);
    // The loose ones sit in the first row, side by side.
    expect(by.c.top).toBe(by.d.top);
    expect(by.c.left).toBeLessThan(by.d.left);
  });
  it("keeps every mark on the card, and short", () => {
    const notes = previewNotes([th("a", "x".repeat(200), 40, 99999), th("b", "", -3, -50)]);
    for (const n of notes) {
      expect(n.left).toBeGreaterThanOrEqual(0);
      expect(n.left).toBeLessThanOrEqual(100);
      expect(n.top).toBeGreaterThanOrEqual(0);
      expect(n.top).toBeLessThanOrEqual(100);
    }
    expect(notes[0].text.length).toBeLessThanOrEqual(26);
    expect(notes[1].text).toBe("Image");
  });
  it("shows no more than a card can hold", () => {
    const many = Array.from({ length: 80 }, (_, i) => th(`n${i}`, `note ${i}`, null, null));
    expect(previewNotes(many)).toHaveLength(24);
    expect(previewNotes(many, 5)).toHaveLength(5);
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

describe("drops and to-dos", () => {
  it("a picture is a drop, words are a to-do", () => {
    expect(isDrop({ image: "data:image/webp;base64,AA" })).toBe(true);
    expect(isDrop({ image: null })).toBe(false);
    expect(isDrop({})).toBe(false);
  });
});

import { dueLabel, reminderDue, clampSize } from "./logic";

describe("due dates", () => {
  const now = new Date("2026-11-02T06:00:00Z"); // 11:30 IST, Monday
  const tz = "Asia/Kolkata";
  it("reads like Slack: Today, Tomorrow, a weekday, a date", () => {
    expect(dueLabel("2026-11-02T12:30:00Z", true, now, tz)).toEqual({ text: "Today, 6:00 PM", late: false, soon: true });
    expect(dueLabel("2026-11-02T18:30:00Z", false, now, tz).text).toBe("Tomorrow");
    expect(dueLabel("2026-11-05T18:30:00Z", false, now, tz).text).toBe("Fri");
    expect(dueLabel("2026-11-20T18:30:00Z", false, now, tz).text).toBe("21 Nov");
  });
  it("is late once the time or the day has passed", () => {
    expect(dueLabel("2026-11-02T05:00:00Z", true, now, tz).late).toBe(true);
    expect(dueLabel("2026-11-01T18:30:00Z", false, now, tz).late).toBe(false); // today (IST midnight), day only
    expect(dueLabel("2026-10-30T18:30:00Z", false, now, tz).late).toBe(true);
  });
  it("owes a reminder once, when its time has come", () => {
    const t = { dueAt: "2026-11-02T05:55:00Z", dueHasTime: true, remindedAt: null, status: "open" as const };
    expect(reminderDue(t, now, 3600_000)).toBe(true);
    expect(reminderDue({ ...t, remindedAt: "2026-11-02T05:56:00Z" }, now, 3600_000)).toBe(false);
    expect(reminderDue({ ...t, status: "done" }, now, 3600_000)).toBe(false);
    expect(reminderDue({ ...t, dueAt: "2026-11-02T07:00:00Z" }, now, 3600_000)).toBe(false);
  });
  it("keeps text sizes sensible", () => {
    expect(clampSize(10)).toBe(4.4);
    expect(clampSize(0.1)).toBe(0.64);
  });
});

import { mentionedEmails } from "./logic";

describe("mentions", () => {
  it("finds @someone@company.com, not plain emails or handles", () => {
    expect(mentionedEmails("ask @Teja@tilicho.in and @ravi@x.co about it")).toEqual(["teja@tilicho.in", "ravi@x.co"]);
    expect(mentionedEmails("mail teja@tilicho.in")).toEqual([]);
    expect(mentionedEmails("@teja please")).toEqual([]);
  });
});

import { parseReminder } from "./logic";

describe("remind me", () => {
  const now = new Date("2026-11-02T06:00:00Z"); // Mon 11:30 IST
  const tz = "Asia/Kolkata";
  const at = (s: string) => parseReminder(s, now, tz)?.at;
  it("reads the day and time, and keeps the words", () => {
    expect(parseReminder("call Ravi, remind me tomorrow at 5", now, tz)).toEqual({ text: "call Ravi", at: "2026-11-03T11:30:00.000Z" });
    expect(at("send deck remind me at 6pm")).toBe("2026-11-02T12:30:00.000Z");
    expect(at("x remind me 10:30am")).toBe("2026-11-03T05:00:00.000Z"); // already past today
    expect(at("x remind me friday")).toBe("2026-11-06T03:30:00.000Z"); // 9 AM
    expect(at("x remind me tonight")).toBe("2026-11-02T14:30:00.000Z");
    expect(at("x remind me in 2 hours")).toBe("2026-11-02T08:00:00.000Z");
    expect(at("x remind me 12 nov evening")).toBe("2026-11-12T12:30:00.000Z");
    expect(at("x remind me")).toBe("2026-11-03T03:30:00.000Z");
  });
  it("leaves other words alone", () => {
    expect(parseReminder("reminders are hard", now, tz)).toBeNull();
    expect(parseReminder("remind me tomorrow", now, tz)?.text).toBe("remind me tomorrow");
  });
});

import { matchPeople, mentionAt, mentionText } from "./use-people";

describe("@ suggestions", () => {
  const people = [
    { email: "teja@tilicho.in", name: "Teja Reddy" },
    { email: "ravi@x.co", name: null },
    { email: "neha@tilicho.in", name: "Neha" },
  ];
  it("finds the @word at the cursor", () => {
    expect(mentionAt("insights from @te", 17)).toEqual({ start: 14, query: "te" });
    expect(mentionAt("mail me@x", 9)).toBeNull();
    expect(mentionAt("@", 1)).toEqual({ start: 0, query: "" });
  });
  it("suggests by name or email, and writes a first name", () => {
    expect(matchPeople(people, "te").map((p) => p.email)).toEqual(["teja@tilicho.in"]);
    expect(matchPeople(people, "ra").map((p) => p.email)).toEqual(["ravi@x.co"]);
    expect(matchPeople(people, "").length).toBe(3);
    expect(mentionText(people[0])).toBe("@Teja");
    expect(mentionText(people[1])).toBe("@ravi@x.co");
  });
});

describe("countdowns", () => {
  const today = "2026-11-03";
  it("counts down to a day, in words a traveller says", () => {
    expect(countdown("2026-11-13", null, today)).toMatchObject({ left: "10 days to go", phase: "ahead", days: 10 });
    expect(countdown("2026-11-05", null, today)).toMatchObject({ left: "2 days to go", phase: "soon" });
    expect(countdown("2026-11-04", null, today).left).toBe("Tomorrow");
    expect(countdown("2026-12-01", null, today).left).toBe("4 weeks to go");
    expect(countdown("2027-04-01", null, today).left).toBe("5 months to go");
  });
  it("during a trip, says which day it is", () => {
    expect(countdown("2026-11-03", null, today)).toMatchObject({ left: "Today", phase: "now" });
    expect(countdown("2026-11-02", "2026-11-06", today)).toMatchObject({ left: "Day 2 of 5", phase: "now" });
  });
  it("afterwards, how long ago", () => {
    expect(countdown("2026-11-02", null, today)).toMatchObject({ left: "Yesterday", phase: "past" });
    expect(countdown("2026-10-10", "2026-10-13", today).left).toBe("3 weeks ago");
  });
  it("writes the dates short, with the year only when it isn't this year", () => {
    expect(dayRange("2026-11-13", null, today)).toBe("13 Nov");
    expect(dayRange("2026-11-13", "2026-11-17", today)).toBe("13–17 Nov");
    expect(dayRange("2026-11-30", "2026-12-02", today)).toBe("30 Nov – 2 Dec");
    expect(dayRange("2027-01-05", null, today)).toBe("5 Jan 2027");
  });
  it("only takes real days", () => {
    expect(isDay("2026-11-13")).toBe(true);
    for (const v of ["2026-13-01", "13-11-2026", "", null, "2026-11-13T00:00"]) expect(isDay(v)).toBe(false);
  });
});
