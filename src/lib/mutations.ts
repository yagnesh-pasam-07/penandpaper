/**
 * Every change to a project, as data. The browser applies an action right away
 * (so the screen never waits), and the server applies the same action to the
 * stored project and returns the result, which then replaces the browser's copy.
 */
import { parseThought } from "./estimate";
import { nextWorkday } from "./time";
import type { CarryReason, Member, Paper, Project, Task, Tint } from "./types";

export const TINTS: Tint[] = ["t4", "t3", "t2", "t1", "t5"];

export type ProjectAction =
  | { type: "addInvites"; projectId: string; members: { id: string; email: string }[] }
  | { type: "setLeave"; projectId: string; memberId: string; date: string; leave: boolean }
  | { type: "startPaper"; projectId: string; date: string }
  | { type: "dropThought"; projectId: string; date: string; taskId: string; text: string; shape: number }
  | { type: "setEstimate"; projectId: string; date: string; taskId: string; est: number | null }
  | { type: "assign"; projectId: string; date: string; taskId: string; memberId: string | null }
  | { type: "removeTask"; projectId: string; date: string; taskId: string }
  | { type: "sendPaper"; projectId: string; date: string }
  | { type: "toggleDone"; projectId: string; date: string; taskId: string }
  | { type: "requestTime"; projectId: string; date: string; taskId: string; hours: number; why: string }
  | { type: "answerRequest"; projectId: string; date: string; taskId: string; give: boolean }
  | { type: "setBlocked"; projectId: string; date: string; taskId: string; why: string | null }
  | { type: "closeDay"; projectId: string; date: string; memberId: string; reason?: CarryReason }
  | { type: "reopenDay"; projectId: string; date: string; memberId: string }
  | { type: "thankTeam"; projectId: string; date: string }
  | { type: "advanceDay"; projectId: string };

/** Actions only the project's lead may send. The rest a member may send for their own tasks. */
export const LEAD_ONLY = new Set<ProjectAction["type"]>([
  "addInvites",
  "setLeave",
  "startPaper",
  "dropThought",
  "setEstimate",
  "assign",
  "removeTask",
  "sendPaper",
  "answerRequest",
  "thankTeam",
  "advanceDay",
]);

export class ActionError extends Error {}

export function uid(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-3);
}

/** Same input, same id, in the browser and on the server (FNV-1a, base 36). */
function stableId(input: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    a = Math.imul(a ^ input.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ input.charCodeAt(input.length - 1 - i), 0x811c9dc5) >>> 0;
  }
  return (a.toString(36) + b.toString(36)).padEnd(12, "0").slice(0, 14);
}

/** "asha.k@company.com" -> "Asha" */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0].split(/[._+-]/)[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function onLeave(member: Member, date: string): boolean {
  return member.leave.includes(date);
}

export function paperFor(project: Project, date: string): Paper | undefined {
  return project.papers.find((p) => p.date === date);
}

/** The latest sent paper before `date`, if any. */
export function previousPaper(project: Project, date: string): Paper | undefined {
  return project.papers
    .filter((p) => p.status === "sent" && p.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/**
 * What rolls into a new paper: every unfinished task of the last sent paper,
 * kept with the same person, plus thoughts that were never handed out.
 */
export function carryOver(project: Project, date: string): Task[] {
  const prev = previousPaper(project, date);
  if (!prev) return [];
  return prev.tasks
    .filter((t) => !t.done)
    .map((t) => {
      const reason = t.assigneeId ? prev.closed[t.assigneeId]?.reason : undefined;
      return {
        id: stableId(`${t.id}:${date}`),
        title: t.title,
        est: t.request?.state === "given" ? t.request.hours : t.est,
        assigneeId: t.assigneeId,
        done: false,
        carriedFrom: t.assigneeId ? prev.date : undefined,
        carryNote: t.blocked ? "blocked" : reason?.toLowerCase(),
        shape: t.shape,
      };
    });
}

function mustPaper(project: Project, date: string): Paper {
  const paper = paperFor(project, date);
  if (!paper) throw new ActionError("No paper for that day.");
  return paper;
}

function mustTask(project: Project, date: string, taskId: string): { paper: Paper; task: Task } {
  const paper = mustPaper(project, date);
  const task = paper.tasks.find((t) => t.id === taskId);
  if (!task) throw new ActionError("That task is gone.");
  return { paper, task };
}

function mustMember(project: Project, memberId: string): Member {
  const member = project.members.find((m) => m.id === memberId);
  if (!member) throw new ActionError("That person isn't on this project.");
  return member;
}

/** Applies one action to `project` in place. Throws ActionError when it can't. */
export function applyAction(project: Project, action: ProjectAction, now: string): void {
  switch (action.type) {
    case "addInvites": {
      for (const { id, email } of action.members) {
        if (project.members.some((m) => m.email.toLowerCase() === email.toLowerCase())) continue;
        project.members.push({
          id,
          name: nameFromEmail(email),
          email,
          tz: project.leadTz,
          city: project.leadCity,
          hours: project.hoursPerDay,
          tint: TINTS[project.members.length % TINTS.length],
          status: "invited",
          leave: [],
        });
      }
      project.invitesSent = true;
      return;
    }
    case "setLeave": {
      const m = mustMember(project, action.memberId);
      m.leave = action.leave ? [...new Set([...m.leave, action.date])] : m.leave.filter((d) => d !== action.date);
      return;
    }
    case "startPaper": {
      if (paperFor(project, action.date)) return;
      project.papers.push({ date: action.date, status: "draft", tasks: carryOver(project, action.date), closed: {} });
      return;
    }
    case "dropThought": {
      const paper = mustPaper(project, action.date);
      const { title, est } = parseThought(action.text);
      if (!title) throw new ActionError("Type a thought first.");
      if (paper.tasks.some((t) => t.id === action.taskId)) return;
      paper.tasks.push({ id: action.taskId, title, est, assigneeId: null, done: false, shape: action.shape });
      return;
    }
    case "setEstimate": {
      mustTask(project, action.date, action.taskId).task.est = action.est;
      return;
    }
    case "assign": {
      if (action.memberId) mustMember(project, action.memberId);
      const { task } = mustTask(project, action.date, action.taskId);
      if (action.memberId && task.est === null) throw new ActionError(`Give "${task.title}" a time first.`);
      task.assigneeId = action.memberId;
      return;
    }
    case "removeTask": {
      const paper = mustPaper(project, action.date);
      paper.tasks = paper.tasks.filter((t) => t.id !== action.taskId);
      return;
    }
    case "sendPaper": {
      const paper = mustPaper(project, action.date);
      paper.status = "sent";
      paper.sentAt = now;
      return;
    }
    case "toggleDone": {
      const { task } = mustTask(project, action.date, action.taskId);
      task.done = !task.done;
      task.doneAt = task.done ? now : undefined;
      if (task.done) task.blocked = undefined;
      return;
    }
    case "requestTime": {
      mustTask(project, action.date, action.taskId).task.request = { hours: action.hours, why: action.why, at: now, state: "pending" };
      return;
    }
    case "answerRequest": {
      const { task } = mustTask(project, action.date, action.taskId);
      if (!task.request) return;
      task.request.state = action.give ? "given" : "kept";
      if (action.give) task.est = task.request.hours;
      return;
    }
    case "setBlocked": {
      mustTask(project, action.date, action.taskId).task.blocked = action.why === null ? undefined : { why: action.why, at: now };
      return;
    }
    case "closeDay": {
      mustPaper(project, action.date).closed[action.memberId] = { at: now, reason: action.reason };
      return;
    }
    case "reopenDay": {
      delete mustPaper(project, action.date).closed[action.memberId];
      return;
    }
    case "thankTeam": {
      mustPaper(project, action.date).thanked = true;
      return;
    }
    case "advanceDay": {
      project.currentDate = nextWorkday(project.currentDate);
      return;
    }
  }
}

/** The member a non-lead may act as: the task's owner, or the day being closed. */
export function actingMemberId(project: Project, action: ProjectAction): string | null {
  switch (action.type) {
    case "toggleDone":
    case "requestTime":
    case "setBlocked":
      return paperFor(project, action.date)?.tasks.find((t) => t.id === action.taskId)?.assigneeId ?? null;
    case "closeDay":
    case "reopenDay":
      return action.memberId;
    default:
      return null;
  }
}
