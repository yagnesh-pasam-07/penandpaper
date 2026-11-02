ALTER TABLE "story_events" ADD COLUMN "depth" integer;--> statement-breakpoint
ALTER TABLE "story_events" ADD COLUMN "seconds" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "story_events_depth_uniq" ON "story_events" USING btree ("story_id","reader") WHERE "story_events"."kind" = 'depth';