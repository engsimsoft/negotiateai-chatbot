# Changelog ТЗ-FIX1: Tool Call Guardian

## Сессия 1 — 2026-02-26

### Added
- `lib/ai/tool-call-guardian.ts` — модуль детекции (commit 7c331da)
  - `detectToolHallucination()` — главная функция детекции
  - `createStepTracker()` — фабрика для per-step трекинга в instrumentedStream
  - `TOOL_PATTERNS` — паттерны: tool names, русские/английские глаголы, fake progress, plan detection
  - Мониторит: deepResearch, fetchUrl, readTelegramChannel, webSearch, updateBriefingPreview, saveBriefingProfile

### Changed (не закоммичено)
- `app/(chat)/api/chat/route.ts` — Guardian интегрирован в instrumentedStream:
  - Импорты createStepTracker, GuardianFlags
  - guardianTracker создаётся перед instrumentedStream
  - Обработка step-start, text-delta, tool-input-start, step-finish
  - guardianFlags собираются на stream done

### Решения
- Фаза 1 утверждена: detection + logging, без буферизации, без retry
- Scope: chat + service-chat routes
- Метрики: `ai_usage_log.guardianFlags` jsonb
- Этап 1 завершён и подтверждён

### Files
- lib/ai/tool-call-guardian.ts (новый, закоммичен)
- app/(chat)/api/chat/route.ts (изменён, НЕ закоммичен)
