-- Drop: from one paper per day to papers you make yourself, and the features that went with the old model.
-- Nothing here deletes a thought or a paper. What goes is structure that no longer has a use:
--   drop_links (lines between thoughts), drop_stacks (and each thought's stack_id/stack_order: thoughts become loose),
--   rank / next_rank (numbering), kind (pen/pencil), carried_from, scheduled_for (roll-over and fold),
--   drop_papers.date and cleared_at (day papers and Clear desk), drop_prefs.stack_hint_done_at.
-- Each existing paper keeps its created_at (now the "made on" date), becomes a plain unnamed paper, and sorts by its last thought.

-- Stacks first: the thoughts' foreign key has to go before the table does.
ALTER TABLE "drop_thoughts" DROP CONSTRAINT "drop_thoughts_stack_id_drop_stacks_id_fk";
--> statement-breakpoint
ALTER TABLE "drop_links" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drop_stacks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "drop_links" CASCADE;--> statement-breakpoint
DROP TABLE "drop_stacks" CASCADE;--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "carried_from";--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "stack_id";--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "stack_order";--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "scheduled_for";--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "rank";--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "next_rank";--> statement-breakpoint

-- Papers: no longer one per person per day.
DROP INDEX "drop_papers_user_date_uq";--> statement-breakpoint
ALTER TABLE "drop_papers" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "drop_papers" DROP COLUMN "cleared_at";--> statement-breakpoint
ALTER TABLE "drop_papers" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "drop_papers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_papers" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drop_papers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "drop_papers_user_idx" ON "drop_papers" USING btree ("user_id");--> statement-breakpoint
-- Existing papers were all "updated" the moment the column was added; give each its real last change (its newest thought, or when it was made).
UPDATE "drop_papers" AS p SET "updated_at" = COALESCE((SELECT max(t."created_at") FROM "drop_thoughts" AS t WHERE t."paper_id" = p."id"), p."created_at");--> statement-breakpoint

-- Settings: the canvas and theme choice, and the stack hint that no longer exists.
ALTER TABLE "drop_prefs" DROP COLUMN "stack_hint_done_at";--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "canvas" text;--> statement-breakpoint
ALTER TABLE "drop_prefs" ADD COLUMN "theme" text;
