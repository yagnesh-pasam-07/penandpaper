CREATE TABLE "drop_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drop_papers" ADD COLUMN "public_token" text;--> statement-breakpoint
ALTER TABLE "drop_strokes" ADD COLUMN "color" text DEFAULT 'ink' NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_strokes" ADD COLUMN "shape" text;--> statement-breakpoint
ALTER TABLE "drop_strokes" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "size" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "color" text DEFAULT 'ink' NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "due_has_time" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drop_shares" ADD CONSTRAINT "drop_shares_paper_id_drop_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."drop_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_shares" ADD CONSTRAINT "drop_shares_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drop_shares_paper_email_idx" ON "drop_shares" USING btree ("paper_id","email");--> statement-breakpoint
CREATE INDEX "drop_shares_email_idx" ON "drop_shares" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "drop_papers_public_token_idx" ON "drop_papers" USING btree ("public_token");