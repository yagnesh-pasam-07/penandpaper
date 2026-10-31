import "server-only";
import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { dropPapers, dropPrefs, dropThoughts } from "./schema";
import { dayRange } from "./tonight";
import { addDays } from "@/lib/time";
import { groupRewind, MAX_STEP, resolve, weekStart, type Resolution, type RewindGroup } from "./resurface";

const db = httpDb;

/** Whether this person wants thoughts to come back (on unless switched off, or before the column exists). */
export async function resurfaceOn(userId: string): Promise<boolean> {
  try {
    const [row] = await db.select({ on: dropPrefs.resurface }).from(dropPrefs).where(eq(dropPrefs.userId, userId));
    return row?.on ?? true;
  } catch {
    return true;
  }
}

export async function setResurface(userId: string, on: boolean): Promise<void> {
  await db.insert(dropPrefs).values({ userId, resurface: on }).onConflictDoUpdate({ target: dropPrefs.userId, set: { resurface: on } });
}

/**
 * Settles a thought that came back: do it (struck), keep (later in the 1 → 7 →
 * 30 rhythm), let go, or later (tomorrow). False when it isn't theirs.
 */
export async function resolveResurface(userId: string, thoughtId: string, choice: Resolution, now: Date = new Date()): Promise<boolean> {
  const [t] = await db
    .select({ step: dropThoughts.resurfaceStep, at: dropThoughts.resurfaceAt })
    .from(dropThoughts)
    .where(and(eq(dropThoughts.id, thoughtId), eq(dropThoughts.userId, userId), isNull(dropThoughts.crumpledAt), isNull(dropThoughts.image), eq(dropThoughts.kind, "note")));
  if (!t) return false;
  const next = resolve({ step: t.step, dueAt: t.at }, choice, now);
  await db
    .update(dropThoughts)
    .set({
      resurfaceStep: next.step,
      resurfaceAt: next.dueAt,
      resurfaceDone: next.dueAt === null || next.step >= MAX_STEP,
      ...(next.strike ? { status: "done" as const, doneAt: sql`coalesce(${dropThoughts.doneAt}, now())` } : {}),
    })
    .where(and(eq(dropThoughts.id, thoughtId), eq(dropThoughts.userId, userId)));
  return true;
}

/** The week so far (Monday to the end of today, in the viewer's zone), grouped by paper. */
export async function rewindWeek(userId: string, tz: string, today: string): Promise<{ from: string; to: string; groups: RewindGroup[] }> {
  const from = weekStart(today);
  const start = dayRange(tz, from).start;
  const end = dayRange(tz, today).end;
  const rows = await db
    .select({
      id: dropThoughts.id,
      text: dropThoughts.text,
      status: dropThoughts.status,
      createdAt: dropThoughts.createdAt,
      paperId: dropPapers.id,
      paperName: dropPapers.name,
      hasImage: sql<boolean>`${dropThoughts.image} is not null`,
    })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .where(and(eq(dropThoughts.userId, userId), isNull(dropThoughts.crumpledAt), isNull(dropPapers.deletedAt), gte(dropThoughts.createdAt, start.toISOString()), lt(dropThoughts.createdAt, end.toISOString())))
    .orderBy(desc(dropThoughts.createdAt))
    .limit(500);
  return {
    from,
    to: addDays(from, 6),
    groups: groupRewind(rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString() }))),
  };
}
