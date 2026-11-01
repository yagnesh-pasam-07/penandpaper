import "server-only";
import { createHmac } from "node:crypto";
import { and, count, countDistinct, desc, eq, gte, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { env } from "@/lib/env";
import { MAX_CLAPS, type Channel, type EventKind, type Source, type Totals } from "./reach";
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
export async function recordEvent(e: { storyId: string; kind: EventKind; reader: string; channel?: Channel | null; source?: Source | null; device?: "phone" | "desktop" | null }): Promise<void> {
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

/** Per-story totals for the Studio list, keyed by story id. */
export async function totalsByStory(): Promise<Record<string, Pick<Totals, "views" | "readers" | "reads" | "shares">>> {
  try {
    const rows = await httpDb
      .select({ storyId: storyEvents.storyId, kind: storyEvents.kind, n: count(), people: countDistinct(storyEvents.reader) })
      .from(storyEvents)
      .groupBy(storyEvents.storyId, storyEvents.kind);
    const out: Record<string, Pick<Totals, "views" | "readers" | "reads" | "shares">> = {};
    for (const r of rows) {
      const t = (out[r.storyId] ??= { views: 0, readers: 0, reads: 0, shares: 0 });
      if (r.kind === "view") {
        t.views = r.n;
        t.readers = r.people;
      } else if (r.kind === "read") t.reads = r.people;
      else if (r.kind === "share") t.shares = r.n;
    }
    return out;
  } catch {
    return {};
  }
}

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

/** Signed-in readers who clapped for a story, most claps first: for the writer only. */
export async function clappers(storyId: string, limit = 50): Promise<{ name: string; image: string | null; count: number }[]> {
  try {
    return await httpDb
      .select({ name: users.name, image: users.image, count: storyClaps.count })
      .from(storyClaps)
      .innerJoin(users, eq(users.id, storyClaps.userId))
      .where(eq(storyClaps.storyId, storyId))
      .orderBy(desc(storyClaps.count))
      .limit(limit);
  } catch {
    return [];
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
