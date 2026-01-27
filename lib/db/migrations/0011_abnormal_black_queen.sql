ALTER TABLE "Document" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "share_token" varchar(32);--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "shared_at" timestamp;--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_share_token_unique" UNIQUE("share_token");