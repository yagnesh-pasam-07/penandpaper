import { boolean, date, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { CarryReason, TimeRequest } from "@/lib/types";

/** One per browser session that signed up, joined, or loaded the demo. */
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  /** SHA-256 of the session cookie; the cookie itself is never stored. */
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    leadName: text("lead_name").notNull(),
    hoursPerDay: integer("hours_per_day").notNull(),
    inviteCode: text("invite_code").notNull(),
    leadTz: text("lead_tz").notNull(),
    leadCity: text("lead_city").notNull(),
    invitesSent: boolean("invites_sent").notNull().default(false),
    currentDate: date("working_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_invite_code_idx").on(t.inviteCode), index("projects_owner_idx").on(t.ownerId)],
);

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Set once the person joins from their invite link. */
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    tz: text("tz").notNull(),
    city: text("city").notNull(),
    hours: real("hours").notNull(),
    tint: text("tint").notNull(),
    status: text("status").notNull(),
    leave: jsonb("leave").$type<string[]>().notNull().default([]),
    position: integer("position").notNull(),
  },
  (t) => [index("members_project_idx").on(t.projectId), index("members_account_idx").on(t.accountId)],
);

export const papers = pgTable(
  "papers",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
    closed: jsonb("closed").$type<Record<string, { at: string; reason?: CarryReason }>>().notNull().default({}),
    thanked: boolean("thanked").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.date] })],
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    paperDate: date("paper_date", { mode: "string" }).notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    est: real("est"),
    assigneeId: text("assignee_id"),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true, mode: "string" }),
    carriedFrom: date("carried_from", { mode: "string" }),
    carryNote: text("carry_note"),
    blocked: jsonb("blocked").$type<{ why: string; at: string }>(),
    request: jsonb("request").$type<TimeRequest>(),
    shape: integer("shape").notNull().default(0),
  },
  (t) => [index("tasks_paper_idx").on(t.projectId, t.paperDate)],
);
