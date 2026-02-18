-- ТЗ-BR1: Briefing tables
-- BriefingSettings: one per user
CREATE TABLE IF NOT EXISTS "BriefingSettings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Moscow' NOT NULL,
	"generationTime" varchar(5) DEFAULT '06:00' NOT NULL,
	"language" varchar(10) DEFAULT 'ru' NOT NULL,
	"maxItems" integer DEFAULT 15 NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "BriefingSettings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
-- BriefingSources: user's news sources
CREATE TABLE IF NOT EXISTS "BriefingSources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"topicId" varchar(50) NOT NULL,
	"sourceUrl" text NOT NULL,
	"sourceName" varchar(200) NOT NULL,
	"sourceLanguage" varchar(10) DEFAULT 'ru' NOT NULL,
	"tier" varchar(20) DEFAULT 'unknown' NOT NULL,
	"rssUrl" text,
	"fetchMethod" varchar(20) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
-- BriefingHistory: generated briefings
CREATE TABLE IF NOT EXISTS "BriefingHistory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"briefingJson" jsonb NOT NULL,
	"sourcesChecked" integer,
	"itemsIncluded" integer,
	"duplicatesRemoved" integer,
	"tokensUsed" integer,
	"status" varchar(20) NOT NULL,
	"generatedAt" timestamp NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
-- Foreign keys
ALTER TABLE "BriefingSettings" ADD CONSTRAINT "BriefingSettings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "BriefingSources" ADD CONSTRAINT "BriefingSources_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "BriefingHistory" ADD CONSTRAINT "BriefingHistory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Indexes
CREATE INDEX IF NOT EXISTS "briefing_settings_user_idx" ON "BriefingSettings" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "briefing_sources_user_idx" ON "BriefingSources" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "briefing_history_user_idx" ON "BriefingHistory" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "briefing_history_user_generated_idx" ON "BriefingHistory" USING btree ("userId","generatedAt");
