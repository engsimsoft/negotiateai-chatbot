# Changelog ТЗ-ExtractCompression

## Сессия 1 — 2026-04-08

### Added
- SPEC.md — копия ТЗ
- ANALYSIS.md — анализ + код-ревью (все решения утверждены архитектором)
- ROADMAP.md — план из 4 этапов
- CHANGELOG.md — этот файл
- HANDOFF.md — начальный контекст

### Этап 1: Миграция + Загрузка истории
- `lib/db/schema.ts` — колонка `extractedAt` в Message_v2
- `lib/db/migrations/0052_extract-at-column.sql` — миграция
- `lib/ai/context-limits.ts` — SIMPLY_CONTEXT_LIMIT, EXTRACT_THRESHOLD_SOFT/HARD, EXTRACT_PAUSE_MS
- `lib/db/queries.ts` — параметр `excludeExtracted` в getMessagesByChatId
- `app/(chat)/api/chat/route.ts` — simply: excludeExtracted=true, maxTokens=180K
- Все конструкторы DBMessage — добавлен `extractedAt: null`

### Этап 2: batchExtractFacts + Триггер
- `lib/prompts/memory/extract-batch.md` — промпт для batch extraction
- `lib/ai/memory/extract.ts` — batchExtractFacts (batch 50 msgs, один Sonnet call)
- `lib/ai/memory/memory-queries.ts` — markMessagesExtracted
- `lib/ai/memory/index.ts` — экспорт batchExtractFacts, markMessagesExtracted
- `lib/db/queries.ts` — getUnextractedSimplyMessages
- `app/(chat)/api/chat/route.ts` — пороговый триггер (80%+пауза / 95%)

### Этап 3: Ночной cron
- `lib/db/queries.ts` — getUsersWithStaleSimplyMessages
- `app/api/cron/memory-profile/route.ts` — Step 0: batch extract stale msgs (>24h)

### Этап 4: Финализация
- CHANGELOG.md (главный) — запись v3.78.0
- SIMPLY_STATUS.md — версия 3.78.0
- CLAUDE.md — обновлены секции Context Window, MIND Memory, версия
- package.json — 3.78.0
- docs/decisions/044-extract-on-compression.md — ADR

### Fixed
- Voyage AI API key — обновлён (старый ключ expired)

### Files
- lib/db/schema.ts
- lib/db/migrations/0052_extract-at-column.sql
- lib/db/migrations/meta/_journal.json
- lib/ai/context-limits.ts
- lib/db/queries.ts
- lib/ai/memory/extract.ts
- lib/ai/memory/memory-queries.ts
- lib/ai/memory/index.ts
- lib/prompts/memory/extract-batch.md
- app/(chat)/api/chat/route.ts
- app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts
- app/(chat)/api/service-chat/route.ts
- app/api/cron/memory-profile/route.ts
- docs/decisions/044-extract-on-compression.md
- CHANGELOG.md
- SIMPLY_STATUS.md
- CLAUDE.md
- package.json
