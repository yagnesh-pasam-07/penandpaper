import { date, index, integer, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "../../db/schema";

/** A canvas a person made: as many as they like, each with its own thoughts. */
export const dropPapers = pgTable(
  "drop_papers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Optional; a paper without one reads as "Untitled". */
    name: text("name"),
    /** When it was made: the date the header and library show. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last change (a thought added, moved, struck, crumpled, or the paper renamed): the last-touched paper is the one /drop opens. */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Put away: hidden from the switcher and library unless "Archived" is on. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Deleted: hidden everywhere, removed for good a week later (like a crumpled thought). */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("drop_papers_user_idx").on(t.userId)],
);

/** Small per-person settings and one-time hints for Drop. */
export const dropPrefs = pgTable("drop_prefs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** The canvas they draw on (an id from src/lib/canvases.ts); null means the default. */
  canvas: text("canvas"),
  /** Light, dark or system; null means system. */
  theme: text("theme"),
  /** How thoughts are written (an id from NOTE_FONTS in src/lib/canvases.ts); null means handwritten. */
  noteFont: text("note_font"),
});

export const dropThoughts = pgTable(
  "drop_thoughts",
  {
    /** Made in the browser, so a thought shows before the server answers. */
    id: text("id").primaryKey(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => dropPapers.id, { onDelete: "cascade" }),
    /** Copied from the paper so every query can check ownership directly. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    status: text("status", { enum: ["open", "done"] }).notNull().default("open"),
    shape: integer("shape").notNull().default(0),
    /** When it was dropped. */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true, mode: "string" }),
    /** Where it was dragged on the sheet: centre x as a share of the reading column's width (below 0 or above 1 when dragged out to the sides), y in px. Null until moved. */
    x: real("x"),
    y: real("y"),
    /** Crumpled (thrown away): hidden everywhere, removed for good a week later. */
    crumpledAt: timestamp("crumpled_at", { withTimezone: true, mode: "string" }),
    /** A pasted or dropped picture, as a small data URL; `text` is then its caption (may be empty). */
    image: text("image"),
    /** When Tonight's paper last decided something about it (struck, kept or crumpled); null while it is unreviewed. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [index("drop_thoughts_paper_idx").on(t.paperId), index("drop_thoughts_user_idx").on(t.userId)],
);

/** Keys for apps that save to a paper without a browser sign-in (the Mac menu-bar app). Only the hash of the secret is kept. */
export const dropApiTokens = pgTable(
  "drop_api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** What the person called it, e.g. "Mac app". */
    name: text("name").notNull(),
    /** SHA-256 (hex) of the secret. */
    tokenHash: text("token_hash").notNull().unique("drop_api_tokens_hash_uq"),
    /** The first characters of the secret, to tell tokens apart in a list. */
    prefix: text("prefix").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    /** Revoked tokens stop working at once and stay listed. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("drop_api_tokens_user_idx").on(t.userId)],
);

/**
 * One evening review per person per day (the local day in their time zone):
 * how many thoughts were struck, kept and crumpled, and when it was closed.
 * The counts are worked out from the thoughts after every choice, so Back and
 * Undo can never leave them wrong.
 */
export const dropDailyReviews = pgTable(
  "drop_daily_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The local day reviewed, YYYY-MM-DD. */
    date: date("date", { mode: "string" }).notNull(),
    struck: integer("struck").notNull().default(0),
    kept: integer("kept").notNull().default(0),
    crumpled: integer("crumpled").notNull().default(0),
    /** When the last unreviewed thought was decided; null while some remain. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("drop_daily_reviews_user_date_uq").on(t.userId, t.date)],
);
