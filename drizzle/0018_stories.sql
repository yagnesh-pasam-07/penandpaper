CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"hook" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cover_media_id" uuid,
	"cover_caption" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'human' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"reading_minutes" integer DEFAULT 1 NOT NULL,
	"audio_media_id" uuid,
	"audio_duration_sec" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"original_url" text,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stories_slug_uq" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "story_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"parts" integer DEFAULT 1 NOT NULL,
	"width" integer,
	"height" integer,
	"complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_media_parts" (
	"media_id" uuid NOT NULL,
	"n" integer NOT NULL,
	"data" text NOT NULL,
	CONSTRAINT "story_media_parts_pk" PRIMARY KEY("media_id","n")
);
--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_media" ADD CONSTRAINT "story_media_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_media_parts" ADD CONSTRAINT "story_media_parts_media_id_story_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."story_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stories_live_idx" ON "stories" USING btree ("status","publish_at");--> statement-breakpoint
CREATE INDEX "story_media_story_idx" ON "story_media" USING btree ("story_id");