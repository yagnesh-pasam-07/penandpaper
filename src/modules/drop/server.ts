import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { users } from "@/db/schema";
import { uid } from "@/lib/mutations";
import { todayIn } from "@/lib/time";
import {
  applyStackOp,
  CRUMPLE_KEEP_DAYS,
  DROP_TIMEZONE,
  rollover,
  settleStacks,
  type DropPaper,
  type Kind,
  type Stack,
  type StackOp,
  type Thought,
} from "./logic";
import { dropPapers, dropPrefs, dropStacks, dropThoughts } from "./schema";

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
    kind: r.kind,
    shape: r.shape,
    createdAt: new Date(r.createdAt).toISOString(),
    doneAt: r.doneAt ? new Date(r.doneAt).toISOString() : null,
    carriedFrom: r.carriedFrom,
    x: r.x,
    y: r.y,
    stackId: r.stackId,
    stackOrder: r.stackOrder,
    scheduledFor: r.scheduledFor,
    rank: r.rank,
    nextRank: r.nextRank,
  };
}

function toStack(r: StackRow): Stack {
  return {
    id: r.id,
    name: r.name,
    x: r.x,
    y: r.y,
    createdAt: new Date(r.createdAt).toISOString(),
    carriedFrom: r.carriedFrom,
    scheduledFor: r.scheduledFor,
    rank: r.rank,
    nextRank: r.nextRank,
  };
}

/** A paper's thoughts and stacks, leaving out crumpled ones. */
async function contentsOf(paper: { id: string; date: string; clearedAt?: string | null }): Promise<DropPaper> {
  const [thoughtRows, stackRows] = await db.batch([
    db
      .select()
      .from(dropThoughts)
      .where(and(eq(dropThoughts.paperId, paper.id), isNull(dropThoughts.crumpledAt)))
      .orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id)),
    db
      .select()
      .from(dropStacks)
      .where(and(eq(dropStacks.paperId, paper.id), isNull(dropStacks.crumpledAt)))
      .orderBy(asc(dropStacks.createdAt), asc(dropStacks.id)),
  ]);
  const stacks = stackRows.map(toStack);
  const live = new Set(stacks.map((s) => s.id));
  // A thought whose stack was thrown away is simply loose.
  const thoughts = thoughtRows.map(toThought).map((t) => (t.stackId && !live.has(t.stackId) ? { ...t, stackId: null, stackOrder: 0, rank: null } : t));
  return { date: paper.date, thoughts, stacks, clearedAt: paper.clearedAt ?? null };
}

type PaperRef = { id: string; date: string; clearedAt: string | null };

const paperCols = { id: dropPapers.id, date: dropPapers.date, clearedAt: dropPapers.clearedAt };

/**
 * Today's paper, made on first open of the day. Making it also brings over the
 * last paper's open thoughts (and their stacks), and moves along whatever was
 * folded for later; if two requests race, only the one that made the paper
 * does that.
 */
async function ensureTodayPaper(userId: string): Promise<PaperRef> {
  const date = dropToday();
  const [existing] = await db
    .select(paperCols)
    .from(dropPapers)
    .where(and(eq(dropPapers.userId, userId), eq(dropPapers.date, date)));
  if (existing) return existing;

  const [created] = await db.insert(dropPapers).values({ userId, date }).onConflictDoNothing().returning(paperCols);
  if (!created) {
    const [row] = await db
      .select(paperCols)
      .from(dropPapers)
      .where(and(eq(dropPapers.userId, userId), eq(dropPapers.date, date)));
    return row;
  }

  const [prev] = await db
    .select(paperCols)
    .from(dropPapers)
    .where(and(eq(dropPapers.userId, userId), lt(dropPapers.date, date)))
    .orderBy(desc(dropPapers.date))
    .limit(1);
  if (prev) {
    const carried = rollover(await contentsOf(prev), uid);
    // Stacks first: carried and moved thoughts point at them.
    if (carried.stacks.length) await db.insert(dropStacks).values(carried.stacks.map((s) => stackRow(s, created.id, userId)));
    const queries = [];
    if (carried.thoughts.length) queries.push(db.insert(dropThoughts).values(carried.thoughts.map((t) => thoughtRow(t, created.id, userId))));
    if (carried.move.stacks.length) {
      const since = sql`coalesce(carried_from, ${prev.date}::date)`;
      queries.push(
        db
          .update(dropStacks)
          .set({ paperId: created.id, carriedFrom: since })
          .where(and(inArray(dropStacks.id, carried.move.stacks), eq(dropStacks.userId, userId))),
      );
      queries.push(
        db
          .update(dropThoughts)
          .set({ paperId: created.id, carriedFrom: since })
          .where(and(inArray(dropThoughts.stackId, carried.move.stacks), eq(dropThoughts.userId, userId))),
      );
    }
    for (const m of carried.move.thoughts) {
      queries.push(db.update(dropThoughts).set({ paperId: created.id, stackId: m.stackId, carriedFrom: m.carriedFrom }).where(and(eq(dropThoughts.id, m.id), eq(dropThoughts.userId, userId))));
    }
    if (queries.length) await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
  }
  return created;
}

function stackRow(s: Stack, paperId: string, userId: string): typeof dropStacks.$inferInsert {
  return {
    id: s.id,
    paperId,
    userId,
    name: s.name,
    x: s.x,
    y: s.y,
    createdAt: s.createdAt,
    carriedFrom: s.carriedFrom,
    scheduledFor: s.scheduledFor,
    rank: s.rank,
    nextRank: s.nextRank,
  };
}

function thoughtRow(t: Thought, paperId: string, userId: string): typeof dropThoughts.$inferInsert {
  return {
    id: t.id,
    paperId,
    userId,
    text: t.text,
    status: t.status,
    kind: t.kind,
    shape: t.shape,
    createdAt: t.createdAt,
    carriedFrom: t.carriedFrom,
    x: t.x,
    y: t.y,
    stackId: t.stackId,
    stackOrder: t.stackOrder,
    scheduledFor: t.scheduledFor,
    rank: t.rank,
    nextRank: t.nextRank,
  };
}

/**
 * Saves the difference between two versions of today's paper, in one batch:
 * new stacks, regrouped, moved, folded or inked thoughts, renamed or moved
 * stacks, and what went away (crumpled, so it can be swept up later).
 */
async function saveChanges(paperId: string, userId: string, before: DropPaper, after: DropPaper): Promise<void> {
  const queries = [];
  const oldStacks = new Map(before.stacks.map((s) => [s.id, s]));
  const newStacks = new Map(after.stacks.map((s) => [s.id, s]));
  const added = after.stacks.filter((s) => !oldStacks.has(s.id));
  if (added.length) queries.push(db.insert(dropStacks).values(added.map((s) => stackRow(s, paperId, userId))));
  for (const s of after.stacks) {
    const was = oldStacks.get(s.id);
    if (was && (was.name !== s.name || was.x !== s.x || was.y !== s.y || was.scheduledFor !== s.scheduledFor || was.rank !== s.rank || was.nextRank !== s.nextRank)) {
      queries.push(
        db
          .update(dropStacks)
          .set({ name: s.name, x: s.x, y: s.y, scheduledFor: s.scheduledFor, rank: s.rank, nextRank: s.nextRank })
          .where(and(eq(dropStacks.id, s.id), eq(dropStacks.paperId, paperId))),
      );
    }
  }
  const kept = new Map(after.thoughts.map((t) => [t.id, t]));
  for (const was of before.thoughts) {
    const t = kept.get(was.id);
    if (!t) continue;
    const changed =
      t.stackId !== was.stackId ||
      t.stackOrder !== was.stackOrder ||
      t.x !== was.x ||
      t.y !== was.y ||
      t.scheduledFor !== was.scheduledFor ||
      t.kind !== was.kind ||
      t.status !== was.status ||
      t.rank !== was.rank ||
      t.nextRank !== was.nextRank;
    if (changed) {
      queries.push(
        db
          .update(dropThoughts)
          .set({
            stackId: t.stackId,
            stackOrder: t.stackOrder,
            x: t.x,
            y: t.y,
            scheduledFor: t.scheduledFor,
            kind: t.kind,
            status: t.status,
            rank: t.rank,
            nextRank: t.nextRank,
            ...(t.status !== was.status ? { doneAt: t.status === "done" ? sql`now()` : null } : {}),
          })
          .where(and(eq(dropThoughts.id, t.id), eq(dropThoughts.paperId, paperId))),
      );
    }
  }
  const gone = before.thoughts.filter((t) => !kept.has(t.id)).map((t) => t.id);
  if (gone.length) queries.push(db.update(dropThoughts).set({ crumpledAt: sql`now()` }).where(and(inArray(dropThoughts.id, gone), eq(dropThoughts.paperId, paperId))));
  const goneStacks = before.stacks.filter((s) => !newStacks.has(s.id)).map((s) => s.id);
  if (goneStacks.length) queries.push(db.update(dropStacks).set({ crumpledAt: sql`now()` }).where(and(inArray(dropStacks.id, goneStacks), eq(dropStacks.paperId, paperId))));
  if (queries.length) await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
}

export async function getToday(userId: string): Promise<DropPaper> {
  return contentsOf(await ensureTodayPaper(userId));
}

/** Groups, regroups, renames, folds, inks or throws away on today's paper. Throws StackError when it doesn't fit. */
export async function changeStacks(userId: string, op: StackOp): Promise<DropPaper> {
  const paper = await ensureTodayPaper(userId);
  const before = await contentsOf(paper);
  const after = applyStackOp(before, op);
  await saveChanges(paper.id, userId, before, after);
  // Someone who has made a stack doesn't need the hint any more.
  if (op.kind === "stack") await finishStackHint(userId);
  return after;
}

export async function addThought(userId: string, input: { id: string; text: string; shape: number; kind: Kind }): Promise<Thought> {
  const paper = await ensureTodayPaper(userId);
  const [row] = await db
    .insert(dropThoughts)
    .values({ id: input.id, paperId: paper.id, userId, text: input.text, shape: input.shape, kind: input.kind })
    .onConflictDoNothing()
    .returning();
  if (row) return toThought(row);
  // Same id sent twice (a retry): return what's there, if it's theirs.
  const [again] = await db.select().from(dropThoughts).where(and(eq(dropThoughts.id, input.id), eq(dropThoughts.userId, userId)));
  if (!again) throw new Error("conflict");
  return toThought(again);
}

/** Only today's thoughts can change; past papers are read-only. Only pen can be struck. Returns null if not found. */
export async function updateThought(userId: string, id: string, patch: { text?: string; status?: "open" | "done" }): Promise<Thought | null> {
  const today = await ensureTodayPaper(userId);
  const [row] = await db
    .update(dropThoughts)
    .set({
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.status ? { status: patch.status, doneAt: patch.status === "done" ? sql`now()` : null } : {}),
    })
    .where(
      and(
        eq(dropThoughts.id, id),
        eq(dropThoughts.userId, userId),
        eq(dropThoughts.paperId, today.id),
        isNull(dropThoughts.crumpledAt),
        ...(patch.status === "done" ? [eq(dropThoughts.kind, "pen")] : []),
      ),
    )
    .returning();
  return row ? toThought(row) : null;
}

/** Crumples a thought on today's paper (kept a week, then swept up). A stack left with one dissolves. */
export async function crumpleThought(userId: string, id: string): Promise<boolean> {
  const today = await ensureTodayPaper(userId);
  const rows = await db
    .update(dropThoughts)
    .set({ crumpledAt: sql`now()` })
    .where(and(eq(dropThoughts.id, id), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, today.id), isNull(dropThoughts.crumpledAt)))
    .returning({ id: dropThoughts.id, stackId: dropThoughts.stackId });
  if (!rows.length) return false;
  // A stack of one dissolves, and the numbers close up.
  const before = await contentsOf(today);
  await saveChanges(today.id, userId, before, settleStacks(before));
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

/** Stamps today's desk as cleared (the evening ritual). */
export async function clearDesk(userId: string): Promise<string> {
  const today = await ensureTodayPaper(userId);
  const [row] = await db.update(dropPapers).set({ clearedAt: sql`now()` }).where(eq(dropPapers.id, today.id)).returning({ clearedAt: dropPapers.clearedAt });
  return row.clearedAt!;
}

/* ---------- One-time hints ---------- */

/** Whether the "drag one note onto another" hint may still show (not dismissed, no stack made yet). */
export async function stackHintPending(userId: string): Promise<boolean> {
  const [row] = await db.select({ done: dropPrefs.stackHintDoneAt }).from(dropPrefs).where(eq(dropPrefs.userId, userId));
  return !row?.done;
}

export async function finishStackHint(userId: string): Promise<void> {
  await db
    .insert(dropPrefs)
    .values({ userId, stackHintDoneAt: sql`now()` })
    .onConflictDoUpdate({ target: dropPrefs.userId, set: { stackHintDoneAt: sql`coalesce(${dropPrefs.stackHintDoneAt}, now())` } });
}

/* ---------- History ---------- */

export type PaperSummary = { date: string; total: number; done: number; cleared: boolean };

/** Past papers, newest first, with how many thoughts and how many struck, and whether the desk was cleared. */
export async function listHistory(userId: string): Promise<PaperSummary[]> {
  const today = dropToday();
  const rows = await db
    .select({
      date: dropPapers.date,
      cleared: sql<boolean>`${dropPapers.clearedAt} is not null`,
      total: sql<number>`count(${dropThoughts.id})::int`,
      done: sql<number>`count(${dropThoughts.id}) filter (where ${dropThoughts.status} = 'done')::int`,
    })
    .from(dropPapers)
    .leftJoin(dropThoughts, and(eq(dropThoughts.paperId, dropPapers.id), isNull(dropThoughts.crumpledAt)))
    .where(and(eq(dropPapers.userId, userId), lt(dropPapers.date, today)))
    .groupBy(dropPapers.date, dropPapers.clearedAt)
    .orderBy(desc(dropPapers.date))
    .limit(365);
  return rows.filter((r) => r.total > 0);
}

export async function getPaper(userId: string, date: string): Promise<DropPaper | null> {
  const [paper] = await db
    .select(paperCols)
    .from(dropPapers)
    .where(and(eq(dropPapers.userId, userId), eq(dropPapers.date, date)));
  if (!paper) return null;
  return contentsOf(paper);
}

/** Everyone whose paper today has at least one thought dropped today. */
export async function digestsFor(date: string): Promise<{ email: string; name: string; paper: DropPaper }[]> {
  const papers = await db
    .select({ id: dropPapers.id, date: dropPapers.date, clearedAt: dropPapers.clearedAt, email: users.email, name: users.name })
    .from(dropPapers)
    .innerJoin(users, eq(users.id, dropPapers.userId))
    .where(eq(dropPapers.date, date));
  const out = [];
  for (const p of papers) {
    const paper = await contentsOf(p);
    if (paper.thoughts.some((t) => !t.carriedFrom)) out.push({ email: p.email, name: p.name, paper });
  }
  return out;
}

/** Sweeps up what was crumpled more than a week ago. */
export async function sweepCrumpled(): Promise<{ thoughts: number; stacks: number }> {
  const cutoff = sql`now() - make_interval(days => ${CRUMPLE_KEEP_DAYS})`;
  const [thoughts, stacks] = await db.batch([
    db.delete(dropThoughts).where(lt(dropThoughts.crumpledAt, cutoff)).returning({ id: dropThoughts.id }),
    db.delete(dropStacks).where(lt(dropStacks.crumpledAt, cutoff)).returning({ id: dropStacks.id }),
  ]);
  return { thoughts: thoughts.length, stacks: stacks.length };
}
