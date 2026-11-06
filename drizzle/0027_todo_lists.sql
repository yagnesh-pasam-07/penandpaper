ALTER TABLE "drop_thoughts" ADD COLUMN "list_id" text;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "list_pos" real;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "indent" integer DEFAULT 0 NOT NULL;