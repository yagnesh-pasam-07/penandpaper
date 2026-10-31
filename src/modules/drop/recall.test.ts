import { describe, expect, it } from "vitest";
import { isDue, localClock, nextShow, notificationText, parseDays, parseRecallTime, pickThought, shouldNotify, wroteAgo, type Candidate } from "./recall";

const IST = "Asia/Kolkata";
const day = 24 * 60 * 60 * 1000;
// 2026-11-02 is a Monday. 10:00 IST = 04:30 UTC.
const monday10 = new Date("2026-11-02T04:30:00Z");

const c = (id: string, ageDays: number, extra: Partial<Candidate> = {}): Candidate => ({
  id,
  createdAt: new Date(monday10.getTime() - ageDays * day).toISOString(),
  dueAt: null,
  lastShownAt: null,
  ...extra,
});

describe("recall settings", () => {
  it("reads a recall time and weekdays", () => {
    expect(parseRecallTime("09:00")).toBe("09:00");
    expect(parseRecallTime(" 21:30 ")).toBe("21:30");
    expect(parseRecallTime("24:00")).toBeNull();
    expect(parseRecallTime("9:00")).toBeNull();
    expect(parseDays([5, 1, 1, 9])).toEqual([1, 5]);
    expect(parseDays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parseDays("x")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("reads the local clock in a zone", () => {
    expect(localClock(IST, monday10)).toEqual({ date: "2026-11-02", weekday: 1, minutes: 600 });
  });
});

describe("when today's thought greets", () => {
  const every = [0, 1, 2, 3, 4, 5, 6];
  it("after the chosen time, once a day", () => {
    expect(isDue({ time: "09:00", days: every, seenOn: null }, IST, monday10)).toBe(true);
    expect(isDue({ time: "11:00", days: every, seenOn: null }, IST, monday10)).toBe(false);
    expect(isDue({ time: "09:00", days: every, seenOn: "2026-11-02" }, IST, monday10)).toBe(false);
  });
  it("any time for 'when I open', and only on chosen days", () => {
    expect(isDue({ time: null, days: every, seenOn: null }, IST, monday10)).toBe(true);
    expect(isDue({ time: "09:00", days: [0, 6], seenOn: null }, IST, monday10)).toBe(false);
  });
  it("notifies once, in the run whose window holds the time", () => {
    const p = { time: "09:45", days: every, seenOn: null, notifiedOn: null };
    expect(shouldNotify(p, IST, monday10, 60)).toBe(true);
    expect(shouldNotify({ ...p, time: "08:30" }, IST, monday10, 60)).toBe(false);
    // A once-a-day job reaches everyone whose time has passed.
    expect(shouldNotify({ ...p, time: "08:30" }, IST, monday10, 24 * 60)).toBe(true);
    expect(shouldNotify({ ...p, notifiedOn: "2026-11-02" }, IST, monday10, 60)).toBe(false);
    expect(shouldNotify({ ...p, seenOn: "2026-11-02" }, IST, monday10, 60)).toBe(false);
    expect(shouldNotify({ ...p, time: null }, IST, monday10, 60)).toBe(false);
  });
});

describe("which thought", () => {
  it("the oldest due first", () => {
    const pick = pickThought([c("a", 3), c("b", 5), c("young", 0.5)], monday10, "s");
    expect(pick?.id).toBe("b");
  });
  it("its own due date wins over its age", () => {
    const later = c("old", 30, { dueAt: new Date(monday10.getTime() + day).toISOString() });
    expect(pickThought([later, c("new", 2)], monday10, "s")?.id).toBe("new");
  });
  it("never one shown in the last day, or passed over today", () => {
    const shown = c("shown", 5, { lastShownAt: new Date(monday10.getTime() - day / 2).toISOString() });
    expect(pickThought([shown, c("other", 4)], monday10, "s")?.id).toBe("other");
    expect(pickThought([c("x", 4), c("y", 3)], monday10, "s", ["x"])?.id).toBe("y");
  });
  it("with nothing due, a forgotten one older than a week, the same all day", () => {
    const far = (id: string) => c(id, 40, { dueAt: new Date(monday10.getTime() + 10 * day).toISOString() });
    const all = [far("p"), far("q"), far("r")];
    const one = pickThought(all, monday10, "user:2026-11-02");
    expect(one).not.toBeNull();
    expect(pickThought(all, monday10, "user:2026-11-02")?.id).toBe(one?.id);
  });
  it("nothing when the library is empty or brand new", () => {
    expect(pickThought([], monday10, "s")).toBeNull();
    expect(pickThought([c("today", 0.2)], monday10, "s")).toBeNull();
  });
});

describe("spacing and words", () => {
  it("spaces each 'Tomorrow' further out: 1, 3, 7, 21, then 60 days", () => {
    const gap = (n: number) => Math.round((new Date(nextShow(n, monday10)).getTime() - monday10.getTime()) / day);
    expect([0, 1, 2, 3, 4, 9].map(gap)).toEqual([1, 3, 7, 21, 60, 60]);
  });
  it("says how long ago, and keeps the notification short", () => {
    expect(wroteAgo(c("a", 12).createdAt, monday10)).toBe("You wrote this 12 days ago");
    expect(wroteAgo(c("a", 1.2).createdAt, monday10)).toBe("You wrote this yesterday");
    const n = notificationText("a ".repeat(100));
    expect(n.title).toBe("Your thought for today is ready");
    expect(n.body.length).toBeLessThanOrEqual(80);
    expect(notificationText("").body).toBe("A picture you kept.");
  });
});
