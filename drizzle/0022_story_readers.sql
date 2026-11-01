CREATE TABLE "story_saves" (
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_saves_pk" PRIMARY KEY("user_id","story_id")
);
--> statement-breakpoint
ALTER TABLE "story_claps" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "story_saves" ADD CONSTRAINT "story_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_saves" ADD CONSTRAINT "story_saves_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_saves_user_idx" ON "story_saves" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "story_claps" ADD CONSTRAINT "story_claps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;