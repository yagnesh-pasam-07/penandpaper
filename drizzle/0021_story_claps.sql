CREATE TABLE "story_claps" (
	"story_id" uuid NOT NULL,
	"reader" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_claps_pk" PRIMARY KEY("story_id","reader")
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "claps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "story_claps" ADD CONSTRAINT "story_claps_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;