import "server-only";
import { createHmac } from "node:crypto";
import { and, count, countDistinct, desc, eq, gte, sql } from "drizzle-orm";
import { httpDb } from "@/db";
import { env } from "@/lib/env";
import type { Channel, EventKind, Source, Totals } from "./reach";
import { stories, storyEvents } from "./schema";

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
