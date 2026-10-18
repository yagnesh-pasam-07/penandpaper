import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { loadProjects, saveProject, type Q } from "@/db/repo";
import { accounts, members, projects } from "@/db/schema";
import { DEMO_LEAD, DEMO_PROJECT_NAME, demoStory } from "@/lib/demo";
import { ActionError, LEAD_ONLY, TINTS, actingMemberId, applyAction, nameFromEmail, uid, type ProjectAction } from "@/lib/mutations";
import { cityFromTz, todayIn } from "@/lib/time";
import type { Lead, Project } from "@/lib/types";
import { createAccount, currentAccount, endSession, type Account } from "./session";

/* ---------- What the browser gets ---------- */

export type AppState = {
  lead: Lead | null;
  projects: Project[];
  /** projectId -> the member this account is on that project. */
  viewer: Record<string, string>;
};

export async function stateFor(q: Q, account: Account | null): Promise<AppState> {
  if (!account) return { lead: null, projects: [], viewer: {} };
  const [owned, joined] = await Promise.all([
    q.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, account.id)),
    q.select({ projectId: members.projectId, id: members.id }).from(members).where(eq(members.accountId, account.id)),
  ]);
  const ownedIds = new Set(owned.map((r) => r.id));
  const ids = [...new Set([...ownedIds, ...joined.map((r) => r.projectId)])];
  const viewer = Object.fromEntries(joined.map((r) => [r.projectId, r.id]));
  const stored = await loadProjects(q, ids);
  return {
    lead: { name: account.name, email: account.email },
    viewer,
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
const tz = z.string().max(64).refine((v) => {
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
  z.object({
    type: z.literal("closeDay"),
    ...at,
    memberId: id,
    reason: z.enum(["Took longer", "Blocked", "Other work", "Unclear"]).optional(),
  }),
  z.object({ type: z.literal("reopenDay"), ...at, memberId: id }),
  z.object({ type: z.literal("thankTeam"), ...at }),
  z.object({ type: z.literal("advanceDay"), projectId: id }),
]);

const accountAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("signUp"), email }),
  z.object({ type: z.literal("createProject"), id, name: z.string().trim().min(1).max(120), hoursPerDay: z.union([z.literal(6), z.literal(8)]), tz }),
  z.object({ type: z.literal("joinProject"), code: z.string().max(40), email, tz, city: z.string().trim().min(1).max(80) }),
  z.object({ type: z.literal("loadDemo"), moment: z.enum(["morning", "afternoon"]) }),
  z.object({ type: z.literal("reset") }),
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

/** Applies one action for the signed-in account. Returns the project it touched, if any. */
export async function handleAction(db: Db, action: AnyAction): Promise<{ projectId?: string }> {
  switch (action.type) {
    case "signUp": {
      const account = await currentAccount(db);
      if (account) await db.update(accounts).set({ email: action.email, name: nameFromEmail(action.email) }).where(eq(accounts.id, account.id));
      else await createAccount(db, action.email, nameFromEmail(action.email));
      return {};
    }

    case "createProject": {
      const account = await currentAccount(db);
      if (!account) throw new HttpError(401, "Sign up first.");
      const project: Project = {
        id: action.id,
        name: action.name,
        leadName: account.name,
        hoursPerDay: action.hoursPerDay,
        inviteCode: `${action.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-")[0] || "team"}-${uid().slice(0, 5)}`,
        createdAt: new Date().toISOString(),
        leadTz: action.tz,
        leadCity: cityFromTz(action.tz),
        invitesSent: false,
        members: [],
        currentDate: todayIn(action.tz),
        papers: [],
      };
      const [taken] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, action.id));
      if (taken) throw new HttpError(409, "That project id is taken. Try again.");
      await saveProject(db, project, account.id);
      return { projectId: project.id };
    }

    case "joinProject": {
      const [target] = await db.select().from(projects).where(eq(projects.inviteCode, action.code));
      if (!target) throw new HttpError(404, "This invite link doesn't match a project.");
      const account = (await currentAccount(db)) ?? (await createAccount(db, action.email, nameFromEmail(action.email)));
      const team = await db.select().from(members).where(eq(members.projectId, target.id)).orderBy(members.position);
      const invited = team.find((m) => m.email.toLowerCase() === action.email.toLowerCase());
      if (invited) {
        await db
          .update(members)
          .set({ accountId: account.id, status: "joined", tz: action.tz, city: action.city })
          .where(eq(members.id, invited.id));
      } else {
        await db.insert(members).values({
          id: uid(),
          projectId: target.id,
          accountId: account.id,
          name: nameFromEmail(action.email),
          email: action.email,
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
      const account = (await currentAccount(db)) ?? (await createAccount(db, DEMO_LEAD.email, DEMO_LEAD.name));
      // One demo per account: loading again replaces it.
      await db.delete(projects).where(and(eq(projects.ownerId, account.id), eq(projects.name, DEMO_PROJECT_NAME), eq(projects.leadName, DEMO_LEAD.name)));
      const { project, viewerId } = demoStory(action.moment, uid);
      await db.transaction(async (tx) => {
        await saveProject(tx, project, account.id);
        // This browser plays Meera on the member screens.
        await tx.update(members).set({ accountId: account.id }).where(eq(members.id, viewerId));
      });
      return { projectId: project.id };
    }

    case "reset": {
      const account = await currentAccount(db);
      if (account) await db.delete(accounts).where(eq(accounts.id, account.id));
      await endSession();
      return {};
    }

    default:
      return runProjectAction(db, action);
  }
}

async function runProjectAction(db: Db, action: ProjectAction): Promise<{ projectId: string }> {
  const account = await currentAccount(db);
  if (!account) throw new HttpError(401, "Sign in first.");

  await db.transaction(async (tx) => {
    // Lock the project row so two people changing it at once take turns.
    const locked = await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, action.projectId)).for("update");
    if (!locked.length) throw new HttpError(404, "That project doesn't exist.");
    const [stored] = await loadProjects(tx, [action.projectId]);
    const isOwner = stored.ownerId === account.id;

    if (!isOwner) {
      if (LEAD_ONLY.has(action.type)) throw new HttpError(403, "Only the project's lead can do that.");
      const memberId = actingMemberId(stored.project, action);
      if (!memberId || stored.memberAccounts[memberId] !== account.id) throw new HttpError(403, "That isn't on your paper.");
    }

    try {
      applyAction(stored.project, action, new Date().toISOString());
    } catch (e) {
      if (e instanceof ActionError) throw new HttpError(400, e.message);
      throw e;
    }
    await saveProject(tx, stored.project, stored.ownerId);
  });
  return { projectId: action.projectId };
}

/** What the join screen shows before someone joins. */
export async function joinPreview(db: Db, code: string) {
  const [row] = await db
    .select({ id: projects.id, name: projects.name, leadName: projects.leadName })
    .from(projects)
    .where(eq(projects.inviteCode, code));
  if (!row) return null;
  const account = await currentAccount(db);
  const [mine] = account
    ? await db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.projectId, row.id), eq(members.accountId, account.id)))
    : [];
  return { ...row, joined: Boolean(mine) };
}

