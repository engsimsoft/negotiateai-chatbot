# ADR 047: Core Model Registry — Task-based Model Resolution

**Дата:** 2026-04-11
**Статус:** Принято
**ТЗ:** TZ1_CoreRegistry (v3.83.0)

## Контекст

К версии 3.82.0 в проекте было **31 AI-точка** — мест, где код напрямую создавал `LanguageModel` через один из нескольких параллельных путей:

1. `myProvider.languageModel("claude-sonnet")` — `customProvider` из AI SDK v5 с захардкоженным map алиасов
2. Прямые экспорты `claudeHaiku` / `claudeSonnet` / `claudeOpus` / `minimaxM27` / `minimaxM27Long` из `lib/ai/providers.ts`
3. Env-переменные `PROFESSOR_MODEL` / `SUMMARIZER_MODEL` / `SNAPSHOT_CLERK_MODEL` / `EXPERT_MODEL` как точечные overrides
4. Pricing-таблица `MODEL_PRICING_RUB` как отдельный захардкоженный словарь
5. `chat-mode-config.ts` — свой map с `modelId` + tools
6. `model-tiers.ts` — свой map для проектных tier (haiku/sonnet/opus)

**Проблемы этой фрагментации:**

- **Смена модели = обход 10+ файлов.** Переключение `claude-sonnet-4-5` → `claude-sonnet-4-6` требовало ручных правок в providers.ts, docs/ai-providers.md, chat-mode-config.ts, model-tiers.ts и всех call-site, которые жили с прямыми импортами.
- **Нельзя переопределить модель per-task для отладки.** Env-переменные работали только для professor/summarizer/snapshot — остальные 25+ точек были недоступны.
- **Pricing дублировался.** `MODEL_PRICING_RUB` в providers.ts и `MODEL_CONTEXT_WINDOW` — каждый со своими захардкоженными значениями. Расхождения выявлялись только когда cost-audit показывал неверные рубли.
- **Невозможно валидировать охват.** Не было единого списка "какая модель назначена на какую задачу" — аудит делался grep'ом по repo.
- **Будущий ТЗ-2 (user-level overrides).** Требовалась сигнатура, которая принимает контекст (userId, cookies) для future подмены модели per-request — без breaking change на call-site.

## Решение

Ввести **единую точку получения модели** — `getModel(taskId, context?)` — и три SSOT-модуля под ней.

### Архитектура

```
┌─────────────────────────────────────────────────┐
│  route.ts / pipeline.ts / artifacts (31 точка)  │
│  const model = getModel('briefing:filter')      │
└──────────────────┬──────────────────────────────┘
                   │
       ┌───────────▼────────────┐
       │  lib/ai/getModel.ts    │ ← overrides (stub, активация в ТЗ-2)
       │  (единая точка входа)  │ ← test mocks (isTestEnvironment)
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │ lib/ai/task-assignments│ taskId → catalogId
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │ lib/ai/model-catalog   │ catalogId → {provider, pricing, caps, defaults}
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │ lib/ai/registry.ts     │ createProviderRegistry (anthropic, minimax, minimaxLong, xai, openrouter)
       └────────────────────────┘
```

### Компоненты

**1. `lib/ai/registry.ts`** — `createProviderRegistry` из AI SDK v6. Пять namespace'ов:
- `anthropic` — Claude Sonnet/Haiku/Opus
- `minimax` — MiniMax M2.7 (дефолтный timeout)
- `minimaxLong` — MiniMax M2.7 с 180s fetch timeout (для briefing)
- `xai` — Grok (все 5 моделей из аудита)
- `openrouter` — glm-5.1, qwen3.6-plus

Non-LLM провайдеры (Voyage, Deepgram, Perplexity, Gemini TTS) остаются именованными helpers вне registry — у них свой API, их нельзя унифицировать под `languageModel()`.

**2. `lib/ai/model-catalog.ts`** — SSOT модели. Каждая запись `ModelEntry` содержит:
- `id`, `provider`, `modelId` — физический ID для API
- `displayName` — человеческое имя для UI
- `pricing` (USD/1M): `input`, `output`, `cachedInput`, `cacheWrite`
- `capabilities`: `vision`, `tools`, `thinking`, `documents`, `streaming`
- `contextWindow`, `maxOutput`, `defaultParams`, `notes`
- `aliasOf?` — для алиасов (`claude-sonnet` → `claude-sonnet-4-6`)

Catalog — единственное место, где знание о физических моделях, их ценах и возможностях. `calculateCostRub` читает pricing отсюда. `taskSupportsThinking(taskId)` проверяет `capabilities.thinking` — callers больше не могут передавать `providerOptions.anthropic.thinking` в модель, которая его не поддерживает.

**3. `lib/ai/task-assignments.ts`** — `DEFAULT_TASK_MODELS: Record<TaskId, string>`. 39 taskId (после Stage 5: +5 artifact). Иерархическая конвенция через `:`:

```
simply-chat, simply-chat-think, simply-chat-vision
chat:haiku, chat:sonnet, chat:opus
project:expert:haiku, project:expert:sonnet, project:expert:opus
professor:planning, professor:review, professor:pipeline-{analyze,execute,synthesize}
clerk:{task-summary, snapshot, file-analyzer}
memory:{extract, extract-batch, consolidate, profile, dedup-verify}
briefing:{filter, author, section, podcast-script}
meeting:summary
service-chat:{ben, project-creation, project-manager, briefing-onboarding}
util:{title, project-summary, artifact-suggestions}
artifact:{text, markdown, excel, pptx, reveal}
vision:ocr
```

Смена модели для любой задачи = одна строка в этом файле. `TaskId` — union type из ключей, компилятор ловит опечатки.

**4. `lib/ai/getModel.ts`** — публичный API:

```ts
getModel(taskId: TaskId, context?: GetModelContext): LanguageModel
getModelIdForTask(taskId: TaskId): string          // для usage logging
getProviderForTask(taskId: TaskId): string         // для ai_usage_log.provider
taskSupportsThinking(taskId: TaskId): boolean      // capability-driven guard
```

Порядок разрешения: `isTestEnvironment → mock` → `lookupOverride (stub, ТЗ-2)` → `DEFAULT_TASK_MODELS[taskId]` → `model-catalog.resolveModelEntry()` → `registry.languageModel()`. Сигнатура с `context?` стабильна и уже подготовлена под ТЗ-2 (user-level overrides).

**Специальный случай:** алиас `MiniMax-M2.7-long` резолвится в `minimaxLong:MiniMax-M2.7` — отдельный namespace registry с extended timeout. Это инкапсулировано в `buildRegistryId()` внутри getModel, callers об этом не знают.

**MiniMax `includeUsage: true`** мутируется на инстансе модели в `getModel()` — без этого MiniMax не эмитит usage events при streaming, и DevPanel показывает пустую стоимость. Раньше был локальный helper в chat/route.ts — теперь централизован.

### ai_usage_log.provider column

Добавлено поле `provider varchar(32) nullable` в `ai_usage_log` (миграция `0053_ai_usage_log_provider.sql`) с SQL-backfill по префиксу `modelId`. `logUsage()` принимает `provider` через `getProviderForTask(taskId)`. Это позволяет cost-audit группировать траты по провайдеру (anthropic / minimax / voyage / deepgram / perplexity / google).

### Capability-driven thinking guard

Во время Stage 3 обнаружилась реальная архитектурная дыра: `providerOptions.anthropic.thinking: adaptive` был захардкожен в 3 местах (plan/route.ts, task-reviewer.ts, service-chat/route.ts). При переключении default-модели на Haiku через task-assignments запрос падал с `400 adaptive thinking is not supported on this model`.

Решение — `taskSupportsThinking(taskId)` читает `capabilities.thinking` из catalog. Все три call-site теперь вызывают `providerOptions.anthropic.thinking` **условно**:

```ts
const supportsThinking = taskSupportsThinking("professor:planning");
const result = await generateObject({
  model: getModel("professor:planning"),
  providerOptions: supportsThinking
    ? { anthropic: { thinking: { type: "adaptive", effort: "high" } } }
    : undefined,
  // ...
});
```

При смене task-assignment на модель без thinking система самоадаптируется. Эта архитектура заодно чинит real-world баг, который существовал с момента миграции ТЗ-C4 (v3.23.0).

## Причины

1. **SSOT для моделей.** Одно место для всех физических моделей, одно место для всех task→model маппингов, одно место для всех цен. Изменение = одна строка.

2. **Будущая совместимость.** `getModel(taskId, context?)` принимает `context` уже сейчас — ТЗ-2 (user overrides из БД / cookies) не потребует breaking change на 31 call-site.

3. **Валидация охвата через типы.** `TaskId` как union — TypeScript гарантирует, что ни одна точка не забыта. `getModelIdForTask("opus:planning")` не скомпилируется, если taskId нет в `DEFAULT_TASK_MODELS`.

4. **Env-переменные как костыль.** `PROFESSOR_MODEL` / `EXPERT_MODEL` давали override только для 4 точек из 31, работали только через перезапуск процесса, и создавали два источника истины (код + env). Заменены на `task-assignments.ts`.

5. **Pricing SSOT.** `MODEL_PRICING_RUB` жил в providers.ts с захардкоженными USD/1M → RUB/1K значениями. Теперь в catalog в USD/1M, конвертация через `RUB_PER_USD` — одна точка для смены курса.

6. **Наблюдаемость в ai_usage_log.** Раньше cost-audit не мог группировать по провайдеру — приходилось grep-like разбор `modelId`. Новая колонка + `getProviderForTask` закрывают это.

7. **capability-driven code.** `taskSupportsThinking` — пример паттерна. В будущем можно добавить `taskSupportsVision(taskId)`, `taskSupportsTools(taskId)` и убрать захардкоженные проверки из call-site.

## Последствия

**Плюсы:**

- Смена default-модели для любой задачи — одна строка в `task-assignments.ts` + HMR автоматически подхватывает.
- Удалены 4 env-переменные (`PROFESSOR_MODEL`, `SUMMARIZER_MODEL`, `SNAPSHOT_CLERK_MODEL`, `EXPERT_MODEL`) — уменьшилась config surface.
- `providers.ts` сократился с ~390 строк до ~260 — теперь это чистый pricing/cost utility module без знаний о конкретных моделях.
- Убрана фрагментация: `myProvider`, `claudeHaiku/Sonnet/Opus`, `minimaxM27/Long`, `getClaudeModel()`, `MODEL_CONTEXT_WINDOW`, `RegistryLanguageModel` — всё удалено (Stage 5). −141 строка.
- Наблюдаемость: `ai_usage_log.provider` сразу после backfill показал что artifact:excel/reveal (claude-sonnet-4-6, anthropic) считаются отдельно от simply (MiniMax-M2.7, minimax) — дало возможность выявить скрытый Sonnet вызов под MiniMax tool call (привело к фиксу DevPanel Timeline, коммит 5768fdd).
- Capability-driven thinking guard автоматически адаптируется при переключении model-tier на проектах.

**Минусы:**

- Небольшой overhead на вызов: `taskId → catalogId → resolveModelEntry → registry.languageModel`. В тестах — микросекунды, в production незаметно.
- Дополнительный слой косвенности при чтении кода: чтобы понять "какая модель вызывается здесь", нужно пройти `task-assignments.ts` → `model-catalog.ts`. Компенсируется тем, что таких путей всего три файла и они короткие.
- Алиасы в catalog (`claude-sonnet` → `claude-sonnet-4-6`) создают два ключа на одну физическую модель. Сохранены для обратной совместимости со старыми `artifact-model` / `title-model` ссылками. Можно удалить в будущем рефакторинге.

## Альтернативы

### 1. Оставить `customProvider` с расширенным alias map

Добавить в `myProvider` все новые алиасы (`briefing:filter` → `minimax-m27-long`). Rejected: сохраняет флат-неймспейс без иерархии, не решает проблему 10+ параллельных источников (chat-mode-config, model-tiers, env-vars), не даёт capability-driven подход.

### 2. React Context / DI в роутах

Передавать модель через параметр `getModel` в каждый handler. Rejected: ухудшает сигнатуры 31 функции, не решает проблему SSOT для цен и capabilities, не работает для server components и background jobs.

### 3. Полный переход на OpenRouter как единый gateway

Все модели через один провайдер (OpenRouter) с маршрутизацией на стороне сервиса. Rejected: потеря native features (Anthropic extended thinking, MiniMax long context, Voyage embeddings), дополнительная комиссия, зависимость от внешнего сервиса как единой точки отказа. OpenRouter оставлен как один из пяти namespace registry для GLM/Qwen — но не как единственный.

### 4. Env-файл со всеми моделями (`.env` — MODELS_JSON=...`)

Вынести всю конфигурацию в env. Rejected: убивает type safety (TaskId → string), не даёт автокомплит в IDE, усложняет тесты (моки), не позволяет валидировать coverage через компилятор.

## Связанные ADR

- [ADR 035](035-sdk-native-usage-tracking.md) — TOKENS1, переход на AI SDK v6 native `inputTokenDetails`. Core Registry построен поверх этих типов.
- [ADR 036](036-cost-tracking-coverage-audit.md) — BILLING1, полное покрытие pipelines для cost tracking. Core Registry нормализует provider-колонку и завершает охват.
- [ADR 037](037-total-usage-and-retry-logging.md) — PIPELINE1, `retryWithLogging` с per-attempt логированием. Core Registry использует его для briefing pipelines.
- [ADR 038](038-cost-tracking-architecture.md) — SDK6 migration + unified usage logging. Core Registry финализирует эту линию работы.

## Миграция на новую модель после ТЗ-1

```ts
// lib/ai/task-assignments.ts
"simply-chat": "MiniMax-M2.7",  // ← одна строка
// ↓
"simply-chat": "claude-sonnet-4-6",
```

Всё. HMR подхватит. Никаких других изменений не требуется — `logUsage` автоматически получит новый `modelId` и `provider`, DevPanel увидит новую модель, cost-audit пересчитает в рублях.

Для добавления новой физической модели:

1. Добавить запись в `model-catalog.ts` (id, provider, pricing, capabilities)
2. Если нужен новый провайдер — добавить в `registry.ts`
3. Назначить taskId в `task-assignments.ts`

Три файла. Никакие call-site не трогаются.
