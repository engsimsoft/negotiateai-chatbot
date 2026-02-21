-- ТЗ-BF1: SavedBriefingTopics — saved topics from briefing issues
CREATE TABLE IF NOT EXISTS "SavedBriefingTopics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"topicId" text NOT NULL,
	"topicName" text NOT NULL,
	"emoji" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb NOT NULL,
	"briefingGeneratedAt" timestamp NOT NULL,
	"savedAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "saved_briefing_topics_user_idx" ON "SavedBriefingTopics" USING btree ("userId");

DO $$ BEGIN
  ALTER TABLE "SavedBriefingTopics" ADD CONSTRAINT "SavedBriefingTopics_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
