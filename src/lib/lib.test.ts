import { describe, expect, it } from "vitest";
import { formatEstLong, formatHours, parseThought } from "./estimate";
import { clock, nextWorkday, sameClock, shortDate, zonedTime } from "./time";
import { carryOver } from "./store";
import { demoAfternoon, demoMorning } from "./demo";
import { cleanStreak, loadOf } from "./selectors";

describe("parseThought", () => {
  it.each([
    ["fix calendar overlap 2h", "fix calendar overlap", 2],
    ["notify manager 1h 30m", "notify manager", 1.5],
    ["notify manager 1h30m", "notify manager", 1.5],
    ["review PRs 90m", "review PRs", 1.5],
    ["QA leave export 3 hours", "QA leave export", 3],
    ["quick sync 0.5h", "quick sync", 0.5],
  ])("%s", (input, title, est) => {
    expect(parseThought(input)).toEqual({ title, est });
  });

  it("leaves est empty when no time is given", () => {
    expect(parseThought("half-day leave rule")).toEqual({ title: "half-day leave rule", est: null });
  });

  it("does not treat a bare time as a title", () => {
    expect(parseThought("2h")).toEqual({ title: "2h", est: null });
  });

  it("does not read version numbers as time", () => {
    expect(parseThought("upgrade to v3")).toEqual({ title: "upgrade to v3", est: null });
  });
});

describe("formatting", () => {
  it("formats estimates", () => {
    expect(formatEstLong(1.5)).toBe("1h 30m");
    expect(formatEstLong(0.5)).toBe("30m");
    expect(formatEstLong(4)).toBe("4h");
    expect(formatHours(7.5)).toBe("7.5h");
  });
});

describe("time zones", () => {
  it("shows when 9:00 elsewhere happens for the lead (story: Wed 21 Oct 2026)", () => {
    expect(clock(zonedTime("2026-10-21", 9, 0, "Europe/Berlin"), "Asia/Kolkata")).toBe("12:30 pm");
    expect(clock(zonedTime("2026-10-21", 9, 0, "America/Toronto"), "Asia/Kolkata")).toBe("6:30 pm");
  });

  it("knows same-clock zones", () => {
    expect(sameClock("Asia/Kolkata", "Asia/Calcutta")).toBe(true);
    expect(sameClock("Asia/Kolkata", "Europe/Berlin")).toBe(false);
  });

  it("skips weekends", () => {
    expect(nextWorkday("2026-10-23")).toBe("2026-10-26");
    expect(nextWorkday("2026-10-21")).toBe("2026-10-22");
    expect(shortDate("2026-10-21")).toBe("Wed, 21 Oct");
  });
});

describe("story data", () => {
  it("carries Tuesday's unfinished tasks to their owners", () => {
    const { project } = demoMorning();
    const carried = carryOver(project, "2026-10-21");
    expect(carried.map((t) => [t.title, t.assigneeId, t.carryNote])).toEqual([
      ["Approval emails", "asha", "took longer"],
      ["Leave balance tests", "sana", "blocked"],
    ]);
  });

  it("matches the live view numbers in the design", () => {
    const { project } = demoAfternoon();
    const paper = project.papers.find((p) => p.date === "2026-10-21")!;
    expect(paper.tasks.length).toBe(9);
    expect(paper.tasks.filter((t) => t.done).length).toBe(5);
  });

  it("counts Meera's clean papers", () => {
    const { project } = demoAfternoon();
    const paper = project.papers.find((p) => p.date === "2026-10-21")!;
    for (const t of paper.tasks) if (t.assigneeId === "meera") t.done = true;
    expect(cleanStreak(project, "meera", "2026-10-21")).toBe(3);
  });

  it("flags load near and over the day", () => {
    expect(loadOf(7.5, 8)).toBe("near");
    expect(loadOf(9, 8)).toBe("over");
    expect(loadOf(4, 8)).toBe("free");
  });
});
