CREATE TABLE "drop_strokes" (
	"id" text PRIMARY KEY NOT NULL,
	"paper_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"points" jsonb NOT NULL,
	"from_id" text,
	"to_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"erased_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "kind" text DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_strokes" ADD CONSTRAINT "drop_strokes_paper_id_drop_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."drop_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_strokes" ADD CONSTRAINT "drop_strokes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drop_strokes_paper_idx" ON "drop_strokes" USING btree ("paper_id");