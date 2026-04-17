-- TZ_SimplyChatRaceCondition: enforce one Simply chat per user.
-- Cleans pre-existing duplicates (keeps oldest per userId), then adds a
-- partial unique index on (userId) WHERE chatMode='simply'.

-- Identify duplicates to remove
CREATE TEMP TABLE _simply_dups AS
SELECT id FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" ASC) AS rn
  FROM "Chat"
  WHERE "chatMode" = 'simply'
) ranked
WHERE rn > 1;

-- Detach nullable chatId references (preserve their data)
UPDATE "ai_usage_log" SET "chatId" = NULL
WHERE "chatId" IN (SELECT id FROM _simply_dups);

UPDATE "ProjectTask" SET "chatId" = NULL
WHERE "chatId" IN (SELECT id FROM _simply_dups);

-- Cascade-delete dependent rows (no ON DELETE CASCADE in schema)
DELETE FROM "Vote_v2"    WHERE "chatId" IN (SELECT id FROM _simply_dups);
DELETE FROM "Vote"       WHERE "chatId" IN (SELECT id FROM _simply_dups);
DELETE FROM "Message_v2" WHERE "chatId" IN (SELECT id FROM _simply_dups);
DELETE FROM "Message"    WHERE "chatId" IN (SELECT id FROM _simply_dups);
DELETE FROM "Stream"     WHERE "chatId" IN (SELECT id FROM _simply_dups);

-- Delete duplicate chats themselves
-- (memory_entry.sourceChatId auto-NULLs via ON DELETE SET NULL)
DELETE FROM "Chat" WHERE id IN (SELECT id FROM _simply_dups);

DROP TABLE _simply_dups;

-- Enforce: at most one Simply chat per user
CREATE UNIQUE INDEX IF NOT EXISTS "Chat_user_simply_uniq"
  ON "Chat" ("userId")
  WHERE "chatMode" = 'simply';
