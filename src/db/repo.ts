import "server-only";
import { and, eq, getTableColumns, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Member, Paper, Project, Task, Tint } from "@/lib/types";
import type { Db } from "./index";
import { members, papers, projects, tasks } from "./schema";

/** A database handle or an open transaction. */
export type Q = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export type StoredProject = {
  project: Project;
  ownerId: string;
  isDemo: boolean;
  /** memberId -> the user who joined as that member. */
  memberAccounts: Record<string, string | null>;
};

/** `col = excluded.col` for an upsert, by property name. */
function excluded<T extends PgTable>(table: T, keys: (keyof T["_"]["columns"] & string)[]): Record<string, SQL> {
  const cols = getTableColumns(table);
  return Object.fromEntries(keys.map((k) => [k, sql.raw(`excluded."${cols[k].name}"`)]));
}

export async function loadProjects(q: Q, ids: string[]): Promise<StoredProject[]> {
  if (!ids.length) return [];
  const [pRows, mRows, paperRows, tRows] = await Promise.all([
    q.select().from(projects).where(inArray(projects.id, ids)),
    q.select().from(members).where(inArray(members.projectId, ids)).orderBy(members.position),
    q.select().from(papers).where(inArray(papers.projectId, ids)).orderBy(papers.date),
    q.select().from(tasks).where(inArray(tasks.projectId, ids)).orderBy(tasks.position),
  ]);

  return pRows
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((p) => {
      const mine = mRows.filter((m) => m.projectId === p.id);
      const project: Project = {
        id: p.id,
        name: p.name,
        leadName: p.leadName,
        hoursPerDay: p.hoursPerDay === 6 ? 6 : 8,
        inviteCode: p.inviteCode,
        createdAt: p.createdAt.toISOString(),
        leadTz: p.leadTz,
        leadCity: p.leadCity,
        invitesSent: p.invitesSent,
        currentDate: p.currentDate,
        members: mine.map(
          (m): Member => ({
            id: m.id,
            name: m.name,
            email: m.email,
            tz: m.tz,
            city: m.city,
            hours: m.hours,
            tint: m.tint as Tint,
            status: m.status === "joined" ? "joined" : "invited",
            leave: m.leave,
          }),
        ),
        papers: paperRows
          .filter((r) => r.projectId === p.id)
          .map(
            (r): Paper => ({
              date: r.date,
              status: r.status === "sent" ? "sent" : "draft",
              sentAt: r.sentAt ? new Date(r.sentAt).toISOString() : undefined,
              closed: r.closed,
              thanked: r.thanked || undefined,
              tasks: tRows
                .filter((t) => t.projectId === p.id && t.paperDate === r.date)
                .map(
                  (t): Task => ({
                    id: t.id,
                    title: t.title,
                    est: t.est,
                    assigneeId: t.assigneeId,
                    done: t.done,
                    doneAt: t.doneAt ? new Date(t.doneAt).toISOString() : undefined,
                    carriedFrom: t.carriedFrom ?? undefined,
                    carryNote: t.carryNote ?? undefined,
                    blocked: t.blocked ?? undefined,
                    request: t.request ?? undefined,
                    shape: t.shape,
                  }),
                ),
            }),
          ),
      };
      return { project, ownerId: p.ownerId, isDemo: p.isDemo, memberAccounts: Object.fromEntries(mine.map((m) => [m.id, m.userId])) };
    });
}

/** Writes the whole project back: upserts what's there, deletes what was removed. */
export async function saveProject(q: Q, project: Project, ownerId: string, opts: { isDemo?: boolean } = {}): Promise<void> {
  await q
    .insert(projects)
    .values({
      id: project.id,
      ownerId,
      name: project.name,
      leadName: project.leadName,
      hoursPerDay: project.hoursPerDay,
      inviteCode: project.inviteCode,
      leadTz: project.leadTz,
      leadCity: project.leadCity,
      invitesSent: project.invitesSent,
      currentDate: project.currentDate,
      isDemo: opts.isDemo ?? false,
      createdAt: new Date(project.createdAt),
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: excluded(projects, ["name", "hoursPerDay", "leadTz", "leadCity", "invitesSent", "currentDate"]),
    });

  const memberIds = project.members.map((m) => m.id);
  if (memberIds.length) {
    await q
      .insert(members)
      .values(
        project.members.map((m, position) => ({
          id: m.id,
          projectId: project.id,
          name: m.name,
          email: m.email,
          tz: m.tz,
          city: m.city,
          hours: m.hours,
          tint: m.tint,
          status: m.status,
          leave: m.leave,
          position,
        })),
      )
      // userId is only ever set by joining, never by a save.
      .onConflictDoUpdate({
        target: members.id,
        set: excluded(members, ["name", "email", "tz", "city", "hours", "tint", "status", "leave", "position"]),
      });
  }
  await q
    .delete(members)
    .where(memberIds.length ? and(eq(members.projectId, project.id), notInArray(members.id, memberIds)) : eq(members.projectId, project.id));

  const dates = project.papers.map((p) => p.date);
  if (dates.length) {
    await q
      .insert(papers)
      .values(
        project.papers.map((p) => ({
          projectId: project.id,
          date: p.date,
          status: p.status,
          sentAt: p.sentAt ?? null,
          closed: p.closed,
          thanked: Boolean(p.thanked),
        })),
      )
      .onConflictDoUpdate({ target: [papers.projectId, papers.date], set: excluded(papers, ["status", "sentAt", "closed", "thanked"]) });
  }
  await q
    .delete(papers)
    .where(dates.length ? and(eq(papers.projectId, project.id), notInArray(papers.date, dates)) : eq(papers.projectId, project.id));

  const taskRows = project.papers.flatMap((p) =>
    p.tasks.map((t, position) => ({
      id: t.id,
      projectId: project.id,
      paperDate: p.date,
      position,
      title: t.title,
      est: t.est,
      assigneeId: t.assigneeId,
      done: t.done,
      doneAt: t.doneAt ?? null,
      carriedFrom: t.carriedFrom ?? null,
      carryNote: t.carryNote ?? null,
      blocked: t.blocked ?? null,
      request: t.request ?? null,
      shape: t.shape,
    })),
  );
  if (taskRows.length) {
    await q
      .insert(tasks)
      .values(taskRows)
      .onConflictDoUpdate({
        target: tasks.id,
        set: excluded(tasks, [
          "paperDate",
          "position",
          "title",
          "est",
          "assigneeId",
          "done",
          "doneAt",
          "carriedFrom",
          "carryNote",
          "blocked",
          "request",
          "shape",
        ]),
      });
  }
  const taskIds = taskRows.map((t) => t.id);
  await q
    .delete(tasks)
    .where(taskIds.length ? and(eq(tasks.projectId, project.id), notInArray(tasks.id, taskIds)) : eq(tasks.projectId, project.id));
}
