# Simply RAG — Фазы внедрения

**Создан:** 2026-04-06
**Статус:** Живой документ — обновляется после каждой фазы
**Основа:** [SIMPLY_RAG_UNIFIED_CONCEPT.md](SIMPLY_RAG_UNIFIED_CONCEPT.md)

---

## Обзор

| Фаза | Название | Версия | Статус | Зависимости |
|------|----------|--------|--------|-------------|
| **RAG-0** | Инфраструктура | 3.70.0 | ✅ Завершён | — |
| **RAG-1** | MIND Extract + Retrieve | 3.71.0 | ✅ Завершён | RAG-0 ✅ |
| **RAG-2** | MIND Consolidation + Profile + UI | 3.72.0 | ✅ Завершён | RAG-1 ✅ |
| **RAG-3** | Compaction (бесконечный чат) | 3.73.0 | ✅ Завершён | Независим |
| **RAG-4** | Библиотека MVP | 3.74.0 | ⬜ Не начат | RAG-0 (pgvector инфраструктура) |

```
RAG-0 (Инфраструктура)
  ├── RAG-1 (Extract + Retrieve) → RAG-2 (Consolidation + Profile + UI)
  ├── RAG-3 (Compaction) — независим, можно параллельно
  └── RAG-4 (Библиотека) — переиспользует pgvector + Voyage из RAG-0
```

---

## Модели Voyage AI — реестр

Единый провайдер на embeddings + reranking. Один API-ключ (`VOYAGE_API_KEY`).

### Активные (по фазам)

| Модель | Фаза | Endpoint | Цена / 1M tok | Контекст | Dim | Назначение |
|--------|------|----------|---------------|----------|-----|------------|
| **voyage-4** | RAG-0 | `/v1/embeddings` | $0.06 | 32K | 1024 | Embedding фактов MIND (input_type: document) |
| **voyage-4-lite** | RAG-0 | `/v1/embeddings` | $0.02 | 32K | 1024 | Embedding запросов (input_type: query). Shared space с voyage-4 |
| **voyage-context-3** | RAG-4 | `/v1/contextualizedembeddings` | $0.18 | 120K total / 32K per doc | 1024 | Embedding чанков документов (контекст всего документа на уровне модели) |
| **voyage-multimodal-3.5** | RAG-4 | `/v1/multimodalembeddings` | $0.12 text / $0.60 per 1B px | — | 1024 | Embedding изображений в единое пространство с текстом |
| **rerank-2.5** | RAG-4 | `/v1/rerank` | $0.05 | 8K query | — | Reranking результатов поиска (instruction-following) |

### Отложенные (RAG-4b+)

| Модель | Цена / 1M tok | Назначение |
|--------|---------------|------------|
| voyage-law-2 | $0.12 | Юридические документы |
| voyage-finance-2 | $0.12 | Финансовые документы |
| voyage-code-3 | $0.18 | Код (GitHub repos) |

### Pricing в RUB (для providers.ts, курс 100 ₽/$)

| Модель | ₽ за 1K tokens |
|--------|---------------|
| voyage-4 | 0.006 |
| voyage-4-lite | 0.002 |
| voyage-context-3 | 0.018 |
| voyage-multimodal-3.5 | 0.012 (text) |
| rerank-2.5 | 0.005 |

### Технические детали API

**`/v1/embeddings`** (voyage-4, voyage-4-lite):
- `input`: string | string[] (max 1000 items)
- `input_type`: null | "query" | "document"
- `output_dimension`: 256 | 512 | 1024 | 2048 (Matryoshka)
- Auth: `Authorization: Bearer $VOYAGE_API_KEY`

**`/v1/contextualizedembeddings`** (voyage-context-3):
- `inputs`: list of lists (документ = список чанков)
- Token limit: 120K total, 32K per inner list
- Отдельный endpoint — не совместим с `/v1/embeddings`

**`/v1/multimodalembeddings`** (voyage-multimodal-3.5):
- `inputs`: list с `content` (text + image_url/image_base64 + video)
- Изображения: min 50K px (upscale), max 16M px (downsample), max 20 MB
- Текст + изображения в едином пространстве

**`/v1/rerank`** (rerank-2.5):
- `query`: string (max 8K tokens)
- `documents`: string[] (max 1000)
- `top_k`: optional
- Поддерживает instruction-following

Free tier: 200M токенов на аккаунт (хватит на всю разработку + начальные тесты).

### Usage tracking — формат ответа Voyage API

Каждый ответ Voyage API возвращает `usage.total_tokens` — точное количество обработанных токенов:

```json
{
  "object": "list",
  "data": [{ "embedding": [...], "index": 0 }],
  "model": "voyage-4",
  "usage": { "total_tokens": 10 }
}
```

**Ключевое отличие от Anthropic:** нет разделения input/output. Только `total_tokens` — сколько токенов обработано. Output = вектор (не текст), не тарифицируется отдельно.

**Маппинг в `ai_usage_log`:**

| Поле ai_usage_log | Значение для Voyage |
|-------------------|---------------------|
| `modelId` | `"voyage-4"` / `"voyage-4-lite"` |
| `inputTokens` | `response.usage.total_tokens` |
| `outputTokens` | `0` (всегда) |
| `thinkingTokens` | `0` |
| `cacheReadTokens` | `0` |
| `cacheWriteTokens` | `0` |
| `costUsd` | `total_tokens × pricing / 1_000_000` |
| `chatMode` | `"memory:embed"` / `"memory:search"` / `"memory:extract"` |
| `durationMs` | Время вызова API |

**Расчёт costUsd:** `calcCostUsd()` подхватит через `MODEL_PRICING_RUB` (уже добав��ен в RAG-0). Не нужен `costUsdOverride` — в отличие от Deepgram/Gemini TTS, Voyage тарифицируется по токенам.

**Полный pricing (все модели, для `MODEL_PRICING_RUB` по мере подключения):**

```typescript
// $/1M tokens → ₽ per 1K tokens (× RUB_PER_USD / 1000)
"voyage-4":            { input: 0.006, output: 0, cached: 0, cacheWrite: 0 },  // $0.06/1M — RAG-0 ✅
"voyage-4-lite":       { input: 0.002, output: 0, cached: 0, cacheWrite: 0 },  // $0.02/1M — RAG-0 ✅
"voyage-4-large":      { input: 0.012, output: 0, cached: 0, cacheWrite: 0 },  // $0.12/1M — будущее
"voyage-context-3":    { input: 0.018, output: 0, cached: 0, cacheWrite: 0 },  // $0.18/1M — RAG-4
"voyage-code-3":       { input: 0.018, output: 0, cached: 0, cacheWrite: 0 },  // $0.18/1M — RAG-4d
"voyage-law-2":        { input: 0.012, output: 0, cached: 0, cacheWrite: 0 },  // $0.12/1M — RAG-4d
"voyage-finance-2":    { input: 0.012, output: 0, cached: 0, cacheWrite: 0 },  // $0.12/1M — RAG-4d
"rerank-2.5":          { input: 0.005, output: 0, cached: 0, cacheWrite: 0 },  // $0.05/1M — RAG-4
"rerank-2.5-lite":     { input: 0.002, output: 0, cached: 0, cacheWrite: 0 },  // $0.02/1M — RAG-4
```

**Внешняя сверка:** Voyage AI dashboard (dash.voyageai.com) показывает usage — можно сверять с нашим `ai_usage_log`.

---

## Обработка изображений — архитектурное решение

### Проблема
Пользователи Simply общаются мультимодально: текст + фото/скрины. Система должна запоминать контент изображений так же, как текст.

### Решение: два уровня

**Уровень 1 — MIND (RAG-1): через Claude Vision**
```
Пользователь отправляет скрин договора
       ↓
Claude Sonnet ВИДИТ изображение (vision нативно)
       ↓
Claude отвечает
       ↓
Fire-and-forget: Sonnet извлекает факты из ВСЕГО разговора
(Sonnet видел изображение → извлекает его содержимое как текст)
       ↓
Текстовые факты → voyage-4 embed → pgvector
```
Дополнительных моделей не нужно. Claude vision + voyage-4 для текстовых фактов.

**Уровень 2 — Библиотека (RAG-4): прямой embed изображений**
```
Пользователь загружает фото доски / слайды / диаграмму
       ↓
voyage-multimodal-3.5 embed (текст + изображение в одном пространстве)
       ↓
pgvector → поиск по визуальному сходству + текстовые запросы
```
Нужен для: фото досок, слайды, диаграммы, скрины UI — контент, который OCR теряет.

### Почему два уровня, а не один
- MIND работает с фактами из диалога — Claude уже видит картинку и извлекает смысл как текст. Дублировать embed изображения — лишние расходы без выигрыша в качестве.
- Библиотека работает с документами вне чата — пользователь загружает файлы напрямую. Здесь multimodal embed незаменим: поиск по визуальному содержимому, которое текстом не описать.

---

## RAG-0: Инфраструктура

**Версия:** 3.69.0 → 3.70.0
**ROADMAP:** [ROADMAP.md](ROADMAP.md)
**Статус:** ✅ Завершён (2026-04-06)

### Что создаёт
- pgvector extension в Neon PostgreSQL
- Таблица `memory_entry` с vector(1024) + HNSW-индекс
- Voyage AI клиент (raw fetch к `/v1/embeddings`: embed + batch)
- Query-функции: upsert, similarity search, delete
- Usage logging для Voyage API

### Результат для следующих фаз
- Инфраструктура БД (pgvector, HNSW) — переиспользуется в RAG-1, RAG-4
- Voyage клиент (`/v1/embeddings`) — переиспользуется в RAG-1, RAG-2
- Паттерн vector search — основа для RAG-1 (memory retrieval) и RAG-4 (document search)
- В RAG-4 клиент расширяется: `contextualizedembeddings`, `multimodalembeddings`, `rerank`

### Новые зависимости
- `VOYAGE_API_KEY` (добавлен)
- pgvector extension (Neon native, v0.8.0)

---

## RAG-1: MIND Extract + Retrieve

**Версия:** 3.70.0 → 3.71.0
**Зависимости:** RAG-0 ✅
**ROADMAP:** [RAG1_ROADMAP.md](RAG1_ROADMAP.md)

### Цель
AI запоминает факты из каждого разговора и использует их в будущих чатах. Работает с текстом И изображениями — Claude видит картинки нативно и извлекает их содержимое как текстовые факты.

### Scope

**Извлечение фактов (fire-and-forget):**
- После каждого ответа AI — Sonnet извлекает факты из пары user+assistant
- `waitUntil()` (Vercel) — не блокирует ответ пользователю
- Sonnet видит ВСЕ части сообщения: текст, изображения (vision), файлы
- Категоризация: fact, task, preference, calendar, person, decision
- Confidence score на каждом факте
- Дедупликация: cosine > 0.92 + category match → supersede старый факт

**Retrieval (при каждом запросе):**
- Embed вопрос пользователя через voyage-4-lite (input_type: "query")
- Similarity search по memory_entry (top-5-10)
- Фильтры: userId (обязательно), category (опционально)
- Инжекция релевантных фактов в system prompt
- Мягкая форма: "Из предыдущих разговоров известно..." (не категоричное утверждение)

**Промпт-инженерия:**
- Промпт для Sonnet-извлечения (`lib/prompts/memory/extract.md`)
- Формат извлечения: structured JSON (content, category, confidence)
- Промпт для инжекции фактов в system prompt
- Инструкция: если изображение содержит важную информацию — извлечь как текстовый факт

### Точка интеграции
- `app/(chat)/api/chat/route.ts` — основной чат: retrieve перед streamText, extract в waitUntil
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — project task chats (с sourceProjectId)
- Expertise и Create используют тот же `chat/route.ts` через chatMode

### Scope чатов
- chat, expertise, create — все пользовательские режимы
- project task chats — с пометкой sourceProjectId
- НЕ service chats (ben, briefing-onboarding) — служебные, не содержат фактов пользователя

### Cost tracking (обязательно при внедрении)

Правило проекта: каждый новый API учитывается с первого дня. Не "потом", не "когда будет биллинг".

**Voyage AI usage logging:**
- Каждый вызов `embedText()` / `embedTexts()` → `logUsage()` fire-and-forget
- Модель: `voyage-4` (embed фактов) или `voyage-4-lite` (embed запросов)
- chatMode конвенция: `memory:embed` (индексация), `memory:search` (retrieval)
- Voyage возвращает `total_tokens` (input only) → маппинг в `LanguageModelUsage`:
  ```typescript
  logUsage({
    userId,
    usage: { inputTokens: totalTokens, outputTokens: 0, totalTokens } as LanguageModelUsage,
    modelId: "voyage-4-lite",
    chatMode: "memory:search",
    durationMs,
  });
  ```
- Pricing уже в `MODEL_PRICING_RUB` → `calcCostUsd()` подхватит автоматически
- `waitUntil()` для background calls (extract) — не блокирует ответ

**Sonnet extract usage logging:**
- Sonnet-извлечение фактов — обычный `logUsage()` с `chatMode: "memory:extract"`
- Паттерн: как `util:auto-naming` в chat/route.ts — fire-and-forget после завершения

**Что появится в cost audit dashboard:**
- Новые chatMode: `memory:embed`, `memory:search`, `memory:extract`
- Фильтрация по периодам, breakdowns по модели — всё бесплатно из существующего UI

### Dev panel: RAG debug (обязательно при внедрении)

Новый debug event + секция в dev panel drawer.

**Новый event `data-debug-rag`:**
- Эмитится из chat/route.ts после retrieval, ДО streamText
- Содержит: query, найденные факты (content, similarity, category), Voyage tokens, search duration
- Паттерн: как `emitDebugPrompt()` — один раз в начале запроса

**Новая секция `RagSection` в dev panel drawer:**
- Количество найденных / инжектированных фактов
- Топ-факты с similarity bars (0.0–1.0)
- Voyage tokens + cost (в копейках)
- Search duration (ms)
- Если фактов 0 — показать "Нет релевантных воспоминаний"

**Файлы:**
- `lib/ai/debug-events.ts` — +`DebugRagData` тип, +`emitDebugRag()` функция
- `components/dev-panel/sections/rag-section.tsx` — новая секция
- `components/dev-panel/dev-panel-drawer.tsx` — +RagSection между Prompt и Raw
- `components/dev-panel/dev-panel-provider.tsx` — +парсинг `data-debug-rag` events

### Стоимость (оценка, на активного пользователя)
| Компонент | chatMode | Расчёт | В день |
|-----------|----------|--------|--------|
| Sonnet extract | `memory:extract` | ~20 сообщений × ~5₽ | ~100₽ |
| Voyage embed (факты) | `memory:embed` | ~40 фактов × 0.006₽ | ~0.24₽ |
| Voyage embed (запросы) | `memory:search` | ~20 запросов × 0.002₽ | ~0.04₽ |
| **Итого** | | | **~100₽/день** |

Основная стоимость — Claude Sonnet, не Voyage. Voyage — копейки. Но учитываем всё.

### Файлы (предварительно)
- `lib/ai/memory/extract.ts` — Sonnet-извлечение фактов (fire-and-forget, +logUsage)
- `lib/ai/memory/retrieve.ts` — semantic search + formatting для prompt (+logUsage)
- `lib/prompts/memory/extract.md` — промпт извлечения
- `app/(chat)/api/chat/route.ts` — интеграция: retrieve + extract + emitDebugRag
- `lib/ai/debug-events.ts` — +DebugRagData, +emitDebugRag()
- `components/dev-panel/sections/rag-section.tsx` — новая секция dev panel

---

## RAG-2: MIND Consolidation + Profile + UI

**Версия:** 3.71.0 → 3.72.0
**Зависимости:** RAG-1 завершён (есть факты в БД)
**ROADMAP:** Создать при старте фазы

### Цель
Периодическая ревизия фактов + ночной Opus-профиль + UI для прозрачности и контроля.

### Scope

**Консолидация (периодическая):**
- Каждые 5-10 сообщений — Sonnet ревизия: противоречия, устаревшее, дубли
- Merge похожих фактов, обновление confidence
- Supersede устаревших (цепочка supersededBy)

**Ночной Opus-профиль:**
- Cron в 3:00 MSK (до брифинга в 5:00)
- Opus получает все активные факты пользователя
- Генерирует нарративный профиль (800-1200 слов): кто, бизнес, люди, приоритеты, открытые вопросы
- Профиль — первый блок system prompt во всех чатах

**UI `/settings/memory`:**
- Страница "Что Simply знает о вас"
- Список фактов: категория, содержимое, дата, источник (ссылка на чат)
- Удаление отдельного факта (один клик)
- "Удалить всё" (полная очистка)
- Opus-профиль: read-only, дата последнего обновления
- Переключатель: вкл/выкл извлечение фактов (глобально)

### Два слоя контекста в каждом разговоре
1. **"Кто этот человек"** — Opus-профиль (~500 токенов)
2. **"Что релевантно сейчас"** — pgvector retrieval, top-5-10 фактов (~300 токенов)

### Стоимость (оценка, на активного пользователя)
| Компонент | Расчёт | В день |
|-----------|--------|--------|
| Sonnet консолидация | ~4 вызова × 5₽ | ~20₽ |
| Opus ночной профиль | 1 × 50₽ | 50₽ |
| **Итого** | | **~70₽/день** |

### Файлы (предварительно)
- `lib/ai/memory/consolidate.ts` — Sonnet-ревизия + Opus-профиль
- `lib/prompts/memory/consolidate.md` — промпт консолидации
- `lib/prompts/memory/profile.md` — промпт Opus-профиля
- `app/(dashboard)/settings/memory/page.tsx` — Server Component
- `components/settings/memory-page.tsx` — клиентский компонент
- `app/(chat)/api/user/memory/route.ts` — API (GET list, DELETE one, DELETE all)
- `app/api/cron/memory-profile/route.ts` — Ночной cron (3:00 MSK)

### Новая таблица (миграция)
```
user_profile_summary:
  id            uuid PK
  userId        uuid FK → User (UNIQUE)
  content       text (нарративный профиль)
  factCount     integer (сколько фактов использовано)
  generatedAt   timestamp
  modelId       varchar (claude-opus-4-6)
```

---

## RAG-3: Compaction (бесконечный чат)

**Версия:** 3.72.0 → 3.73.0 (или параллельно с RAG-1/2)
**Зависимости:** Независим от RAG-1/2, но требует проверки совместимости AI SDK v6
**ROADMAP:** Создать при старте фазы

### Цель
Бесконечный разговор без "начните новый чат". Anthropic Compaction API заменяет самодельную snapshot-систему.

### Scope

**Compaction API интеграция:**
- Beta header: `compact-2026-01-12`
- Trigger: кастомный порог токенов (вместо дефолтного)
- Instructions: что обязательно сохранять при сжатии (имена, даты, решения, контекст проекта)
- `pause_after_compaction`: пауза для инжекции MIND-контекста после сжатия
- Streaming поддержка
- Модели: Claude Opus 4.6, Sonnet 4.6

**Замена snapshot-системы:**
- Deprecate `snapshots: jsonb` в Chat таблице
- Убрать snapshot-creator clerk (`lib/ai/clerks/snapshot-creator.ts`)
- Убрать context-indicator component
- Упростить/удалить CONTEXT_BUDGET, SNAPSHOT_THRESHOLD из context-limits.ts
- Убрать snapshot-related UI (SnapshotCard, SnapshotDivider)

**Критический нюанс:**
- Compaction blocks в ответе нужно сохранять целиком — append `response.content`, не только текст
- Если извлечь только строку, compaction state потеряется
- Нужно проверить как Vercel AI SDK v6 обрабатывает compaction blocks при сохранении в БД

**Синергия с MIND:**
- Compaction сжимает — но может потерять детали
- MIND извлекает факты ДО сжатия — ничего не теряется
- `pause_after_compaction` — идеальная точка для инжекции MIND retrieval после сжатия

### Предварительная проверка (до старта)
- [ ] Vercel AI SDK v6 поддерживает beta-заголовки Anthropic?
- [ ] Vercel AI SDK v6 поддерживает `context_management` параметр?
- [ ] Как AI SDK v6 сохраняет compaction blocks в message parts?
- [ ] Или нужен прямой вызов @anthropic-ai/sdk?

### Файлы (предварительно)
- `app/(chat)/api/chat/route.ts` — замена snapshot-логики на Compaction
- `lib/ai/context-limits.ts` — упрощение/удаление
- `lib/ai/clerks/snapshot-creator.ts` — удаление
- `components/projects/snapshot-card.tsx` — удаление/адаптация
- `components/projects/context-indicator.tsx` — удаление/адаптация

---

## RAG-4: Библиотека MVP

**Версия:** 3.73.0 → 3.74.0
**Зависимости:** RAG-0 (pgvector + Voyage инфраструктура)
**ROADMAP:** Создать при старте фазы

### Цель
Пользователь загружает файлы и изображения — AI использует их при ответах со ссылкой на источник. Загрузил и забыл.

### Scope MVP

**Загрузка и обработка:**
- Drag & drop файлов: PDF, DOCX, TXT, MD, изображения (PNG, JPG, WEBP)
- PDF (цифровой): извлечение текста (pdf-parse — уже в проекте)
- DOCX: парсинг (mammoth — уже в проекте)
- TXT/MD: прямое чтение
- Изображения: voyage-multimodal-3.5 — прямой embed в единое пространство с текстом

**Chunking + Embedding (текстовые документы):**
- Recursive chunking: 400-500 токенов, 15% overlap
- Embedding: voyage-context-3 через `/v1/contextualizedembeddings` (контекст документа на уровне модели)
- Batch embed через Voyage API

**Embedding (изображения):**
- voyage-multimodal-3.5 через `/v1/multimodalembeddings`
- Текст + изображения → единое vector space (1024 dim)
- Поиск текстовым запросом находит релевантные изображения

**Поиск:**
- Hybrid search: vector (pgvector cosine) + keyword (tsvector для текстовых чанков)
- RRF merge (Reciprocal Rank Fusion)
- Reranking: Voyage rerank-2.5 с контекстной инструкцией
- Top 5-10 чанков/изображений → в контекст LLM

**Citations:**
- Каждый ответ на основе документа — с указанием источника
- PDF → документ + страница
- DOCX → документ + раздел
- Изображение → имя файла + превью

**UI:**
- Страница управления документами (`/library`)
- Загрузка файлов (drag & drop), статус обработки (pending → processing → completed)
- Превью изображений, удаление
- Scope: глобальный (все чаты) или per-project

### Новые таблицы (миграции)
```
knowledge_document:
  id, userId, projectId?, fileName, fileType, fileSize, blobUrl,
  status (pending|processing|completed|failed), metadata jsonb,
  createdAt, updatedAt

knowledge_chunk:
  id, documentId FK CASCADE, userId, content text?,
  embedding vector(1024), embeddingModel varchar,
  searchVector tsvector?, chunkIndex int,
  tokenCount int?, metadata jsonb, createdAt
```

Примечание: `content` и `searchVector` nullable — для изображений контента нет, только embedding.

### Voyage клиент — расширение из RAG-0
RAG-0 создаёт клиент для `/v1/embeddings`. В RAG-4 добавляем методы:
- `embedContextualizedChunks()` → `/v1/contextualizedembeddings` (voyage-context-3)
- `embedMultimodal()` → `/v1/multimodalembeddings` (voyage-multimodal-3.5)
- `rerankDocuments()` → `/v1/rerank` (rerank-2.5)

### Фоновая обработка
- Решение: Inngest vs Vercel Cron + p-limit (принять при старте RAG-4)
- Обработка большого PDF > 60 сек — нужна step function или chunked processing

### Стоимость (оценка, на 1000 пользователей)
| Компонент | Расчёт | В месяц |
|-----------|--------|---------|
| Voyage context-3 embed | 5K документов × 50 чанков × 500 tok | ~$8 |
| Voyage multimodal embed | 2K изображений × ~1M px | ~$1.20 |
| Voyage rerank | 100K запросов × ~500 tok | ~$3 |
| Voyage query embed | 100K запросов × 100 tok | ~$0.60 |
| **Итого Voyage** | | **~$13/мес** |

---

## Будущие фазы (после RAG-4)

Не планируются детально. Общее направление из концепта:

| Фаза | Название | Что добавляет |
|------|----------|---------------|
| RAG-4b | Библиотека расширенная | Сайты, YouTube, аудио/видео (Supadata, ElevenLabs Scribe) |
| RAG-4c | Библиотека интеграции | Telegram-канал, Google Drive, Notion, GitHub |
| RAG-4d | Доменные модели | voyage-law-2, voyage-finance-2, voyage-code-3, авто-роутинг |
| MIND-2 | Граф знаний | Сущности, связи, дерево тем, календарь идей |
| MIND-2.5 | Контекстный поиск | Замена Google — исследование с контекстом пользователя |
| MIND-3 | Проактивность | AI пишет первым, anticipation engine |

---

## Как использовать этот документ

1. **Перед началом новой фазы** — прочитать scope фазы здесь
2. **При старте фазы** — создать отдельный ROADMAP.md по шаблону из [ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md)
3. **После завершения фазы** — обновить статус здесь (⬜ → ✅), записать что изменилось
4. **Между фазами** — этот документ = навигатор: что дальше, какие зависимости, что переиспользуется

---

**Обновлено:** 2026-04-06 — добавлен реестр моделей Voyage AI с ценами и API, архитектурное решение по обработке изображений (два уровня: MIND через Claude Vision, Библиотека через voyage-multimodal-3.5), уточнены стоимости и файлы
