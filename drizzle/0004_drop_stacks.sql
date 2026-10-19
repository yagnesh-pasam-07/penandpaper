CREATE TABLE "drop_stacks" (
	"id" text PRIMARY KEY NOT NULL,
	"paper_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"x" real,
	"y" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"carried_from" date
);
--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "stack_id" text;--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD COLUMN "stack_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "drop_stacks" ADD CONSTRAINT "drop_stacks_paper_id_drop_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."drop_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drop_stacks" ADD CONSTRAINT "drop_stacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drop_stacks_paper_idx" ON "drop_stacks" USING btree ("paper_id");--> statement-breakpoint
ALTER TABLE "drop_thoughts" ADD CONSTRAINT "drop_thoughts_stack_id_drop_stacks_id_fk" FOREIGN KEY ("stack_id") REFERENCES "public"."drop_stacks"("id") ON DELETE set null ON UPDATE no action;