-- ТЗ-MR2: Add userInstructions column to MeetingRecord
ALTER TABLE "MeetingRecord" ADD COLUMN IF NOT EXISTS "userInstructions" text;
