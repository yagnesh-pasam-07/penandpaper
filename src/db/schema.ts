import { bigint, boolean, date, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { CarryReason, TimeRequest } from "@/lib/types";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/*
 * Auth tables. Better Auth reads and writes these through its Drizzle adapter
 * (src/lib/auth.ts, `usePlural: true`). The property names are the field names
 * Better Auth expects; only the column names are ours.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique("users_email_uq"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** "user" for everyone; "admin" opens Studio (with its passcode). Set only by `npm run set-role`, never by the app. */
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  /** When a page of theirs was last open and visible (a ping each minute); Studio's "online now". */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique("sessions_token_uq"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** One row per way a user can sign in (e.g. `google`). Email links need no row. */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId), uniqueIndex("accounts_provider_account_uq").on(t.providerId, t.accountId)],
);

/** Short-lived values: sign-in links and Google sign-ins in progress. */
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/** Request counts for Better Auth's rate limiter, shared across serverless functions. */
export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique("rate_limits_key_uq"),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/*
 * Planning tables.
 */

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    leadName: text("lead_name").notNull(),
    hoursPerDay: integer("hours_per_day").notNull(),
    inviteCode: text("invite_code").notNull(),
    leadTz: text("lead_tz").notNull(),
    leadCity: text("lead_city").notNull(),
    invitesSent: boolean("invites_sent").notNull().default(false),
    currentDate: date("working_date", { mode: "string" }).notNull(),
    /** The /demo story: never sends email to its made-up people. */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
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
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
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
  (t) => [index("members_project_idx").on(t.projectId), index("members_user_idx").on(t.userId)],
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
