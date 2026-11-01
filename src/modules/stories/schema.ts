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
    /** Total claps, kept in step with story_claps, for ranking "Most loved" without a sum on every page. */
    claps: integer("claps").notNull().default(0),
    /** The writer's own voice, read aloud. No text-to-speech. */
    audioMediaId: uuid("audio_media_id"),
    audioDurationSec: integer("audio_duration_sec"),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    /** The line a reader's WhatsApp message starts with; empty = the default ("I read this and thought of you."). */
    shareText: text("share_text").notNull().default(""),
    /** A picture for link previews, if not the cover. */
    shareMediaId: uuid("share_media_id"),
    /** The person the story is about: their name, where they are, and their real photo (never stock). */
    personName: text("person_name").notNull().default(""),
    personPlace: text("person_place").notNull().default(""),
    personPhotoId: uuid("person_photo_id"),
    /** They agreed to be featured: shows "Shared with their permission". */
    personConsent: boolean("person_consent").notNull().default(false),
    /** A series it belongs to, by name ("The man behind the words"); its page is /stories/series/<slugify(name)>. */
    series: text("series").notNull().default(""),
    /** Sources and references, one per line ("Title — https://…" or plain text). */
    sources: text("sources").notNull().default(""),
    /** The same story in the other language (Telugu ⇄ English): the other story's id. */
    translationOf: uuid("translation_of"),
    /** Where it first appeared (e.g. Medium), for "First published on …" and the canonical link. */
    originalUrl: text("original_url"),
    /** One author today; the column is here so more writers need no rewrite. */
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stories_live_idx").on(t.status, t.publishAt), index("stories_series_idx").on(t.series)],
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

/**
 * What readers do with a story, for the writer's Story Studio: a view, a
 * read to the end, a listen, a share (and where to). Anonymous: `reader` is a
 * hash of a random id the browser keeps (never a cookie, never an IP), so we
 * can count people, not who they are. Readers never see these numbers.
 */
export const storyEvents = pgTable(
  "story_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["view", "read", "listen", "share"] }).notNull(),
    /** For a share: whatsapp, instagram, copy, native, x, other. */
    channel: text("channel"),
    /** Where the reader came from: whatsapp, instagram, google, home, stories, direct, other. */
    source: text("source"),
    device: text("device", { enum: ["phone", "desktop"] }),
    reader: text("reader").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("story_events_story_idx").on(t.storyId, t.kind), index("story_events_time_idx").on(t.createdAt)],
);

/**
 * Claps: a reader taps as many times as a story moved them, up to 50 (like
 * Medium). One row per reader per story, holding their count, so the total
 * is a sum and nobody can clap a story to the top alone.
 */
export const storyClaps = pgTable(
  "story_claps",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    /** The anonymous reader key as story_events, or "u:<user id>" for a signed-in reader (one count across all their devices). */
    reader: text("reader").notNull(),
    /** Set when a signed-in reader clapped, so the writer can see who loved a story. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.reader], name: "story_claps_pk" })],
);

/** A reader's "save for later" list: signed-in readers only. */
export const storySaves = pgTable(
  "story_saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.storyId], name: "story_saves_pk" }), index("story_saves_user_idx").on(t.userId, t.createdAt)],
);
