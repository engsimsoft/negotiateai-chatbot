# AI-провайдеры и модели

**Версия:** 3.3.0
**Последнее обновление:** 2026-04-06
**Статус:** 4 провайдера, 4 модели Anthropic + 4 модели Gemini + 2 модели Perplexity + 2 модели Voyage AI

---

## О документе

Этот документ — **единственный источник правды** для:
- AI-провайдеров (Anthropic, Google, Perplexity)
- Моделей и их характеристик
- **Реестра конфигураций** — какая модель где и с какими настройками
- Цен на токены
- API ключей и настроек

**Связанные документы:**
- [ai-chats-map.md](ai-chats-map.md) — карта чатов и UI
- [ai-agents.md](ai-agents.md) — агенты и промпты
- [ai-tools.md](ai-tools.md) — инструменты

**Ключевые файлы:**
- [lib/ai/providers.ts](../lib/ai/providers.ts) — конфигурация провайдеров
- [lib/ai/chat-mode-config.ts](../lib/ai/chat-mode-config.ts) — chatMode → модель
- [lib/ai/model-tiers.ts](../lib/ai/model-tiers.ts) — уровни моделей для проектов
- [lib/briefing/briefing-config.ts](../lib/briefing/briefing-config.ts) — модели для брифинга (фильтр Gemini + автор Claude)
- [lib/ai/retry-with-logging.ts](../lib/ai/retry-with-logging.ts) — retry wrapper с per-attempt usage logging (v3.69.0)

---

## Провайдеры

### Anthropic (основной — v3.23.0+)

| Параметр | Значение |
|----------|----------|
| SDK | `@ai-sdk/anthropic@3.0.58` (обёртка над `ai@6.0.116`) |
| API Key | `ANTHROPIC_API_KEY` |
| Документация | https://docs.anthropic.com/ |

> **SDK версии (v3.65.0+):** `ai@6.x` + `@ai-sdk/anthropic@3.x` + `@ai-sdk/google@3.x` + `@ai-sdk/react@3.x`. v6 предоставляет нативные `inputTokenDetails`/`outputTokenDetails` (включая `cacheWriteTokens`).

### Google AI (vision-ocr + Briefing фильтр + Podcast)

| Параметр | Значение |
|----------|----------|
| SDK (text) | `@ai-sdk/google` |
| SDK (TTS) | `@google/genai` |
| API Key | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Документация | https://ai.google.dev/ |

> Google AI используется для vision-ocr, Briefing фильтр (Stage 1), Podcast скрипт (Gemini Flash) и Podcast TTS (Gemini TTS). Все остальные AI-запросы — Anthropic.

### Perplexity (Deep Research)

| Параметр | Значение |
|----------|----------|
| SDK | REST API (fetch) |
| API Key | `PERPLEXITY_API_KEY` |
| Endpoint | `https://api.perplexity.ai/chat/completions` |
| Документация | https://docs.perplexity.ai/ |

> Perplexity используется для инструмента Deep Research (sonar-pro / sonar-deep-research). Доступен в режимах expertise, create и проектных чатах.

### Voyage AI (Embeddings + RAG)

| Параметр | Значение |
|----------|----------|
| SDK | REST API (fetch) — паттерн perplexity-client.ts |
| API Key | `VOYAGE_API_KEY` |
| Endpoint | `https://api.voyageai.com/v1/embeddings` |
| Документация | https://docs.voyageai.com/ |
| Клиент | `lib/ai/memory/voyage-client.ts` |

> Voyage AI — единый провайдер для embeddings и reranking. Рекомендован Anthropic. Используется для MIND (память из чатов) и Библиотеки (база знаний). Shared embedding space: voyage-4 (indexing) + voyage-4-lite (queries).

---

## Модели

### Anthropic Claude

| Модель | ID в проекте | Реальный ID | Input | Output | Контекст | Max Output |
|--------|--------------|-------------|-------|--------|----------|------------|
| **Claude Sonnet 4.6** | `claude-sonnet` | `claude-sonnet-4-6` | $3.00/1M | $15.00/1M | 200K (1M бета) | 64K |
| **Claude Haiku 4.5** | `claude-haiku` | `claude-haiku-4-5-20251001` | $1.00/1M | $5.00/1M | 200K | 64K |
| **Claude Opus 4.6** | `claude-opus` | `claude-opus-4-6` | $5.00/1M | $25.00/1M | 200K (1M бета) | 128K |

**Алиасы:**
- `title-model` → `claude-haiku-4-5-20251001`
- `artifact-model` → `claude-sonnet-4-6`

### Google Gemini

| Модель | Реальный ID | Использование | Конфиг |
|--------|-------------|---------------|--------|
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | Vision OCR (image, PDF) | `lib/ai/vision-ocr.ts` |
| **Gemini 2.0 Flash** | `gemini-2.0-flash` | Briefing: фильтр (Stage 1) | `lib/briefing/briefing-config.ts` |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | Podcast: генерация сценария | `lib/podcast/script-generator.ts` |
| **Gemini 2.5 Flash TTS** | `gemini-2.5-flash-preview-tts` | Podcast: озвучка (multi-speaker) | `lib/podcast/tts-gemini.ts` |

### Perplexity Sonar

| Модель | Реальный ID | Использование | Конфиг |
|--------|-------------|---------------|--------|
| **Sonar Pro** | `sonar-pro` | Deep Research: быстрый мультишаговый поиск (5-15 сек) | `lib/ai/tools/deep-research.ts` |
| **Sonar Deep Research** | `sonar-deep-research` | Deep Research: исчерпывающее исследование (30-120 сек) | `lib/ai/tools/deep-research.ts` |

### Voyage AI Embeddings

| Модель | Реальный ID | Цена / 1M tok | Размерность | Использование | Конфиг |
|--------|-------------|---------------|-------------|---------------|--------|
| **Voyage 4** | `voyage-4` | $0.06 | 1024 | Embedding фактов MIND (input_type: document) | `lib/ai/memory/voyage-client.ts` |
| **Voyage 4 Lite** | `voyage-4-lite` | $0.02 | 1024 | Embedding запросов (input_type: query, shared space) | `lib/ai/memory/voyage-client.ts` |

**Планируемые (RAG-4):**
- `voyage-context-3` ($0.18/1M) — contextualized chunk embeddings для документов
- `voyage-multimodal-3.5` ($0.12/1M text) — мультимодальные эмбеддинги (текст + изображения)
- `rerank-2.5` ($0.05/1M) — instruction-following reranker

---

## Реестр конфигураций (SSOT)

> **Назначение:** Единая таблица ВСЕХ точек использования моделей. При миграции на новую модель (напр. claude-sonnet-4-6) — пройди по таблице и обнови нужные строки.

### Anthropic Claude — Streaming чаты

| Функция | Файл | Модель | temperature | maxSteps | providerOptions | Примечание |
|---------|------|--------|-------------|----------|-----------------|------------|
| Чат (chatMode=chat) | `api/chat/route.ts` | `claude-haiku` | 1.0 | 5 | `cacheControl: ephemeral` ¹ | Via `getModelForChatMode()` |
| Экспертиза (chatMode=expertise) | `api/chat/route.ts` | `claude-sonnet` | 1.0 | 5 | `cacheControl: ephemeral` ¹ | Via `getModelForChatMode()` |
| Создание (chatMode=create) | `api/chat/route.ts` | `claude-sonnet` | 1.0 | 5 | `cacheControl: ephemeral` ¹ | Via `getModelForChatMode()` |
| Проект: Исполнитель | `api/chat/route.ts` | `claude-haiku` | 1.0 | 5 | `cacheControl: ephemeral` ¹ | Via `getProjectModel("executor")` |
| Проект: Эксперт | `api/chat/route.ts` | `claude-sonnet` | 1.0 | 5 | `cacheControl: ephemeral` ¹ | Via `getProjectModel("expert")` |
| Проект: Профессор | `api/chat/route.ts` | `claude-opus` | 1.0 | 5 | `cacheControl: ephemeral` ¹ | Via `getProjectModel("professor")` |
| Эксперт по задаче | `api/projects/[id]/tasks/[taskId]/chat/route.ts` | `claude-sonnet` (default) | 1.0 | 5 | `cacheControl: ephemeral` ¹ | Tier из ProjectTask, env: `EXPERT_MODEL` |
| Professor Pipeline: Анализ | `lib/ai/professor-pipeline.ts` | `claude-opus` | 1.0 | — | — | Phase 1 (streamText), без кэша ² |
| Professor Pipeline: Исполнение | `lib/ai/professor-pipeline.ts` | `claude-haiku` | 1.0 | — | — | Phase 2 (streamText), без кэша ² |
| Professor Pipeline: Синтез | `lib/ai/professor-pipeline.ts` | `claude-opus` | 1.0 | — | — | Phase 3 (streamText), без кэша ² |

> ¹ **cacheControl: ephemeral** (v3.60.0) — передаётся через `providerOptions` на system message (per-message, не top-level `streamText()`). 5-минутный TTL, cached read = 0.1× базовой цены.
> ² Professor Pipeline исключён: одноразовые вызовы с уникальными промптами — cache write без read = 25% перерасход на Opus.

### Anthropic Claude — Service чаты (streamText)

| Функция | Файл | Модель | temperature | providerOptions | Примечание |
|---------|------|--------|-------------|-----------------|------------|
| Бен (❓) | `api/service-chat/route.ts` | `claude-haiku` | 1.0 | `cacheControl: ephemeral` ¹ | context: ben |
| Секретарь (создание проекта) | `api/service-chat/route.ts` | `claude-sonnet` | 1.0 | `cacheControl: ephemeral` ¹ | context: project-creation |
| Менеджер проекта | `api/service-chat/route.ts` | `claude-haiku` | 0.5 | `cacheControl: ephemeral` ¹ | context: project-manager |
| **Briefing Онбординг** | `api/service-chat/route.ts` | **`claude-sonnet-4-6`** | 0.5 | `cacheControl: ephemeral` ¹ + `thinking adaptive, effort high` | context: briefing-onboarding |

### Anthropic Claude — Backend (generateText / generateObject)

| Функция | Файл | Модель | temperature | providerOptions | Примечание |
|---------|------|--------|-------------|-----------------|------------|
| Auto-naming чатов | `api/chat/route.ts` | `title-model` (haiku) | — | — | generateObject, Zod schema |
| Generate title | `api/chat/[id]/generate-title/route.ts` | `title-model` (haiku) | — | — | generateObject |
| Профессор планирования | `api/projects/[id]/plan/route.ts` | `claude-opus` | 0.2 | `thinking adaptive, effort high` | env: `PROFESSOR_MODEL` |
| Ревьюер задач | `lib/ai/professors/task-reviewer.ts` | `claude-opus` | 0.2 | `thinking adaptive, effort high` | env: `PROFESSOR_MODEL` |
| Суммаризатор задач | `lib/ai/clerks/task-summarizer.ts` | `claude-haiku` | 0.1 | — | env: `SUMMARIZER_MODEL` |
| Snapshot Creator | `lib/ai/clerks/snapshot-creator.ts` | `claude-haiku` | 0.1 | — | env: `SNAPSHOT_CLERK_MODEL` |
| Клерк-анализатор файлов | `api/projects/[id]/analyze-file/route.ts` | `claude-haiku` | 0.1 | — | Hardcoded |
| Project Summary | `api/projects/[id]/generate-summary/route.ts` | `claude-haiku` | — | — | Hardcoded |
| **Briefing: Автор** | `lib/briefing/briefing-author.ts` | **`claude-sonnet-4-6`** | — | — | generateObject, maxOutputTokens по volume, retryWithLogging (v3.69.0) |
| **Meeting: Суммаризатор** | `lib/meeting/meeting-pipeline.ts` | **`claude-sonnet-4-6`** | 0.3 | 8192 | generateText, 3 уровня (compact/standard/detailed) |
| **MIND: Извлечение фактов** | `lib/ai/memory/extract.ts` | **`claude-sonnet-4-6`** | 0.1 | — | generateObject, fire-and-forget в onFinish, chatMode: `memory:extract` |

### Voyage AI — Embeddings

| Функция | Файл | Модель | Цена / 1M tok | Примечание |
|---------|------|--------|---------------|------------|
| MIND: Embed фактов | `lib/ai/memory/extract.ts` | `voyage-4` | $0.06 | chatMode: `memory:embed`, costUsdOverride |
| MIND: Search запрос | `lib/ai/memory/retrieve.ts` | `voyage-4-lite` | $0.02 | chatMode: `memory:search`, costUsdOverride |

### Google Gemini — Backend

| Функция | Файл | Модель | providerOptions | maxOutputTokens | Примечание |
|---------|------|--------|-----------------|-----------------|------------|
| Briefing: Фильтр | `lib/briefing/briefing-filter.ts` | `gemini-2.0-flash` | — | — | generateObject |
| Vision OCR (Image) | `lib/ai/vision-ocr.ts` | `gemini-2.5-flash` | `thinkingBudget: 0` | — | Thinking выключен |
| Vision OCR (PDF) | `lib/ai/vision-ocr.ts` | `gemini-2.5-flash` | `thinkingBudget: 0` | — | Thinking выключен |
| **Podcast: Скрипт** | `lib/podcast/script-generator.ts` | `gemini-2.5-flash` | — | 2048 | `@ai-sdk/google` generateText |
| **Podcast: TTS** | `lib/podcast/tts-gemini.ts` | `gemini-2.5-flash-preview-tts` | — | — | `@google/genai` SDK, multi-speaker (Kore + Puck) |

### Env-переменные для override моделей

| Переменная | Default | Где используется |
|------------|---------|-----------------|
| `PROFESSOR_MODEL` | `claude-opus` | Планирование, ревью задач |
| `SUMMARIZER_MODEL` | `claude-haiku` | Суммаризатор задач |
| `SNAPSHOT_CLERK_MODEL` | `claude-haiku` | Snapshot Creator |
| `EXPERT_MODEL` | `claude-sonnet` | Эксперт по задаче |

---

## Миграция на новую модель (чеклист)

> При переходе на новую модель (напр. `claude-sonnet-4-5` → `claude-sonnet-4-6`):

**1. Обнови `lib/ai/providers.ts`:**
- Измени реальный ID в `customProvider.languageModels`
- Обнови прямые экспорты (`claudeSonnet`, etc.)

**2. Пройди Реестр конфигураций выше:**
- Найди все строки с целевой моделью
- Проверь, нужно ли добавить `providerOptions` (thinking/effort)
- Проверь совместимость `temperature` с новой моделью

**3. Если новая модель поддерживает thinking/effort:**
```typescript
// Пример: добавление thinking budget для Claude Sonnet 4.6
const result = await streamText({
  model: myProvider.languageModel('claude-sonnet-4-6'),
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 10000 },
    },
  },
});
```

**4. Обнови эту таблицу** — заполни колонку `providerOptions` для каждой точки использования.

**5. Обнови [ai-chats-map.md](ai-chats-map.md)** — модели в быстром обзоре.

---

## Использование в коде

### Через myProvider (рекомендуется)

```typescript
import { myProvider } from '@/lib/ai/providers';

const model = myProvider.languageModel('claude-sonnet');
```

| ID | Реальный ID | Назначение |
|----|-------------|------------|
| `claude-sonnet` | `claude-sonnet-4-6` | Основной чат, Секретарь, Эксперт, артефакты |
| `claude-haiku` | `claude-haiku-4-5-20251001` | Бен, Менеджер, Клерки, Исполнитель, заголовки |
| `claude-opus` | `claude-opus-4-6` | Профессоры (планирование, ревью) |
| `claude-sonnet-4-6` | `claude-sonnet-4-6` | Briefing: Онбординг, Автор статьи |
| `title-model` | `claude-haiku-4-5-20251001` | Генерация заголовков чатов |
| `artifact-model` | `claude-sonnet-4-6` | Генерация suggestions |

### Прямые экспорты (для pipelines и clerks)

```typescript
import { claudeHaiku, claudeSonnet, claudeOpus, getClaudeModel } from '@/lib/ai/providers';

const model = getClaudeModel('haiku');  // 'haiku' | 'sonnet' | 'opus'
```

### Pricing и Cost Calculation (v3.58.0)

```typescript
import { calculateCostRub, calculateTtsCostRub } from '@/lib/ai/providers';

// Стоимость AI-вызова (в рублях, курс 100 ₽/$)
const cost = calculateCostRub('claude-sonnet-4-6', { inputTokens: 1000, outputTokens: 500 });

// Стоимость TTS (Gemini, по секундам аудио)
const ttsCost = calculateTtsCostRub(30); // 30 секунд
```

`MODEL_PRICING_RUB` поддерживает: Claude (Haiku, Sonnet, Opus), Gemini (2.0 Flash, 2.5 Flash), Perplexity (Sonar Pro, Sonar Deep Research), Voyage AI (voyage-4, voyage-4-lite).

Non-token провайдеры (v3.66.0):
```typescript
import { calculateDeepgramCostUsd, calculateGeminiTtsCostUsd } from '@/lib/ai/providers';

// Deepgram Nova-3: $0.0043/min batch
const dgCost = calculateDeepgramCostUsd(audioSeconds);

// Gemini TTS: $4/1M chars
const ttsCost = calculateGeminiTtsCostUsd(script.length);
```
Передаются через `costUsdOverride` в `logUsage()` — обходят `calcCostUsd()` для non-token pricing.

Используется в Pipeline Observability (`lib/ai/pipeline-trace.ts`) для расчёта стоимости каждого этапа pipeline.

---

## Лимиты и квоты

### Anthropic

| Лимит | Значение |
|-------|----------|
| RPM (requests/min) | Зависит от тарифа |
| TPM (tokens/min) | Зависит от тарифа |
| Concurrent requests | По тарифу аккаунта |

### Google AI

| Лимит | Free tier | Pay-as-you-go |
|-------|-----------|---------------|
| RPM (requests/min) | 15 | 1000+ |
| TPM (tokens/min) | 1M | 4M+ |
| RPD (requests/day) | 1500 | Unlimited |

---

## Environment Variables

```bash
# Anthropic (обязательно — основной провайдер)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google AI (для vision-ocr + briefing фильтр + podcast)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key

# Perplexity (для Deep Research)
PERPLEXITY_API_KEY=your_perplexity_api_key

# Voyage AI (для embeddings + RAG)
VOYAGE_API_KEY=your_voyage_api_key
```

### Где получить ключи

| Провайдер | URL |
|-----------|-----|
| Anthropic | https://console.anthropic.com/settings/keys |
| Google AI | https://aistudio.google.com/apikey |
| Perplexity | https://www.perplexity.ai/settings/api |
| Voyage AI | https://dash.voyageai.com/ |

---

## Расчёт стоимости

| Модель | 1K input + 1K output | 10K input + 2K output |
|--------|---------------------|----------------------|
| Claude Haiku 4.5 | $0.006 | $0.020 |
| Claude Sonnet 4.6 | $0.018 | $0.060 |
| Claude Opus 4.6 | $0.030 | $0.100 |

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-04-06 | 3.3.0 | ТЗ-PIPELINE1: Removed AUTHOR_MODEL_FALLBACK (claude-sonnet-4-5-20250929), added retryWithLogging for briefing-author/section-author, artifact handlers now log usage |
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

**Обновлено:** 2026-04-06
