# Changelog ТЗ-1: Core Registry

Локальный лог изменений. Финальная сводка переедет в главный `CHANGELOG.md` в Этапе 6.

---

## Сессия 2 — 2026-04-10 — Этап 1: Core инфраструктура

### Added
- `lib/ai/model-catalog.ts` — SSOT для всех моделей приложения. Тип `ModelEntry` с pricing (USD/1M), capabilities, contextWindow. 28 записей: Claude (3 физ + 5 алиасов + 1 legacy), MiniMax (2), Grok (5), OpenRouter (2), Voyage (2), Perplexity (2), Deepgram, Gemini TTS. Helpers: `getModelEntry`, `resolveModelEntry` (алиасы), `listPhysicalModels`, `getDisplayName`, `getContextWindow`.
- `lib/ai/registry.ts` — `createProviderRegistry` AI SDK v6. 5 провайдеров: `anthropic`, `minimax`, `minimaxLong` (отдельный namespace с 180s timeout), `xai`, `openrouter`. Разделитель `:`.
- `lib/ai/task-assignments.ts` — `DEFAULT_TASK_MODELS` с 34 taskId, покрывающими все 31+ точки аудита. Иерархическая конвенция с `:`. `TaskId` union type.
- `lib/ai/getModel.ts` — единая точка получения LanguageModel. Порядок: test-mocks → overrides (stub ТЗ-2) → task-assignment → catalog → registry. Сигнатура `getModel(taskId, context?)` подготовлена под ТЗ-2. Helpers: `getModelIdForTask`, `getProviderForTask`.
- `lib/db/migrations/0053_ai_usage_log_provider.sql` — добавление nullable колонки `provider varchar(32)` + SQL `CASE`-backfill по префиксу `modelId`.
- Journal entry `0053_ai_usage_log_provider` в `lib/db/migrations/meta/_journal.json`.
- `.env.example`: `XAI_API_KEY` секция.
- Зависимость `@ai-sdk/xai@3.0.82`.

### Changed
- `lib/ai/providers.ts` — полный рефакторинг. Удалён хардкод `MODEL_PRICING_RUB`. `calculateCostRub`/`calculateCostBreakdownRub`/`getStepCostRub` теперь читают pricing из `model-catalog.ts` с конвертацией USD/1M → RUB/1K через `RUB_PER_USD`. Legacy экспорты `myProvider`/`claudeHaiku`/`claudeSonnet`/`claudeOpus`/`minimaxM27`/`minimaxM27Long` сохранены как тонкие обёртки над registry (удалятся в Этапе 5). `extractUsageForPricing` и non-LLM helpers (`calculateDeepgramCostUsd`, `calculateGeminiTtsCostUsd`, `calculateTtsCostRub`) остались на месте. Публичный API не изменился — 10+ call-sites не затронуты.
- `lib/ai/usage-utils.ts` — `LogUsageInput` + `logUsage()` принимают опциональное поле `provider`. Если не передан, вычисляется через `inferProviderFromModelId()` (те же правила что и SQL backfill).
- `lib/db/schema.ts` — `aiUsageLog` + колонка `provider: varchar("provider", { length: 32 })` (nullable, для совместимости).
- `lib/db/queries.ts` — `saveAiUsageLog()` принимает и пишет `provider`.

### Deferred
- Удаление пакета `tokenlens` и файла `lib/ai/tokenlens-catalog.ts` — переехало в Этап 5. Причина: 8+ файлов (podcast, briefing, memory, professor-pipeline, pipeline-trace) импортируют `calcCostUsd`/`calcStepCostRub`/`getTokenlensCatalog` или тип `ModelCatalog`. Эти файлы мигрируют в Этапах 3-4, а окончательная очистка legacy — в Этапе 5. ROADMAP.md обновить.

### Database
- Миграция 0053 применена автоматически при `npm run build`.
- Backfill отработал: 288 записей получили provider (anthropic=107, minimax=64, voyage=55, deepgram=25, perplexity=14, google=10). 13 NULL — историческая помойка (`M2-her`, `speech-2.8-hd` от отменённой MiniMax TTS, один мусорный UUID). Не критично — новые записи получают `provider` через `inferProviderFromModelId`.

### Validation
- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → успешен
- Миграция применена, колонка `provider varchar(32)` проверена через SQL
- Backfill проверен через SQL

### Files
- **Новые:** `lib/ai/model-catalog.ts`, `lib/ai/registry.ts`, `lib/ai/task-assignments.ts`, `lib/ai/getModel.ts`, `lib/db/migrations/0053_ai_usage_log_provider.sql`
- **Изменённые:** `lib/ai/providers.ts`, `lib/ai/usage-utils.ts`, `lib/db/schema.ts`, `lib/db/queries.ts`, `lib/db/migrations/meta/_journal.json`, `.env.example`, `package.json` (+@ai-sdk/xai)

---

## Сессия 1 — 2026-04-10 — Анализ + Планирование

### Added
- `specs/TZ1_CoreRegistry/SPEC.md` — ТЗ получено от архитектора
- `specs/TZ1_CoreRegistry/ANALYSIS.md` — анализ, 12 вопросов, код-ревью
- `specs/TZ1_CoreRegistry/ROADMAP.md` — план из 6 этапов
- `specs/TZ1_CoreRegistry/HANDOFF.md` — начальный контекст
- `specs/TZ1_CoreRegistry/CHANGELOG.md` — этот файл

### Files
- `specs/TZ1_CoreRegistry/` — полная структура фазы Анализ+Планирование
