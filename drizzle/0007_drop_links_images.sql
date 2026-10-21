CREATE TABLE "drop_links" (
	"id" text PRIMARY KEY NOT NULL,
	"paper_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"label" text,
	"arrow" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "drop_links" ADD CONSTRAINT "drop_links_paper_id_drop_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."drop_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_links" ADD CONSTRAINT "drop_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drop_links_paper_idx" ON "drop_links" USING btree ("paper_id");