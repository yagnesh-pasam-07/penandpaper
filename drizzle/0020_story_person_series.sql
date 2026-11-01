ALTER TABLE "stories" ADD COLUMN "person_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "person_place" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "person_photo_id" uuid;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "person_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "series" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "sources" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "translation_of" uuid;--> statement-breakpoint
CREATE INDEX "stories_series_idx" ON "stories" USING btree ("series");