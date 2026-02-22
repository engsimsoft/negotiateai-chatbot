ALTER TABLE "BriefingHistory" ADD COLUMN "audioUrls" jsonb;--> statement-breakpoint
ALTER TABLE "BriefingHistory" ADD COLUMN "audioStatus" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "BriefingHistory" ADD COLUMN "audioDurations" jsonb;
