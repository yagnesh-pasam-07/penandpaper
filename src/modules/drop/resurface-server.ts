import "server-only";
import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { dropPapers, dropPrefs, dropThoughts } from "./schema";
import { dayRange } from "./tonight";
import { addDays } from "@/lib/time";
import { agoText, groupRewind, MAX_STEP, resolve, weekStart, type Resolution, type RewindGroup } from "./resurface";

const db = httpDb;

/** The one thought that comes back this morning. */
export type ResurfaceCard = { id: string; text: string; image: string | null; createdAt: string; ago: string; paperId: string; paperName: string | null };

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
 * Today's thought, if one is due: still open, not crumpled, on a paper that
 * isn't deleted, not done coming back, and due (its own `resurfaceAt`, or a
 * day after it was written when it has never come back). Among the due ones,
 * the oldest first, so nothing waits forever. Null when nothing is due, or
 * when the person switched it off.
 */
export async function todaysResurface(userId: string, now: Date = new Date()): Promise<ResurfaceCard | null> {
  if (!(await resurfaceOn(userId))) return null;
  const at = now.toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const [r] = await db
      .select({
        id: dropThoughts.id,
        text: dropThoughts.text,
        image: dropThoughts.image,
        createdAt: dropThoughts.createdAt,
        paperId: dropPapers.id,
        paperName: dropPapers.name,
      })
      .from(dropThoughts)
      .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
      .where(
        and(
          eq(dropThoughts.userId, userId),
          eq(dropThoughts.status, "open"),
          isNull(dropThoughts.crumpledAt),
          isNull(dropPapers.deletedAt),
          eq(dropThoughts.resurfaceDone, false),
          or(lte(dropThoughts.resurfaceAt, at), and(isNull(dropThoughts.resurfaceAt), lte(dropThoughts.createdAt, dayAgo))),
          // A picture with no words has nothing to remind you of in a card.
          sql`length(trim(${dropThoughts.text})) > 0`,
        ),
      )
      .orderBy(asc(sql`coalesce(${dropThoughts.resurfaceAt}, ${dropThoughts.createdAt})`), asc(dropThoughts.id))
      .limit(1);
    return r ? { id: r.id, text: r.text, image: r.image, createdAt: new Date(r.createdAt).toISOString(), ago: agoText(r.createdAt, now), paperId: r.paperId, paperName: r.paperName } : null;
  } catch {
    // Before `npm run db:migrate` the columns aren't there: nothing comes back yet.
    return null;
  }
}

/**
 * Settles a thought that came back: do it (struck), keep (later in the 1 → 7 →
 * 30 rhythm), let go, or later (tomorrow). False when it isn't theirs.
 */
export async function resolveResurface(userId: string, thoughtId: string, choice: Resolution, now: Date = new Date()): Promise<boolean> {
  const [t] = await db
    .select({ step: dropThoughts.resurfaceStep, at: dropThoughts.resurfaceAt })
    .from(dropThoughts)
    .where(and(eq(dropThoughts.id, thoughtId), eq(dropThoughts.userId, userId), isNull(dropThoughts.crumpledAt)));
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
