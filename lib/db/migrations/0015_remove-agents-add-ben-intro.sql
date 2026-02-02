-- ТЗ-NEW-01 Phase 6: Remove agent system, add Ben intro flag
-- Drop UserAgent first (has FK to Agent)
DROP TABLE IF EXISTS "UserAgent" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "Agent" CASCADE;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "has_seen_ben_intro" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "agentId";--> statement-breakpoint
ALTER TABLE "Message_v2" DROP COLUMN IF EXISTS "agentId";