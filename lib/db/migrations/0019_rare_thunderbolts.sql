ALTER TABLE "Chat" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "isStarred" boolean DEFAULT false NOT NULL;