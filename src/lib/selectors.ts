import { onLeave } from "./mutations";
import type { Member, Paper, Project, Task } from "./types";

export function sumEst(tasks: Task[]): number {
  return tasks.reduce((s, t) => s + (t.est ?? 0), 0);
}

export function tasksOf(paper: Paper | undefined, memberId: string): Task[] {
  return paper?.tasks.filter((t) => t.assigneeId === memberId) ?? [];
}

export function looseThoughts(paper: Paper | undefined): Task[] {
  return paper?.tasks.filter((t) => t.assigneeId === null) ?? [];
}

/** People who are working on `date`. */
export function presentMembers(project: Project, date: string): Member[] {
  return project.members.filter((m) => !onLeave(m, date));
}

export type Load = "free" | "near" | "over";

/** Near = 90% or more of the day; over = past it. */
export function loadOf(planned: number, capacity: number): Load {
  if (planned > capacity) return "over";
  if (capacity > 0 && planned / capacity >= 0.9) return "near";
  return "free";
}

/** Members who got at least one task on a sent paper. */
export function recipients(project: Project, paper: Paper): Member[] {
  return project.members.filter((m) => paper.tasks.some((t) => t.assigneeId === m.id));
}

export function memberDone(paper: Paper, memberId: string): boolean {
  const mine = tasksOf(paper, memberId);
  return mine.length > 0 && mine.every((t) => t.done);
}

/** Latest finish time across a member's tasks. */
export function finishedAt(paper: Paper, memberId: string): Date | null {
  const times = tasksOf(paper, memberId)
    .map((t) => t.doneAt)
    .filter((x): x is string => Boolean(x))
    .sort();
  return times.length ? new Date(times[times.length - 1]) : null;
}

/** Consecutive sent papers, newest first, where this member struck everything. */
export function cleanStreak(project: Project, memberId: string, upTo: string): number {
  const papers = project.papers
    .filter((p) => p.status === "sent" && p.date <= upTo && tasksOf(p, memberId).length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const p of papers) {
    if (!memberDone(p, memberId)) break;
    streak += 1;
  }
  return streak;
}

export function greeting(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function hourIn(tz: string, at: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(at));
}
