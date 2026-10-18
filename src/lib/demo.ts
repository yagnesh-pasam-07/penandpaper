import type { Member, Paper, Project, Task } from "./types";

/**
 * The story from the design canvas: Yagnesh leads 4 people across
 * Hyderabad, Berlin and Toronto. Wednesday 21 Oct 2026.
 */

export const DEMO_LEAD = { name: "Yagnesh", email: "yagnesh@example.com" };
export const DEMO_PROJECT_NAME = "Atlas HR platform";

const members: Member[] = [
  { id: "asha", name: "Asha", email: "asha@example.com", tz: "Asia/Kolkata", city: "Hyderabad", hours: 8, tint: "t4", status: "joined", leave: [] },
  { id: "dev", name: "Dev", email: "dev@example.com", tz: "Europe/Berlin", city: "Berlin", hours: 6, tint: "t3", status: "joined", leave: [] },
  { id: "meera", name: "Meera", email: "meera@example.com", tz: "Asia/Kolkata", city: "Hyderabad", hours: 8, tint: "t2", status: "joined", leave: [] },
  { id: "sana", name: "Sana", email: "sana@example.com", tz: "America/Toronto", city: "Toronto", hours: 8, tint: "t1", status: "joined", leave: [] },
  { id: "rohan", name: "Rohan", email: "rohan@example.com", tz: "Asia/Kolkata", city: "Hyderabad", hours: 8, tint: "t5", status: "joined", leave: ["2026-10-21"] },
];

let n = 0;
function task(title: string, est: number | null, assigneeId: string | null, extra: Partial<Task> = {}): Task {
  n += 1;
  return { id: `demo-${n}`, title, est, assigneeId, done: false, shape: n % 6, ...extra };
}

function done(at: string): Partial<Task> {
  return { done: true, doneAt: at };
}

function pastPapers(): Paper[] {
  return [
    {
      date: "2026-10-16",
      status: "sent",
      sentAt: "2026-10-16T03:20:00Z",
      closed: { meera: { at: "2026-10-16T13:00:00Z", reason: "Took longer" } },
      tasks: [task("Leave types API", 4, "meera", done("2026-10-16T09:00:00Z")), task("Holiday seed data", 3, "meera")],
    },
    {
      date: "2026-10-19",
      status: "sent",
      sentAt: "2026-10-19T03:20:00Z",
      closed: {},
      tasks: [
        task("Leave request form", 5, "meera", done("2026-10-19T10:30:00Z")),
        task("Form validation", 3, "meera", done("2026-10-19T12:00:00Z")),
        task("Employee directory sync", 6, "asha", done("2026-10-19T11:00:00Z")),
      ],
    },
    {
      date: "2026-10-20",
      status: "sent",
      sentAt: "2026-10-20T03:20:00Z",
      closed: {
        asha: { at: "2026-10-20T13:30:00Z", reason: "Took longer" },
        sana: { at: "2026-10-20T22:00:00Z", reason: "Blocked" },
      },
      tasks: [
        task("Leave balance API", 6, "meera", done("2026-10-20T11:00:00Z")),
        task("Accrual rules", 2, "meera", done("2026-10-20T12:40:00Z")),
        task("Approval emails", 2, "asha"),
        task("Manager inbox", 5, "asha", done("2026-10-20T10:00:00Z")),
        task("Leave balance tests", 2, "sana"),
        task("Timezone audit", 4, "dev", done("2026-10-20T14:00:00Z")),
      ],
    },
  ];
}

function baseProject(): Project {
  return {
    id: "atlas",
    name: DEMO_PROJECT_NAME,
    leadName: DEMO_LEAD.name,
    hoursPerDay: 8,
    inviteCode: "atlas-7k2",
    createdAt: "2026-10-12T04:00:00Z",
    leadTz: "Asia/Kolkata",
    leadCity: "Hyderabad",
    invitesSent: true,
    members: structuredClone(members),
    currentDate: "2026-10-21",
    papers: pastPapers(),
  };
}

function afternoonPaper(): Paper {
  return {
    date: "2026-10-21",
    status: "sent",
    sentAt: "2026-10-21T03:25:00Z",
    closed: {},
    tasks: [
      task("Leave calendar view", 4, "asha", done("2026-10-21T08:10:00Z")),
      task("Approval emails", 2, "asha", { ...done("2026-10-21T09:30:00Z"), carriedFrom: "2026-10-20", carryNote: "took longer" }),
      task("Notify manager", 1.5, "asha", done("2026-10-21T10:40:00Z")),
      task("Public holiday list", 2, "dev", done("2026-10-21T09:15:00Z")),
      task("QA leave export", 3, "dev", { blocked: { why: "waiting on test data", at: "2026-10-21T10:05:00Z" } }),
      task("Half-day leave rule", 1, "meera", done("2026-10-21T04:40:00Z")),
      task("Leave policy settings", 5, "meera", {
        request: { hours: 7, why: "3 edge cases in carry-forward", at: "2026-10-21T05:50:00Z", state: "pending" },
      }),
      task("Fix calendar overlap", 2, "sana"),
      task("Leave balance tests", 2, "sana", { carriedFrom: "2026-10-20", carryNote: "blocked" }),
    ],
  };
}

/** Gives every id in the story a fresh one, so each load is its own copy. */
function withFreshIds(project: Project, viewer: string, newId: () => string): { project: Project; viewerId: string } {
  const ids = new Map<string, string>();
  const map = (id: string) => {
    if (!ids.has(id)) ids.set(id, newId());
    return ids.get(id)!;
  };
  project.id = map(project.id);
  project.inviteCode = `atlas-${newId().slice(0, 5)}`;
  for (const m of project.members) m.id = map(m.id);
  for (const p of project.papers) {
    p.closed = Object.fromEntries(Object.entries(p.closed).map(([k, v]) => [map(k), v]));
    for (const t of p.tasks) {
      t.id = map(t.id);
      if (t.assigneeId) t.assigneeId = map(t.assigneeId);
    }
  }
  return { project, viewerId: map(viewer) };
}

/**
 * Wednesday 8:52 am: Tuesday is closed, Wednesday's paper not started.
 * Wednesday afternoon: paper sent, Dev blocked, Meera asked for more time.
 * The viewer (who this browser is on member screens) is Meera.
 */
export function demoStory(moment: "morning" | "afternoon", newId?: () => string): { project: Project; viewerId: string } {
  n = 0;
  const project = baseProject();
  if (moment === "afternoon") project.papers.push(afternoonPaper());
  return newId ? withFreshIds(project, "meera", newId) : { project, viewerId: "meera" };
}
