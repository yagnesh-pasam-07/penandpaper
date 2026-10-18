CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"account_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"tz" text NOT NULL,
	"city" text NOT NULL,
	"hours" real NOT NULL,
	"tint" text NOT NULL,
	"status" text NOT NULL,
	"leave" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "papers" (
	"project_id" text NOT NULL,
	"date" date NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp with time zone,
	"closed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thanked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "papers_project_id_date_pk" PRIMARY KEY("project_id","date")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"lead_name" text NOT NULL,
	"hours_per_day" integer NOT NULL,
	"invite_code" text NOT NULL,
	"lead_tz" text NOT NULL,
	"lead_city" text NOT NULL,
	"invites_sent" boolean DEFAULT false NOT NULL,
	"working_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"paper_date" date NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"est" real,
	"assignee_id" text,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"carried_from" date,
	"carry_note" text,
	"blocked" jsonb,
	"request" jsonb,
	"shape" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "papers" ADD CONSTRAINT "papers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_project_idx" ON "members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "members_account_idx" ON "members" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_invite_code_idx" ON "projects" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tasks_paper_idx" ON "tasks" USING btree ("project_id","paper_date");