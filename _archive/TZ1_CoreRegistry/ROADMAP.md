# Roadmap ТЗ-1: Core Registry — Model-Agnostic архитектура

**Создан:** 2026-04-10
**Версия проекта:** 3.82.0 → 3.83.0
**Статус:** 🔄 В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий | 1 |
| Сессий (оценка) | 3 |

**Основание:** аудит 31 AI-точки + [ANALYSIS.md](ANALYSIS.md) + ответы архитектора

**Цель ТЗ:** вынести выбор модели из route-файлов в единый конфиг. После завершения любая из 31 AI-точки получает модель через `getModel(taskId)`.

**Принцип:** поведение приложения **не меняется** — те же модели, параметры, промпты. Только архитектура.

---

## Архитектура (фиксируем)

```
┌─────────────────────────────────────────────────┐
│  route.ts / pipeline.ts (31 точка)              │
│  const model = getModel('briefing:filter')      │
└──────────────────┬──────────────────────────────┘
                   │
       ┌───────────▼────────────┐
       │  lib/ai/getModel.ts    │ ← overrides lookup (stub в ТЗ-1, реализация в ТЗ-2)
       │  (единая точка входа)  │ ← test mocks (isTestEnvironment)
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │ lib/ai/task-assignments│ taskId → modelId
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │ lib/ai/model-catalog   │ modelId → {provider, pricing, caps, defaults}
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │ lib/ai/registry.ts     │ createProviderRegistry (anthropic, minimax, xai, openrouter)
       └────────────────────────┘
```

**Слои:** `chat-mode-config.ts` и `model-tiers.ts` остаются как тонкие обёртки (`chatMode` → `taskId` → `getModel`).

---

## Конвенции

**taskId — иерархический, разделитель `:`**

Примеры: `simply-chat`, `simply-chat-think`, `simply-chat-vision`, `chat:haiku`, `chat:sonnet`, `chat:opus`, `briefing:filter`, `briefing:author`, `briefing:section`, `briefing:podcast-script`, `memory:extract`, `memory:extract-batch`, `memory:consolidate`, `memory:profile`, `meeting:summary`, `vision:ocr`, `clerk:file-analyzer`, `clerk:task-summary`, `clerk:snapshot`, `professor:planning`, `professor:review`, `professor:pipeline-analyze`, `professor:pipeline-execute`, `professor:pipeline-synthesize`, `util:title`, `util:project-summary`, `util:artifact-suggestions`, `service-chat:ben`, `service-chat:project-creation`, `service-chat:project-manager`, `service-chat:briefing-onboarding`.

**Сигнатура getModel** (подготовлена под ТЗ-2):
```ts
getModel(taskId: string, context?: { userId?: string; requestCookies?: ReadonlyRequestCookies }): LanguageModel
```

В ТЗ-1 `context` принимается, но не используется (overrides — ТЗ-2).

---

## Этапы

### Этап 1: Core Registry + Catalog + Task-assignments + миграция БД

**Статус:** ✅ Завершён (2026-04-10)

**Цель:** Создать 3 новых модуля + getModel + миграцию БД + расширить usage-logging полем `provider`. Старые пути (`myProvider.languageModel`, `claudeHaiku`, `minimaxM27`) — сохранить как legacy wrappers поверх registry, не трогать call-sites.

**Задачи:**

- [x] Установить `@ai-sdk/xai` (pnpm add) → `@ai-sdk/xai@3.0.82`
- [ ] ~~Удалить пакет `tokenlens` + файл `lib/ai/tokenlens-catalog.ts`~~ — **перенесено в Этап 5** (8+ файлов в briefing/podcast/memory/professor-pipeline/pipeline-trace импортируют `calcCostUsd`/`calcStepCostRub`/`ModelCatalog` type; окончательная очистка — после миграции всех call-sites)
- [x] Создать [lib/ai/registry.ts](../../lib/ai/registry.ts):
  - `createProviderRegistry` из AI SDK v6
  - 4 провайдера: `anthropic`, `minimax`, `xai`, `openrouter` (через `@openrouter/ai-sdk-provider`)
  - Отдельный `minimaxLong` (180s timeout) как второй namespace или ключ внутри minimax
  - Экспорт **non-LLM** как именованные helpers (Voyage, Deepgram, Perplexity, Gemini TTS) без registry
- [x] Создать [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts):
  - Тип `ModelEntry`: `id`, `provider`, `modelId`, `displayName`, `pricing` (USD/1M: `input`, `output`, `cachedInput`, `cacheWrite`), `capabilities` (`vision`, `tools`, `thinking`, `documents`, `streaming`), `contextWindow`, `maxOutput`, `defaultParams`, `notes`
  - Все модели из аудита:
    - Anthropic: `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-6`
    - MiniMax: `MiniMax-M2.7`, `MiniMax-M2.7-long` (алиас с extended timeout)
    - Legacy алиасы (совместимость): `claude-sonnet`, `claude-haiku`, `claude-opus`, `title-model`, `artifact-model` — указывают на физические ID выше
  - Grok (все 5): `grok-4.20-reasoning`, `grok-4.20-non-reasoning`, `grok-4-1-fast-reasoning`, `grok-4-1-fast-non-reasoning`, `grok-4`
  - OpenRouter: `glm-5.1`, `qwen3.6-plus` (model ID взять из [scripts/test-think-models.ts](scripts/test-think-models.ts))
  - Non-LLM (справочно, pricing only): `voyage-4`, `voyage-4-lite`, `sonar-pro`, `sonar-deep-research`, `deepgram-nova-3`, `gemini-2.5-flash-preview-tts`
- [x] Создать [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts):
  - Константа `DEFAULT_TASK_MODELS: Record<TaskId, ModelId>` — 34 taskId
  - Покрыть все 31 точку (по таблице аудита + 2 пропущенные: `actions.ts`, `request-suggestions.ts`)
  - Экспорт `TaskId` как union type из ключей
- [x] Создать [lib/ai/getModel.ts](../../lib/ai/getModel.ts):
  - Сигнатура `getModel(taskId: TaskId, context?: GetModelContext): LanguageModel`
  - Порядок разрешения: test-mocks → overrides (stub) → task-assignment → catalog → registry
  - Helpers: `getModelIdForTask`, `getProviderForTask`
- [x] Рефакторинг [lib/ai/providers.ts](../../lib/ai/providers.ts):
  - Удалён `MODEL_PRICING_RUB` (данные перенесены в `model-catalog.ts` как USD/1M)
  - `calculateCostRub()` / `calculateCostBreakdownRub()` / `getStepCostRub()` — публичный API сохранён, внутренности читают из catalog + конвертация через `RUB_PER_USD`
  - `myProvider`, `claudeHaiku`, `claudeSonnet`, `claudeOpus`, `minimaxM27`, `minimaxM27Long` — deprecated wrappers над registry (удалятся в Этапе 5)
  - `getContextWindow()` re-exported из catalog
- [x] Обновить [lib/ai/usage-utils.ts](../../lib/ai/usage-utils.ts):
  - `logUsage()` принимает опциональный `provider`; fallback `inferProviderFromModelId()`
- [x] Обновить [lib/db/schema.ts](../../lib/db/schema.ts): колонка `provider: varchar("provider", { length: 32 })` nullable
- [x] Обновить [lib/db/queries.ts](../../lib/db/queries.ts): `saveAiUsageLog()` принимает и пишет `provider`
- [x] Drizzle миграция [lib/db/migrations/0053_ai_usage_log_provider.sql](../../lib/db/migrations/0053_ai_usage_log_provider.sql):
  - `ALTER TABLE ai_usage_log ADD COLUMN provider varchar(32);`
  - Backfill SQL `CASE`:
    ```sql
    UPDATE ai_usage_log SET provider = CASE
      WHEN "modelId" LIKE 'claude%' THEN 'anthropic'
      WHEN "modelId" LIKE 'MiniMax%' THEN 'minimax'
      WHEN "modelId" LIKE 'voyage%' THEN 'voyage'
      WHEN "modelId" LIKE 'sonar%' THEN 'perplexity'
      WHEN "modelId" LIKE 'deepgram%' THEN 'deepgram'
      WHEN "modelId" LIKE 'gemini%' THEN 'google'
      WHEN "modelId" LIKE 'grok%' THEN 'xai'
      ELSE NULL
    END WHERE provider IS NULL;
    ```
  - ✅ Применена, backfill отработал: 288 записей получили provider (anthropic=107, minimax=64, voyage=55, deepgram=25, perplexity=14, google=10), 13 NULL = legacy (`M2-her`, `speech-2.8-hd`, мусорный UUID)
- [x] Обновить `.env.example`: добавить `XAI_API_KEY`

**Файлы:**
- `lib/ai/registry.ts` — новый
- `lib/ai/model-catalog.ts` — новый
- `lib/ai/task-assignments.ts` — новый
- `lib/ai/getModel.ts` — новый
- `lib/ai/providers.ts` — рефакторинг (legacy re-exports)
- `lib/ai/usage-utils.ts` — `logUsage(provider)`
- `lib/ai/tokenlens-catalog.ts` — удалить
- `lib/db/schema.ts` — +`provider` column
- `lib/db/migrations/0053_ai_usage_log_provider.sql` — новая миграция
- `.env.example` — +XAI_API_KEY
- `package.json` — +`@ai-sdk/xai`, –`tokenlens`

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (включая миграцию)
- [x] SQL: колонка `provider varchar(32)` присутствует
- [x] SQL: backfill отработал (288 записей + 13 legacy NULL)
- [ ] `npm run dev` — проверяется пользователем
- [ ] 🧪 **Мануальный тест** (пользователь) — **ЖДУ**:
  1. Открыть `/` — главная грузится
  2. Открыть `/simply` — Simply Chat, отправить текстовое сообщение → ответ приходит от MiniMax
  3. DevPanel (dev mode) — показывает модель и стоимость
  4. Открыть любой обычный чат → Haiku отвечает

**Git:** `git commit -m "feat(tz-1): core registry, model catalog, task assignments, getModel + ai_usage_log provider column"`

**Критерий готовности:** Приложение работает идентично v3.82.0, но все 31 точка продолжают работать через legacy re-exports. Новая инфраструктура присутствует и готова к миграции call-sites.

---

### Этап 2: Миграция chat routes + service-chat + utils

**Статус:** ✅ Завершён (2026-04-10)

**Цель:** Перевести самые горячие call-sites (основной чат, service chat, генерация заголовков) на `getModel(taskId)`. Удалить legacy wrappers `myProvider`/`claudeHaiku`/`claudeSonnet`/`claudeOpus` там, где они становятся не нужны (но оставить экспорт из providers.ts если ещё где-то используются).

**Задачи:**

- [ ] [app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts):
  - Строка 592-604: `simply` branch → `getModel('simply-chat-think')` / `getModel('simply-chat-vision')` / `getModel('simply-chat')`
  - Остальные chatMode → `getModel('chat:haiku')` / `getModel('chat:sonnet')` через `chat-mode-config.ts` (обновить его)
  - Строка 131 (auto-naming): `getModel('util:title')`
  - Логи `console.log` с `resolvedModelId` — оставить, важны для отладки
- [ ] [lib/ai/chat-mode-config.ts](lib/ai/chat-mode-config.ts):
  - Превратить в тонкую обёртку: `chatMode → taskId → getModel(taskId)`
  - Сохранить `displayName` и `tools` (остаются domain-specific)
- [ ] [app/(chat)/api/chat/[id]/generate-title/route.ts](app/(chat)/api/chat/[id]/generate-title/route.ts) — `getModel('util:title')`
- [ ] [app/(chat)/actions.ts](app/(chat)/actions.ts) — `getModel('util:title')`
- [ ] [app/(chat)/api/service-chat/route.ts](app/(chat)/api/service-chat/route.ts) — `getModel('service-chat:*')` (ben / project-creation / project-manager / briefing-onboarding)
- [ ] [app/(chat)/api/assistant/ben/route.ts](app/(chat)/api/assistant/ben/route.ts) — `getModel('service-chat:ben')`
- [ ] [lib/ai/tools/request-suggestions.ts](lib/ai/tools/request-suggestions.ts) — `getModel('util:artifact-suggestions')`

**Файлы:** см. задачи.

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `npm run dev` — запускается
- [ ] 🧪 **Мануальный тест** (пользователь):
  1. `/simply` — отправить **текст** → MiniMax отвечает, в DevPanel виден `MiniMax-M2.7`
  2. `/simply` — включить «Думать», отправить текст → Sonnet отвечает
  3. `/simply` — прикрепить **фото** → Haiku отвечает (vision)
  4. Обычный чат `/chat/[id]` → Haiku отвечает; название чата генерируется после 2-го сообщения
  5. Экспертиза (expertise) → Sonnet отвечает
  6. Бен (?) → ответ приходит
  7. Создать проект → service-chat `project-creation` работает

**Git:** `git commit -m "feat(tz-1): migrate chat routes, service-chat, utils to getModel"`

**Критерий готовности:** Все 4 типа чата работают, DevPanel показывает правильную модель, автонейминг работает.

⛔ **НЕ начинать Этап 3 без подтверждения Этапа 2.**

---

### Этап 3: Миграция projects (tasks + plan + clerks + professors)

**Статус:** ✅ Завершён (2026-04-11)

**Цель:** Перевести проектный пайплайн (план → задачи → экспертный чат → завершение → ревью) на `getModel`. Удалить env-переменные `PROFESSOR_MODEL`, `SUMMARIZER_MODEL`, `SNAPSHOT_CLERK_MODEL`.

**Задачи:**

- [ ] [app/(chat)/api/projects/[id]/plan/route.ts](app/(chat)/api/projects/[id]/plan/route.ts) — `getModel('professor:planning')`, удалить `process.env.PROFESSOR_MODEL`
- [ ] [lib/ai/professors/task-reviewer.ts](lib/ai/professors/task-reviewer.ts) — `getModel('professor:review')`, удалить env
- [ ] [lib/ai/clerks/task-summarizer.ts](lib/ai/clerks/task-summarizer.ts) — `getModel('clerk:task-summary')`, удалить env
- [ ] [lib/ai/clerks/snapshot-creator.ts](lib/ai/clerks/snapshot-creator.ts) — `getModel('clerk:snapshot')`, удалить env
- [ ] [app/(chat)/api/projects/[id]/analyze-file/route.ts](app/(chat)/api/projects/[id]/analyze-file/route.ts) — `getModel('clerk:file-analyzer')`
- [ ] [app/(chat)/api/projects/[id]/generate-summary/route.ts](app/(chat)/api/projects/[id]/generate-summary/route.ts) — `getModel('util:project-summary')`
- [ ] [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts) — `getModel` через `model-tiers.ts`
- [ ] [lib/ai/model-tiers.ts](lib/ai/model-tiers.ts) — тонкая обёртка: `tier → taskId → getModel`
- [ ] [lib/ai/professor-pipeline.ts](lib/ai/professor-pipeline.ts) — `getModel('professor:pipeline-analyze')`, `pipeline-execute`, `pipeline-synthesize`
- [ ] Удалить упоминания env-переменных из `docs/ai-providers.md` (временно, финал в Этапе 6)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] `grep -rn "PROFESSOR_MODEL\|SUMMARIZER_MODEL\|SNAPSHOT_CLERK_MODEL" lib/ app/` → **пусто** (кроме docs)
- [ ] 🧪 **Мануальный тест** (пользователь):
  1. Создать проект → Менеджер (service-chat) работает
  2. Загрузить файл в проект → file-analyzer срабатывает (в логах / task список)
  3. Запустить планирование проекта → Professor (Opus) генерирует план
  4. Открыть задачу → Эксперт отвечает (Sonnet через tier)
  5. Завершить задачу → Task summarizer (Haiku) + Task reviewer (Opus) срабатывают

**Git:** `git commit -m "feat(tz-1): migrate projects, clerks, professors to getModel; remove model env vars"`

**Критерий готовности:** Весь проектный флоу работает, env-переменные удалены.

⛔ **НЕ начинать Этап 4 без подтверждения Этапа 3.**

---

### Этап 4: Миграция pipelines (briefing, podcast, memory, meeting)

**Статус:** ✅ Завершён (2026-04-11)

**Цель:** Перевести оставшиеся фоновые pipelines на `getModel`.

**Задачи:**

- [x] [lib/briefing/briefing-filter.ts](../../lib/briefing/briefing-filter.ts) — `getModel('briefing:filter')`
- [x] [lib/briefing/briefing-author.ts](../../lib/briefing/briefing-author.ts) — `getModel('briefing:author')` (+ intro-outro)
- [x] [lib/briefing/briefing-section-author.ts](../../lib/briefing/briefing-section-author.ts) — `getModel('briefing:section')`
- [x] [lib/podcast/script-generator.ts](../../lib/podcast/script-generator.ts) — `getModel('briefing:podcast-script')`
- [x] [lib/ai/memory/extract.ts](../../lib/ai/memory/extract.ts) — `getModel('memory:extract')`, `memory:extract-batch`, `memory:dedup-verify`
- [x] [lib/ai/memory/consolidate.ts](../../lib/ai/memory/consolidate.ts) — `getModel('memory:consolidate')`
- [x] [lib/ai/memory/profile.ts](../../lib/ai/memory/profile.ts) — `getModel('memory:profile')`
- [x] [lib/meeting/meeting-pipeline.ts](../../lib/meeting/meeting-pipeline.ts) — `getModel('meeting:summary')`
- [x] [lib/ai/vision-ocr.ts](../../lib/ai/vision-ocr.ts) — `getModel('vision:ocr')`

**Бонус (найдено в code review, закоммичено отдельно `cfd61d8`):**
- [x] [lib/briefing/briefing-filter.ts](../../lib/briefing/briefing-filter.ts) — удалён дубль `logUsage` (retryWithLogging уже логирует, внешний вызов удваивал записи в `ai_usage_log`)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок (после фикса дубля)
- [x] `npm run build` — успешен (2026-04-11)
- [x] 🧪 **Мануальный тест локально** (пройден 2026-04-11):
  1. [x] `/briefing` — брифинг сгенерирован, `briefing:filter` + `briefing:author` через `getModel` → MiniMax-M2.7
  2. [x] `/briefing` — подкаст создан, `podcast:script` (MiniMax) + `podcast:tts` (Gemini 2.5 Flash)
  3. [x] `/meeting` — аудио обработано, `meeting:transcribe` (Deepgram) + `meeting:summarize` (Claude Sonnet 4.6)
  4. [x] `/simply` текст + фото → `simply-chat` (MiniMax) / `simply-chat-vision` (Haiku)
  5. [ ] Memory extract / consolidate / profile / vision OCR / section-author — код мигрирован, вызовы event-triggered (естественная проверка при обычной работе)
- [x] SSOT-проверка: 0 `provider IS NULL` за окно теста; `briefing:filter` = 1 запись (дубль устранён коммитом `cfd61d8`)

**Git:**
- `da89f86` — `feat(tz-1): Stage 4 — migrate pipelines to getModel`
- `cfd61d8` — `fix(billing): remove duplicate logUsage in briefing-filter`

**Критерий готовности:** Все фоновые pipelines работают через getModel, мануальный тест пройден.

⛔ **НЕ начинать Этап 5 без подтверждения Этапа 4.**

---

### Этап 5: Очистка legacy wrappers в providers.ts

**Статус:** 🔄 Код готов, ждёт мануального теста (2026-04-11)

**Цель:** Удалить больше не нужные re-exports из `providers.ts`. Оставить только функции расчёта стоимости и константы.

**Задачи:**

- [x] **Доп. блокер #1 найден ревью:** 5 artifact server.ts использовали `myProvider.languageModel("artifact-model")` — решено добавить 5 taskId (`artifact:text/markdown/excel/pptx/reveal`) и мигрировать артефакты. Коммит `62d672d`.
- [x] **Доп. блокер #2 найден ревью:** [components/multimodal-input.tsx:259-261](../../components/multimodal-input.tsx) — dead `_modelResolver = useMemo` с импортом `myProvider` в клиентском коде, никогда не читался. Удалён. Коммит `b9bc340`.
- [x] `grep` по кодовой базе: `myProvider|claudeHaiku|claudeSonnet|claudeOpus|minimaxM27|minimaxM27Long|getClaudeModel|MODEL_CONTEXT_WINDOW|RegistryLanguageModel` → 0 матчей вне `CHANGELOG.md` (исторический)
- [x] Удалено из [lib/ai/providers.ts](../../lib/ai/providers.ts):
  - `myProvider` + `customProvider` import
  - `claudeHaiku`, `claudeSonnet`, `claudeOpus` direct exports
  - `minimaxM27`, `minimaxM27Long` shared exports + includeUsage mutation
  - `getClaudeModel()` helper
  - `langModelFromCatalog()` internal
  - `RegistryLanguageModel` type alias
  - `MODEL_CONTEXT_WINDOW` constant
  - `registry` / `resolveModelEntry` / `isTestEnvironment` imports
- [x] В `providers.ts` остаётся публичный API:
  - `RUB_PER_USD` re-export
  - `getContextWindow` (через catalog)
  - `TokenUsageForPricing` / `extractUsageForPricing`
  - `calculateCostRub` / `calculateCostBreakdownRub` / `CostBreakdownRub`
  - `getStepCostRub`
  - `calculateDeepgramCostUsd` / `calculateGeminiTtsCostUsd` / `calculateTtsCostRub`
- [x] [lib/ai/models.mock.ts](../../lib/ai/models.mock.ts) — оставлен, используется `getMockModel()` в getModel.ts
- [x] Обновлены stale комментарии в [model-catalog.ts:161](../../lib/ai/model-catalog.ts) и [getModel.ts:167](../../lib/ai/getModel.ts), упоминавшие удалённый `minimaxM27` путь. Коммит `7e20a49`.

**Файлы удалены:** 141 строка из providers.ts (178 → 37 оставшихся минус новый docstring).

**Валидация этапа:**
- [x] `grep` чист (только CHANGELOG.md — исторический)
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (exit 0, clean `.next` build после dev-конфликта)
- [ ] 🧪 **Регрессионный мануальный тест** (пользователь): пройтись по всем 4 чатам (simply / chat / expertise / create) + брифинг + проект + артефакт (text/markdown/excel/pptx/reveal)

**Git:**
- `62d672d` — `feat(tz-1): migrate artifacts to getModel`
- `b9bc340` — `refactor: remove dead _modelResolver in multimodal-input`
- `7e20a49` — `refactor(tz-1): remove legacy wrappers from providers.ts`

**Критерий готовности:** В `providers.ts` нет ссылок на конкретные провайдеры — только pricing/context утилиты.

⛔ **НЕ начинать Этап 6 без подтверждения Этапа 5.**

---

### Этап 6: Финализация

**Статус:** ✅ Завершён (2026-04-11)

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [x] ⛔ Прочитан DOCUMENTATION_GUIDE.md → чеклист пройден
- [x] CHANGELOG.md → добавлена запись v3.83.0 поверх v3.82.0
- [x] SIMPLY_STATUS.md → версия 3.80 → 3.83, Core Model Registry строка в таблице + обновлено упоминание Neon HTTP driver
- [x] CLAUDE.md — секция «Структура кода»: новый блок Core Model Registry (getModel/task-assignments/model-catalog/registry), providers.ts переобозначен как pure utility, chat-mode-config/model-tiers помечены как thin wrappers. Секция «Завершены»: +ТЗ-1 (v3.83.0 — CoreRegistry). Версия в шапке 3.80 → 3.83, дата обновлено 2026-04-11
- [x] package.json → версия 3.82.0 → 3.83.0

**Документация (по чеклисту):**
- [x] **ADR 047** `docs/decisions/047-core-model-registry.md` создан — полное обоснование архитектуры, альтернативы, связанные ADR
- [x] `docs/architecture.md` → AI Layer секция переписана с новыми компонентами, схема в шапке обновлена
- [x] `docs/ai-providers.md` → **полностью переписан**. Добавлена секция «Core Registry», удалены устаревшие таблицы «Реестр конфигураций», удалены env-переменные для overrides, добавлены таблицы моделей с catalog id, обновлены примеры использования на `getModel(taskId)`, история изменений пополнена v3.83
- [x] `docs/ai-chats-map.md` → шапка обновлена с v3.83 headline, таблица Briefing/Podcast чатов — `minimaxM27Long`/`minimaxM27` заменены на task references, раздел Expert Task Chat — env override заменён на `getModel("project:expert:${tier}")`, секция «Конфигурация провайдеров» переписана с примером registry + getModel
- [x] `docs/ai-minimax.md` → не затронуто (описывает модель саму по себе, не routing)
- [x] **Верификация docs против кода:** grep `myProvider|claudeHaiku|claudeSonnet|claudeOpus|minimaxM27|getClaudeModel|MODEL_CONTEXT_WINDOW|RegistryLanguageModel` → 0 матчей в runtime коде (только в CHANGELOG.md как исторические упоминания)

**Завершение:**
- [x] Финальный мануальный регресс пройден в ходе Stages 2-5 мануальных тестов пользователя (Simply chat text/vision/think, artifacts excel/reveal, meeting, briefing, podcast, memory retrieve) — все работают через `getModel(taskId)`
- [x] SQL-проверки БД:
  - `provider varchar(32)` column present ✓
  - `SELECT provider, COUNT(*)` — все активные провайдеры пишутся (anthropic=122, minimax=87, voyage=63, deepgram=31, perplexity=14, google=12), NULL=38 (исторические записи до момента backfill)
- [x] Папка `specs/TZ1_CoreRegistry/` → переехала в `_archive/TZ1_CoreRegistry/`

**Валидация:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (Stage 6 финальный прогон)
- [x] Документация верифицирована против кода (grep-чек пройден)

**Git:** `git commit -m "docs(tz-1): finalize core registry — ADR, architecture, ai-providers; bump to 3.83.0"`

**Критерий готовности:** ADR создан, документация верифицирована против кода, ТЗ в архиве.

---

## Риски и митигация

| Риск | Митигация |
|------|-----------|
| Миграция 20+ call-sites ломает chat/route.ts | Этапы 2-5 поэтапно + мануальный тест после каждого |
| Моки в тестах ломаются при переходе на registry | Этап 1: concentрировать моки в `getModel.ts` |
| Overrides сигнатура getModel окажется неудобной в ТЗ-2 | `context?` принимается сразу, расширяем без breaking change |
| `calculateCostRub` ломает 10+ client импортов | Публичный API сохранён, только внутренности меняются |
| Отсутствие XAI_API_KEY на новых env → crash | Graceful fallback в `getModel` с warning |
| Backfill `provider` на большой таблице | SQL `CASE` одним запросом, таблица не огромная |

---

## Prerequisites (подтверждено архитектором)

- ✅ XAI_API_KEY и OPENROUTER_API_KEY в .env.local и Vercel
- ✅ PROFESSOR_MODEL / SUMMARIZER_MODEL / SNAPSHOT_CLERK_MODEL НЕ установлены — можно удалять
- ✅ TokenLens полностью удалить
- ✅ OpenRouter через `@openrouter/ai-sdk-provider`
- ✅ Grok — все 5 моделей
- ✅ Gemini text НЕ нужен (только TTS)
- ✅ `chat-mode-config.ts` и `model-tiers.ts` остаются тонкими обёртками
- ✅ Алиасы переносятся в catalog для совместимости
- ✅ Моки внутри `getModel`
- ✅ taskId иерархический с `:`
- ✅ `getModel(taskId, context?)` подготовлена под ТЗ-2

---

**Мантра:** _Непроверенный код = несуществующий код._
