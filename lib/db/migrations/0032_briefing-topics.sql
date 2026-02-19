-- ТЗ-A2: BriefingTopics — custom user topics from AI onboarding
CREATE TABLE IF NOT EXISTS "BriefingTopics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"topicId" varchar(50) NOT NULL,
	"topicName" varchar(100) NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"orderIndex" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
-- Foreign key
ALTER TABLE "BriefingTopics" ADD CONSTRAINT "BriefingTopics_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Indexes
CREATE INDEX IF NOT EXISTS "briefing_topics_user_idx" ON "BriefingTopics" USING btree ("userId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "briefing_topics_user_topic_idx" ON "BriefingTopics" USING btree ("userId","topicId");
