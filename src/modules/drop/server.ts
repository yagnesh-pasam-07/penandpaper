import "server-only";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { users } from "@/db/schema";
import { uid } from "@/lib/mutations";
import { todayIn } from "@/lib/time";
import { DROP_TIMEZONE, rollover, type DropPaper, type Thought } from "./logic";
import { dropPapers, dropThoughts } from "./schema";

const db = httpDb;

export function dropToday(): string {
  return todayIn(process.env.DROP_TIMEZONE || DROP_TIMEZONE);
}

type ThoughtRow = typeof dropThoughts.$inferSelect;

function toThought(r: ThoughtRow): Thought {
  return {
    id: r.id,
    text: r.text,
    status: r.status,
    shape: r.shape,
    createdAt: new Date(r.createdAt).toISOString(),
    doneAt: r.doneAt ? new Date(r.doneAt).toISOString() : null,
    carriedFrom: r.carriedFrom,
    x: r.x,
    y: r.y,
  };
}

async function thoughtsOf(paperId: string): Promise<Thought[]> {
  const rows = await db.select().from(dropThoughts).where(eq(dropThoughts.paperId, paperId)).orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id));
  return rows.map(toThought);
}

/**
 * Today's paper, made on first open of the day. Making it also brings over the
 * last paper's unstruck thoughts; if two requests race, only the one that made
 * the paper copies them.
 */
async function ensureTodayPaper(userId: string): Promise<{ id: string; date: string }> {
  const date = dropToday();
  const [existing] = await db
    .select({ id: dropPapers.id })
    .from(dropPapers)
    .where(and(eq(dropPapers.userId, userId), eq(dropPapers.date, date)));
  if (existing) return { id: existing.id, date };

  const [created] = await db.insert(dropPapers).values({ userId, date }).onConflictDoNothing().returning({ id: dropPapers.id });
  if (!created) {
    const [row] = await db
      .select({ id: dropPapers.id })
      .from(dropPapers)
      .where(and(eq(dropPapers.userId, userId), eq(dropPapers.date, date)));
    return { id: row.id, date };
  }

  const [prev] = await db
    .select()
    .from(dropPapers)
    .where(and(eq(dropPapers.userId, userId), lt(dropPapers.date, date)))
    .orderBy(desc(dropPapers.date))
    .limit(1);
  if (prev) {
    const carried = rollover({ date: prev.date, thoughts: await thoughtsOf(prev.id) }, uid);
    if (carried.length) {
      await db.insert(dropThoughts).values(
        carried.map((t) => ({ id: t.id, paperId: created.id, userId, text: t.text, status: t.status, shape: t.shape, createdAt: t.createdAt, carriedFrom: t.carriedFrom, x: t.x, y: t.y })),
      );
    }
  }
  return { id: created.id, date };
}

export async function getToday(userId: string): Promise<DropPaper> {
  const paper = await ensureTodayPaper(userId);
  return { date: paper.date, thoughts: await thoughtsOf(paper.id) };
}

export async function addThought(userId: string, input: { id: string; text: string; shape: number }): Promise<Thought> {
  const paper = await ensureTodayPaper(userId);
  const [row] = await db
    .insert(dropThoughts)
    .values({ id: input.id, paperId: paper.id, userId, text: input.text, shape: input.shape })
    .onConflictDoNothing()
    .returning();
  if (row) return toThought(row);
  // Same id sent twice (a retry): return what's there, if it's theirs.
  const [again] = await db.select().from(dropThoughts).where(and(eq(dropThoughts.id, input.id), eq(dropThoughts.userId, userId)));
  if (!again) throw new Error("conflict");
  return toThought(again);
}

/** Only today's thoughts can change; past papers are read-only. Returns null if not found. */
export async function updateThought(userId: string, id: string, patch: { text?: string; status?: "open" | "done" }): Promise<Thought | null> {
  const today = await ensureTodayPaper(userId);
  const [row] = await db
    .update(dropThoughts)
    .set({
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.status ? { status: patch.status, doneAt: patch.status === "done" ? sql`now()` : null } : {}),
    })
    .where(and(eq(dropThoughts.id, id), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, today.id)))
    .returning();
  return row ? toThought(row) : null;
}

export async function deleteThought(userId: string, id: string): Promise<boolean> {
  const today = await ensureTodayPaper(userId);
  const rows = await db
    .delete(dropThoughts)
    .where(and(eq(dropThoughts.id, id), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, today.id)))
    .returning({ id: dropThoughts.id });
  return rows.length > 0;
}

/**
 * Moves thoughts on today's paper; a null spot sends one back into the flow.
 * Thoughts that aren't on today's paper are skipped. Returns how many moved.
 */
export async function arrangeThoughts(userId: string, placements: { id: string; x: number | null; y: number | null }[]): Promise<number> {
  const today = await ensureTodayPaper(userId);
  if (!placements.length) return 0;
  const ids = placements.map((p) => p.id);
  const xs = sql.join(placements.map((p) => sql`when ${p.id} then ${p.x}::real`), sql` `);
  const ys = sql.join(placements.map((p) => sql`when ${p.id} then ${p.y}::real`), sql` `);
  const rows = await db
    .update(dropThoughts)
    .set({ x: sql`case ${dropThoughts.id} ${xs} end`, y: sql`case ${dropThoughts.id} ${ys} end` })
    .where(and(inArray(dropThoughts.id, ids), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, today.id)))
    .returning({ id: dropThoughts.id });
  return rows.length;
}

/** Sends every thought on today's paper back into the flow. */
export async function tidyToday(userId: string): Promise<void> {
  const today = await ensureTodayPaper(userId);
  await db
    .update(dropThoughts)
    .set({ x: null, y: null })
    .where(and(eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, today.id)));
}

export type PaperSummary = { date: string; total: number; done: number };

/** Past papers, newest first, with how many thoughts and how many struck. */
export async function listHistory(userId: string): Promise<PaperSummary[]> {
  const today = dropToday();
  const rows = await db
    .select({
      date: dropPapers.date,
      total: sql<number>`count(${dropThoughts.id})::int`,
      done: sql<number>`count(${dropThoughts.id}) filter (where ${dropThoughts.status} = 'done')::int`,
    })
    .from(dropPapers)
    .leftJoin(dropThoughts, eq(dropThoughts.paperId, dropPapers.id))
    .where(and(eq(dropPapers.userId, userId), lt(dropPapers.date, today)))
    .groupBy(dropPapers.date)
    .orderBy(desc(dropPapers.date))
    .limit(365);
  return rows.filter((r) => r.total > 0);
}

export async function getPaper(userId: string, date: string): Promise<DropPaper | null> {
  const [paper] = await db
    .select()
    .from(dropPapers)
    .where(and(eq(dropPapers.userId, userId), eq(dropPapers.date, date)));
  if (!paper) return null;
  return { date, thoughts: await thoughtsOf(paper.id) };
}

/** Everyone whose paper today has at least one thought dropped today. */
export async function digestsFor(date: string): Promise<{ email: string; name: string; paper: DropPaper }[]> {
  const papers = await db
    .select({ id: dropPapers.id, email: users.email, name: users.name })
    .from(dropPapers)
    .innerJoin(users, eq(users.id, dropPapers.userId))
    .where(eq(dropPapers.date, date));
  const out = [];
  for (const p of papers) {
    const thoughts = await thoughtsOf(p.id);
    if (thoughts.some((t) => !t.carriedFrom)) out.push({ email: p.email, name: p.name, paper: { date, thoughts } });
  }
  return out;
}
