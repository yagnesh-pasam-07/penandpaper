-- Stacks are going away. Thoughts stay (they only lose their grouping); none are deleted.
-- A thought inside a stack that was folded for later keeps that fold, so it doesn't pop back onto today's sheet.
UPDATE "drop_thoughts" AS t SET "scheduled_for" = s."scheduled_for" FROM "drop_stacks" AS s WHERE t."stack_id" = s."id" AND s."scheduled_for" IS NOT NULL AND t."scheduled_for" IS NULL;--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP CONSTRAINT "drop_thoughts_stack_id_drop_stacks_id_fk";
--> statement-breakpoint
ALTER TABLE "drop_stacks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "drop_stacks" CASCADE;--> statement-breakpoint
ALTER TABLE "drop_prefs" DROP COLUMN "stack_hint_done_at";--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "stack_id";--> statement-breakpoint
ALTER TABLE "drop_thoughts" DROP COLUMN "stack_order";
