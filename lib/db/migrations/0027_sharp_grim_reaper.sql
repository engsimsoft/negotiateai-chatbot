ALTER TABLE "Chat" ADD COLUMN "snapshots" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "contextState" jsonb;