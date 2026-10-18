"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { parseThought } from "./estimate";
import { browserTz, cityFromTz, nextWorkday, todayIn } from "./time";
import type { CarryReason, Lead, Member, Paper, Project, Task, Tint } from "./types";
import { demoAfternoon, demoMorning } from "./demo";

const TINTS: Tint[] = ["t4", "t3", "t2", "t1", "t5"];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function inviteCode(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-")[0] || "team";
  return `${slug}-${Math.random().toString(36).slice(2, 5)}`;
}

/** "asha.k@company.com" -> "Asha" */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0].split(/[._+-]/)[0] || email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function onLeave(member: Member, date: string): boolean {
  return member.leave.includes(date);
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
        id: uid(),
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

export function paperFor(project: Project, date: string): Paper | undefined {
  return project.papers.find((p) => p.date === date);
}

type State = {
  lead: Lead | null;
  projects: Project[];
  /** Which member this browser is, per project (member screens). */
  viewer: Record<string, string>;
};

type Actions = {
  signUp: (email: string) => void;
  createProject: (name: string, hoursPerDay: 6 | 8) => string;
  addInvites: (projectId: string, emails: string[]) => void;
  joinProject: (code: string, email: string, tz: string, city: string) => { projectId: string; memberId: string } | null;
  setLeave: (projectId: string, memberId: string, date: string, leave: boolean) => void;
  startPaper: (projectId: string, date: string) => void;
  dropThought: (projectId: string, date: string, text: string) => void;
  setEstimate: (projectId: string, date: string, taskId: string, est: number | null) => void;
  assign: (projectId: string, date: string, taskId: string, memberId: string | null) => void;
  removeTask: (projectId: string, date: string, taskId: string) => void;
  sendPaper: (projectId: string, date: string) => void;
  toggleDone: (projectId: string, date: string, taskId: string) => void;
  requestTime: (projectId: string, date: string, taskId: string, hours: number, why: string) => void;
  answerRequest: (projectId: string, date: string, taskId: string, give: boolean) => void;
  setBlocked: (projectId: string, date: string, taskId: string, why: string | null) => void;
  closeDay: (projectId: string, date: string, memberId: string, reason?: CarryReason) => void;
  reopenDay: (projectId: string, date: string, memberId: string) => void;
  thankTeam: (projectId: string, date: string) => void;
  advanceDay: (projectId: string) => void;
  loadDemo: (moment: "morning" | "afternoon") => void;
  reset: () => void;
};

export type Store = State & Actions;

const empty: State = { lead: null, projects: [], viewer: {} };

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** Copy-on-write update of one project. */
      const updateProject = (projectId: string, fn: (p: Project) => void) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const copy = structuredClone(p);
            fn(copy);
            return copy;
          }),
        }));

      const updatePaper = (projectId: string, date: string, fn: (paper: Paper, project: Project) => void) =>
        updateProject(projectId, (p) => {
          const paper = paperFor(p, date);
          if (paper) fn(paper, p);
        });

      const updateTask = (projectId: string, date: string, taskId: string, fn: (t: Task, paper: Paper) => void) =>
        updatePaper(projectId, date, (paper) => {
          const task = paper.tasks.find((t) => t.id === taskId);
          if (task) fn(task, paper);
        });

      return {
        ...empty,

        signUp: (email) => set({ lead: { email, name: nameFromEmail(email) } }),

        createProject: (name, hoursPerDay) => {
          const tz = browserTz();
          const project: Project = {
            id: uid(),
            name,
            hoursPerDay,
            inviteCode: inviteCode(name),
            createdAt: new Date().toISOString(),
            leadTz: tz,
            leadCity: cityFromTz(tz),
            invitesSent: false,
            members: [],
            currentDate: todayIn(tz),
            papers: [],
          };
          set((s) => ({ projects: [...s.projects, project] }));
          return project.id;
        },

        addInvites: (projectId, emails) =>
          updateProject(projectId, (p) => {
            for (const email of emails) {
              if (p.members.some((m) => m.email.toLowerCase() === email.toLowerCase())) continue;
              p.members.push({
                id: uid(),
                name: nameFromEmail(email),
                email,
                tz: p.leadTz,
                city: p.leadCity,
                hours: p.hoursPerDay,
                tint: TINTS[p.members.length % TINTS.length],
                status: "invited",
                leave: [],
              });
            }
            p.invitesSent = true;
          }),

        joinProject: (code, email, tz, city) => {
          const project = get().projects.find((p) => p.inviteCode === code);
          if (!project) return null;
          let memberId = project.members.find((m) => m.email.toLowerCase() === email.toLowerCase())?.id;
          updateProject(project.id, (p) => {
            let member = p.members.find((m) => m.id === memberId);
            if (!member) {
              member = {
                id: uid(),
                name: nameFromEmail(email),
                email,
                tz,
                city,
                hours: p.hoursPerDay,
                tint: TINTS[p.members.length % TINTS.length],
                status: "joined",
                leave: [],
              };
              p.members.push(member);
              memberId = member.id;
            }
            member.status = "joined";
            member.tz = tz;
            member.city = city;
          });
          set((s) => ({ viewer: { ...s.viewer, [project.id]: memberId! } }));
          return { projectId: project.id, memberId: memberId! };
        },

        setLeave: (projectId, memberId, date, leave) =>
          updateProject(projectId, (p) => {
            const m = p.members.find((x) => x.id === memberId);
            if (!m) return;
            m.leave = leave ? [...new Set([...m.leave, date])] : m.leave.filter((d) => d !== date);
          }),

        startPaper: (projectId, date) =>
          updateProject(projectId, (p) => {
            if (paperFor(p, date)) return;
            p.papers.push({ date, status: "draft", tasks: carryOver(p, date), closed: {} });
          }),

        dropThought: (projectId, date, text) => {
          const { title, est } = parseThought(text);
          if (!title) return;
          updatePaper(projectId, date, (paper) => {
            paper.tasks.push({ id: uid(), title, est, assigneeId: null, done: false, shape: Math.floor(Math.random() * 6) });
          });
        },

        setEstimate: (projectId, date, taskId, est) =>
          updateTask(projectId, date, taskId, (t) => {
            t.est = est;
          }),

        assign: (projectId, date, taskId, memberId) =>
          updateTask(projectId, date, taskId, (t) => {
            t.assigneeId = memberId;
          }),

        removeTask: (projectId, date, taskId) =>
          updatePaper(projectId, date, (paper) => {
            paper.tasks = paper.tasks.filter((t) => t.id !== taskId);
          }),

        sendPaper: (projectId, date) =>
          updatePaper(projectId, date, (paper) => {
            paper.status = "sent";
            paper.sentAt = new Date().toISOString();
          }),

        toggleDone: (projectId, date, taskId) =>
          updateTask(projectId, date, taskId, (t) => {
            t.done = !t.done;
            t.doneAt = t.done ? new Date().toISOString() : undefined;
            if (t.done) t.blocked = undefined;
          }),

        requestTime: (projectId, date, taskId, hours, why) =>
          updateTask(projectId, date, taskId, (t) => {
            t.request = { hours, why, at: new Date().toISOString(), state: "pending" };
          }),

        answerRequest: (projectId, date, taskId, give) =>
          updateTask(projectId, date, taskId, (t) => {
            if (!t.request) return;
            t.request.state = give ? "given" : "kept";
            if (give) t.est = t.request.hours;
          }),

        setBlocked: (projectId, date, taskId, why) =>
          updateTask(projectId, date, taskId, (t) => {
            t.blocked = why === null ? undefined : { why, at: new Date().toISOString() };
          }),

        closeDay: (projectId, date, memberId, reason) =>
          updatePaper(projectId, date, (paper) => {
            paper.closed[memberId] = { at: new Date().toISOString(), reason };
          }),

        reopenDay: (projectId, date, memberId) =>
          updatePaper(projectId, date, (paper) => {
            delete paper.closed[memberId];
          }),

        thankTeam: (projectId, date) =>
          updatePaper(projectId, date, (paper) => {
            paper.thanked = true;
          }),

        advanceDay: (projectId) =>
          updateProject(projectId, (p) => {
            p.currentDate = nextWorkday(p.currentDate);
          }),

        loadDemo: (moment) => {
          const seed = moment === "morning" ? demoMorning() : demoAfternoon();
          set({ lead: seed.lead, projects: [seed.project], viewer: { [seed.project.id]: seed.viewerId } });
        },

        reset: () => set(empty),
      };
    },
    {
      name: "pen-and-paper",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

