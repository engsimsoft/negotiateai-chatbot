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

**Статус:** ⬜ Не начат

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

**Статус:** ⬜ Не начат

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

**Статус:** ⬜ Не начат

**Цель:** Перевести оставшиеся фоновые pipelines на `getModel`.

**Задачи:**

- [ ] [lib/briefing/briefing-filter.ts](lib/briefing/briefing-filter.ts) — `getModel('briefing:filter')` (MiniMax long timeout)
- [ ] [lib/briefing/briefing-author.ts](lib/briefing/briefing-author.ts) — `getModel('briefing:author')`
- [ ] [lib/briefing/briefing-section-author.ts](lib/briefing/briefing-section-author.ts) — `getModel('briefing:section')`
- [ ] [lib/podcast/script-generator.ts](lib/podcast/script-generator.ts) — `getModel('briefing:podcast-script')`
- [ ] [lib/ai/memory/extract.ts](lib/ai/memory/extract.ts) — `getModel('memory:extract')`, `memory:extract-batch`
- [ ] [lib/ai/memory/consolidate.ts](lib/ai/memory/consolidate.ts) — `getModel('memory:consolidate')`
- [ ] [lib/ai/memory/profile.ts](lib/ai/memory/profile.ts) — `getModel('memory:profile')`
- [ ] [lib/meeting/meeting-pipeline.ts](lib/meeting/meeting-pipeline.ts) — `getModel('meeting:summary')`
- [ ] [lib/ai/vision-ocr.ts](lib/ai/vision-ocr.ts) — `getModel('vision:ocr')`

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 **Мануальный тест** (пользователь):
  1. `/briefing` — сгенерировать брифинг (filter + author срабатывают, контент появляется)
  2. `/briefing` — создать подкаст (script генерируется)
  3. `/meeting` — загрузить аудио → transcribe + summarize работают
  4. Memory: отправить несколько сообщений в чат → extract должен записать факты (проверить `/context` или БД через `mcp__postgres__query`)
  5. Vision OCR: загрузить скриншот с текстом → текст извлекается

**Git:** `git commit -m "feat(tz-1): migrate briefing, podcast, memory, meeting, vision-ocr pipelines"`

**Критерий готовности:** Все фоновые pipelines работают через getModel.

⛔ **НЕ начинать Этап 5 без подтверждения Этапа 4.**

---

### Этап 5: Очистка legacy wrappers в providers.ts

**Статус:** ⬜ Не начат

**Цель:** Удалить больше не нужные re-exports из `providers.ts`. Оставить только функции расчёта стоимости и константы.

**Задачи:**

- [ ] `grep` по кодовой базе: `myProvider.languageModel|claudeHaiku|claudeSonnet|claudeOpus|minimaxM27\b|minimaxM27Long` → должно быть **0 матчей** вне `providers.ts` и тестовых моков
- [ ] Удалить из [lib/ai/providers.ts](lib/ai/providers.ts):
  - `myProvider`, `customProvider` import
  - `claudeHaiku`, `claudeSonnet`, `claudeOpus` экспорты
  - `minimaxM27`, `minimaxM27Long` экспорты
  - `getClaudeModel()`
  - `createAnthropic`, `createMinimaxOpenAI` импорты
- [ ] В `providers.ts` остаётся:
  - `RUB_PER_USD` re-export
  - `calculateCostRub` / `calculateCostBreakdownRub` / `getStepCostRub` (внутренности через catalog)
  - `extractUsageForPricing` (если не перенесено в `getModel.ts`)
  - `calculateDeepgramCostUsd`, `calculateGeminiTtsCostUsd`, `calculateTtsCostRub` — для non-LLM
  - `getContextWindow` re-export
- [ ] Удалить [lib/ai/models.mock.ts](lib/ai/models.mock.ts) если `isTestEnvironment` branch полностью переехал в `getModel.ts` (или оставить и импортировать из `getModel`)

**Валидация этапа:**
- [ ] `grep` чист (см. выше)
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Все тесты проходят (если есть playwright)
- [ ] 🧪 **Регрессионный мануальный тест** (пользователь): пройтись по всем 4 чатам (simply / chat / expertise / create) + брифинг + проект

**Git:** `git commit -m "refactor(tz-1): remove legacy providers.ts wrappers"`

**Критерий готовности:** В `providers.ts` нет ссылок на конкретные провайдеры — только pricing/context утилиты.

⛔ **НЕ начинать Этап 6 без подтверждения Этапа 5.**

---

### Этап 6: Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Перенести [CHANGELOG.md](CHANGELOG.md) → главный [CHANGELOG.md](../../CHANGELOG.md)
- [ ] Обновить [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) — добавить v3.83.0 ТЗ-1 Core Registry
- [ ] Обновить [CLAUDE.md](../../CLAUDE.md):
  - Секция «Структура кода» — добавить `lib/ai/registry.ts`, `model-catalog.ts`, `task-assignments.ts`, `getModel.ts`
  - «Завершены» — добавить ТЗ-1 (v3.83.0 — CoreRegistry)
- [ ] Обновить [package.json](../../package.json) — версия `3.82.0` → `3.83.0`

**Документация (по чеклисту):**
- [ ] ADR нужен → **Да**: создать `docs/decisions/NNN-model-registry.md` (новый архитектурный слой, SSOT для моделей, обоснование почему `createProviderRegistry` + catalog вместо `customProvider`)
- [ ] `docs/architecture.md` → обновить (новый слой `lib/ai/registry`, `model-catalog`, `getModel`)
- [ ] `docs/ai-providers.md` → **переписать Реестр конфигураций** на основе catalog; удалить строки про env-переменные (PROFESSOR_MODEL и т.д.)
- [ ] `docs/ai-chats-map.md` → обновить (модели берутся из task-assignments, упомянуть getModel)
- [ ] `docs/ai-minimax.md` → обновить если затронуто
- [ ] **Верификация docs против кода** (Правило 5): `grep` по моделям → сверить с catalog

**Завершение:**
- [ ] Финальный мануальный регресс (пользователь): все 6 основных flow
- [ ] SQL-проверки БД:
  - `SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_usage_log';` — есть `provider`
  - `SELECT provider, COUNT(*) FROM ai_usage_log GROUP BY provider;` — backfill отработал и новые записи пишутся
- [ ] Переместить папку `specs/TZ1_CoreRegistry/` → `_archive/TZ1_CoreRegistry/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Production URL работает (если деплой)
- [ ] Документация актуальна (проверено по чеклисту)

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
