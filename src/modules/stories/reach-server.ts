import "server-only";
import { createHmac } from "node:crypto";
import { and, count, countDistinct, desc, eq, gte, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { env } from "@/lib/env";
import { MAX_ACTIVE_SECONDS, MAX_CLAPS, type Channel, type EventKind, type Source, type StoryNumbers, type Totals } from "./reach";
import { users } from "@/db/schema";
import { stories, storyClaps, storyEvents, storySaves } from "./schema";

/**
 * A reader as Studio counts them: the browser's random id, keyed with the
 * app's secret, so the stored value can't be matched to anything outside.
 */
export function readerKey(raw: string): string {
  return createHmac("sha256", `${env.BETTER_AUTH_SECRET}:readers`).update(raw).digest("base64url").slice(0, 22);
}

/**
 * Records one event. A view, read or listen counts once per reader per story
 * per day (a refresh isn't a second reader); shares all count.
 */
export async function recordEvent(e: { storyId: string; kind: EventKind; reader: string; channel?: Channel | null; source?: Source | null; device?: "phone" | "desktop" | null; depth?: number; seconds?: number }): Promise<void> {
  if (e.kind === "depth") {
    // One row per reader per story; it only ever moves forward (deeper, longer).
    const depth = Math.max(0, Math.min(Math.floor(e.depth ?? 0), 5000));
    const seconds = Math.max(0, Math.min(Math.floor(e.seconds ?? 0), MAX_ACTIVE_SECONDS));
    await httpDb.execute(sql`
      insert into ${storyEvents} (story_id, kind, reader, device, depth, seconds)
      values (${e.storyId}::uuid, 'depth', ${e.reader}, ${e.device ?? null}, ${depth}, ${seconds})
      on conflict (story_id, reader) where kind = 'depth'
      do update set depth = greatest(${storyEvents.depth}, excluded.depth), seconds = greatest(${storyEvents.seconds}, excluded.seconds)
    `);
    return;
  }
  if (e.kind !== "share") {
    const [dup] = await httpDb
      .select({ id: storyEvents.id })
      .from(storyEvents)
      .where(and(eq(storyEvents.storyId, e.storyId), eq(storyEvents.kind, e.kind), eq(storyEvents.reader, e.reader), gte(storyEvents.createdAt, sql`now() - interval '1 day'`)))
      .limit(1);
    if (dup) return;
  }
  await httpDb.insert(storyEvents).values({ storyId: e.storyId, kind: e.kind, reader: e.reader, channel: e.channel ?? null, source: e.source ?? null, device: e.device ?? null });
}

const empty = (): Totals => ({ views: 0, readers: 0, reads: 0, listens: 0, shares: 0, byChannel: {}, bySource: {}, byDevice: {} });

/** Everything Studio shows for one story. */
export async function storyReach(storyId: string, days = 28): Promise<Totals & { daily: { day: string; views: number }[] }> {
  const t = empty();
  const byKind = await httpDb
    .select({ kind: storyEvents.kind, n: count(), people: countDistinct(storyEvents.reader) })
    .from(storyEvents)
    .where(eq(storyEvents.storyId, storyId))
    .groupBy(storyEvents.kind);
  for (const r of byKind) {
    if (r.kind === "view") {
      t.views = r.n;
      t.readers = r.people;
    } else if (r.kind === "read") t.reads = r.people;
    else if (r.kind === "listen") t.listens = r.people;
    else t.shares = r.n;
  }
  const [channels, sources, devices, perDay] = await Promise.all([
    httpDb.select({ k: storyEvents.channel, n: count() }).from(storyEvents).where(and(eq(storyEvents.storyId, storyId), eq(storyEvents.kind, "share"))).groupBy(storyEvents.channel),
    httpDb.select({ k: storyEvents.source, n: countDistinct(storyEvents.reader) }).from(storyEvents).where(and(eq(storyEvents.storyId, storyId), eq(storyEvents.kind, "view"))).groupBy(storyEvents.source),
    httpDb.select({ k: storyEvents.device, n: countDistinct(storyEvents.reader) }).from(storyEvents).where(and(eq(storyEvents.storyId, storyId), eq(storyEvents.kind, "view"))).groupBy(storyEvents.device),
    httpDb
      .select({ day: sql<string>`to_char(${storyEvents.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`, views: count() })
      .from(storyEvents)
      .where(and(eq(storyEvents.storyId, storyId), eq(storyEvents.kind, "view"), gte(storyEvents.createdAt, sql`now() - make_interval(days => ${days})`)))
      .groupBy(sql`1`),
  ]);
  for (const r of channels) t.byChannel[r.k ?? "other"] = r.n;
  for (const r of sources) t.bySource[r.k ?? "direct"] = r.n;
  for (const r of devices) t.byDevice[r.k ?? "desktop"] = r.n;
  return { ...t, daily: perDay };
}

/** Totals across all stories, for the top of Story Studio. */
export async function allReach(): Promise<Pick<Totals, "views" | "readers" | "reads" | "shares"> & { topSource: string | null; topChannel: string | null }> {
  try {
    const [row] = await httpDb
      .select({
        views: sql<number>`count(*) filter (where ${storyEvents.kind} = 'view')::int`,
        readers: sql<number>`count(distinct ${storyEvents.reader}) filter (where ${storyEvents.kind} = 'view')::int`,
        reads: sql<number>`count(distinct (${storyEvents.reader}, ${storyEvents.storyId})) filter (where ${storyEvents.kind} = 'read')::int`,
        shares: sql<number>`count(*) filter (where ${storyEvents.kind} = 'share')::int`,
      })
      .from(storyEvents);
    const [src] = await httpDb.select({ k: storyEvents.source, n: count() }).from(storyEvents).where(eq(storyEvents.kind, "view")).groupBy(storyEvents.source).orderBy(desc(count())).limit(1);
    const [ch] = await httpDb.select({ k: storyEvents.channel, n: count() }).from(storyEvents).where(eq(storyEvents.kind, "share")).groupBy(storyEvents.channel).orderBy(desc(count())).limit(1);
    return { ...row, topSource: src?.k ?? null, topChannel: ch?.k ?? null };
  } catch {
    return { views: 0, readers: 0, reads: 0, shares: 0, topSource: null, topChannel: null };
  }
}

/** The story's id for a public slug, only while it is live (events for drafts are refused). */
export async function liveStoryId(slug: string): Promise<string | null> {
  const [s] = await httpDb
    .select({ id: stories.id })
    .from(stories)
    .where(and(eq(stories.slug, slug), eq(stories.status, "published"), sql`${stories.publishAt} <= now()`))
    .limit(1);
  return s?.id ?? null;
}

/**
 * Adds a reader's claps to a live story, at most MAX_CLAPS from one reader in
 * all, and keeps the story's total in step, in one statement. Returns this
 * reader's count and the story's total.
 */
export async function addClaps(storyId: string, reader: string, n: number, userId: string | null = null): Promise<{ mine: number; total: number }> {
  const add = Math.max(1, Math.min(Math.floor(n), MAX_CLAPS));
  const rows = await httpDb.execute<{ mine: number; total: number }>(sql`
    with prev as (
      select coalesce((select ${storyClaps.count} from ${storyClaps} where ${storyClaps.storyId} = ${storyId}::uuid and ${storyClaps.reader} = ${reader}), 0) as c
    ),
    up as (
      insert into ${storyClaps} (story_id, reader, user_id, count, updated_at)
      values (${storyId}::uuid, ${reader}, ${userId}::uuid, least(${add}::int, ${MAX_CLAPS}::int), now())
      on conflict (story_id, reader) do update set count = least(${storyClaps.count} + ${add}::int, ${MAX_CLAPS}::int), updated_at = now()
      returning count
    ),
    tot as (
      update ${stories} set claps = ${stories.claps} + ((select count from up) - (select c from prev))
      where ${stories.id} = ${storyId}::uuid
      returning claps
    )
    select (select count from up)::int as mine, (select claps from tot)::int as total
  `);
  const r = (rows as unknown as { rows?: { mine: number; total: number }[] }).rows?.[0] ?? (rows as unknown as { mine: number; total: number }[])[0];
  return { mine: Number(r?.mine ?? 0), total: Number(r?.total ?? 0) };
}

/** A story's total, and this reader's own claps. */
export async function clapsOf(storyId: string, reader: string): Promise<{ mine: number; total: number }> {
  const [[s], [m]] = await Promise.all([
    httpDb.select({ total: stories.claps }).from(stories).where(eq(stories.id, storyId)).limit(1),
    httpDb.select({ mine: storyClaps.count }).from(storyClaps).where(and(eq(storyClaps.storyId, storyId), eq(storyClaps.reader, reader))).limit(1),
  ]);
  return { mine: m?.mine ?? 0, total: s?.total ?? 0 };
}

/** The clap key for a signed-in reader: one count per person, on every device. */
export const userReader = (userId: string) => `u:${userId}`;

/**
 * A reader signed in: their anonymous claps on this browser become theirs.
 * Per story, the account keeps the larger of the two counts (still at most
 * MAX_CLAPS), the anonymous row goes, and the story total is corrected.
 */
export async function claimClaps(anon: string, userId: string): Promise<void> {
  const me = userReader(userId);
  await httpDb.execute(sql`
    with a as (
      delete from ${storyClaps} where ${storyClaps.reader} = ${anon} returning story_id, count
    ),
    u as (
      select c.story_id, c.count from ${storyClaps} c join a on a.story_id = c.story_id where c.reader = ${me}
    ),
    merged as (
      insert into ${storyClaps} (story_id, reader, user_id, count, updated_at)
      select a.story_id, ${me}, ${userId}::uuid, least(greatest(a.count, coalesce(u.count, 0)), ${MAX_CLAPS}::int), now()
      from a left join u on u.story_id = a.story_id
      on conflict (story_id, reader) do update set count = excluded.count, user_id = excluded.user_id, updated_at = now()
      returning story_id
    )
    update ${stories} s set claps = coalesce((select sum(c.count) from ${storyClaps} c where c.story_id = s.id), 0)
    where s.id in (select story_id from merged)
  `);
}

/** Signed-in readers who clapped for a story, most claps first, with when they last clapped: for the writer only. */
export async function clappers(storyId: string, limit = 200): Promise<{ name: string; email: string; image: string | null; count: number; at: string }[]> {
  try {
    const rows = await httpDb
      .select({ name: users.name, email: users.email, image: users.image, count: storyClaps.count, at: storyClaps.updatedAt })
      .from(storyClaps)
      .innerJoin(users, eq(users.id, storyClaps.userId))
      .where(eq(storyClaps.storyId, storyId))
      .orderBy(desc(storyClaps.count), desc(storyClaps.updatedAt))
      .limit(limit);
    return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
  } catch {
    return [];
  }
}

/** Claps for one story, by people: everyone who clapped, how many were signed in, and the total. */
export async function clapSummary(storyId: string): Promise<{ people: number; signedIn: number; total: number; full: number }> {
  try {
    const [r] = await httpDb
      .select({
        people: count(),
        signedIn: sql<number>`count(${storyClaps.userId})::int`,
        total: sql<number>`coalesce(sum(${storyClaps.count}), 0)::int`,
        full: sql<number>`count(*) filter (where ${storyClaps.count} >= ${MAX_CLAPS})::int`,
      })
      .from(storyClaps)
      .where(and(eq(storyClaps.storyId, storyId), sql`${storyClaps.count} > 0`));
    return { people: Number(r?.people ?? 0), signedIn: Number(r?.signedIn ?? 0), total: Number(r?.total ?? 0), full: Number(r?.full ?? 0) };
  } catch {
    return { people: 0, signedIn: 0, total: 0, full: 0 };
  }
}

/** Claps and clapping people per story, for the Studio list. */
export async function clapsByStory(): Promise<Record<string, { claps: number; people: number }>> {
  try {
    const rows = await httpDb
      .select({ storyId: storyClaps.storyId, claps: sql<number>`coalesce(sum(${storyClaps.count}), 0)::int`, people: count() })
      .from(storyClaps)
      .where(sql`${storyClaps.count} > 0`)
      .groupBy(storyClaps.storyId);
    return Object.fromEntries(rows.map((r) => [r.storyId, { claps: Number(r.claps), people: Number(r.people) }]));
  } catch {
    return {};
  }
}

/** Save or unsave a story for later. Returns whether it is saved now. */
export async function setSaved(userId: string, storyId: string, saved: boolean): Promise<boolean> {
  if (saved) await httpDb.insert(storySaves).values({ userId, storyId }).onConflictDoNothing();
  else await httpDb.delete(storySaves).where(and(eq(storySaves.userId, userId), eq(storySaves.storyId, storyId)));
  return saved;
}

export async function isSaved(userId: string, storyId: string): Promise<boolean> {
  const [r] = await httpDb.select({ s: storySaves.storyId }).from(storySaves).where(and(eq(storySaves.userId, userId), eq(storySaves.storyId, storyId))).limit(1);
  return !!r;
}

/** A reader's saved stories, newest saved first (live stories only). */
export async function savedStories(userId: string): Promise<{ slug: string; title: string; hook: string; readingMinutes: number; coverId: string | null }[]> {
  return httpDb
    .select({ slug: stories.slug, title: stories.title, hook: stories.hook, readingMinutes: stories.readingMinutes, coverId: stories.coverMediaId })
    .from(storySaves)
    .innerJoin(stories, eq(stories.id, storySaves.storyId))
    .where(and(eq(storySaves.userId, userId), eq(stories.status, "published"), sql`${stories.publishAt} <= now()`))
    .orderBy(desc(storySaves.createdAt));
}

/**
 * Attention for one story: each reader's furthest block and active seconds,
 * and read-through by where they came from (readers who finished ÷ readers
 * who opened, per source). For the writer only.
 */
export async function storyAttention(storyId: string): Promise<{
  depths: number[];
  seconds: number[];
  finishedSeconds: number[];
  bySource: { source: string; readers: number; finished: number }[];
}> {
  const [rows, src] = await Promise.all([
    httpDb.execute<{ depth: number; seconds: number; finished: boolean }>(sql`
      select d.depth, d.seconds,
        exists (select 1 from ${storyEvents} r where r.story_id = d.story_id and r.reader = d.reader and r.kind = 'read') as finished
      from ${storyEvents} d
      where d.story_id = ${storyId}::uuid and d.kind = 'depth'
    `),
    httpDb.execute<{ source: string | null; readers: number; finished: number }>(sql`
      with v as (
        select distinct on (reader) reader, source from ${storyEvents}
        where story_id = ${storyId}::uuid and kind = 'view'
        order by reader, created_at
      )
      select v.source, count(*)::int as readers,
        count(*) filter (where exists (select 1 from ${storyEvents} r where r.story_id = ${storyId}::uuid and r.reader = v.reader and r.kind = 'read'))::int as finished
      from v group by v.source
    `),
  ]);
  const list = <T,>(r: unknown): T[] => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
  const d = list<{ depth: number; seconds: number; finished: boolean }>(rows);
  return {
    depths: d.map((x) => Number(x.depth ?? 0)),
    seconds: d.map((x) => Number(x.seconds ?? 0)).filter((x) => x > 0),
    finishedSeconds: d.filter((x) => x.finished).map((x) => Number(x.seconds ?? 0)).filter((x) => x > 0),
    bySource: list<{ source: string | null; readers: number; finished: number }>(src)
      .map((x) => ({ source: x.source ?? "direct", readers: Number(x.readers), finished: Number(x.finished) }))
      .sort((a, b) => b.readers - a.readers),
  };
}

/**
 * The numbers every live story is compared on, in one read: readers, readers
 * in its first 7 days, readers past the opening (the third paragraph came on
 * screen), finishers, and readers who had read another story before this one
 * (the ones who came back). Anonymous reader keys only.
 */
export async function storyNumbers(): Promise<StoryNumbers[]> {
  try {
    const rows = await httpDb.execute<{ id: string; readers: number; week1: number; past_opening: number; finished: number; returning: number }>(sql`
      with live as (
        select id, publish_at from ${stories} where status = 'published' and publish_at <= now()
      ),
      firsts as (
        select e.story_id, e.reader, min(e.created_at) as at
        from ${storyEvents} e join live l on l.id = e.story_id
        where e.kind = 'view' group by e.story_id, e.reader
      ),
      first_any as (
        select reader, min(at) as at from firsts group by reader
      )
      select l.id::text as id,
        count(f.reader)::int as readers,
        count(f.reader) filter (where f.at < l.publish_at + interval '7 days')::int as week1,
        count(f.reader) filter (where exists (select 1 from ${storyEvents} d where d.story_id = l.id and d.reader = f.reader and d.kind = 'depth' and d.depth >= 2))::int as past_opening,
        count(f.reader) filter (where exists (select 1 from ${storyEvents} r where r.story_id = l.id and r.reader = f.reader and r.kind = 'read'))::int as finished,
        count(f.reader) filter (where a.at < f.at)::int as returning
      from live l
      left join firsts f on f.story_id = l.id
      left join first_any a on a.reader = f.reader
      group by l.id
    `);
    const list = ((rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[])) as { id: string; readers: number; week1: number; past_opening: number; finished: number; returning: number }[];
    return list.map((r) => ({ id: r.id, readers: Number(r.readers), week1: Number(r.week1), pastOpening: Number(r.past_opening), finished: Number(r.finished), returning: Number(r.returning) }));
  } catch (e) {
    console.error("storyNumbers", e);
    return [];
  }
}
