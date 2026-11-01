import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { httpDb } from "@/db";
import { users } from "@/db/schema";
import { isLive, readingMinutes, slugify, storyState, uniqueSlug, type Category, type StoryState } from "./logic";
import { firstLine } from "./markdown";
import { stories, storyMedia, storyMediaParts } from "./schema";

/** Every cached read of stories carries this tag; every write expires it. */
export const STORIES_TAG = "stories";

export type StoryCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  hook: string;
  category: Category;
  readingMinutes: number;
  coverId: string | null;
  hasAudio: boolean;
  publishAt: string;
  series: string;
  language: string;
  claps: number;
};

export type Story = StoryCard & {
  body: string;
  coverCaption: string;
  personName: string;
  personPlace: string;
  personPhotoId: string | null;
  personConsent: boolean;
  sources: string;
  translationOf: string | null;
  audioId: string | null;
  audioDurationSec: number | null;
  originalUrl: string | null;
  shareText: string;
  shareMediaId: string | null;
  author: string;
  updatedAt: string;
};

export type DraftRow = { id: string; slug: string; title: string; state: StoryState; publishAt: string | null; updatedAt: string; readingMinutes: number };

const cardCols = {
  id: stories.id,
  slug: stories.slug,
  title: stories.title,
  subtitle: stories.subtitle,
  hook: stories.hook,
  body: stories.body,
  category: stories.category,
  readingMinutes: stories.readingMinutes,
  coverId: stories.coverMediaId,
  audioId: stories.audioMediaId,
  publishAt: stories.publishAt,
  series: stories.series,
  language: stories.language,
  claps: stories.claps,
};

type CardRow = { id: string; slug: string; title: string; subtitle: string; hook: string; body: string; category: Category; readingMinutes: number; coverId: string | null; audioId: string | null; publishAt: Date | null; series: string; language: string; claps: number };

const toCard = (r: CardRow): StoryCard => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  subtitle: r.subtitle,
  hook: r.hook || firstLine(r.body),
  category: r.category,
  readingMinutes: r.readingMinutes,
  coverId: r.coverId,
  hasAudio: !!r.audioId,
  publishAt: (r.publishAt ?? new Date(0)).toISOString(),
  series: r.series,
  language: r.language,
  claps: r.claps,
});

const live = (now: Date) => and(eq(stories.status, "published"), lte(stories.publishAt, now));

/*
 * Public reads are cached and shared by every reader. They are re-checked at
 * most every 15 minutes, so a scheduled story goes live within 15 minutes of
 * its time, and a write in Studio expires them at once (STORIES_TAG).
 * A table that isn't there yet (before the migration) reads as no stories.
 */

/** Published stories, newest first, or most loved (most claps) first. */
export async function publishedStories(limit = 60, order: "new" | "loved" = "new"): Promise<StoryCard[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  try {
    const rows = await httpDb
      .select(cardCols)
      .from(stories)
      .where(live(new Date()))
      .orderBy(...(order === "loved" ? [desc(stories.claps), desc(stories.publishAt)] : [desc(stories.publishAt)]))
      .limit(limit);
    return rows.map(toCard);
  } catch {
    return [];
  }
}

/** The newest published story: "This week's story". */
export async function latestStory(): Promise<StoryCard | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  return (await publishedStories(1))[0] ?? null;
}

async function loadStory(where: ReturnType<typeof eq>): Promise<(Story & { status: "draft" | "published"; publishAtRaw: Date | null }) | null> {
  const [r] = await httpDb
    .select({ ...cardCols, coverCaption: stories.coverCaption, personName: stories.personName, personPlace: stories.personPlace, personPhotoId: stories.personPhotoId, personConsent: stories.personConsent, sources: stories.sources, translationOf: stories.translationOf, audioDurationSec: stories.audioDurationSec, originalUrl: stories.originalUrl, shareText: stories.shareText, shareMediaId: stories.shareMediaId, status: stories.status, updatedAt: stories.updatedAt, author: users.name })
    .from(stories)
    .innerJoin(users, eq(users.id, stories.authorId))
    .where(where)
    .limit(1);
  if (!r) return null;
  return {
    ...toCard(r),
    body: r.body,
    coverCaption: r.coverCaption,
    personName: r.personName,
    personPlace: r.personPlace,
    personPhotoId: r.personPhotoId,
    personConsent: r.personConsent,
    sources: r.sources,
    translationOf: r.translationOf,
    audioId: r.audioId,
    audioDurationSec: r.audioDurationSec,
    originalUrl: r.originalUrl,
    shareText: r.shareText,
    shareMediaId: r.shareMediaId,
    author: r.author,
    updatedAt: r.updatedAt.toISOString(),
    status: r.status,
    publishAtRaw: r.publishAt,
  };
}

/** One published story by its address, or null (drafts and scheduled stories are not found). */
export async function publishedStory(slug: string): Promise<Story | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  try {
    const s = await loadStory(eq(stories.slug, slug));
    if (!s || !isLive(s.status, s.publishAtRaw)) return null;
    return { ...s, status: undefined, publishAtRaw: undefined } as Story;
  } catch {
    return null;
  }
}

/** Slugs of every published story, for the sitemap and prerendering. */
export async function publishedSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  try {
    const rows = await httpDb.select({ slug: stories.slug, updatedAt: stories.updatedAt }).from(stories).where(live(new Date())).orderBy(desc(stories.publishAt));
    return rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt.toISOString() }));
  } catch {
    return [];
  }
}

/* ---------- Studio (the writer only; callers check storyWriter() first) ---------- */

/** Any story, draft or not, for the editor and the preview. */
export async function storyForWriter(id: string): Promise<(Story & { state: StoryState; status: "draft" | "published"; publishAtRaw: Date | null }) | null> {
  const s = await loadStory(eq(stories.id, id));
  return s ? { ...s, state: storyState(s.status, s.publishAtRaw) } : null;
}

export async function allStories(): Promise<DraftRow[]> {
  const rows = await httpDb
    .select({ id: stories.id, slug: stories.slug, title: stories.title, status: stories.status, publishAt: stories.publishAt, updatedAt: stories.updatedAt, readingMinutes: stories.readingMinutes })
    .from(stories)
    .orderBy(desc(stories.updatedAt));
  return rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, state: storyState(r.status, r.publishAt), publishAt: r.publishAt?.toISOString() ?? null, updatedAt: r.updatedAt.toISOString(), readingMinutes: r.readingMinutes }));
}

async function freeSlug(title: string, exceptId?: string): Promise<string> {
  const base = slugify(title || "untitled");
  const taken = await httpDb
    .select({ slug: stories.slug })
    .from(stories)
    .where(and(sql`${stories.slug} like ${`${base}%`}`, exceptId ? ne(stories.id, exceptId) : undefined));
  return uniqueSlug(base, taken.map((t) => t.slug));
}

/** A new, empty draft. */
export async function createStory(authorId: string, init: { title?: string; subtitle?: string; hook?: string; body?: string; category?: Category; originalUrl?: string | null } = {}): Promise<string> {
  const slug = await freeSlug(init.title ?? "untitled");
  const [row] = await httpDb
    .insert(stories)
    .values({ slug, authorId, title: init.title ?? "", subtitle: init.subtitle ?? "", hook: init.hook ?? "", body: init.body ?? "", category: init.category ?? "human", originalUrl: init.originalUrl ?? null, readingMinutes: readingMinutes(init.body ?? "") })
    .returning({ id: stories.id });
  return row.id;
}

export type StoryPatch = {
  title?: string;
  subtitle?: string;
  hook?: string;
  body?: string;
  category?: Category;
  coverMediaId?: string | null;
  coverCaption?: string;
  audioMediaId?: string | null;
  audioDurationSec?: number | null;
  originalUrl?: string | null;
  shareText?: string;
  shareMediaId?: string | null;
  personName?: string;
  personPlace?: string;
  personPhotoId?: string | null;
  personConsent?: boolean;
  series?: string;
  sources?: string;
  language?: string;
};

/**
 * Saves the writer's changes. The address follows the title while it is a
 * draft, and is fixed once published (links shared on WhatsApp keep working).
 */
export async function saveStory(id: string, patch: StoryPatch): Promise<{ slug: string; readingMinutes: number } | null> {
  const [cur] = await httpDb.select({ status: stories.status, slug: stories.slug, body: stories.body, translationOf: stories.translationOf, title: stories.title, subtitle: stories.subtitle }).from(stories).where(eq(stories.id, id)).limit(1);
  if (!cur) return null;
  const set: Partial<typeof stories.$inferInsert> = { ...patch, updatedAt: new Date() };
  if (patch.body !== undefined) set.readingMinutes = readingMinutes(patch.body);
  // A draft's address follows its title, or its subtitle when the title has no Latin letters (a Telugu title).
  if ((patch.title !== undefined || patch.subtitle !== undefined) && cur.status === "draft" && !cur.translationOf) {
    const title = patch.title ?? cur.title;
    const subtitle = patch.subtitle ?? cur.subtitle;
    set.slug = await freeSlug(slugify(title) !== "story" ? title : subtitle.split(/[.!?]/)[0] || title, id);
  }
  const [row] = await httpDb.update(stories).set(set).where(eq(stories.id, id)).returning({ slug: stories.slug, readingMinutes: stories.readingMinutes });
  return row ?? null;
}

/** Publish now (`at` = now) or later; or back to a draft (`at` = null). */
export async function setPublished(id: string, at: Date | null): Promise<void> {
  await httpDb
    .update(stories)
    .set(at ? { status: "published", publishAt: at, updatedAt: new Date() } : { status: "draft", updatedAt: new Date() })
    .where(eq(stories.id, id));
  // Back to a draft, a translation takes the original's address plus its language again (a draft isn't public, so nothing breaks).
  if (!at) {
    const [t] = await httpDb.select({ of: stories.translationOf, language: stories.language }).from(stories).where(eq(stories.id, id)).limit(1);
    const [src] = t?.of ? await httpDb.select({ slug: stories.slug }).from(stories).where(eq(stories.id, t.of)).limit(1) : [];
    if (src) await httpDb.update(stories).set({ slug: await freeSlug(`${src.slug} ${t.language}`, id) }).where(eq(stories.id, id));
  }
}

export async function deleteStory(id: string): Promise<void> {
  await httpDb.delete(stories).where(eq(stories.id, id));
}

/* ---------- Media ---------- */

/** Each part's size in base64 characters (about 1.5 MB of file). A request stays under Vercel's 4.5 MB body limit. */
export const PART_CHARS = 2_000_000;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;

export async function startMedia(storyId: string, m: { kind: "image" | "audio"; contentType: string; size: number; parts: number; width?: number; height?: number }): Promise<string> {
  const [row] = await httpDb
    .insert(storyMedia)
    .values({ storyId, kind: m.kind, contentType: m.contentType, size: m.size, parts: m.parts, width: m.width ?? null, height: m.height ?? null })
    .returning({ id: storyMedia.id });
  return row.id;
}

/** Stores part `n`; when the last part is in, marks the file complete. */
export async function putMediaPart(mediaId: string, n: number, data: string): Promise<{ complete: boolean } | null> {
  const [m] = await httpDb.select({ parts: storyMedia.parts }).from(storyMedia).where(eq(storyMedia.id, mediaId)).limit(1);
  if (!m || n < 0 || n >= m.parts) return null;
  await httpDb.insert(storyMediaParts).values({ mediaId, n, data }).onConflictDoUpdate({ target: [storyMediaParts.mediaId, storyMediaParts.n], set: { data } });
  const [{ count }] = await httpDb.select({ count: sql<number>`count(*)::int` }).from(storyMediaParts).where(eq(storyMediaParts.mediaId, mediaId));
  const complete = count >= m.parts;
  if (complete) await httpDb.update(storyMedia).set({ complete: true }).where(eq(storyMedia.id, mediaId));
  return { complete };
}

export type MediaMeta = { id: string; storyId: string; kind: "image" | "audio"; contentType: string; size: number; parts: number; width: number | null; height: number | null };

/** A finished file's details, or null. */
export async function mediaMeta(id: string): Promise<MediaMeta | null> {
  const [m] = await httpDb
    .select({ id: storyMedia.id, storyId: storyMedia.storyId, kind: storyMedia.kind, contentType: storyMedia.contentType, size: storyMedia.size, parts: storyMedia.parts, width: storyMedia.width, height: storyMedia.height })
    .from(storyMedia)
    .where(and(eq(storyMedia.id, id), eq(storyMedia.complete, true)))
    .limit(1);
  return m ?? null;
}

/** Sizes of a story's pictures, so the page reserves their space (no jumping while they load). */
export async function mediaSizes(ids: string[]): Promise<Record<string, { w: number; h: number }>> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  if (!ids.length) return {};
  const rows = await httpDb.select({ id: storyMedia.id, w: storyMedia.width, h: storyMedia.height }).from(storyMedia).where(inArray(storyMedia.id, ids));
  return Object.fromEntries(rows.filter((r) => r.w && r.h).map((r) => [r.id, { w: r.w!, h: r.h! }]));
}

/** The parts in `[from, to]` (all of them when `to` is left out), decoded, in order. */
export async function mediaBytes(id: string, from = 0, to?: number): Promise<Buffer> {
  const rows = await httpDb
    .select({ n: storyMediaParts.n, data: storyMediaParts.data })
    .from(storyMediaParts)
    .where(and(eq(storyMediaParts.mediaId, id), gte(storyMediaParts.n, from), to === undefined ? undefined : lte(storyMediaParts.n, to)))
    .orderBy(asc(storyMediaParts.n));
  return Buffer.concat(rows.map((r) => Buffer.from(r.data, "base64")));
}

/** Whether the public may fetch this file: it belongs to a story that is live now. */
export async function mediaIsPublic(storyId: string, mediaId?: string): Promise<boolean> {
  const [s] = await httpDb.select({ status: stories.status, publishAt: stories.publishAt }).from(stories).where(eq(stories.id, storyId)).limit(1);
  if (s && isLive(s.status, s.publishAt)) return true;
  if (!mediaId) return false;
  // A translation shares the original's cover and photos: public while a live story shows it.
  const [user] = await httpDb
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        live(new Date()),
        sql`(${stories.coverMediaId} = ${mediaId} or ${stories.personPhotoId} = ${mediaId} or ${stories.shareMediaId} = ${mediaId} or ${stories.audioMediaId} = ${mediaId} or ${stories.body} like ${`%media:${mediaId}%`})`,
      ),
    )
    .limit(1);
  return !!user;
}

/** Published stories in one series (by its address), oldest first: a series reads in order. */
export async function seriesStories(slug: string): Promise<{ name: string; stories: StoryCard[] }> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  try {
    const rows = await httpDb.select(cardCols).from(stories).where(and(live(new Date()), ne(stories.series, ""))).orderBy(asc(stories.publishAt));
    const inSeries = rows.filter((r) => slugify(r.series) === slug);
    return { name: inSeries[0]?.series ?? "", stories: inSeries.map(toCard) };
  } catch {
    return { name: "", stories: [] };
  }
}

/** Every series with at least one published story, for the stories page. */
export async function allSeries(): Promise<{ name: string; slug: string; count: number }[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  try {
    const rows = await httpDb.select({ series: stories.series, n: sql<number>`count(*)::int` }).from(stories).where(and(live(new Date()), ne(stories.series, ""))).groupBy(stories.series);
    return rows.map((r) => ({ name: r.series, slug: slugify(r.series), count: r.n }));
  } catch {
    return [];
  }
}

/**
 * The same story in the other language, if it is published: either this
 * story is a translation of it, or it is a translation of this one.
 */
export async function translationOf(storyId: string, ofId: string | null): Promise<{ slug: string; language: string } | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  try {
    const [r] = await httpDb
      .select({ slug: stories.slug, language: stories.language })
      .from(stories)
      .where(and(live(new Date()), ofId ? eq(stories.id, ofId) : eq(stories.translationOf, storyId)))
      .limit(1);
    return r ?? null;
  } catch {
    return null;
  }
}

/** Makes a draft translation of a story: same picture, person, series and sources; text to be translated. */
export async function createTranslation(fromId: string, authorId: string, language: string): Promise<string | null> {
  const [src] = await httpDb.select().from(stories).where(eq(stories.id, fromId)).limit(1);
  if (!src) return null;
  const [existing] = await httpDb.select({ id: stories.id }).from(stories).where(eq(stories.translationOf, fromId)).limit(1);
  if (existing) return existing.id;
  // The original's address plus the language ("the-man-behind-the-words-te"): readable even when the title is all Telugu.
  const slug = await freeSlug(`${src.slug} ${language}`);
  const [row] = await httpDb
    .insert(stories)
    .values({
      slug,
      authorId,
      title: src.title,
      subtitle: src.subtitle,
      hook: src.hook,
      body: src.body,
      category: src.category,
      language,
      coverMediaId: src.coverMediaId,
      coverCaption: src.coverCaption,
      personName: src.personName,
      personPlace: src.personPlace,
      personPhotoId: src.personPhotoId,
      personConsent: src.personConsent,
      series: src.series,
      sources: src.sources,
      originalUrl: src.originalUrl,
      translationOf: fromId,
      readingMinutes: src.readingMinutes,
    })
    .returning({ id: stories.id });
  return row.id;
}

/** Every series name used so far (drafts too), for the editor's suggestions. */
export async function seriesNames(): Promise<string[]> {
  const rows = await httpDb.selectDistinct({ series: stories.series }).from(stories).where(ne(stories.series, ""));
  return rows.map((r) => r.series).sort();
}

/** The most-clapped story published in the last 30 days, if any has claps: the homepage feature. */
export async function lovedThisMonth(): Promise<StoryCard | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  try {
    const [r] = await httpDb
      .select(cardCols)
      .from(stories)
      .where(and(live(new Date()), sql`${stories.claps} > 0`, sql`${stories.publishAt} > now() - interval '30 days'`))
      .orderBy(desc(stories.claps), desc(stories.publishAt))
      .limit(1);
    return r ? toCard(r) : null;
  } catch {
    return null;
  }
}
