import { date, index, integer, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "../../db/schema";

/** One paper per person per day (in DROP_TIMEZONE). */
export const dropPapers = pgTable(
  "drop_papers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** When the desk was cleared that evening, if it was. */
    clearedAt: timestamp("cleared_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [uniqueIndex("drop_papers_user_date_uq").on(t.userId, t.date)],
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
    /** Pen is a task; pencil is a loose idea. */
    kind: text("kind", { enum: ["pen", "pencil"] }).notNull().default("pen"),
    shape: integer("shape").notNull().default(0),
    /** When it was first dropped; kept when it rolls over. */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true, mode: "string" }),
    /** The day it was first dropped, when it rolled over from an earlier paper. */
    carriedFrom: date("carried_from", { mode: "string" }),
    /** Where it was dragged on the sheet: centre x as a share of the reading column's width (below 0 or above 1 when dragged out to the sides), y in px. Null until moved. */
    x: real("x"),
    y: real("y"),
    /** Folded away till this day. */
    scheduledFor: date("scheduled_for", { mode: "string" }),
    /** Crumpled (thrown away): hidden everywhere, removed for good a week later. */
    crumpledAt: timestamp("crumpled_at", { withTimezone: true, mode: "string" }),
    /** A pasted or dropped picture, as a small data URL; `text` is then its caption (may be empty). */
    image: text("image"),
  },
  (t) => [index("drop_thoughts_paper_idx").on(t.paperId), index("drop_thoughts_user_idx").on(t.userId)],
);
