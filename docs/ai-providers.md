# AI-провайдеры и модели

**Версия:** 3.101.0
**Последнее обновление:** 2026-04-30
**Статус:** 7 провайдеров (Anthropic, Moonshot AI, Google, xAI, OpenRouter, Perplexity, Voyage, Deepgram) + Core Registry v1

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
- [ai-minimax.md](ai-minimax.md) — 🗄 архивный (MiniMax удалён в ТЗ-BR-AUTHOR-KIMI 2026-04-27)
- [decisions/047-core-model-registry.md](decisions/047-core-model-registry.md) — ADR архитектуры Core Registry

---

## Core Registry (v3.83.0+, ТЗ-1)

С версии 3.83.0 все 39 AI-точек приложения получают модель **только** через единую функцию `getModel(taskId)`. Три файла — источник правды:

| Файл | Ответственность |
|------|-----------------|
| [lib/ai/registry.ts](../lib/ai/registry.ts) | `createProviderRegistry` (AI SDK v6): четыре namespace'а — `anthropic`, `moonshotai` (с 180s fetch timeout), `xai`, `openrouter` |
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
| `util:*` | Утилиты (title / project-summary) |
| `artifact:*` | Artifact handlers (text / markdown / excel / pptx / reveal) |

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

Используется для: projects expert chat (все tier), professor pipeline, artifacts, meeting:summary, simply-chat-think, clerk'ов, всех service chats, auto-naming. Полный список — через `DEFAULT_TASK_MODELS`. После Шага 3 миграции (2026-04-28) Anthropic полностью убран из image-пути чата — `chat-vision` теперь на Grok 4.1 Fast non-reasoning.

### Moonshot AI (Kimi K2.6)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/moonshotai@2.0.11` (dist-tag `ai-v6`, официальный пакет Vercel monorepo). Под капотом — `@ai-sdk/openai-compatible` |
| Factory | `createMoonshotAI({ apiKey, fetch })` |
| API Key | `MOONSHOT_API_KEY` |
| Endpoint | `https://api.moonshot.ai/v1` (Global, default) |
| Registry namespace | `moonshotai` (180s fetch timeout через `AbortSignal.timeout` для briefing pipelines) |
| Документация | https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart |

Используется для: `briefing:author`, `briefing:section`, `briefing:podcast-script`. **НЕ используется** для vision, TTS, document input — модель только текстовая в Simply.

**Prompt caching.** Автоматический server-side cache (без явных breakpoints). Срабатывает на повторяющихся system prompt + history. Метрика в response: `prompt_tokens_details.cached_tokens` (openai-формат, AI SDK v6 мапит в `inputTokenDetails.cacheReadTokens`). Pricing cache hit: $0.16/M input vs $0.95/M base = **−83%**.

**Mode:** Instant (thinking disabled через `providerOptions.moonshotai.thinking: { type: 'disabled' }` — лежит в catalog `defaultParams`, подхватывается через `getDefaultParamsForTask(taskId)`). Reasoning не используется в briefing — длинный связный текст не требует CoT, thinking тратит токены без выгоды.

**Параметры из catalog `defaultParams`:** `temperature: 0.6`, `topP: 0.95`, `providerOptions.moonshotai.thinking: { type: 'disabled' }` — это рекомендация Moonshot для Instant mode (см. quickstart).

Pricing (Kimi K2.6): base $0.95/M input, cached input $0.16/M, output $4.00/M, cache write — нет (автоматический server-side cache).

### Google AI

| Параметр | Значение |
|----------|----------|
| SDK (TTS) | `@google/genai` — напрямую в `lib/podcast/tts-gemini.ts` |
| API Key | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Registry namespace | **НЕ в registry** — TTS вызывается напрямую через native SDK |
| Документация | https://ai.google.dev/ |

Используется для: Podcast TTS (Gemini 2.5 Flash TTS, multi-speaker Kore + Iapetus). После Шага 3 миграции (2026-04-28) `@ai-sdk/google` больше не используется — vision-ocr taskId удалён, image-сценарии чата на xAI Grok 4.1 Fast non-reasoning.

### xAI (Grok)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/xai@3.0.82` (text/vision) + raw fetch для Files API и Responses API |
| API Key | `XAI_API_KEY` |
| Registry namespace | `xai` |
| Документация | https://docs.x.ai/ |

**Files API + Responses API (Шаг 4 миграции, v3.101.0).** Чат-путь PDF/DOCX/XLSX/CSV/TXT/MD идёт через `lib/ai/files/xai-files-client.ts` (multipart upload `/v1/files` с `purpose: "assistants"`, raw fetch) + `lib/ai/files/xai-responses.ts` (стрим `/v1/responses` с `input_file` parts → адаптер в UIMessage stream). Server-side `document_search` активируется автоматически при наличии `input_file`. Все 7 моделей в каталоге получили `documentSupport: { supported: true, method: "files-api", maxSizeMb: 48 }` (Phase 1.5 verified — non-reasoning тоже agentic-capable для Files API). DOCX/XLSX/CSV конвертируются в text/plain до upload (не поддерживаются как нативные content types). Cost tracking точный: `response.usage.cost_in_usd_ticks` (1 tick = $1e-7) → `ai_usage_log.costUsd`, `response.usage.server_side_tool_usage_details.document_search_calls` → `ai_usage_log.serverSideToolCalls jsonb` (1-6 calls per-turn — variable agentic depth). Lifecycle: `chat_attachment` запись на каждый file part, FK CASCADE на `Chat`/`Message_v2`, `deleteChatById`/`deleteAllChatsByUserId` каскадно дропают xAI files + Vercel Blob через `cleanupAttachmentExternals`. Ночной reaper cron `/api/cron/reap-attachments` (0 3 * * *) удаляет orphans старше 24ч.

В catalog 7 Grok-моделей (grok-4, grok-4-fast, grok-4.20-reasoning, grok-4.20-non-reasoning, grok-4.20-multi-agent-0309, grok-4-1-fast-reasoning, grok-4-1-fast-non-reasoning). Активны через `task-assignments`: `simply-chat`, `simply-chat-think`, `expertise`, `create`, `meeting:summary`, `chat-vision`, `briefing:filter`, MIND memory hot path, Library, util:title, compaction:summarize.

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

### Moonshot AI

| Модель | Catalog ID | Физический ID | Input | Output | Cached input | Контекст | Max output | Примечание |
|--------|------------|---------------|-------|--------|--------------|----------|------------|------------|
| Kimi K2.6 | `kimi-k2.6` | `kimi-k2.6` | $0.95/1M | $4.00/1M | $0.16/1M | 256K | 32K | Instant mode (thinking disabled), автоматический prompt cache. defaultParams: temperature 0.6, topP 0.95, thinking disabled (рекомендация Moonshot quickstart) |

### Non-LLM (справочно — pricing only, в catalog для cost audit)

| Модель | Физический ID | Цена | Использование |
|--------|---------------|------|---------------|
| Voyage 4 | `voyage-4` | $0.06/1M tok | MIND: embed фактов (document) |
| Voyage 4 Lite | `voyage-4-lite` | $0.02/1M tok | MIND: embed запросов (query, shared space) |
| Sonar Pro | `sonar-pro` | $3/$15 per 1M | Deep Research: быстрый мультишаговый |
| Sonar Deep Research | `sonar-deep-research` | $5/$25 per 1M | Deep Research: исчерпывающий |
| Deepgram Nova-3 | `deepgram-nova-3` | $0.0043/min batch | Voice input, meeting transcribe |
| Gemini 2.5 Flash TTS | `gemini-2.5-flash-preview-tts` | $4/1M chars | Podcast TTS (multi-speaker) |

### xAI Grok

| Модель | Физический ID | Статус |
|--------|---------------|--------|
| Grok 4 | `grok-4` | В catalog, документ-capable (Files API), не назначен task |
| Grok 4 Fast | `grok-4-fast` | В catalog, документ-capable (Files API), не назначен task |
| Grok 4.20 Reasoning | `grok-4.20-0309-reasoning` | Активен: `simply-chat-think`, `expertise`, `create`, `meeting:summary`, MIND `extract`/`deep-consolidate`, professor pipeline |
| Grok 4.20 Non-Reasoning | `grok-4.20-0309-non-reasoning` | В catalog, не назначен task |
| Grok 4.20 Multi-Agent | `grok-4.20-multi-agent-0309` | 🔒 Reserved для `expertise-multi-agent` (ТЗ-XAI-MA-1, Premium режим) |
| Grok 4.1 Fast Reasoning | `grok-4-1-fast-reasoning` | В catalog, не назначен task |
| Grok 4.1 Fast Non-Reasoning | `grok-4-1-fast-non-reasoning` | Активен: `simply-chat`, `chat-vision` (universal attachment slot), `briefing:filter`, MIND memory hot path, Library, util:title, compaction:summarize, clerks |

Все 7 моделей имеют `documentSupport: { supported: true, method: "files-api", maxSizeMb: 48 }` (Phase 1.5 ТЗ-FilesAPIMigration verified).

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

# Moonshot AI / Kimi K2.6 (обязательно — Briefing pipeline: author, section, podcast-script)
MOONSHOT_API_KEY=your_moonshot_api_key

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
| Moonshot AI / Kimi | https://platform.kimi.ai/ |
| Google AI | https://aistudio.google.com/apikey |
| xAI | https://console.x.ai/ |
| OpenRouter | https://openrouter.ai/keys |
| Perplexity | https://www.perplexity.ai/settings/api |
| Voyage AI | https://dash.voyageai.com/ |
| Deepgram | https://console.deepgram.com/ |

---

## Cost Calculation API

### Token-based (для Anthropic / Moonshot AI / xAI / OpenRouter)

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

`memory:extract-batch` логирует Voyage embeddings через `costUsdOverride` в `lib/ai/memory/extract.ts`. TODO: вынести в catalog как non-LLM provider.

---

## Context windows

`getContextWindow(modelId)` из [lib/ai/providers.ts](../lib/ai/providers.ts) делегирует в `model-catalog.ts`. Используется как физическая характеристика модели. Для индикатора использования в UI и порогов компактации — единый `SIMPLY_CONTEXT_LIMIT` из [lib/ai/context-limits.ts](../lib/ai/context-limits.ts) (ADR 054).

---

## Лимиты и квоты

### Anthropic

| Лимит | Значение |
|-------|----------|
| RPM / TPM | Зависит от тарифа аккаунта |
| Concurrent requests | По тарифу |

### Moonshot AI (Kimi K2.6)

| Лимит | Значение |
|-------|----------|
| Timeout на запрос | 180s (через `AbortSignal.timeout` в registry namespace `moonshotai`) для briefing pipelines |
| Context window | 256 000 tokens |
| Max output | 32 768 tokens |
| Tier (Concurrency / TPM / RPM / TPD) | Зависит от тарифа Moonshot. Tier0 free: 3/500K/20/1.5M. Tier2 после $10 пополнения: 100/3M/500/unlimited |

### Google AI (TTS)

| Лимит | Free tier | Pay-as-you-go |
|-------|-----------|---------------|
| RPM | 15 | 1000+ |
| RPD | 1500 | Unlimited |

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-04-30 | 3.101.0 | **TZ_FilesAPIMigration (Шаг 4 серии Simply_Migration):** chat-путь PDF/DOCX/XLSX/CSV/TXT/MD переведён на xAI Files API + Responses API. Новый модуль `lib/ai/files/` (xai-files-client + xai-responses). Все 7 Grok'ов получили `documentSupport.supported = true`. Cost tracking точный через `cost_in_usd_ticks` + `server_side_tool_usage_details.document_search_calls` (1-6 per-turn). Новая таблица `chat_attachment` (FK CASCADE), новая колонка `ai_usage_log.server_side_tool_calls jsonb`, ночной reaper cron `/api/cron/reap-attachments`. ADR 058 — запрет inline file content в Message_v2. |
| 2026-04-27 | 3.99.2 | **ТЗ-BR-AUTHOR-KIMI:** Briefing pipeline (`briefing:author`, `briefing:section`, `briefing:podcast-script`) переведён с MiniMax M2.7 на Kimi K2.6 через официальный `@ai-sdk/moonshotai@ai-v6`. Закрыт production silent hang после апгрейда `ai@6.0.168` (был связан с pinned `@ai-sdk/anthropic@3.0.6` внутри `vercel-minimax-ai-provider@0.0.2`). Удалены: пакет `vercel-minimax-ai-provider`, namespaces `minimax`/`minimaxLong`, две catalog entries `MiniMax-M2.7`/`MiniMax-M2.7-long`, ENV `MINIMAX_API_KEY`. Добавлены: namespace `moonshotai` с 180s fetch timeout, catalog entry `kimi-k2.6` с `defaultParams` (temperature 0.6, topP 0.95, thinking disabled), новый getter `getDefaultParamsForTask(taskId)` — параметры берутся из catalog (Блок 9 концепта), не hardcode в call-sites. |
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

**Обновлено:** 2026-04-30
