CREATE TABLE "drop_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stack_hint_done_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "drop_papers" ADD COLUMN "cleared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drop_stacks" ADD COLUMN "scheduled_for" date;--> statement-breakpoint
ALTER TABLE "drop_stacks" ADD COLUMN "crumpled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "kind" text DEFAULT 'pen' NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "scheduled_for" date;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "crumpled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD CONSTRAINT "drop_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;