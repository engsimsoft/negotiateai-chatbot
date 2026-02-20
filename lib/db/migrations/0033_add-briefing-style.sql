-- ТЗ-HF1: Add briefingStyle to BriefingTopics (per-topic author instruction)
ALTER TABLE "BriefingTopics" ADD COLUMN "briefing_style" text;
