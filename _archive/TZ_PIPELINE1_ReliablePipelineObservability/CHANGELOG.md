# Changelog ТЗ-PIPELINE1: Reliable Pipeline Observability

## Сессия 0 — 2026-04-06

### Подготовка
- Исследование документации: AI SDK v6 retry/usage, Anthropic billing, Google AI SDK
- Полный аудит pipeline кода (7 файлов)
- Аудит существующей DevPanel инфраструктуры
- Создание ТЗ (SPEC, ANALYSIS, ROADMAP)
- Перенос ТЗ-BILLING2 в архив

### Ключевые находки
- AI SDK `maxRetries` default = 2 (3 попытки), usage только за последнюю успешную
- Anthropic не charge за server errors, но charge за client disconnect
- Существующая trace-инфраструктура покрывает 80% нужд DevPanel

### Files
- specs/TZ_PIPELINE1_ReliablePipelineObservability/ — новая папка ТЗ

## Сессия 1 — 2026-04-06

### Fixed
- `onFinish: ({ usage })` → `onFinish: ({ totalUsage })` в 4 streaming routes:
  - `app/(chat)/api/service-chat/route.ts`
  - `app/(chat)/api/chat/route.ts`
  - `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
  - `app/(chat)/api/assistant/ben/route.ts`

### Added
- logUsage для 5 artifact файлов (было 0 логирования):
  - `artifacts/text/server.ts` (chatMode: artifact:text)
  - `artifacts/markdown/server.ts` (chatMode: artifact:markdown)
  - `artifacts/excel/server.ts` (chatMode: artifact:excel)
  - `artifacts/presentation-reveal/server.ts` (chatMode: artifact:reveal)
  - `artifacts/presentation-pptx/server.ts` (chatMode: artifact:pptx)

### Verified
- Anthropic Console: $0.22 vs БД: $0.21 (дельта ~4.5%, в пределах округления Console)
- До фикса: потеря 74% tokens. После фикса: дельта <5%

### Files
- app/(chat)/api/service-chat/route.ts
- app/(chat)/api/chat/route.ts
- app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts
- app/(chat)/api/assistant/ben/route.ts
- artifacts/text/server.ts
- artifacts/markdown/server.ts
- artifacts/excel/server.ts
- artifacts/presentation-reveal/server.ts
- artifacts/presentation-pptx/server.ts

## Сессия 1 (продолжение) — 2026-04-06

### Added (Этап 1)
- `lib/ai/retry-with-logging.ts` — retry-обёртка с per-attempt logging
- `maxRetries: 0` в briefing-author, section-author, filter, script-generator
- `retryWithLogging()` в briefing-author и section-author

### Removed (Этап 1)
- `AUTHOR_MODEL_FALLBACK` из briefing-config

### Fixed (Этап 2)
- safeEnqueue wrapper в briefing generate route (Controller crash fix)

### Added (Этап 3)
- `AiCallAttempt` тип + `attempts?` в `AiCallTrace`
- Retry History в Pipeline Trace Drawer
- URL Verification секция в Pipeline Trace Drawer
- `urlVerification` prop flow: page-client → footer → drawer

### Verified
- Console $0.52 vs БД $0.519 (настройка брифинга, <1%)
- Console $0.07 vs БД $0.0735 (генерация брифинга, ~0%)

### Finalization (Этап 4)
- CHANGELOG.md, SIMPLY_STATUS.md, CLAUDE.md, package.json обновлены
- ADR 037 создан
- Версия: 3.69.0
