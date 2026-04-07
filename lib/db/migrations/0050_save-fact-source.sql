-- ТЗ-SaveFact: Add "source" column to memory_entry
-- Distinguishes how the fact was created:
--   "extracted" — background Extract pipeline (default for all existing facts)
--   "explicit"  — user explicitly asked AI to remember via saveFact tool

ALTER TABLE "memory_entry" ADD COLUMN "source" varchar(32) NOT NULL DEFAULT 'extracted';
