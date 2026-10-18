"use client";

import { create } from "zustand";
import { authClient } from "./auth-client";
import { applyAction, ActionError, uid, type ProjectAction } from "./mutations";
import { browserTz, cityFromTz, todayIn } from "./time";
import type { CarryReason, Lead, Project } from "./types";

export { carryOver, nameFromEmail, onLeave, paperFor, previousPaper, uid } from "./mutations";

type ServerState = {
  lead: Lead | null;
  projects: Project[];
  viewer: Record<string, string>;
  /** Which sign-in methods work here. */
  signIn: { password: boolean; email: boolean; google: boolean };
};

type State = ServerState & {
  /** "loading" until the first answer from the server. */
  status: "loading" | "ready" | "offline";
  /** The last thing that went wrong, shown as a toast. */
  error: string | null;
};

type Actions = {
  refresh: () => Promise<void>;
  dismissError: () => void;
  createProject: (name: string, hoursPerDay: 6 | 8) => string;
  addInvites: (projectId: string, emails: string[]) => void;
  joinProject: (code: string, tz: string, city: string) => Promise<{ projectId: string } | null>;
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
  loadDemo: (moment: "morning" | "afternoon") => Promise<string | null>;
  deleteDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

export type Store = State & Actions;

type ActionResponse = { state: ServerState; projectId?: string; error?: string };

async function post(body: object): Promise<ActionResponse> {
  const res = await fetch("/api/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<ActionResponse>;
  if (!res.ok || !json.state) throw new Error(json.error ?? "Couldn't reach Pen & Paper. Check your connection.");
  return json as ActionResponse;
}

export const useStore = create<Store>()((set, get) => {
  /*
   * Changes go to the server one at a time, in order. While any are in flight
   * the screen keeps its own (already updated) copy; the server's copy replaces
   * it once the queue is empty.
   */
  let queue: Promise<unknown> = Promise.resolve();
  let inFlight = 0;

  const send = <T,>(body: object, onDone?: (r: ActionResponse) => T): Promise<T | null> => {
    inFlight += 1;
    const run = queue.then(async () => {
      try {
        const r = await post(body);
        inFlight -= 1;
        if (inFlight === 0) set({ ...r.state, status: "ready" });
        return onDone ? onDone(r) : (null as T);
      } catch (e) {
        inFlight -= 1;
        set({ error: e instanceof Error ? e.message : String(e) });
        if (inFlight === 0) void get().refresh();
        return null;
      }
    });
    queue = run;
    return run;
  };

  /** Shows the change now, then sends it. */
  const act = (action: ProjectAction) => {
    const now = new Date().toISOString();
    const projects = get().projects.map((p) => {
      if (p.id !== action.projectId) return p;
      const copy = structuredClone(p);
      try {
        applyAction(copy, action, now);
      } catch (e) {
        if (e instanceof ActionError) set({ error: e.message });
        throw e;
      }
      return copy;
    });
    set({ projects });
    void send(action);
  };

  const tryAct = (action: ProjectAction) => {
    try {
      act(action);
    } catch {
      // Already reported through `error`.
    }
  };

  return {
    lead: null,
    projects: [],
    viewer: {},
    signIn: { password: false, email: false, google: false },
    status: "loading",
    error: null,

    refresh: async () => {
      if (inFlight > 0) return;
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const state = (await res.json()) as ServerState;
        if (inFlight === 0) set({ ...state, status: "ready" });
      } catch {
        set((s) => ({ status: s.status === "loading" ? "offline" : s.status }));
      }
    },

    dismissError: () => set({ error: null }),

    createProject: (name, hoursPerDay) => {
      const id = uid();
      const tz = browserTz();
      const lead = get().lead;
      const optimistic: Project = {
        id,
        name,
        leadName: lead?.name ?? "",
        isOwner: true,
        hoursPerDay,
        inviteCode: "",
        createdAt: new Date().toISOString(),
        leadTz: tz,
        leadCity: cityFromTz(tz),
        invitesSent: false,
        members: [],
        currentDate: todayIn(tz),
        papers: [],
      };
      set((s) => ({ projects: [...s.projects, optimistic] }));
      void send({ type: "createProject", id, name, hoursPerDay, tz });
      return id;
    },

    addInvites: (projectId, emails) => tryAct({ type: "addInvites", projectId, members: emails.map((email) => ({ id: uid(), email })) }),

    joinProject: (code, tz, city) => send({ type: "joinProject", code, tz, city }, (r) => (r.projectId ? { projectId: r.projectId } : null)),

    setLeave: (projectId, memberId, date, leave) => tryAct({ type: "setLeave", projectId, memberId, date, leave }),
    startPaper: (projectId, date) => tryAct({ type: "startPaper", projectId, date }),
    dropThought: (projectId, date, text) =>
      tryAct({ type: "dropThought", projectId, date, text, taskId: uid(), shape: Math.floor(Math.random() * 6) }),
    setEstimate: (projectId, date, taskId, est) => tryAct({ type: "setEstimate", projectId, date, taskId, est }),
    assign: (projectId, date, taskId, memberId) => tryAct({ type: "assign", projectId, date, taskId, memberId }),
    removeTask: (projectId, date, taskId) => tryAct({ type: "removeTask", projectId, date, taskId }),
    sendPaper: (projectId, date) => tryAct({ type: "sendPaper", projectId, date }),
    toggleDone: (projectId, date, taskId) => tryAct({ type: "toggleDone", projectId, date, taskId }),
    requestTime: (projectId, date, taskId, hours, why) => tryAct({ type: "requestTime", projectId, date, taskId, hours, why }),
    answerRequest: (projectId, date, taskId, give) => tryAct({ type: "answerRequest", projectId, date, taskId, give }),
    setBlocked: (projectId, date, taskId, why) => tryAct({ type: "setBlocked", projectId, date, taskId, why }),
    closeDay: (projectId, date, memberId, reason) => tryAct({ type: "closeDay", projectId, date, memberId, reason }),
    reopenDay: (projectId, date, memberId) => tryAct({ type: "reopenDay", projectId, date, memberId }),
    thankTeam: (projectId, date) => tryAct({ type: "thankTeam", projectId, date }),
    advanceDay: (projectId) => tryAct({ type: "advanceDay", projectId }),

    loadDemo: (moment) => send({ type: "loadDemo", moment }, (r) => r.projectId ?? null),

    deleteDemo: async () => {
      await send({ type: "deleteDemo" });
    },

    signOut: async () => {
      await authClient.signOut();
      set({ lead: null, projects: [], viewer: {} });
      await get().refresh();
    },
  };
});
