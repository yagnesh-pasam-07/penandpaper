import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "../../db/schema";

/**
 * Stories: real human stories, history and art, written in Studio and read
 * (or heard) by anyone. Public, and nothing to do with anyone's private paper.
 *
 * "Scheduled" is not stored: it is a published story whose `publish_at` is
 * still ahead. Live ⇔ status = 'published' and publish_at <= now().
 */
export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The address: /stories/<slug>. Unique, readable, set from the title until first published. */
    slug: text("slug").notNull().unique("stories_slug_uq"),
    title: text("title").notNull().default(""),
    subtitle: text("subtitle").notNull().default(""),
    /** One line that makes you want to read it: the homepage, the share preview and the list. */
    hook: text("hook").notNull().default(""),
    /** The story in plain Markdown (see markdown.ts for what it understands). */
    body: text("body").notNull().default(""),
    coverMediaId: uuid("cover_media_id"),
    /** The line under the cover picture (Markdown pictures carry their own captions). */
    coverCaption: text("cover_caption").notNull().default(""),
    category: text("category", { enum: ["human", "history", "art"] }).notNull().default("human"),
    /** For translations later (Telugu first); every story is one language. */
    language: text("language").notNull().default("en"),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    /** The writer's own voice, read aloud. No text-to-speech. */
    audioMediaId: uuid("audio_media_id"),
    audioDurationSec: integer("audio_duration_sec"),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    /** Where it first appeared (e.g. Medium), for "First published on …" and the canonical link. */
    originalUrl: text("original_url"),
    /** One author today; the column is here so more writers need no rewrite. */
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stories_live_idx").on(t.status, t.publishAt)],
);

/**
 * A picture or a recording for a story. The bytes live in `story_media_parts`
 * (2 MB each, base64) until they move to object storage with the paper's pictures.
 */
export const storyMedia = pgTable(
  "story_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["image", "audio"] }).notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull().default(0),
    parts: integer("parts").notNull().default(1),
    width: integer("width"),
    height: integer("height"),
    /** All parts are in: only then is it served. A picture's caption and artist live in the story's Markdown. */
    complete: boolean("complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("story_media_story_idx").on(t.storyId)],
);

export const storyMediaParts = pgTable(
  "story_media_parts",
  {
    mediaId: uuid("media_id")
      .notNull()
      .references(() => storyMedia.id, { onDelete: "cascade" }),
    n: integer("n").notNull(),
    data: text("data").notNull(),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.n], name: "story_media_parts_pk" })],
);
