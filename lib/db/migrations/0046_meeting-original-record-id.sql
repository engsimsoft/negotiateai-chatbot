-- ТЗ-MR2: Add originalRecordId column (self-referencing FK to root record for regeneration)
ALTER TABLE "MeetingRecord" ADD COLUMN IF NOT EXISTS "originalRecordId" uuid REFERENCES "MeetingRecord"("id") ON DELETE SET NULL;
