ALTER TABLE "Message_v2" ADD COLUMN "agentId" uuid;
--> statement-breakpoint
-- ТЗ-2: Backfill agentId for existing assistant messages from Chat.agentId
UPDATE "Message_v2" m
SET "agentId" = c."agentId"
FROM "Chat" c
WHERE m."chatId" = c."id"
  AND m."role" = 'assistant'
  AND c."agentId" IS NOT NULL;