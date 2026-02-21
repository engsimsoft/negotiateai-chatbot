-- ТЗ-BRIEFING-VOLUME: Add volume to BriefingSettings (compact/standard/detailed)
ALTER TABLE "BriefingSettings" ADD COLUMN "volume" varchar(20) DEFAULT 'standard' NOT NULL;
