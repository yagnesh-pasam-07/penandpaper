CREATE TABLE "drop_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drop_thoughts" (
	"id" text PRIMARY KEY NOT NULL,
	"paper_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"shape" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	"carried_from" date
);
--> statement-breakpoint
ALTER TABLE "drop_papers" ADD CONSTRAINT "drop_papers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD CONSTRAINT "drop_thoughts_paper_id_drop_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."drop_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD CONSTRAINT "drop_thoughts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drop_papers_user_date_uq" ON "drop_papers" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "drop_thoughts_paper_idx" ON "drop_thoughts" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "drop_thoughts_user_idx" ON "drop_thoughts" USING btree ("user_id");