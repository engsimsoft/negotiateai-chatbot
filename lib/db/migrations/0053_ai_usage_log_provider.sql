-- ТЗ-1 CoreRegistry: +provider column в ai_usage_log
ALTER TABLE "ai_usage_log" ADD COLUMN IF NOT EXISTS "provider" varchar(32);

-- Backfill: парсер по префиксу modelId. Неизвестные остаются NULL.
UPDATE "ai_usage_log"
SET "provider" = CASE
  WHEN "modelId" LIKE 'claude%'   THEN 'anthropic'
  WHEN "modelId" LIKE 'MiniMax%'  THEN 'minimax'
  WHEN "modelId" LIKE 'grok%'     THEN 'xai'
  WHEN "modelId" LIKE 'voyage%'   THEN 'voyage'
  WHEN "modelId" LIKE 'sonar%'    THEN 'perplexity'
  WHEN "modelId" LIKE 'deepgram%' THEN 'deepgram'
  WHEN "modelId" =    'nova-3'    THEN 'deepgram'
  WHEN "modelId" LIKE 'gemini%'   THEN 'google'
  ELSE NULL
END
WHERE "provider" IS NULL;
