import "server-only";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { users } from "@/db/schema";
import { uid } from "@/lib/mutations";
import { todayIn } from "@/lib/time";
import { applyStackOp, DROP_TIMEZONE, rollover, settleStacks, type DropPaper, type Stack, type StackOp, type Thought } from "./logic";
import { dropPapers, dropStacks, dropThoughts } from "./schema";

const db = httpDb;

export function dropToday(): string {
  return todayIn(process.env.DROP_TIMEZONE || DROP_TIMEZONE);
}

type ThoughtRow = typeof dropThoughts.$inferSelect;
type StackRow = typeof dropStacks.$inferSelect;

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
    stackId: r.stackId,
    stackOrder: r.stackOrder,
  };
}

function toStack(r: StackRow): Stack {
  return { id: r.id, name: r.name, x: r.x, y: r.y, createdAt: new Date(r.createdAt).toISOString(), carriedFrom: r.carriedFrom };
}

async function thoughtsOf(paperId: string): Promise<Thought[]> {
  const rows = await db.select().from(dropThoughts).where(eq(dropThoughts.paperId, paperId)).orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id));
  return rows.map(toThought);
}

async function stacksOf(paperId: string): Promise<Stack[]> {
  const rows = await db.select().from(dropStacks).where(eq(dropStacks.paperId, paperId)).orderBy(asc(dropStacks.createdAt), asc(dropStacks.id));
  return rows.map(toStack);
}

async function contentsOf(paperId: string, date: string): Promise<DropPaper> {
  const [thoughts, stacks] = await Promise.all([thoughtsOf(paperId), stacksOf(paperId)]);
  return { date, thoughts, stacks };
}

/**
 * Today's paper, made on first open of the day. Making it also brings over the
 * last paper's unstruck thoughts (and their stacks); if two requests race, only
 * the one that made the paper copies them.
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
    const carried = rollover(await contentsOf(prev.id, prev.date), uid);
    // Stacks first: carried thoughts point at them.
    if (carried.stacks.length) await db.insert(dropStacks).values(carried.stacks.map((s) => stackRow(s, created.id, userId)));
    if (carried.thoughts.length) await db.insert(dropThoughts).values(carried.thoughts.map((t) => thoughtRow(t, created.id, userId)));
  }
  return { id: created.id, date };
}

function stackRow(s: Stack, paperId: string, userId: string): typeof dropStacks.$inferInsert {
  return { id: s.id, paperId, userId, name: s.name, x: s.x, y: s.y, createdAt: s.createdAt, carriedFrom: s.carriedFrom };
}

function thoughtRow(t: Thought, paperId: string, userId: string): typeof dropThoughts.$inferInsert {
  return {
    id: t.id,
    paperId,
    userId,
    text: t.text,
    status: t.status,
    shape: t.shape,
    createdAt: t.createdAt,
    carriedFrom: t.carriedFrom,
    x: t.x,
    y: t.y,
    stackId: t.stackId,
    stackOrder: t.stackOrder,
  };
}

/**
 * Saves the difference between two versions of today's paper, in one batch:
 * new stacks, moved or regrouped thoughts, renamed or moved stacks, and what
 * went away.
 */
async function saveChanges(paperId: string, userId: string, before: DropPaper, after: DropPaper): Promise<void> {
  const queries = [];
  const oldStacks = new Map(before.stacks.map((s) => [s.id, s]));
  const newStacks = new Map(after.stacks.map((s) => [s.id, s]));
  const added = after.stacks.filter((s) => !oldStacks.has(s.id));
  if (added.length) queries.push(db.insert(dropStacks).values(added.map((s) => stackRow(s, paperId, userId))));
  for (const s of after.stacks) {
    const was = oldStacks.get(s.id);
    if (was && (was.name !== s.name || was.x !== s.x || was.y !== s.y)) {
      queries.push(db.update(dropStacks).set({ name: s.name, x: s.x, y: s.y }).where(and(eq(dropStacks.id, s.id), eq(dropStacks.paperId, paperId))));
    }
  }
  const kept = new Map(after.thoughts.map((t) => [t.id, t]));
  for (const was of before.thoughts) {
    const t = kept.get(was.id);
    if (t && (t.stackId !== was.stackId || t.stackOrder !== was.stackOrder || t.x !== was.x || t.y !== was.y)) {
      queries.push(
        db
          .update(dropThoughts)
          .set({ stackId: t.stackId, stackOrder: t.stackOrder, x: t.x, y: t.y })
          .where(and(eq(dropThoughts.id, t.id), eq(dropThoughts.paperId, paperId))),
      );
    }
  }
  const gone = before.thoughts.filter((t) => !kept.has(t.id)).map((t) => t.id);
  if (gone.length) queries.push(db.delete(dropThoughts).where(and(inArray(dropThoughts.id, gone), eq(dropThoughts.paperId, paperId))));
  const goneStacks = before.stacks.filter((s) => !newStacks.has(s.id)).map((s) => s.id);
  if (goneStacks.length) queries.push(db.delete(dropStacks).where(and(inArray(dropStacks.id, goneStacks), eq(dropStacks.paperId, paperId))));
  if (queries.length) await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
}

export async function getToday(userId: string): Promise<DropPaper> {
  const paper = await ensureTodayPaper(userId);
  return contentsOf(paper.id, paper.date);
}

/** Groups, regroups, renames or throws away stacks on today's paper. Throws StackError when it doesn't fit. */
export async function changeStacks(userId: string, op: StackOp): Promise<DropPaper> {
  const paper = await ensureTodayPaper(userId);
  const before = await contentsOf(paper.id, paper.date);
  const after = applyStackOp(before, op);
  await saveChanges(paper.id, userId, before, after);
  return after;
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
    .returning({ id: dropThoughts.id, stackId: dropThoughts.stackId });
  if (!rows.length) return false;
  // Taking one from a pair leaves a stack of one: it dissolves.
  if (rows[0].stackId) {
    const before = await contentsOf(today.id, today.date);
    await saveChanges(today.id, userId, before, settleStacks(before));
  }
  return true;
}

/**
 * Moves thoughts and stacks on today's paper; a null spot sends one back into
 * the flow. Ids that aren't on today's paper are skipped. Returns how many moved.
 */
export async function arrangeThoughts(userId: string, placements: { id: string; x: number | null; y: number | null }[]): Promise<number> {
  const today = await ensureTodayPaper(userId);
  if (!placements.length) return 0;
  const ids = placements.map((p) => p.id);
  const at = (col: "x" | "y") => sql.join(placements.map((p) => sql`when ${p.id} then ${p[col]}::real`), sql` `);
  const [thoughts, stacks] = await db.batch([
    db
      .update(dropThoughts)
      .set({ x: sql`case ${dropThoughts.id} ${at("x")} end`, y: sql`case ${dropThoughts.id} ${at("y")} end` })
      .where(and(inArray(dropThoughts.id, ids), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, today.id)))
      .returning({ id: dropThoughts.id }),
    db
      .update(dropStacks)
      .set({ x: sql`case ${dropStacks.id} ${at("x")} end`, y: sql`case ${dropStacks.id} ${at("y")} end` })
      .where(and(inArray(dropStacks.id, ids), eq(dropStacks.userId, userId), eq(dropStacks.paperId, today.id)))
      .returning({ id: dropStacks.id }),
  ]);
  return thoughts.length + stacks.length;
}

/** Sends every thought and stack on today's paper back into the flow. */
export async function tidyToday(userId: string): Promise<void> {
  const today = await ensureTodayPaper(userId);
  await db.batch([
    db
      .update(dropThoughts)
      .set({ x: null, y: null })
      .where(and(eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, today.id))),
    db
      .update(dropStacks)
      .set({ x: null, y: null })
      .where(and(eq(dropStacks.userId, userId), eq(dropStacks.paperId, today.id))),
  ]);
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
  return contentsOf(paper.id, date);
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
    const paper = await contentsOf(p.id, date);
    if (paper.thoughts.some((t) => !t.carriedFrom)) out.push({ email: p.email, name: p.name, paper });
  }
  return out;
}
