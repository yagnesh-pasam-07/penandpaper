ALTER TABLE "drop_prefs" ADD COLUMN "resurface" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "resurface_step" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "resurface_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "resurface_done" boolean DEFAULT false NOT NULL;