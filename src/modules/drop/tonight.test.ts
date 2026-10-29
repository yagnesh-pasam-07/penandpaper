import { describe, expect, it } from "vitest";
import {
  adjustCounts,
  countsOf,
  dayRange,
  decisionOf,
  emailSubject,
  hourIn,
  isEveningLocal,
  isInReview,
  localDate,
  noCounts,
  progressText,
  resolveTz,
  reviewDateOf,
  stateFor,
  summaryText,
  thoughtsText,
} from "./tonight";

const at = (iso: string) => new Date(iso);
const hours = (r: { start: Date; end: Date }) => (r.end.getTime() - r.start.getTime()) / 3_600_000;

describe("time zones", () => {
  it("uses a zone the runtime knows, else the fallback, else UTC", () => {
    expect(resolveTz("America/Los_Angeles")).toBe("America/Los_Angeles");
    expect(resolveTz("Mars/Phobos")).toBe("Asia/Kolkata");
    expect(resolveTz(null)).toBe("Asia/Kolkata");
    expect(resolveTz("")).toBe("Asia/Kolkata");
    expect(resolveTz("../../etc/passwd")).toBe("Asia/Kolkata");
    expect(resolveTz("x".repeat(200))).toBe("Asia/Kolkata");
    expect(resolveTz("nope", "Pacific/Auckland")).toBe("Pacific/Auckland");
    expect(resolveTz("nope", "also/nope")).toBe("UTC");
  });

  it("puts an instant on the local day, with midnight starting the new day (Kolkata)", () => {
    expect(localDate("Asia/Kolkata", at("2026-10-28T18:29:59Z"))).toBe("2026-10-28"); // 23:59:59
    expect(localDate("Asia/Kolkata", at("2026-10-28T18:30:00Z"))).toBe("2026-10-29"); // 00:00:00
  });

  it("does the same in Los Angeles and Auckland", () => {
    expect(localDate("America/Los_Angeles", at("2026-10-29T06:59:59Z"))).toBe("2026-10-28");
    expect(localDate("America/Los_Angeles", at("2026-10-29T07:00:00Z"))).toBe("2026-10-29");
    expect(localDate("Pacific/Auckland", at("2026-10-28T10:59:59Z"))).toBe("2026-10-28");
    expect(localDate("Pacific/Auckland", at("2026-10-28T11:00:00Z"))).toBe("2026-10-29");
  });

  it("an invalid zone falls back to the default instead of throwing", () => {
    expect(localDate("Not/AZone", at("2026-10-28T18:29:59Z"))).toBe("2026-10-28");
    expect(localDate("Not/AZone", at("2026-10-28T18:30:00Z"))).toBe("2026-10-29");
  });

  it("the same instant can be two different days in two zones", () => {
    const t = at("2026-10-28T20:00:00Z");
    expect(localDate("Asia/Kolkata", t)).toBe("2026-10-29");
    expect(localDate("America/Los_Angeles", t)).toBe("2026-10-28");
  });

  it("dates a thought by the local day it was dropped", () => {
    expect(reviewDateOf("2026-10-28T18:29:59Z", "Asia/Kolkata")).toBe("2026-10-28");
    expect(reviewDateOf("2026-10-28T18:30:00Z", "Asia/Kolkata")).toBe("2026-10-29");
  });
});

describe("a local day's range", () => {
  it("runs midnight to midnight in Kolkata", () => {
    const r = dayRange("Asia/Kolkata", "2026-10-28");
    expect(r.start.toISOString()).toBe("2026-10-27T18:30:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-28T18:30:00.000Z");
    expect(hours(r)).toBe(24);
  });

  it("includes its first instant and leaves out the next midnight", () => {
    const r = dayRange("Asia/Kolkata", "2026-10-28");
    expect(localDate("Asia/Kolkata", r.start)).toBe("2026-10-28");
    expect(localDate("Asia/Kolkata", new Date(r.end.getTime() - 1))).toBe("2026-10-28");
    expect(localDate("Asia/Kolkata", r.end)).toBe("2026-10-29");
  });

  it("is 23 hours when the clocks go forward and 25 when they go back (Los Angeles)", () => {
    expect(hours(dayRange("America/Los_Angeles", "2026-03-08"))).toBe(23);
    expect(dayRange("America/Los_Angeles", "2026-03-08").start.toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(dayRange("America/Los_Angeles", "2026-03-08").end.toISOString()).toBe("2026-03-09T07:00:00.000Z");
    expect(hours(dayRange("America/Los_Angeles", "2026-11-01"))).toBe(25);
    expect(hours(dayRange("America/Los_Angeles", "2026-06-15"))).toBe(24);
  });

  it("is 23 hours and 25 hours on Auckland's change days", () => {
    expect(hours(dayRange("Pacific/Auckland", "2026-09-27"))).toBe(23);
    expect(dayRange("Pacific/Auckland", "2026-09-27").start.toISOString()).toBe("2026-09-26T12:00:00.000Z");
    expect(hours(dayRange("Pacific/Auckland", "2026-04-05"))).toBe(25);
  });

  it("the days either side of a change still line up with no gap or overlap", () => {
    const a = dayRange("America/Los_Angeles", "2026-03-07");
    const b = dayRange("America/Los_Angeles", "2026-03-08");
    const c = dayRange("America/Los_Angeles", "2026-03-09");
    expect(a.end.getTime()).toBe(b.start.getTime());
    expect(b.end.getTime()).toBe(c.start.getTime());
  });
});

describe("evening", () => {
  it("starts at 18:00 on the clock in the zone", () => {
    expect(isEveningLocal(at("2026-10-28T12:29:59Z"), "Asia/Kolkata")).toBe(false); // 17:59:59
    expect(isEveningLocal(at("2026-10-28T12:30:00Z"), "Asia/Kolkata")).toBe(true); // 18:00:00
    expect(isEveningLocal(at("2026-10-28T18:29:59Z"), "Asia/Kolkata")).toBe(true); // 23:59:59
    expect(isEveningLocal(at("2026-10-28T18:30:00Z"), "Asia/Kolkata")).toBe(false); // 00:00:00
  });

  it("reads midnight as hour 0, not 24", () => {
    expect(hourIn("Asia/Kolkata", at("2026-10-28T18:30:00Z"))).toBe(0);
    expect(hourIn("Asia/Kolkata", at("2026-10-28T18:29:59Z"))).toBe(23);
  });

  it("follows the viewer's zone, not the server's", () => {
    const t = at("2026-10-28T20:00:00Z"); // 01:30 next day in Kolkata, 13:00 in Los Angeles
    expect(isEveningLocal(t, "Asia/Kolkata")).toBe(false);
    expect(isEveningLocal(t, "America/Los_Angeles")).toBe(false);
    expect(isEveningLocal(at("2026-10-29T02:00:00Z"), "America/Los_Angeles")).toBe(true); // 19:00 PDT
  });
});

describe("what a thought's state says", () => {
  const open = { reviewedAt: null, crumpledAt: null, status: "open" as const };
  it("reads the choice from the state", () => {
    expect(decisionOf(open)).toBeNull();
    expect(decisionOf({ ...open, reviewedAt: "x" })).toBe("keep");
    expect(decisionOf({ ...open, reviewedAt: "x", status: "done" })).toBe("strike");
    expect(decisionOf({ ...open, reviewedAt: "x", crumpledAt: "y" })).toBe("crumple");
  });

  it("skips thoughts struck or crumpled outside the ritual, and keeps reviewed ones", () => {
    expect(isInReview(open)).toBe(true);
    expect(isInReview({ ...open, status: "done" })).toBe(false);
    expect(isInReview({ ...open, crumpledAt: "y" })).toBe(false);
    expect(isInReview({ ...open, reviewedAt: "x", status: "done" })).toBe(true);
    expect(isInReview({ ...open, reviewedAt: "x", crumpledAt: "y" })).toBe(true);
  });

  it("maps each choice to the state it leaves, and undo to the original", () => {
    expect(stateFor("strike")).toEqual({ reviewed: true, struck: true, crumpled: false });
    expect(stateFor("keep")).toEqual({ reviewed: true, struck: false, crumpled: false });
    expect(stateFor("crumple")).toEqual({ reviewed: true, struck: false, crumpled: true });
    expect(stateFor("undo")).toEqual({ reviewed: false, struck: false, crumpled: false });
  });
});

describe("counts", () => {
  it("moves a thought from one choice to another", () => {
    let c = noCounts;
    c = adjustCounts(c, null, "strike");
    c = adjustCounts(c, null, "keep");
    c = adjustCounts(c, null, "crumple");
    expect(c).toEqual({ struck: 1, kept: 1, crumpled: 1 });
    c = adjustCounts(c, "crumple", "keep"); // changed its mind
    expect(c).toEqual({ struck: 1, kept: 2, crumpled: 0 });
    c = adjustCounts(c, "strike", null); // Back
    expect(c).toEqual({ struck: 0, kept: 2, crumpled: 0 });
  });

  it("never goes below zero, and leaves the original alone", () => {
    expect(adjustCounts(noCounts, "strike", null)).toEqual(noCounts);
    const before = { struck: 1, kept: 0, crumpled: 0 };
    adjustCounts(before, "strike", "keep");
    expect(before).toEqual({ struck: 1, kept: 0, crumpled: 0 });
  });

  it("counts a list of choices, leaving out undecided ones", () => {
    expect(countsOf(["strike", "strike", null, "keep", "crumple", "strike"])).toEqual({ struck: 3, kept: 1, crumpled: 1 });
    expect(countsOf([])).toEqual(noCounts);
  });
});

describe("words", () => {
  it("sums up the review and leaves out parts with none", () => {
    expect(summaryText({ struck: 4, kept: 3, crumpled: 2 })).toBe("4 struck · 3 kept · 2 crumpled");
    expect(summaryText({ struck: 0, kept: 5, crumpled: 0 })).toBe("5 kept");
    expect(summaryText({ struck: 1, kept: 0, crumpled: 2 })).toBe("1 struck · 2 crumpled");
    expect(summaryText(noCounts)).toBe("Nothing to review");
  });

  it("shows progress for the card on screen", () => {
    expect(progressText(0, 9)).toBe("1 of 9");
    expect(progressText(2, 9)).toBe("3 of 9");
    expect(progressText(8, 9)).toBe("9 of 9");
    expect(progressText(9, 9)).toBe("9 of 9");
    expect(progressText(0, 0)).toBe("0 of 0");
    expect(progressText(-3, 4)).toBe("1 of 4");
  });

  it("writes the email subject with the right plural", () => {
    expect(thoughtsText(1)).toBe("1 thought");
    expect(thoughtsText(0)).toBe("0 thoughts");
    expect(emailSubject(9)).toBe("Tonight's paper · 9 thoughts");
    expect(emailSubject(1)).toBe("Tonight's paper · 1 thought");
  });
});
