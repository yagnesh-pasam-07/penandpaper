import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { loadProjects, saveProject, type Q } from "@/db/repo";
import { members, projects } from "@/db/schema";
import { demoStory } from "@/lib/demo";
import { appUrl, emailEnabled, googleEnabled } from "@/lib/env";
import { formatHours } from "@/lib/estimate";
import { ActionError, LEAD_ONLY, TINTS, actingMemberId, applyAction, nameFromEmail, paperFor, uid, type ProjectAction } from "@/lib/mutations";
import { cityFromTz, todayIn, weekday, zonedTime } from "@/lib/time";
import type { Lead, Member, Project } from "@/lib/types";
import { sendMail } from "./email";
import type { User } from "./session";

/* ---------- What the browser gets ---------- */

export type AppState = {
  lead: Lead | null;
  projects: Project[];
  /** projectId -> the member this account is on that project. */
  viewer: Record<string, string>;
  /** Which sign-in methods work in this environment. */
  signIn: { email: boolean; google: boolean };
};

export async function stateFor(q: Q, user: User | null): Promise<AppState> {
  const signIn = { email: emailEnabled || process.env.NODE_ENV !== "production", google: googleEnabled };
  if (!user) return { lead: null, projects: [], viewer: {}, signIn };
  const [owned, joined] = await Promise.all([
    q.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, user.id)),
    q.select({ projectId: members.projectId, id: members.id }).from(members).where(eq(members.userId, user.id)),
  ]);
  const ownedIds = new Set(owned.map((r) => r.id));
  const ids = [...new Set([...ownedIds, ...joined.map((r) => r.projectId)])];
  const viewer = Object.fromEntries(joined.map((r) => [r.projectId, r.id]));
  const stored = await loadProjects(q, ids);
  return {
    lead: { name: user.name, email: user.email },
    viewer,
    signIn,
    projects: stored.map(({ project }) => {
      const isOwner = ownedIds.has(project.id);
      if (isOwner) return { ...project, isOwner };
      // Teammates see each other's names, not their email addresses.
      return { ...project, isOwner, members: project.members.map((m) => (m.id === viewer[project.id] ? m : { ...m, email: "" })) };
    }),
  };
}

/* ---------- Input ---------- */

const id = z.string().regex(/^[a-z0-9-]{6,40}$/);
const day = z.iso.date();
const email = z.email().max(254);
const tz = z
  .string()
  .max(64)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone");
const hours = z.number().min(0.25).max(24);
const at = { projectId: id, date: day };

const projectAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addInvites"), projectId: id, members: z.array(z.object({ id, email })).min(1).max(50) }),
  z.object({ type: z.literal("setLeave"), ...at, memberId: id, leave: z.boolean() }),
  z.object({ type: z.literal("startPaper"), ...at }),
  z.object({ type: z.literal("dropThought"), ...at, taskId: id, text: z.string().trim().min(1).max(200), shape: z.number().int().min(0).max(5) }),
  z.object({ type: z.literal("setEstimate"), ...at, taskId: id, est: hours.nullable() }),
  z.object({ type: z.literal("assign"), ...at, taskId: id, memberId: id.nullable() }),
  z.object({ type: z.literal("removeTask"), ...at, taskId: id }),
  z.object({ type: z.literal("sendPaper"), ...at }),
  z.object({ type: z.literal("toggleDone"), ...at, taskId: id }),
  z.object({ type: z.literal("requestTime"), ...at, taskId: id, hours, why: z.string().max(200) }),
  z.object({ type: z.literal("answerRequest"), ...at, taskId: id, give: z.boolean() }),
  z.object({ type: z.literal("setBlocked"), ...at, taskId: id, why: z.string().max(200).nullable() }),
  z.object({ type: z.literal("closeDay"), ...at, memberId: id, reason: z.enum(["Took longer", "Blocked", "Other work", "Unclear"]).optional() }),
  z.object({ type: z.literal("reopenDay"), ...at, memberId: id }),
  z.object({ type: z.literal("thankTeam"), ...at }),
  z.object({ type: z.literal("advanceDay"), projectId: id }),
]);

const accountAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("createProject"), id, name: z.string().trim().min(1).max(120), hoursPerDay: z.union([z.literal(6), z.literal(8)]), tz }),
  z.object({ type: z.literal("joinProject"), code: z.string().max(40), tz, city: z.string().trim().min(1).max(80) }),
  z.object({ type: z.literal("loadDemo"), moment: z.enum(["morning", "afternoon"]) }),
  z.object({ type: z.literal("deleteDemo") }),
]);

export const anyAction = z.union([projectAction, accountAction]);
export type AnyAction = z.infer<typeof anyAction>;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/* ---------- Handling ---------- */

/** Every action needs a signed-in person. Returns the project it touched, if any. */
export async function handleAction(db: Db, user: User | null, action: AnyAction): Promise<{ projectId?: string }> {
  if (!user) throw new HttpError(401, "Sign in first.");

  switch (action.type) {
    case "createProject": {
      const [taken] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, action.id));
      if (taken) throw new HttpError(409, "That project id is taken. Try again.");
      const slug = action.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-")[0] || "team";
      const project: Project = {
        id: action.id,
        name: action.name,
        leadName: user.name,
        hoursPerDay: action.hoursPerDay,
        inviteCode: `${slug.slice(0, 20)}-${uid().slice(0, 6)}`,
        createdAt: new Date().toISOString(),
        leadTz: action.tz,
        leadCity: cityFromTz(action.tz),
        invitesSent: false,
        members: [],
        currentDate: todayIn(action.tz),
        papers: [],
      };
      await saveProject(db, project, user.id);
      return { projectId: project.id };
    }

    case "joinProject": {
      const [target] = await db.select().from(projects).where(eq(projects.inviteCode, action.code));
      if (!target) throw new HttpError(404, "This invite link doesn't match a project.");
      const team = await db.select().from(members).where(eq(members.projectId, target.id)).orderBy(members.position);
      if (team.some((m) => m.userId === user.id)) return { projectId: target.id };
      // The signed-in address is verified, so it can claim the invite sent to it.
      const invited = team.find((m) => !m.userId && m.email.toLowerCase() === user.email.toLowerCase());
      if (invited) {
        await db.update(members).set({ userId: user.id, status: "joined", tz: action.tz, city: action.city }).where(eq(members.id, invited.id));
      } else {
        await db.insert(members).values({
          id: uid(),
          projectId: target.id,
          userId: user.id,
          name: user.name || nameFromEmail(user.email),
          email: user.email,
          tz: action.tz,
          city: action.city,
          hours: target.hoursPerDay,
          tint: TINTS[team.length % TINTS.length],
          status: "joined",
          leave: [],
          position: team.length,
        });
      }
      return { projectId: target.id };
    }

    case "loadDemo": {
      // One demo per person: loading again replaces it.
      await db.delete(projects).where(and(eq(projects.ownerId, user.id), eq(projects.isDemo, true)));
      const { project, viewerId } = demoStory(action.moment, uid);
      project.leadName = user.name;
      await db.transaction(async (tx) => {
        await saveProject(tx, project, user.id, { isDemo: true });
        // This browser plays Meera on the member screens.
        await tx.update(members).set({ userId: user.id }).where(eq(members.id, viewerId));
      });
      return { projectId: project.id };
    }

    case "deleteDemo": {
      await db.delete(projects).where(and(eq(projects.ownerId, user.id), eq(projects.isDemo, true)));
      return {};
    }

    default:
      return runProjectAction(db, user, action);
  }
}

async function runProjectAction(db: Db, user: User, action: ProjectAction): Promise<{ projectId: string }> {
  const { before, after, isDemo } = await db.transaction(async (tx) => {
    // Lock the project row so two people changing it at once take turns.
    const locked = await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, action.projectId)).for("update");
    if (!locked.length) throw new HttpError(404, "That project doesn't exist.");
    const [stored] = await loadProjects(tx, [action.projectId]);
    const isOwner = stored.ownerId === user.id;

    if (!isOwner) {
      if (LEAD_ONLY.has(action.type)) throw new HttpError(403, "Only the project's lead can do that.");
      const memberId = actingMemberId(stored.project, action);
      if (!memberId || stored.memberAccounts[memberId] !== user.id) throw new HttpError(403, "That isn't on your paper.");
    }

    const before = structuredClone(stored.project);
    try {
      applyAction(stored.project, action, new Date().toISOString());
    } catch (e) {
      if (e instanceof ActionError) throw new HttpError(400, e.message);
      throw e;
    }
    await saveProject(tx, stored.project, stored.ownerId);
    return { before, after: stored.project, isDemo: stored.isDemo };
  });

  // Email goes out only after the change is saved, and never for the demo's made-up people.
  if (!isDemo) {
    if (action.type === "addInvites") await sendInvites(before, after);
    if (action.type === "sendPaper" && paperFor(before, action.date)?.status !== "sent") await sendPapers(after, action.date);
  }
  return { projectId: action.projectId };
}

async function sendInvites(before: Project, after: Project) {
  const added = after.members.filter((m) => !before.members.some((b) => b.id === m.id));
  await Promise.all(
    added.map((m) =>
      sendMail({
        to: m.email,
        subject: `${after.leadName} added you to ${after.name}`,
        heading: `${after.leadName} added you to ${after.name}`,
        lines: [
          "Pen & Paper is how your team plans the day.",
          "Your paper arrives at 9:00, your time. Tap a task to strike it out. Need more time? Say so in one tap.",
        ],
        cta: { label: "Join the team", url: `${appUrl}/join/${after.inviteCode}` },
      }),
    ),
  );
}

/** Each person's paper, scheduled for 9:00 in their own time zone (now, if that's already past). */
async function sendPapers(project: Project, date: string) {
  const paper = paperFor(project, date);
  if (!paper) return;
  const people = project.members.filter((m: Member) => paper.tasks.some((t) => t.assigneeId === m.id));
  await Promise.all(
    people.map((m) => {
      const mine = paper.tasks.filter((t) => t.assigneeId === m.id);
      const total = mine.reduce((s, t) => s + (t.est ?? 0), 0);
      const nine = zonedTime(date, 9, 0, m.tz);
      return sendMail({
        to: m.email,
        subject: `Your ${weekday(date)} paper is ready`,
        heading: `Your ${weekday(date)} paper is ready`,
        lines: [`${mine.length} ${mine.length === 1 ? "task" : "tasks"} · ${formatHours(total)} · from ${project.leadName}`, ...mine.map((t) => `• ${t.title}`)],
        cta: { label: "Open my paper", url: `${appUrl}/me/${project.id}/today` },
        scheduledAt: nine.getTime() > Date.now() + 60_000 ? nine.toISOString() : undefined,
      });
    }),
  );
}

/** What the join screen shows before someone joins. */
export async function joinPreview(db: Db, user: User | null, code: string) {
  const [row] = await db.select({ id: projects.id, name: projects.name, leadName: projects.leadName }).from(projects).where(eq(projects.inviteCode, code));
  if (!row) return null;
  const [mine] = user
    ? await db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.projectId, row.id), eq(members.userId, user.id)))
    : [];
  return { ...row, joined: Boolean(mine), signedInAs: user?.email ?? null };
}
