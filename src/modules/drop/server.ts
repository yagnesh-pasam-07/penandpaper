import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { users } from "@/db/schema";
import { uid } from "@/lib/mutations";
import { addDays, todayIn } from "@/lib/time";
import {
  applyPaperOp,
  CRUMPLE_KEEP_DAYS,
  DROP_TIMEZONE,
  rollover,
  type DropPaper,
  type Kind,
  type PaperOp,
  type Thought,
} from "./logic";
import { dropPapers, dropPrefs, dropThoughts } from "./schema";

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
    kind: r.kind,
    shape: r.shape,
    createdAt: new Date(r.createdAt).toISOString(),
    doneAt: r.doneAt ? new Date(r.doneAt).toISOString() : null,
    carriedFrom: r.carriedFrom,
    x: r.x,
    y: r.y,
    scheduledFor: r.scheduledFor,
    image: r.image,
  };
}

/** A paper's thoughts, leaving out crumpled ones. */
async function contentsOf(paper: { id: string; date: string; clearedAt?: string | null }): Promise<DropPaper> {
  const rows = await db
    .select()
    .from(dropThoughts)
    .where(and(eq(dropThoughts.paperId, paper.id), isNull(dropThoughts.crumpledAt)))
    .orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id));
  return { date: paper.date, thoughts: rows.map(toThought), clearedAt: paper.clearedAt ?? null };
}

type PaperRef = { id: string; date: string; clearedAt: string | null };

const paperCols = { id: dropPapers.id, date: dropPapers.date, clearedAt: dropPapers.clearedAt };

/**
 * Today's paper, made on first open of the day. Making it also brings over the
 * last paper's open thoughts, and moves along whatever was
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
    const queries = [];
    if (carried.thoughts.length) queries.push(db.insert(dropThoughts).values(carried.thoughts.map((t) => thoughtRow(t, created.id, userId))));
    for (const m of carried.move.thoughts) {
      queries.push(db.update(dropThoughts).set({ paperId: created.id, carriedFrom: m.carriedFrom }).where(and(eq(dropThoughts.id, m.id), eq(dropThoughts.userId, userId))));
    }
    if (queries.length) await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
  }
  return created;
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
    scheduledFor: t.scheduledFor,
    image: t.image ?? null,
  };
}

/**
 * Saves the difference between two versions of today's paper, in one batch:
 * moved, folded or inked thoughts, and what went away (crumpled, so it can be
 * swept up later).
 */
async function saveChanges(paperId: string, before: DropPaper, after: DropPaper): Promise<void> {
  const queries = [];
  const kept = new Map(after.thoughts.map((t) => [t.id, t]));
  for (const was of before.thoughts) {
    const t = kept.get(was.id);
    if (!t) continue;
    const changed = t.x !== was.x || t.y !== was.y || t.scheduledFor !== was.scheduledFor || t.kind !== was.kind || t.status !== was.status;
    if (changed) {
      queries.push(
        db
          .update(dropThoughts)
          .set({
            x: t.x,
            y: t.y,
            scheduledFor: t.scheduledFor,
            kind: t.kind,
            status: t.status,
            ...(t.status !== was.status ? { doneAt: t.status === "done" ? sql`now()` : null } : {}),
          })
          .where(and(eq(dropThoughts.id, t.id), eq(dropThoughts.paperId, paperId))),
      );
    }
  }
  const gone = before.thoughts.filter((t) => !kept.has(t.id)).map((t) => t.id);
  if (gone.length) queries.push(db.update(dropThoughts).set({ crumpledAt: sql`now()` }).where(and(inArray(dropThoughts.id, gone), eq(dropThoughts.paperId, paperId))));
  if (queries.length) await db.batch(queries as unknown as Parameters<typeof db.batch>[0]);
}

export async function getToday(userId: string): Promise<DropPaper> {
  const paper = await contentsOf(await ensureTodayPaper(userId));
  return withEchoes(userId, paper);
}

/** How far back a thought written again still counts as "again". */
const ECHO_DAYS = 30;
const sameWords = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Marks thoughts whose words were written afresh (not carried over) on earlier
 * days this month, with those days, so a thought you keep writing presses
 * through the paper, darker each time.
 */
async function withEchoes(userId: string, paper: DropPaper): Promise<DropPaper> {
  const texts = new Set(paper.thoughts.filter((t) => t.text).map((t) => sameWords(t.text)));
  if (!texts.size) return paper;
  const rows = await db
    .select({ text: dropThoughts.text, date: dropPapers.date })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .where(
      and(
        eq(dropThoughts.userId, userId),
        isNull(dropThoughts.carriedFrom),
        lt(dropPapers.date, paper.date),
        gte(dropPapers.date, addDays(paper.date, -ECHO_DAYS)),
        inArray(sql`lower(regexp_replace(trim(${dropThoughts.text}), '\\s+', ' ', 'g'))`, [...texts]),
      ),
    );
  if (!rows.length) return paper;
  const days = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = sameWords(r.text);
    days.set(k, (days.get(k) ?? new Set()).add(r.date));
  }
  return {
    ...paper,
    thoughts: paper.thoughts.map((t) => {
      const seen = days.get(sameWords(t.text));
      // Only the copy written today (or carried from the first time) presses through.
      return seen ? { ...t, echoes: [...seen].filter((d) => d !== t.carriedFrom).sort() } : t;
    }),
  };
}

/** Folds or inks a thought on today's paper. Throws PaperError when it doesn't fit. */
export async function changePaper(userId: string, op: PaperOp): Promise<DropPaper> {
  const paper = await ensureTodayPaper(userId);
  const before = await contentsOf(paper);
  const after = applyPaperOp(before, op);
  await saveChanges(paper.id, before, after);
  return after;
}

export async function addThought(userId: string, input: { id: string; text: string; shape: number; kind: Kind; image?: string | null; x?: number | null; y?: number | null }): Promise<Thought> {
  const paper = await ensureTodayPaper(userId);
  const [row] = await db
    .insert(dropThoughts)
    .values({ id: input.id, paperId: paper.id, userId, text: input.text, shape: input.shape, kind: input.kind, image: input.image ?? null, x: input.x ?? null, y: input.y ?? null })
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

/** Crumples a thought on today's paper (kept a week, then swept up). */
export async function crumpleThought(userId: string, id: string): Promise<boolean> {
  const today = await ensureTodayPaper(userId);
  const rows = await db
    .update(dropThoughts)
    .set({ crumpledAt: sql`now()` })
    .where(and(eq(dropThoughts.id, id), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, today.id), isNull(dropThoughts.crumpledAt)))
    .returning({ id: dropThoughts.id });
  return rows.length > 0;
}

/**
 * Moves thoughts on today's paper; a null spot sends one back into
 * the flow. Ids that aren't on today's paper are skipped. Returns how many moved.
 */
export async function arrangeThoughts(userId: string, placements: { id: string; x: number | null; y: number | null }[]): Promise<number> {
  const today = await ensureTodayPaper(userId);
  if (!placements.length) return 0;
  const ids = placements.map((p) => p.id);
  const at = (col: "x" | "y") => sql.join(placements.map((p) => sql`when ${p.id} then ${p[col]}::real`), sql` `);
  const rows = await db
    .update(dropThoughts)
    .set({ x: sql`case ${dropThoughts.id} ${at("x")} end`, y: sql`case ${dropThoughts.id} ${at("y")} end` })
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

/** Stamps today's desk as cleared (the evening ritual). */
export async function clearDesk(userId: string): Promise<string> {
  const today = await ensureTodayPaper(userId);
  const [row] = await db.update(dropPapers).set({ clearedAt: sql`now()` }).where(eq(dropPapers.id, today.id)).returning({ clearedAt: dropPapers.clearedAt });
  return row.clearedAt!;
}

/* ---------- Appearance ---------- */

export type Appearance = { canvas: string | null; theme: string | null };

/** The saved choice; nothing saved (the device's own choice stands) if the columns aren't there yet, i.e. before `npm run db:migrate`. */
export async function getAppearance(userId: string): Promise<Appearance> {
  try {
    const [row] = await db.select({ canvas: dropPrefs.canvas, theme: dropPrefs.theme }).from(dropPrefs).where(eq(dropPrefs.userId, userId));
    return { canvas: row?.canvas ?? null, theme: row?.theme ?? null };
  } catch (e) {
    console.error("getAppearance: run db:migrate to add the canvas and theme columns", e);
    return { canvas: null, theme: null };
  }
}

/** Saves the canvas and/or theme choice (values are checked against the registry by the route). */
export async function saveAppearance(userId: string, patch: { canvas?: string; theme?: string }): Promise<void> {
  try {
    await db
      .insert(dropPrefs)
      .values({ userId, ...patch })
      .onConflictDoUpdate({ target: dropPrefs.userId, set: patch });
  } catch (e) {
    // Before `npm run db:migrate` the choice only lives on this device (localStorage).
    console.error("saveAppearance: run db:migrate to add the canvas and theme columns", e);
  }
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
export async function sweepCrumpled(): Promise<{ thoughts: number }> {
  const cutoff = sql`now() - make_interval(days => ${CRUMPLE_KEEP_DAYS})`;
  const thoughts = await db.delete(dropThoughts).where(lt(dropThoughts.crumpledAt, cutoff)).returning({ id: dropThoughts.id });
  return { thoughts: thoughts.length };
}
