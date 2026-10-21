import { boolean, date, index, integer, pgTable, real, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
  /** The "drag one note onto another" hint was dismissed, or a first stack was made. */
  stackHintDoneAt: timestamp("stack_hint_done_at", { withTimezone: true, mode: "string" }),
});

/** Thoughts piled together on one paper, like sticky notes. */
export const dropStacks = pgTable(
  "drop_stacks",
  {
    /** Made in the browser, like a thought's. */
    id: text("id").primaryKey(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => dropPapers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    /** Spot on the sheet, like a thought's (x: share of width, y: px); null while it flows. */
    x: real("x"),
    y: real("y"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    /** The day it was first made, when it rolled over from an earlier paper. */
    carriedFrom: date("carried_from", { mode: "string" }),
    /** Folded away till this day. */
    scheduledFor: date("scheduled_for", { mode: "string" }),
    /** Crumpled (thrown away): hidden everywhere, removed for good a week later. */
    crumpledAt: timestamp("crumpled_at", { withTimezone: true, mode: "string" }),
    /** Numbered as a whole (1 is first); unique per paper among numbered ones, kept so by the update logic. */
    rank: smallint("rank"),
    /** Picked for tomorrow's top 3: arrives numbered. */
    nextRank: smallint("next_rank"),
  },
  (t) => [index("drop_stacks_paper_idx").on(t.paperId)],
);

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
    /** Where it was dragged on the sheet: centre x as a share of the width, y in px. Null until moved. */
    x: real("x"),
    y: real("y"),
    stackId: text("stack_id").references(() => dropStacks.id, { onDelete: "set null" }),
    /** Place in its stack; higher is nearer the top. */
    stackOrder: integer("stack_order").notNull().default(0),
    /** Folded away till this day. */
    scheduledFor: date("scheduled_for", { mode: "string" }),
    /** Crumpled (thrown away): hidden everywhere, removed for good a week later. */
    crumpledAt: timestamp("crumpled_at", { withTimezone: true, mode: "string" }),
    /** Place in today's order (1 is first), if numbered; unique per paper among numbered ones, kept so by the update logic. */
    rank: smallint("rank"),
    /** Picked for tomorrow's top 3: arrives numbered. */
    nextRank: smallint("next_rank"),
    /** A pasted or dropped picture, as a small data URL; `text` is then its caption (may be empty). */
    image: text("image"),
  },
  (t) => [index("drop_thoughts_paper_idx").on(t.paperId), index("drop_thoughts_user_idx").on(t.userId)],
);

/** Ink lines joining two thoughts or stacks on one paper. */
export const dropLinks = pgTable(
  "drop_links",
  {
    /** Made in the browser, like a thought's. */
    id: text("id").primaryKey(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => dropPapers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** A thought's or a stack's id. */
    fromId: text("from_id").notNull(),
    toId: text("to_id").notNull(),
    label: text("label"),
    arrow: boolean("arrow").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("drop_links_paper_idx").on(t.paperId)],
);
