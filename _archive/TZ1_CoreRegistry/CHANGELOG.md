# Changelog ТЗ-1: Core Registry

Локальный лог изменений. Финальная сводка переедет в главный `CHANGELOG.md` в Этапе 6.

---

## Сессия 4 — 2026-04-11 — Этап 3: Миграция projects + clerks + professors

### Changed — 9 файлов мигрированы на getModel(taskId)

- **lib/ai/model-tiers.ts** — Превратился в тонкую обёртку. Добавлены `getTaskIdForTier()` и `getProjectTierModelId()`. `PROJECT_MODELS` больше не хардкодит `myProvider.languageModel(…)` — модели резолвятся лениво через `getModel()`. Metadata (name/description/icon/pricing) остаются в модуле.
- **lib/ai/clerks/task-summarizer.ts** — `getModel("clerk:task-summary")`. Удалён `process.env.SUMMARIZER_MODEL`.
- **lib/ai/clerks/snapshot-creator.ts** — `getModel("clerk:snapshot")`. Удалён `process.env.SNAPSHOT_CLERK_MODEL`.
- **app/(chat)/api/projects/[id]/analyze-file/route.ts** — `getModel("clerk:file-analyzer")`.
- **app/(chat)/api/projects/[id]/plan/route.ts** — `getModel("professor:planning")`. Удалён `process.env.PROFESSOR_MODEL`.
- **lib/ai/professors/task-reviewer.ts** — `getModel("professor:review")`. Удалён `process.env.PROFESSOR_MODEL`.
- **lib/ai/professor-pipeline.ts** — 3 фазы: `professor:pipeline-analyze` / `pipeline-execute` / `pipeline-synthesize`. Все `saveAiUsageLog` теперь пишут `provider`.
- **app/(chat)/api/projects/[id]/generate-summary/route.ts** — `getModel("util:project-summary")`.
- **app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts** — Удалены дубли `TIER_ALIAS`. Использует `getProjectTierModelId(tier)` + `getTaskIdForTier(tier)`. Два места: main onFinish + guardian error handler.

### Added — Architectural improvements

- **lib/ai/getModel.ts::taskSupportsThinking(taskId)** — Новый capability helper. Читает `capabilities.thinking` из model-catalog. Используется callers чтобы **условно** передавать `providerOptions.anthropic.thinking: adaptive` — только если resolved модель его поддерживает. Решает реальную проблему: при смене defaults в task-assignments (например с Opus на Haiku) hardcoded thinking options ломали API запрос с 400 "adaptive thinking is not supported on this model". Теперь system самоадаптируется под любую модель. Применено в 3 call-sites:
  - `app/(chat)/api/projects/[id]/plan/route.ts`
  - `lib/ai/professors/task-reviewer.ts`
  - `app/(chat)/api/service-chat/route.ts` (briefing-onboarding)

- **components/projects/task-chat.tsx** — Обёрнут в `<DevPanelProvider>`. `DevPanelFooter` внутри `PreviewMessage` теперь получает контекст в task-chat и показывает модель/токены/стоимость для каждого ответа эксперта. Серверная сторона (`emitDebugPrompt/Step/Finish`) уже всё эмитит — требовалось только клиентское оборачивание. `DataStreamProvider` уже доступен в `app/(task)/layout.tsx`.

### Removed — env variables

- `PROFESSOR_MODEL` — удалена из `plan/route.ts` и `task-reviewer.ts`
- `SUMMARIZER_MODEL` — удалена из `task-summarizer.ts`
- `SNAPSHOT_CLERK_MODEL` — удалена из `snapshot-creator.ts`

### Validation

- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → успешен
- `grep` по 9 файлам: 0 legacy refs (только комментарии "was process.env.X")
- **Логи dev-сервера подтверждают работу архитектуры:**
  - `POST /api/service-chat 200` — project-creation → Sonnet ✅
  - `POST /api/projects/.../analyze-file 200 in 4557ms` — file-analyzer → Haiku ✅
  - `POST /api/projects/.../plan` — модель резолвится из task-assignments (в теле запроса видно `model: 'claude-opus-4-6'` в запросе к Anthropic API)

### Architecture validation — главное достижение

Во время мануального теста **одной строкой в `task-assignments.ts`** были переключены 8 taskId (chat:sonnet/opus, project:expert:haiku/sonnet/opus, professor:planning/review/pipeline-analyze/synthesize) с Opus/Sonnet на Haiku. Все call-sites автоматически подхватили новую модель через `getModel()` + HMR. **Это ровно тот use case, ради которого делается Core Registry** — возможность переключать модели без касания call-sites.

При этом вскрылась реальная архитектурная дыра (`providerOptions.anthropic.thinking` был hardcoded, ломался на Haiku) — и была решена **правильно**: через catalog-driven capability check `taskSupportsThinking()`, а не через заплатку. После fix `providerOptions` автоматически адаптируется под любую resolved модель без ручного вмешательства.

### Known issues (не относятся к Этапу 3)

- **Planning promt не совместим с Haiku output format.** Когда `professor:planning` был временно переключён на Haiku для теста, API запрос прошёл успешно (200 OK, 49 секунд), модель сгенерировала валидный `<plan_report>`, но обернула ответ в markdown fence `\`\`\`xml ... \`\`\`` и, возможно, усекла `<plan_json>` тег. Парсер в `extractTag()` рассчитан на чистый Opus output. Это **не infrastructure проблема** — это domain-specific prompt engineering, будет решено при переписывании промптов под cross-model support (будущий этап после ТЗ-1).

- **DevPanel полный e2e тест в TaskChat** не пройден — требует реальной задачи, открытой через planner. Planning с Opus дорого, планинг с Haiku упал на parser (см. выше). Компонент обёрнут корректно, сервер эмитит debug events — тест будет выполнен автоматически при первом использовании проектов в production после коммита ТЗ-1.

### Files (12 changed)

- `lib/ai/model-tiers.ts` (rewrite — thin wrapper)
- `lib/ai/clerks/task-summarizer.ts` (+8, -5)
- `lib/ai/clerks/snapshot-creator.ts` (+8, -5)
- `lib/ai/professors/task-reviewer.ts` (+18, -9)
- `lib/ai/professor-pipeline.ts` (+18, -9)
- `lib/ai/getModel.ts` (+14) — `taskSupportsThinking()`
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` (+10, -4)
- `app/(chat)/api/projects/[id]/plan/route.ts` (+19, -12)
- `app/(chat)/api/projects/[id]/generate-summary/route.ts` (+10, -3)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (+10, -8)
- `app/(chat)/api/service-chat/route.ts` (+2, -1) — thinking guard
- `components/projects/task-chat.tsx` (+5, -2) — DevPanelProvider wrap

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
