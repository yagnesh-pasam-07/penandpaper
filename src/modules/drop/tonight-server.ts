import "server-only";
import { and, asc, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { dropDailyReviews, dropPapers, dropThoughts } from "./schema";
import { countsOf, dayRange, decisionOf, isInReview, localDate, MAX_CARDS, reviewDateOf, stateFor, type Counts, type Decision } from "./tonight";

const db = httpDb;

/** One thought on the review, with where it lives and what has been decided about it. */
export type TonightCard = {
  id: string;
  text: string;
  image: string | null;
  shape: number;
  createdAt: string;
  paperId: string;
  paperName: string | null;
  decision: Decision | null;
};

/** Everything the review screen needs in one load, so going through the cards never waits on the network. */
export type TonightState = {
  date: string;
  total: number;
  reviewed: number;
  remaining: number;
  completed: boolean;
  summary: Counts;
  cards: TonightCard[];
};

/** The numbers without the cards: for the header button and the API. */
export type TonightCounts = { date: string; total: number; reviewed: number; remaining: number; completed: boolean; summary: Counts };

const iso = (d: Date | string) => new Date(d).toISOString();

/** To-dos dropped on this local day, on papers that are not deleted (archived ones count), still in the review. Drops (pictures) aren't reviewed. */
function inReviewToday(userId: string, start: Date, end: Date) {
  return and(
    eq(dropThoughts.userId, userId),
    isNull(dropThoughts.image),
    gte(dropThoughts.createdAt, start.toISOString()),
    lt(dropThoughts.createdAt, end.toISOString()),
    isNull(dropPapers.deletedAt),
    or(isNotNull(dropThoughts.reviewedAt), and(isNull(dropThoughts.crumpledAt), eq(dropThoughts.status, "open"))),
  );
}

/** Today's cards, oldest first, with the choices already made. */
export async function tonightState(userId: string, tz: string, now: Date = new Date()): Promise<TonightState> {
  const date = localDate(tz, now);
  const { start, end } = dayRange(tz, date);
  const rows = await db
    .select({
      id: dropThoughts.id,
      text: dropThoughts.text,
      image: dropThoughts.image,
      shape: dropThoughts.shape,
      createdAt: dropThoughts.createdAt,
      status: dropThoughts.status,
      reviewedAt: dropThoughts.reviewedAt,
      crumpledAt: dropThoughts.crumpledAt,
      paperId: dropPapers.id,
      paperName: dropPapers.name,
    })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .where(inReviewToday(userId, start, end))
    .orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id))
    .limit(MAX_CARDS);
  const cards: TonightCard[] = rows.map((r) => ({
    id: r.id,
    text: r.text,
    image: r.image,
    shape: r.shape,
    createdAt: iso(r.createdAt),
    paperId: r.paperId,
    paperName: r.paperName,
    decision: decisionOf(r),
  }));
  const reviewed = cards.filter((c) => c.decision).length;
  const remaining = cards.length - reviewed;
  return { date, total: cards.length, reviewed, remaining, completed: cards.length > 0 && remaining === 0, summary: countsOf(cards.map((c) => c.decision)), cards };
}

/** How many are struck, kept, crumpled and still to do on a local day, counted by the database. */
async function countsFor(userId: string, tz: string, date: string): Promise<{ summary: Counts; remaining: number }> {
  const { start, end } = dayRange(tz, date);
  const [row] = await db
    .select({
      struck: sql<number>`count(*) filter (where ${dropThoughts.reviewedAt} is not null and ${dropThoughts.crumpledAt} is null and ${dropThoughts.status} = 'done')::int`,
      kept: sql<number>`count(*) filter (where ${dropThoughts.reviewedAt} is not null and ${dropThoughts.crumpledAt} is null and ${dropThoughts.status} = 'open')::int`,
      crumpled: sql<number>`count(*) filter (where ${dropThoughts.reviewedAt} is not null and ${dropThoughts.crumpledAt} is not null)::int`,
      remaining: sql<number>`count(*) filter (where ${dropThoughts.reviewedAt} is null and ${dropThoughts.crumpledAt} is null and ${dropThoughts.status} = 'open')::int`,
    })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .where(and(eq(dropThoughts.userId, userId), isNull(dropThoughts.image), gte(dropThoughts.createdAt, start.toISOString()), lt(dropThoughts.createdAt, end.toISOString()), isNull(dropPapers.deletedAt)));
  return { summary: { struck: row?.struck ?? 0, kept: row?.kept ?? 0, crumpled: row?.crumpled ?? 0 }, remaining: row?.remaining ?? 0 };
}

/** The numbers for today, without sending the cards. */
export async function tonightCounts(userId: string, tz: string, now: Date = new Date()): Promise<TonightCounts> {
  const date = localDate(tz, now);
  const { summary, remaining } = await countsFor(userId, tz, date);
  const reviewed = summary.struck + summary.kept + summary.crumpled;
  const total = reviewed + remaining;
  return { date, total, reviewed, remaining, completed: total > 0 && remaining === 0, summary };
}

/** The oldest card not decided yet, or null. */
export async function nextTonightCard(userId: string, tz: string, now: Date = new Date()): Promise<TonightCard | null> {
  const { start, end } = dayRange(tz, localDate(tz, now));
  const [r] = await db
    .select({
      id: dropThoughts.id,
      text: dropThoughts.text,
      image: dropThoughts.image,
      shape: dropThoughts.shape,
      createdAt: dropThoughts.createdAt,
      paperId: dropPapers.id,
      paperName: dropPapers.name,
    })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .where(and(inReviewToday(userId, start, end), isNull(dropThoughts.reviewedAt)))
    .orderBy(asc(dropThoughts.createdAt), asc(dropThoughts.id))
    .limit(1);
  return r ? { id: r.id, text: r.text, image: r.image, shape: r.shape, createdAt: iso(r.createdAt), paperId: r.paperId, paperName: r.paperName, decision: null } : null;
}

export type ReviewResult = TonightCounts | "not_found" | "not_reviewable";

/**
 * Decides a thought: strike it (the red line, kept on its paper), keep it as it
 * is, crumple it, or `undo` to put it back as it was before the review. Each is
 * a "set", not a "toggle", so sending the same one twice changes nothing and
 * counts nothing twice. The day's counts are then worked out again from the
 * thoughts and saved with the review's record. The paper is not "touched", so
 * reviewing an old paper doesn't make it the one a new capture lands on.
 */
export async function reviewThought(userId: string, thoughtId: string, action: Decision | "undo", tz: string, now: Date = new Date()): Promise<ReviewResult> {
  const [t] = await db
    .select({ id: dropThoughts.id, createdAt: dropThoughts.createdAt, status: dropThoughts.status, reviewedAt: dropThoughts.reviewedAt, crumpledAt: dropThoughts.crumpledAt })
    .from(dropThoughts)
    .innerJoin(dropPapers, eq(dropPapers.id, dropThoughts.paperId))
    .where(and(eq(dropThoughts.id, thoughtId), eq(dropThoughts.userId, userId), isNull(dropThoughts.image), isNull(dropPapers.deletedAt)));
  if (!t) return "not_found";
  if (!isInReview(t)) return "not_reviewable";

  const want = stateFor(action);
  await db
    .update(dropThoughts)
    .set({
      reviewedAt: want.reviewed ? sql`coalesce(${dropThoughts.reviewedAt}, now())` : null,
      status: want.struck ? "done" : "open",
      doneAt: want.struck ? sql`coalesce(${dropThoughts.doneAt}, now())` : null,
      crumpledAt: want.crumpled ? sql`coalesce(${dropThoughts.crumpledAt}, now())` : null,
    })
    .where(and(eq(dropThoughts.id, thoughtId), eq(dropThoughts.userId, userId)));

  // The day this thought belongs to (not "today"): a review that crosses midnight still counts on the right day.
  const date = reviewDateOf(t.createdAt, tz);
  const { summary, remaining } = await countsFor(userId, tz, date);
  const reviewed = summary.struck + summary.kept + summary.crumpled;
  const completed = reviewed > 0 && remaining === 0;
  await db
    .insert(dropDailyReviews)
    .values({ userId, date, struck: summary.struck, kept: summary.kept, crumpled: summary.crumpled, completedAt: completed ? now : null })
    .onConflictDoUpdate({
      target: [dropDailyReviews.userId, dropDailyReviews.date],
      set: {
        struck: summary.struck,
        kept: summary.kept,
        crumpled: summary.crumpled,
        completedAt: completed ? sql`coalesce(${dropDailyReviews.completedAt}, now())` : null,
        updatedAt: sql`now()`,
      },
    });
  return { date, total: reviewed + remaining, reviewed, remaining, completed, summary };
}
