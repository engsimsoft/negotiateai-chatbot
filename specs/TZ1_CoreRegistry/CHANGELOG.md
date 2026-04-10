# Changelog ТЗ-1: Core Registry

Локальный лог изменений. Финальная сводка переедет в главный `CHANGELOG.md` в Этапе 6.

---

## Сессия 3 — 2026-04-10 — Этап 2: Миграция chat routes + service-chat + utils

### Changed — 7 call-sites мигрированы на getModel(taskId)

- **app/(chat)/actions.ts** — `generateTitleFromUserMessage()` → `getModel("util:title")` + `getProviderForTask` в logUsage
- **app/(chat)/api/chat/[id]/generate-title/route.ts** — `getModel("util:title")` + provider logging
- **lib/ai/tools/request-suggestions.ts** — `getModel("util:artifact-suggestions")`
- **app/(chat)/api/assistant/ben/route.ts** — `getModel("service-chat:ben")` (deprecated Ben продолжает работать)
- **app/(chat)/api/service-chat/route.ts** — Локальный `getModelId()` удалён, заменён на `getTaskIdForContext()` → `getModel(taskId)`. Все 4 контекста (ben/project-creation/project-manager/briefing-onboarding) идут через task-assignments
- **lib/ai/chat-mode-config.ts** — Превратился в тонкую обёртку. `CHAT_MODE_CONFIG` теперь содержит только `displayName` и `tools` (без `modelId`). Добавлен `getTaskIdForChatMode()`. `getModelForChatMode()` переписан через catalog
- **app/(chat)/api/chat/route.ts** — Главный файл, 3 точки:
  - Auto-naming (L128) → `getModel("util:title")`
  - Simply branch (L584-598) → 3 taskId вместо захардкоженных имён: `simply-chat-think`, `simply-chat-vision`, `simply-chat`
  - resolvedModelId в onFinish (L998-1010) → `getModelIdForTask(getTaskIdForChatMode(chatMode))`
  - Локальный `minimaxModel()` helper и `createMinimaxOpenAI` import удалены

### Fixed

- **lib/ai/getModel.ts** — Добавлена мутация `config.includeUsage = true` для `minimax:*` / `minimaxLong:*` моделей. Без этого MiniMax не эмитит usage events при streaming, и DevPanel показывает пустую стоимость. Раньше была в локальном `minimaxModel()` хелпере chat/route.ts — теперь централизована в getModel
- **lib/ai/task-assignments.ts** — `service-chat:project-manager` исправлен с `claude-sonnet-4-6` на `claude-haiku-4-5-20251001` (реальный код в `getModelId()` всегда возвращал Haiku для project-manager)

### Validation

- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → успешен
- `grep -rn "myProvider|claudeHaiku|claudeSonnet|claudeOpus|minimaxM27" <мигрированные файлы>` → 0 матчей
- **Логи dev-сервера подтверждают все 3 taskId для Simply:**
  - `task=simply-chat-think, model=claude-sonnet-4-6` ✅
  - `task=simply-chat-vision, model=claude-haiku-4-5-20251001` ✅
  - `task=simply-chat, model=MiniMax-M2.7` ✅
  - `POST /api/service-chat 200 in 3905ms` (project-creation) ✅
- **Мануальный тест пользователем** (2026-04-10): Simply text/think/vision + Экспертиза + Создание + service-chat project-creation — все прошли

### Files

- `app/(chat)/actions.ts` (+3, -3)
- `app/(chat)/api/chat/[id]/generate-title/route.ts` (+10, -2)
- `app/(chat)/api/chat/route.ts` (+24, -22)
- `app/(chat)/api/assistant/ben/route.ts` (+13, -4)
- `app/(chat)/api/service-chat/route.ts` (+16, -13)
- `lib/ai/chat-mode-config.ts` (+43, -16)
- `lib/ai/getModel.ts` (+12, -1)
- `lib/ai/task-assignments.ts` (+1, -1)
- `lib/ai/tools/request-suggestions.ts` (+2, -1)

---

## Сессия 2b — 2026-04-10 — HOTFIX commit b4bce63

### Added
- **lib/utils.ts::stripIncompleteToolParts** — UI-level pre-sanitization для AI SDK v6 tool parts. Фильтрует все `tool-*` parts с `state !== "output-available"` (output-error, input-streaming, input-available) до `convertToModelMessages`. Если message остаётся без meaningful content — вставляется placeholder `[инструмент не завершён]`. Defense-in-depth вместе с существующим `sanitizeCoreMessages`. Применён в 4 call-sites: chat/route.ts (pipeline + main), task-chat/route.ts, ben/route.ts

### Fixed
- **components/messages.tsx** — Canonical single-scroll conversation. Убран outer `<div flex-col-reverse overflow-y-scroll>` (из commit bfb07f1 ТЗ-SlidingWindow), который создавал **двойной scroll-контейнер** поверх `<Conversation>` (StickToBottom). Scrollbar из-за этого "жил своей жизнью" — смещался влево на коротких сообщениях. Теперь используется только `<Conversation>` + родной `<ConversationScrollButton>` (читает `useStickToBottomContext`). Scroll-on-submit реализован через внутренний sub-component `<ScrollToBottomOnSubmit>`. `hasSentMessage` state переместился внутрь `PureMessages`. `useMessages` hook удалён из messages.tsx (остался в artifact-messages.tsx)

### Validation
- Мануальный тест пользователем в отравленном чате (c3bca966) **БЕЗ SQL DELETE** — sanitizer разблокировал чат на лету. MiniMax 7.491 tok, Haiku vision 16.8k tok с attachment, все 200 OK
- Скроллбар больше не гуляет, стрелка вниз работает корректно

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
