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
};

export type Story = StoryCard & {
  body: string;
  coverCaption: string;
  language: string;
  audioId: string | null;
  audioDurationSec: number | null;
  originalUrl: string | null;
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
};

type CardRow = { id: string; slug: string; title: string; subtitle: string; hook: string; body: string; category: Category; readingMinutes: number; coverId: string | null; audioId: string | null; publishAt: Date | null };

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
});

const live = (now: Date) => and(eq(stories.status, "published"), lte(stories.publishAt, now));

/*
 * Public reads are cached and shared by every reader. They are re-checked at
 * most every 15 minutes, so a scheduled story goes live within 15 minutes of
 * its time, and a write in Studio expires them at once (STORIES_TAG).
 * A table that isn't there yet (before the migration) reads as no stories.
 */

/** Published stories, newest first. */
export async function publishedStories(limit = 60): Promise<StoryCard[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
  cacheTag(STORIES_TAG);
  try {
    const rows = await httpDb.select(cardCols).from(stories).where(live(new Date())).orderBy(desc(stories.publishAt)).limit(limit);
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
    .select({ ...cardCols, coverCaption: stories.coverCaption, language: stories.language, audioDurationSec: stories.audioDurationSec, originalUrl: stories.originalUrl, status: stories.status, updatedAt: stories.updatedAt, author: users.name })
    .from(stories)
    .innerJoin(users, eq(users.id, stories.authorId))
    .where(where)
    .limit(1);
  if (!r) return null;
  return {
    ...toCard(r),
    body: r.body,
    coverCaption: r.coverCaption,
    language: r.language,
    audioId: r.audioId,
    audioDurationSec: r.audioDurationSec,
    originalUrl: r.originalUrl,
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
};

/**
 * Saves the writer's changes. The address follows the title while it is a
 * draft, and is fixed once published (links shared on WhatsApp keep working).
 */
export async function saveStory(id: string, patch: StoryPatch): Promise<{ slug: string; readingMinutes: number } | null> {
  const [cur] = await httpDb.select({ status: stories.status, slug: stories.slug, body: stories.body }).from(stories).where(eq(stories.id, id)).limit(1);
  if (!cur) return null;
  const set: Partial<typeof stories.$inferInsert> = { ...patch, updatedAt: new Date() };
  if (patch.body !== undefined) set.readingMinutes = readingMinutes(patch.body);
  if (patch.title !== undefined && cur.status === "draft") set.slug = await freeSlug(patch.title, id);
  const [row] = await httpDb.update(stories).set(set).where(eq(stories.id, id)).returning({ slug: stories.slug, readingMinutes: stories.readingMinutes });
  return row ?? null;
}

/** Publish now (`at` = now) or later; or back to a draft (`at` = null). */
export async function setPublished(id: string, at: Date | null): Promise<void> {
  await httpDb
    .update(stories)
    .set(at ? { status: "published", publishAt: at, updatedAt: new Date() } : { status: "draft", updatedAt: new Date() })
    .where(eq(stories.id, id));
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
export async function mediaIsPublic(storyId: string): Promise<boolean> {
  const [s] = await httpDb.select({ status: stories.status, publishAt: stories.publishAt }).from(stories).where(eq(stories.id, storyId)).limit(1);
  return !!s && isLive(s.status, s.publishAt);
}
