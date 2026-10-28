import { index, integer, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
  },
  (t) => [index("drop_thoughts_paper_idx").on(t.paperId), index("drop_thoughts_user_idx").on(t.userId)],
);
