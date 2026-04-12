# AI-провайдеры и модели

**Версия:** 3.83.0
**Последнее обновление:** 2026-04-11
**Статус:** 7 провайдеров (Anthropic, MiniMax, Google, xAI, OpenRouter, Perplexity, Voyage, Deepgram) + Core Registry v1

---

## О документе

Этот документ описывает:
- AI-провайдеров и модели
- Цены на токены
- API ключи и переменные окружения
- Лимиты и квоты

**SSOT реестра моделей и task→model маппингов** теперь живёт **в коде**, не в docs. См. раздел «Core Registry» ниже.

**Связанные документы:**
- [ai-chats-map.md](ai-chats-map.md) — карта чатов и UI
- [ai-agents.md](ai-agents.md) — агенты и промпты
- [ai-tools.md](ai-tools.md) — инструменты
- [ai-minimax.md](ai-minimax.md) — детали MiniMax M2.7
- [decisions/047-core-model-registry.md](decisions/047-core-model-registry.md) — ADR архитектуры Core Registry

---

## Core Registry (v3.83.0+, ТЗ-1)

С версии 3.83.0 все 39 AI-точек приложения получают модель **только** через единую функцию `getModel(taskId)`. Три файла — источник правды:

| Файл | Ответственность |
|------|-----------------|
| [lib/ai/registry.ts](../lib/ai/registry.ts) | `createProviderRegistry` (AI SDK v6): пять namespace'ов — `anthropic`, `minimax`, `minimaxLong`, `xai`, `openrouter` |
| [lib/ai/model-catalog.ts](../lib/ai/model-catalog.ts) | SSOT физических моделей: pricing (USD/1M), capabilities (vision/tools/thinking), contextWindow, aliasOf |
| [lib/ai/task-assignments.ts](../lib/ai/task-assignments.ts) | `DEFAULT_TASK_MODELS: Record<TaskId, string>` — 39 taskId → catalog id |
| [lib/ai/getModel.ts](../lib/ai/getModel.ts) | Публичный API: `getModel(taskId)`, `getModelIdForTask`, `getProviderForTask`, `taskSupportsThinking` |

**Смена default-модели = одна строка в `task-assignments.ts`.** HMR подхватывает автоматически, никакие call-sites не трогаются. Полное обоснование — в [ADR 047](decisions/047-core-model-registry.md).

### Использование в коде

```ts
import { getModel, getModelIdForTask, getProviderForTask, taskSupportsThinking } from "@/lib/ai/getModel";

const TASK = "briefing:author" as const;

const result = await streamText({
  model: getModel(TASK),
  // providerOptions пишутся условно — catalog знает capabilities
  providerOptions: taskSupportsThinking(TASK)
    ? { anthropic: { thinking: { type: "adaptive", effort: "high" } } }
    : undefined,
  // ...
});

logUsage({
  userId,
  usage: result.usage,
  modelId: getModelIdForTask(TASK),
  provider: getProviderForTask(TASK),
  chatMode: "briefing:author",
});
```

### TaskId convention

Иерархический, разделитель `:`. Префикс обозначает домен:

| Префикс | Что |
|---------|-----|
| `simply-chat*` | Simply Chat (text / vision / think) |
| `chat:*` | Обычный чат по tier (haiku / sonnet / opus) |
| `project:expert:*` | Экспертный чат по задаче проекта (tier) |
| `professor:*` | Профессорский pipeline (planning / review / pipeline-{analyze,execute,synthesize}) |
| `clerk:*` | Вспомогательные клерки (task-summary / snapshot / file-analyzer) |
| `memory:*` | MIND / RAG (extract / extract-batch / consolidate / profile / dedup-verify) |
| `briefing:*` | Генерация брифинга (filter / author / section / podcast-script) |
| `meeting:*` | Транскрипция и суммаризация встреч |
| `service-chat:*` | Сервисные чаты (ben / project-creation / project-manager / briefing-onboarding) |
| `util:*` | Утилиты (title / project-summary / artifact-suggestions) |
| `artifact:*` | Artifact handlers (text / markdown / excel / pptx / reveal) |
| `vision:ocr` | OCR через vision-модель |

Полный список — константа `DEFAULT_TASK_MODELS` в `task-assignments.ts`. TypeScript `TaskId` union гарантирует, что опечатки ловятся компилятором.

### Non-LLM провайдеры

Voyage (embeddings), Deepgram (speech-to-text), Perplexity (deep research), Gemini TTS — **не** живут в registry. Каждый вызывается через свой клиент (`voyage-client.ts`, `deepgram-transcribe.ts`, `perplexity-client.ts`, `tts-gemini.ts`), расчёт стоимости через специальные helper-функции в `providers.ts` (`calculateDeepgramCostUsd`, `calculateGeminiTtsCostUsd`). Их учёт идёт через `logUsage({ costUsdOverride })` в обход `calcCostUsd()`.

---

## Провайдеры

### Anthropic (основной)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/anthropic@3.x` (обёртка над `ai@6.x`) |
| API Key | `ANTHROPIC_API_KEY` |
| Registry namespace | `anthropic` |
| Документация | https://docs.anthropic.com/ |

> **SDK версии:** `ai@6.x` + `@ai-sdk/anthropic@3.x` + `@ai-sdk/google@3.x` + `@ai-sdk/react@3.x`. v6 предоставляет нативные `inputTokenDetails`/`outputTokenDetails` (включая `cacheWriteTokens`, `cacheReadTokens`, `reasoningTokens`).

Используется для: projects expert chat (все tier), professor pipeline, artifacts, memory:extract, meeting:summary, simply-chat-think, simply-chat-vision, clerk'ов, всех service chats, auto-naming, vision:ocr (fallback). Полный список — через `DEFAULT_TASK_MODELS`.

### MiniMax

| Параметр | Значение |
|----------|----------|
| SDK | `vercel-minimax-ai-provider@0.0.2` (официальный пакет MiniMax, Anthropic-compatible) |
| Factory | `createMinimax()` (default export). Под капотом — тонкая обёртка над `AnthropicMessagesLanguageModel` из `@ai-sdk/anthropic/internal` |
| API Key | `MINIMAX_API_KEY` |
| Endpoint | `https://api.minimax.io/anthropic/v1` |
| Registry namespace | `minimax` (default, 60s fetch timeout) + `minimaxLong` (180s timeout для briefing/memory pipelines) |
| Документация | https://platform.minimax.io/docs/api-reference/text-anthropic-api |
| Детали | [ai-minimax.md](ai-minimax.md), ADR 049 |

Используется для: `simply-chat`, `briefing:filter`, `briefing:author`, `briefing:section`, `briefing:podcast-script`, `memory:extract-batch`, `memory:consolidate`, `memory:profile`. **НЕ используется** для vision и TTS (MiniMax не поддерживает ни image, ни document input ни в одном режиме).

**Prompt caching.** Режим Anthropic-compat даёт два уровня кэширования:
- **Passive auto-cache** — срабатывает автоматически от 512 tokens, порядок prefix-matching `tools → system → messages`. Нет параметров в запросе. Метрика в response: `cache_read_input_tokens` (AI SDK v6 мапит в `inputTokenDetails.cacheReadTokens`).
- **Explicit cache control** — `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }` на content-part или tool. До 4 breakpoints, TTL 5 минут с автопродлением при hit. Идентичен синтаксису Anthropic, т.к. пакет проксирует через `AnthropicMessagesLanguageModel`. Метрики: `cache_creation_input_tokens` + `cache_read_input_tokens`.

Pricing (M2.7): base $0.30/M input, cache write $0.375/M (1.25×), cache read $0.03–0.06/M (~0.1× = скидка 90%), output $1.20/M.

### Google AI

| Параметр | Значение |
|----------|----------|
| SDK (vision) | `@ai-sdk/google` — используется через catalog entry для OCR |
| SDK (TTS) | `@google/genai` — напрямую в `lib/podcast/tts-gemini.ts` |
| API Key | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Registry namespace | **НЕ в registry** — подключается через catalog `provider: "google"` и обрабатывается отдельно (non-LLM paths) |
| Документация | https://ai.google.dev/ |

Используется для: Podcast TTS (Gemini 2.5 Flash TTS, multi-speaker Kore + Iapetus). Vision OCR сейчас на Claude Haiku (vision:ocr task), Gemini Vision зарезервирован в catalog но не активен.

### xAI (Grok)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/xai@3.0.82` |
| API Key | `XAI_API_KEY` |
| Registry namespace | `xai` |
| Документация | https://docs.x.ai/ |

В catalog добавлены 5 моделей (grok-4.20-reasoning, grok-4.20-non-reasoning, grok-4-1-fast-reasoning, grok-4-1-fast-non-reasoning, grok-4). **В task-assignments пока не подключены** — зарезервированы для будущих ТЗ. Готовность инфраструктуры проверена в Stage 1 ТЗ-1.

### OpenRouter

| Параметр | Значение |
|----------|----------|
| SDK | `@openrouter/ai-sdk-provider` |
| API Key | `OPENROUTER_API_KEY` |
| Registry namespace | `openrouter` |
| Документация | https://openrouter.ai/docs |

Зарезервирован под GLM 5.1 и Qwen 3.6 Plus. **В task-assignments пока не подключены.**

### Perplexity

| Параметр | Значение |
|----------|----------|
| SDK | REST API через `lib/ai/tools/perplexity-client.ts` |
| API Key | `PERPLEXITY_API_KEY` |
| Endpoint | `https://api.perplexity.ai/chat/completions` |
| Документация | https://docs.perplexity.ai/ |

Используется для `tool:deep-research` (sonar-pro / sonar-deep-research). Доступен в режимах expertise, create, project expert chat. **Не в registry** — это tool, не модель.

### Voyage AI

| Параметр | Значение |
|----------|----------|
| SDK | REST API через `lib/ai/memory/voyage-client.ts` |
| API Key | `VOYAGE_API_KEY` |
| Endpoint | `https://api.voyageai.com/v1/embeddings` |
| Документация | https://docs.voyageai.com/ |

Используется для MIND / RAG: `voyage-4` (indexing, document embeddings) + `voyage-4-lite` (query embeddings, shared space). **Не в registry** — это embeddings, не language model.

### Deepgram

| Параметр | Значение |
|----------|----------|
| SDK | REST API |
| API Key | `DEEPGRAM_API_KEY` |
| Документация | https://developers.deepgram.com/ |

Используется для: voice input (в чате, realtime API), meeting transcribe (Nova-3 batch, русский, diarize). **Не в registry** — это speech-to-text, не language model.

---

## Модели (реестр цен)

Физические ID, цены (USD/1M tokens), назначение. SSOT — [lib/ai/model-catalog.ts](../lib/ai/model-catalog.ts).

### Anthropic Claude

| Модель | Catalog ID | Физический ID | Input | Output | Cache read | Cache write | Контекст | Max Output |
|--------|------------|---------------|-------|--------|------------|-------------|----------|------------|
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | `claude-sonnet-4-6` | $3.00/1M | $15.00/1M | $0.30/1M | $3.75/1M | 1M | 64K |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | `claude-haiku-4-5-20251001` | $1.00/1M | $5.00/1M | $0.10/1M | $1.25/1M | 200K | 64K |
| Claude Opus 4.6 | `claude-opus-4-6` | `claude-opus-4-6` | $5.00/1M | $25.00/1M | $0.50/1M | $6.25/1M | 1M | 128K |

**Алиасы (сохранены для обратной совместимости):**
- `claude-sonnet` → `claude-sonnet-4-6`
- `claude-haiku` → `claude-haiku-4-5-20251001`
- `claude-opus` → `claude-opus-4-6`
- `artifact-model` → `claude-sonnet-4-6`
- `title-model` → `claude-haiku-4-5-20251001`

### MiniMax

| Модель | Catalog ID | Физический ID | Input | Output | Контекст | Примечание |
|--------|------------|---------------|-------|--------|----------|------------|
| MiniMax M2.7 | `MiniMax-M2.7` | `MiniMax-M2.7` | $0.30/1M | $1.20/1M | 204K | Автоматическое кэширование |
| MiniMax M2.7 (long) | `MiniMax-M2.7-long` | `MiniMax-M2.7` | $0.30/1M | $1.20/1M | 204K | Алиас на ту же физическую модель, но через registry namespace `minimaxLong` с 180s fetch timeout (для briefing) |

### Non-LLM (справочно — pricing only, в catalog для cost audit)

| Модель | Физический ID | Цена | Использование |
|--------|---------------|------|---------------|
| Voyage 4 | `voyage-4` | $0.06/1M tok | MIND: embed фактов (document) |
| Voyage 4 Lite | `voyage-4-lite` | $0.02/1M tok | MIND: embed запросов (query, shared space) |
| Sonar Pro | `sonar-pro` | $3/$15 per 1M | Deep Research: быстрый мультишаговый |
| Sonar Deep Research | `sonar-deep-research` | $5/$25 per 1M | Deep Research: исчерпывающий |
| Deepgram Nova-3 | `deepgram-nova-3` | $0.0043/min batch | Voice input, meeting transcribe |
| Gemini 2.5 Flash TTS | `gemini-2.5-flash-preview-tts` | $4/1M chars | Podcast TTS (multi-speaker) |

### xAI Grok (зарезервировано в catalog, не активно в task-assignments)

| Модель | Физический ID | Статус |
|--------|---------------|--------|
| Grok 4.20 Reasoning | `grok-4.20-reasoning` | В catalog, не назначен task |
| Grok 4.20 Non-Reasoning | `grok-4.20-non-reasoning` | В catalog, не назначен task |
| Grok 4-1 Fast Reasoning | `grok-4-1-fast-reasoning` | В catalog, не назначен task |
| Grok 4-1 Fast Non-Reasoning | `grok-4-1-fast-non-reasoning` | В catalog, не назначен task |
| Grok 4 | `grok-4` | В catalog, не назначен task |

### OpenRouter (зарезервировано в catalog, не активно в task-assignments)

| Модель | Физический ID | Статус |
|--------|---------------|--------|
| GLM 5.1 | `z-ai/glm-4.6` | В catalog, не назначен task |
| Qwen 3.6 Plus | `qwen/qwen3-max` (placeholder) | В catalog, не назначен task |

---

## Environment Variables

```bash
# Anthropic (обязательно — основной провайдер)
ANTHROPIC_API_KEY=your_anthropic_api_key

# MiniMax (обязательно — Simply Chat, Briefing, Podcast Script)
MINIMAX_API_KEY=your_minimax_api_key

# Google AI (обязательно — Podcast TTS)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

# xAI (зарезервировано — Grok через registry)
XAI_API_KEY=your_xai_api_key

# OpenRouter (зарезервировано — GLM, Qwen через registry)
OPENROUTER_API_KEY=your_openrouter_api_key

# Perplexity (Deep Research tool)
PERPLEXITY_API_KEY=your_perplexity_api_key

# Voyage AI (MIND / RAG embeddings)
VOYAGE_API_KEY=your_voyage_api_key

# Deepgram (voice input + meeting transcribe)
DEEPGRAM_API_KEY=your_deepgram_api_key
```

**Env-переменные для override моделей удалены в ТЗ-1 (v3.83.0):** `PROFESSOR_MODEL`, `SUMMARIZER_MODEL`, `SNAPSHOT_CLERK_MODEL`, `EXPERT_MODEL`. Их роль теперь играет `task-assignments.ts`. Для временного переключения модели в dev — правка одной строки в `DEFAULT_TASK_MODELS` + HMR.

### Где получить ключи

| Провайдер | URL |
|-----------|-----|
| Anthropic | https://console.anthropic.com/settings/keys |
| MiniMax | https://platform.minimax.io/user-center/basic-information/interface-key |
| Google AI | https://aistudio.google.com/apikey |
| xAI | https://console.x.ai/ |
| OpenRouter | https://openrouter.ai/keys |
| Perplexity | https://www.perplexity.ai/settings/api |
| Voyage AI | https://dash.voyageai.com/ |
| Deepgram | https://console.deepgram.com/ |

---

## Cost Calculation API

### Token-based (для Anthropic / MiniMax / xAI / OpenRouter)

```ts
import { calculateCostRub, calculateCostBreakdownRub, extractUsageForPricing } from "@/lib/ai/providers";

const usage = extractUsageForPricing(sdkUsage);
const cost = calculateCostRub("claude-sonnet-4-6", usage);  // агрегат в рублях
const breakdown = calculateCostBreakdownRub("claude-sonnet-4-6", usage);
// { freshInputRub, cacheReadRub, cacheWriteRub, outputRub, reasoningRub, totalRub }
```

Под капотом читается `pricing` из model-catalog и конвертируется через `RUB_PER_USD` из `lib/constants/pricing`.

### Non-token (для Deepgram / Gemini TTS)

```ts
import { calculateDeepgramCostUsd, calculateGeminiTtsCostUsd, calculateTtsCostRub } from "@/lib/ai/providers";

// Deepgram Nova-3: $0.0043/min batch
const dgCost = calculateDeepgramCostUsd(audioSeconds);

// Gemini TTS: $4/1M chars
const ttsCost = calculateGeminiTtsCostUsd(script.length);

// TTS в рублях через флэт-тариф ($/секунда)
const ttsRub = calculateTtsCostRub(durationSeconds);
```

Передаются через `costUsdOverride` в `logUsage()` — обходят `calcCostUsd()` для non-token pricing. Используется в Pipeline Observability (`lib/ai/pipeline-trace.ts`).

### Voyage (hardcoded per-token)

`memory:extract` логирует Voyage embeddings через `costUsdOverride` в `lib/ai/memory/extract.ts`. TODO: вынести в catalog как non-LLM provider.

---

## Context windows

`getContextWindow(modelId)` из [lib/ai/providers.ts](../lib/ai/providers.ts) делегирует в `model-catalog.ts`. Используется для подсчёта percentage в Context popover UI.

---

## Лимиты и квоты

### Anthropic

| Лимит | Значение |
|-------|----------|
| RPM / TPM | Зависит от тарифа аккаунта |
| Concurrent requests | По тарифу |

### MiniMax

| Лимит | Значение |
|-------|----------|
| Timeout на запрос | 180s (через registry namespace `minimaxLong`) для briefing pipelines |
| Context window | 204 800 tokens |

### Google AI (TTS)

| Лимит | Free tier | Pay-as-you-go |
|-------|-----------|---------------|
| RPM | 15 | 1000+ |
| RPD | 1500 | Unlimited |

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-04-11 | 3.83.0 | **ТЗ-1 Core Registry:** `getModel(taskId)` как SSOT для 39 AI-точек. Удалены `myProvider`, `claudeHaiku/Sonnet/Opus`, `minimaxM27/Long`, env-overrides (PROFESSOR_MODEL/SUMMARIZER_MODEL/SNAPSHOT_CLERK_MODEL/EXPERT_MODEL). providers.ts стал чистым pricing/cost utility (−141 строка). Добавлены registry namespaces xAI + OpenRouter (зарезервированы). `ai_usage_log.provider` column + backfill. Capability-driven `taskSupportsThinking()`. ADR 047. |
| 2026-04-06 | 3.3.0 | ТЗ-PIPELINE1: Removed AUTHOR_MODEL_FALLBACK, added retryWithLogging for briefing-author/section-author, artifact handlers now log usage |
| 2026-03-01 | 3.2.0 | ТЗ-CACHE1: Prompt Caching (cacheControl: ephemeral) для всех streaming routes (per-message providerOptions на system message) |
| 2026-02-22 | 3.1.1 | Добавлены Perplexity (sonar-pro, sonar-deep-research), Podcast модели (gemini-2.5-flash скрипт, gemini-2.5-flash-preview-tts TTS), `@google/genai` SDK для TTS |
| 2026-02-21 | 3.1.0 | Briefing Author → Claude Sonnet 4.6 (из Gemini 3 Pro), effort для 3 точек (онбординг, профессор, ревьюер), Gemini остался только для фильтра + OCR |
| 2026-02-21 | 3.0.0 | Добавлен Реестр конфигураций (SSOT), исправлены модели (claude-sonnet-4-6 для онбординга, gemini-2.5-flash для OCR), добавлен чеклист миграции |
| 2026-02-20 | 2.1.0 | Добавлены модели Gemini для Briefing pipeline |
| 2026-02-16 | 2.0.0 | Полное переключение на Anthropic Claude. OpenRouter удалён |
| 2026-02-03 | 1.1.1 | Переход на официальный OpenRouter SDK |
| 2026-02-02 | 1.1.0 | Обновлены модели Claude на 4.5 |
| 2026-02-02 | 1.0.0 | Создание документа |

---

**Обновлено:** 2026-04-11
