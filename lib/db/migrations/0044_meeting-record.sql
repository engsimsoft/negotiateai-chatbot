-- ТЗ-MR: Meeting Recorder MVP
CREATE TABLE IF NOT EXISTS "MeetingRecord" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "title" varchar(255) NOT NULL,
  "durationSeconds" integer NOT NULL,
  "speakerCount" integer NOT NULL DEFAULT 0,
  "summaryLevel" varchar(20) NOT NULL,
  "transcript" text NOT NULL,
  "summary" text NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "meeting_record_user_idx" ON "MeetingRecord" ("userId");
CREATE INDEX IF NOT EXISTS "meeting_record_user_created_idx" ON "MeetingRecord" ("userId", "createdAt");
