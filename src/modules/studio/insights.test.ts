import { describe, expect, it } from "vitest";
import { buildInsights, change, type InsightInput } from "./insights";

const base: InsightInput = {
  writers: { now: 3, before: 3 },
  thoughts: { now: 30, before: 30 },
  newPeople: { now: 2, before: 2 },
  perWriter: { now: 10, before: 10 },
  people: 10,
  retained: { cohort: 0, came_back: 0 },
  activated: { joined: 0, wrote: 0 },
  slipping: 0,
  neverWrote: 0,
  reviews: { now: 1, before: 1 },
  sources: [{ source: "canvas", now: 30, before: 30 }],
  weekdays: [0, 0, 0, 0, 0, 0, 0],
  hours: Array(24).fill(0),
};

describe("change", () => {
  it("is the percent change, or null without a base", () => {
    expect(change({ now: 15, before: 10 })).toBe(50);
    expect(change({ now: 5, before: 10 })).toBe(-50);
    expect(change({ now: 5, before: 0 })).toBeNull();
  });
});

describe("buildInsights", () => {
  it("calls out a drop in writers first, as something to act on", () => {
    const out = buildInsights({ ...base, writers: { now: 2, before: 6 } });
    expect(out[0]).toMatchObject({ tone: "act", title: "Writers down 67%" });
  });
  it("flags weak activation and weak retention", () => {
    const out = buildInsights({ ...base, activated: { joined: 10, wrote: 3 }, retained: { cohort: 10, came_back: 1 } });
    expect(out.map((i) => i.title)).toEqual(expect.arrayContaining(["Only 30% of new people wrote a first thought", "10% came back after their first week"]));
  });
  it("notices an unused capture surface and the busiest time", () => {
    const hours = Array(24).fill(0);
    hours[22] = 30;
    const weekdays = [0, 30, 0, 0, 0, 0, 0];
    const out = buildInsights({ ...base, sources: [{ source: "canvas", now: 30, before: 0 }, { source: "extension", now: 0, before: 0 }], hours, weekdays });
    expect(out.map((i) => i.title)).toEqual(expect.arrayContaining(["Nobody used the Chrome extension this month", "People think most on Mondays, 10 pm–11 pm"]));
  });
  it("stays quiet when nothing moved", () => {
    expect(buildInsights({ ...base, sources: [] })).toEqual([]);
  });
});
