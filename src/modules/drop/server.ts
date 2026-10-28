import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { users } from "@/db/schema";
import {
  CRUMPLE_KEEP_DAYS,
  DROP_TIMEZONE,
  SEARCH_LIMIT,
  cleanName,
  escapeLike,
  groupDigest,
  previewNotes,
  type DigestGroup,
  type DigestRow,
  type DropPaper,
  type PaperCardData,
  type PaperMeta,
  type SearchHit,
  type Thought,
} from "./logic";
import { dropPapers, dropPrefs, dropThoughts } from "./schema";

const db = httpDb;

/** The zone the evening email's day, and how dates read, follow. */
export function dropZone(): string {
  return process.env.DROP_TIMEZONE || DROP_TIMEZONE;
}

type ThoughtRow = typeof dropThoughts.$inferSelect;

const iso = (d: Date | string) => new Date(d).toISOString();

function toThought(r: ThoughtRow): Thought {
  return {
    id: r.id,
    text: r.text,
    status: r.status,
    shape: r.shape,
    createdAt: iso(r.createdAt),
    doneAt: r.doneAt ? iso(r.doneAt) : null,
    x: r.x,
    y: r.y,
    image: r.image,
  };
}

/* ---------- Papers ---------- */

const metaCols = {
  id: dropPapers.id,
  name: dropPapers.name,
  createdAt: dropPapers.createdAt,
  updatedAt: dropPapers.updatedAt,
  archivedAt: dropPapers.archivedAt,
};

type MetaRow = { id: string; name: string | null; createdAt: Date; updatedAt: Date; archivedAt: Date | null };

const toMeta = (r: MetaRow, count: number): PaperMeta => ({
  id: r.id,
  name: r.name,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
  archivedAt: r.archivedAt ? iso(r.archivedAt) : null,
  count,
});

/** One of this person's papers (not deleted), or null. Archived ones are still theirs to open and edit. */
async function ownedPaper(userId: string, paperId: string) {
  const [row] = await db
    .select(metaCols)
    .from(dropPapers)
    .where(and(eq(dropPapers.id, paperId), eq(dropPapers.userId, userId), isNull(dropPapers.deletedAt)));
  return row ?? null;
}

/** Notes that something on the paper changed, so it is the one /drop opens next. */
async function touch(paperId: string): Promise<void> {
  await db.update(dropPapers).set({ updatedAt: sql`now()` }).where(eq(dropPapers.id, paperId));
}

/** A paper's thoughts, leaving out crumpled ones. */
async function contentsOf(paper: { id: string; name: string | null; createdAt: Date; archivedAt: Date | null }): Promise<DropPaper> {
  const rows = await db
    .select()
    .from(dropThoughts)
    .where(and(eq(dropThoughts.paperId, paper.id), isNull(dropThoughts.crumpledAt)))
    .orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id));
  return { id: paper.id, name: paper.name, createdAt: iso(paper.createdAt), archivedAt: paper.archivedAt ? iso(paper.archivedAt) : null, thoughts: rows.map(toThought) };
}

/** Opens a paper with its thoughts, if it is theirs. */
export async function getPaper(userId: string, paperId: string): Promise<DropPaper | null> {
  const paper = await ownedPaper(userId, paperId);
  return paper ? contentsOf(paper) : null;
}

/** A new blank paper; the name is optional. */
export async function createPaper(userId: string, name?: string | null): Promise<PaperMeta> {
  const [row] = await db.insert(dropPapers).values({ userId, name: cleanName(name) }).returning(metaCols);
  return toMeta(row, 0);
}

/** The paper /drop opens: the one touched last, or a first blank one if there are none. */
export async function latestPaperId(userId: string): Promise<string> {
  const [row] = await db
    .select({ id: dropPapers.id })
    .from(dropPapers)
    .where(and(eq(dropPapers.userId, userId), isNull(dropPapers.archivedAt), isNull(dropPapers.deletedAt)))
    .orderBy(desc(dropPapers.updatedAt), desc(dropPapers.createdAt))
    .limit(1);
  return row?.id ?? (await createPaper(userId)).id;
}

/** Papers, newest first, with how many thoughts each holds; archived ones only when asked for. */
export async function listPapers(userId: string, opts: { archived?: boolean } = {}): Promise<PaperMeta[]> {
  const rows = await db
    .select({ ...metaCols, count: sql<number>`count(${dropThoughts.id})::int` })
    .from(dropPapers)
    .leftJoin(dropThoughts, and(eq(dropThoughts.paperId, dropPapers.id), isNull(dropThoughts.crumpledAt)))
    .where(and(eq(dropPapers.userId, userId), isNull(dropPapers.deletedAt), opts.archived ? isNotNull(dropPapers.archivedAt) : isNull(dropPapers.archivedAt)))
    .groupBy(dropPapers.id)
    .orderBy(desc(dropPapers.createdAt))
    .limit(200);
  return rows.map((r) => toMeta(r, r.count));
}

/** The library: each paper with a small picture of its canvas. */
export async function listPaperCards(userId: string, opts: { archived?: boolean } = {}): Promise<PaperCardData[]> {
  const papers = await listPapers(userId, opts);
  if (!papers.length) return [];
  const rows = await db
    .select({ id: dropThoughts.id, paperId: dropThoughts.paperId, text: dropThoughts.text, status: dropThoughts.status, x: dropThoughts.x, y: dropThoughts.y })
    .from(dropThoughts)
    .where(and(inArray(dropThoughts.paperId, papers.map((p) => p.id)), isNull(dropThoughts.crumpledAt)))
    .orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id));
  const byPaper = new Map<string, typeof rows>();
  for (const r of rows) byPaper.set(r.paperId, [...(byPaper.get(r.paperId) ?? []), r]);
  return papers.map((p) => ({ ...p, notes: previewNotes(byPaper.get(p.id) ?? []) }));
}

/** Renames a paper; a blank name clears it. False if it isn't theirs. */
export async function renamePaper(userId: string, paperId: string, name: string | null): Promise<boolean> {
  const rows = await db
    .update(dropPapers)
    .set({ name: cleanName(name), updatedAt: sql`now()` })
    .where(and(eq(dropPapers.id, paperId), eq(dropPapers.userId, userId), isNull(dropPapers.deletedAt)))
    .returning({ id: dropPapers.id });
  return rows.length > 0;
}

/** Puts a paper away (or brings it back). */
export async function archivePaper(userId: string, paperId: string, archived: boolean): Promise<boolean> {
  const rows = await db
    .update(dropPapers)
    .set({ archivedAt: archived ? sql`now()` : null })
    .where(and(eq(dropPapers.id, paperId), eq(dropPapers.userId, userId), isNull(dropPapers.deletedAt)))
    .returning({ id: dropPapers.id });
  return rows.length > 0;
}

/** Deletes a paper: hidden at once, kept a week so it can be undone, then swept up. */
export async function deletePaper(userId: string, paperId: string): Promise<boolean> {
  const rows = await db
    .update(dropPapers)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(dropPapers.id, paperId), eq(dropPapers.userId, userId), isNull(dropPapers.deletedAt)))
    .returning({ id: dropPapers.id });
  return rows.length > 0;
}

/** Takes a deleted paper back (an undo). */
export async function restorePaper(userId: string, paperId: string): Promise<boolean> {
  const rows = await db
    .update(dropPapers)
    .set({ deletedAt: null, updatedAt: sql`now()` })
    .where(and(eq(dropPapers.id, paperId), eq(dropPapers.userId, userId), isNotNull(dropPapers.deletedAt)))
    .returning({ id: dropPapers.id });
  return rows.length > 0;
}

/* ---------- Thoughts ---------- */

/** Thrown when the paper isn't theirs (or is gone). */
export class PaperNotFound extends Error {}

export async function addThought(
  userId: string,
  paperId: string,
  input: { id: string; text: string; shape: number; image?: string | null; x?: number | null; y?: number | null },
): Promise<Thought> {
  if (!(await ownedPaper(userId, paperId))) throw new PaperNotFound();
  const [row] = await db
    .insert(dropThoughts)
    .values({ id: input.id, paperId, userId, text: input.text, shape: input.shape, image: input.image ?? null, x: input.x ?? null, y: input.y ?? null })
    .onConflictDoNothing()
    .returning();
  if (row) {
    await touch(paperId);
    return toThought(row);
  }
  // Same id sent twice (a retry): return what's there, if it's theirs.
  const [again] = await db.select().from(dropThoughts).where(and(eq(dropThoughts.id, input.id), eq(dropThoughts.userId, userId)));
  if (!again) throw new Error("conflict");
  return toThought(again);
}

/** Edits or strikes a thought on this paper. Returns null if it isn't there. */
export async function updateThought(userId: string, paperId: string, id: string, patch: { text?: string; status?: "open" | "done" }): Promise<Thought | null> {
  const [row] = await db
    .update(dropThoughts)
    .set({
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.status ? { status: patch.status, doneAt: patch.status === "done" ? sql`now()` : null } : {}),
    })
    .where(and(eq(dropThoughts.id, id), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, paperId), isNull(dropThoughts.crumpledAt)))
    .returning();
  if (!row) return null;
  await touch(paperId);
  return toThought(row);
}

/** Crumples a thought on this paper (kept a week, then swept up). */
export async function crumpleThought(userId: string, paperId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(dropThoughts)
    .set({ crumpledAt: sql`now()` })
    .where(and(eq(dropThoughts.id, id), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, paperId), isNull(dropThoughts.crumpledAt)))
    .returning({ id: dropThoughts.id });
  if (rows.length) await touch(paperId);
  return rows.length > 0;
}

/**
 * Moves thoughts on this paper; a null spot sends one back into the flow.
 * Ids that aren't on this paper are skipped. Returns how many moved.
 */
export async function arrangeThoughts(userId: string, paperId: string, placements: { id: string; x: number | null; y: number | null }[]): Promise<number> {
  if (!placements.length) return 0;
  const ids = placements.map((p) => p.id);
  const at = (col: "x" | "y") => sql.join(placements.map((p) => sql`when ${p.id} then ${p[col]}::real`), sql` `);
  const rows = await db
    .update(dropThoughts)
    .set({ x: sql`case ${dropThoughts.id} ${at("x")} end`, y: sql`case ${dropThoughts.id} ${at("y")} end` })
    .where(and(inArray(dropThoughts.id, ids), eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, paperId)))
    .returning({ id: dropThoughts.id });
  if (rows.length) await touch(paperId);
  return rows.length;
}

/** Sends every thought on this paper back into the flow. */
export async function tidyPaper(userId: string, paperId: string): Promise<void> {
  await db
    .update(dropThoughts)
    .set({ x: null, y: null })
    .where(and(eq(dropThoughts.userId, userId), eq(dropThoughts.paperId, paperId)));
  await touch(paperId);
}

/* ---------- Search ---------- */

/** Thoughts across all their papers whose words contain the term (any case), newest first. */
export async function searchThoughts(userId: string, term: string): Promise<SearchHit[]> {
  const rows = await db
    .select({
      thoughtId: dropThoughts.id,
      text: dropThoughts.text,
      paperId: dropPapers.id,
      paperName: dropPapers.name,
      paperCreatedAt: dropPapers.createdAt,
    })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .where(and(eq(dropThoughts.userId, userId), isNull(dropThoughts.crumpledAt), isNull(dropPapers.deletedAt), ilike(dropThoughts.text, `%${escapeLike(term)}%`)))
    .orderBy(desc(dropThoughts.createdAt))
    .limit(SEARCH_LIMIT);
  return rows.map((r) => ({ ...r, paperCreatedAt: iso(r.paperCreatedAt) }));
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

/* ---------- The evening email ---------- */

/** Everyone who dropped something on `date` (a YYYY-MM-DD day in the Drop time zone), with those thoughts grouped by paper. */
export async function digestsFor(date: string): Promise<{ email: string; name: string; groups: DigestGroup[]; latestPaperId: string | null }[]> {
  const zone = dropZone();
  const rows = await db
    .select({
      userId: dropThoughts.userId,
      email: users.email,
      userName: users.name,
      paperId: dropPapers.id,
      paperName: dropPapers.name,
      paperCreatedAt: dropPapers.createdAt,
      id: dropThoughts.id,
      text: dropThoughts.text,
      status: dropThoughts.status,
      hasImage: sql<boolean>`${dropThoughts.image} is not null`,
    })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .innerJoin(users, eq(users.id, dropThoughts.userId))
    .where(and(isNull(dropThoughts.crumpledAt), isNull(dropPapers.deletedAt), sql`(${dropThoughts.createdAt} at time zone ${zone})::date = ${date}::date`))
    .orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id));

  const people = new Map<string, { email: string; name: string; rows: DigestRow[] }>();
  for (const r of rows) {
    const who = people.get(r.userId) ?? { email: r.email, name: r.userName, rows: [] };
    who.rows.push({
      paperId: r.paperId,
      paperName: r.paperName,
      paperCreatedAt: iso(r.paperCreatedAt),
      thought: { id: r.id, text: r.text, status: r.status, image: r.hasImage ? "yes" : null },
    });
    people.set(r.userId, who);
  }
  return [...people.values()].map((who) => ({ email: who.email, name: who.name, ...groupDigest(who.rows, zone) }));
}

/** Sweeps up what was crumpled or deleted more than a week ago. */
export async function sweepCrumpled(): Promise<{ thoughts: number; papers: number }> {
  const cutoff = sql`now() - make_interval(days => ${CRUMPLE_KEEP_DAYS})`;
  const thoughts = await db.delete(dropThoughts).where(lt(dropThoughts.crumpledAt, cutoff)).returning({ id: dropThoughts.id });
  // A paper's thoughts go with it.
  const papers = await db.delete(dropPapers).where(lt(dropPapers.deletedAt, cutoff)).returning({ id: dropPapers.id });
  return { thoughts: thoughts.length, papers: papers.length };
}
