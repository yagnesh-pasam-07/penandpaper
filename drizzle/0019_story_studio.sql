CREATE TABLE "story_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"channel" text,
	"source" text,
	"device" text,
	"reader" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "share_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "share_media_id" uuid;--> statement-breakpoint
ALTER TABLE "story_events" ADD CONSTRAINT "story_events_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_events_story_idx" ON "story_events" USING btree ("story_id","kind");--> statement-breakpoint
CREATE INDEX "story_events_time_idx" ON "story_events" USING btree ("created_at");