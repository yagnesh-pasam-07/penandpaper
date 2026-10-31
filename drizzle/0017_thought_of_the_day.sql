CREATE TABLE "drop_push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "recall_time" text DEFAULT '09:00';--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "recall_days" jsonb;--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "recall_sound" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "recall_seen_on" text;--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "recall_notified_on" text;--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "recall_skipped" jsonb;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "recall_shown_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drop_push_subscriptions" ADD CONSTRAINT "drop_push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drop_push_user_idx" ON "drop_push_subscriptions" USING btree ("user_id");