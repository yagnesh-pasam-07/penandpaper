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
  },
  (t) => [uniqueIndex("drop_papers_user_date_uq").on(t.userId, t.date)],
);

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
  },
  (t) => [index("drop_thoughts_paper_idx").on(t.paperId), index("drop_thoughts_user_idx").on(t.userId)],
);
