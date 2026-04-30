# Архитектура Simply

Описание архитектуры платформы AI-агентов Simply. **Пофайловая карта, куда CLAUDE.md перенаправляет за «где лежит код».**

## Оглавление

1. [⛔ UI — закон](#-ui--закон) — указатель на design-system.md (SSOT для компонентов)
2. [Общая схема](#общая-схема) — ASCII-диаграмма трёх слоёв
3. [Слои приложения](#слои-приложения) — Presentation / Auth / AI / Data
4. [Карта фич (пофайлово)](#карта-фич-пофайлово) — маршрут → папки для каждой фичи
5. [Streaming Pipeline & Observability](#streaming-pipeline--observability) — stream, Guardian, DevPanel, Switchboard, cron
6. [Security](#security)
7. [Почему такая архитектура](#почему-такая-архитектура)
8. [Связанные документы](#связанные-документы)

**SSOT-файлы для быстрого перехода (не дублируются здесь):**
- UI компоненты и закон → [docs/design-system.md](design-system.md) ⭐
- AI Tools детали → [docs/ai-tools.md](ai-tools.md)
- AI-агенты и промпты → [docs/ai-agents.md](ai-agents.md)
- Артефакты → [docs/ai-artifacts.md](ai-artifacts.md)
- Карта моделей по taskId → [docs/ai-chats-map.md](ai-chats-map.md) ⭐
- Провайдеры, цены → [docs/ai-providers.md](ai-providers.md)
- Модели и маршрутизация (код) → [lib/ai/task-assignments.ts](../lib/ai/task-assignments.ts) + [lib/ai/model-catalog.ts](../lib/ai/model-catalog.ts)
- Схема БД → [lib/db/schema.ts](../lib/db/schema.ts)

---

## ⛔ UI — закон

> 🚨 **ПЕРЕД ЛЮБОЙ UI-РАБОТОЙ:** прочитать **[docs/design-system.md](design-system.md)**. Это единственный источник правды для цветов, шрифтов, layout-ов и **полного списка существующих компонентов**.

**Ключевое правило:** **НЕ изобретать новые компоненты.** Они уже созданы — **SSOT = [design-system.md раздел 13](design-system.md#13-используемые-компоненты-ssot)**:

- **13.1** — 25 shadcn/ui примитивов (`components/ui/`)
- **13.2** — 17 AI-chat элементов (`components/elements/`)
- **13.3** — кросс-фичевые (`components/shared/`)
- **13.4** — фичевые папки (`components/<feature>/`)
- **13.5** — top-level компоненты чата

Протокол при новом UI (1. `ls` → 2. импорт существующего → 3. проп/вариант → 4. крайне редко новый файл) — тоже в [design-system.md раздел 13](design-system.md#13-используемые-компоненты-ssot).

**architecture.md намеренно НЕ дублирует** список компонентов — он меняется, и единственное место его держать — design-system.md. Правило из [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md): SSOT = один источник, остальные ссылаются.

---

## Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Browser)                           │
│                  Пользователи платформы                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Application (Vercel)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App Router (app/)                                   │  │
│  │  ├── (auth)/           - Auth pages (NextAuth)       │  │
│  │  ├── (chat)/           - Simply Chat + projects + api│  │
│  │  ├── (dashboard)/      - Dashboard, Briefing, Meeting│  │
│  │  │                       Groups, Projects, Settings  │  │
│  │  │                       + expertise/create landings │  │
│  │  ├── (expertise)/      - Expertise chat view [/id]   │  │
│  │  ├── (create)/         - Creation chat view [/id]    │  │
│  │  ├── (task)/           - Project task chat view      │  │
│  │  └── api/              - Cron, admin, telegram, dev  │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic (lib/)                               │  │
│  │  ├── ai/getModel.ts       - SSOT getModel(taskId)      │  │
│  │  ├── ai/task-assignments.ts - taskId → catalog id      │  │
│  │  ├── ai/model-catalog.ts  - Pricing/capabilities SSOT  │  │
│  │  ├── ai/registry.ts       - createProviderRegistry     │  │
│  │  ├── ai/providers.ts      - Pure cost/pricing utilities│  │
│  │  ├── ai/pipeline-trace.ts - Pipeline trace              │  │
│  │  ├── ai/retry-with-logging.ts - Retry wrapper (per-attempt) │
│  │  ├── ai/tools/            - AI-инструменты              │  │
│  │  ├── briefing/            - Briefing pipeline + research engine │
│  │  ├── podcast/             - Podcast Engine              │  │
│  │  ├── meeting/             - Meeting recorder pipeline   │  │
│  │  ├── prompts/             - Skills + Agents system      │  │
│  │  ├── telegram/            - Telegram bot + groups       │  │
│  │  ├── db/queries.ts        - Database queries (Neon HTTP)│  │
│  │  └── db/schema.ts         - Database schema             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ External Services
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  ├── xAI Grok          - Simply Chat + Expertise + Create  │
│  │                       + MIND + Collections RAG (Библиотека ✅) │
│  ├── Anthropic Claude  - vision, artifacts, professor, clerks │
│  ├── Moonshot AI       - briefing pipeline (Kimi K2.6)     │
│  ├── Google Gemini     - reserved (TTS / fallback)         │
│  ├── Brave Search API  - Web search                        │
│  ├── Deepgram          - Voice input (Nova-3)              │
│  ├── CloudConvert API  - PPTX preview                      │
│  └── PostgreSQL (Neon) - Database                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Слои приложения

### 1. Presentation Layer (UI)

**Папки:** `app/`, `components/`

Отвечает за:
- Интерфейс чата
- Streaming ответов в реальном времени
- Рендеринг Markdown
- UI артефактов (text, презентации)
- Auth UI

**Технологии:**
- Next.js 15.3 (App Router, RSC)
- React 18, TypeScript
- Tailwind CSS
- Vercel AI SDK UI

---

### 2. Authentication Layer

**Файлы:** `app/(auth)/`, `middleware.ts`

Отвечает за:
- Авторизацию (NextAuth 5.0)
- Управление сессиями
- Защиту routes

**Текущее состояние:**
- Регистрация через email/password
- Профиль пользователя (displayName, bio, occupation)
- NextAuth 5.0-beta.25

---

### 3. AI Layer

**Папка:** `lib/ai/`

#### Core Registry

Все 39 AI-точек приложения получают модель через единую функцию `getModel(taskId)`.

- **`getModel.ts`** — публичный API (`getModel`, `getModelIdForTask`, `getProviderForTask`, `taskSupportsThinking`, `getMaxOutputTokensForTask`). Порядок резолва модели: test mocks → dev overrides → task-assignments → catalog → registry. `getMaxOutputTokensForTask(taskId)` применяет двухслойную safety-net: `Math.min(requested, modelCapability)` + `warnOnce` при `provider === "anthropic" && effective > 21333` (см. ADR 053).
- **`task-assignments.ts`** — SSOT маппинга `TaskId → catalogId` (`DEFAULT_TASK_MODELS`) + **SSOT лимитов output** (`DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` — compile-time check через TS). Изменение default-модели или output cap для задачи = одна строка.
- **`model-catalog.ts`** — SSOT физических моделей: pricing (USD/1M), capabilities (vision/tools/thinking), contextWindow, алиасы.
- **`registry.ts`** — `createProviderRegistry` (AI SDK v6) с 4 namespace: `anthropic`, `moonshotai` (180s fetch timeout для briefing), `xai`, `openrouter`.
- **`providers.ts`** — остался как **чистый pricing/cost utility module**: `calculateCostRub`, `calculateCostBreakdownRub`, `extractUsageForPricing`, `getContextWindow`, non-LLM cost helpers (Deepgram, Gemini TTS). Больше не содержит model resolution logic.

**Детали и обоснование:** [ADR 047](decisions/047-core-model-registry.md), [ai-providers.md](ai-providers.md).

#### AI SDK version
- `ai@6.x` + `@ai-sdk/anthropic@3.x` + `@ai-sdk/google@3.x` + `@ai-sdk/xai@3.x` + `@ai-sdk/react@3.x`
- `@ai-sdk/moonshotai@2.0.11` (dist-tag `ai-v6`, официальный Vercel пакет для Moonshot AI / Kimi K2.6)
- `@openrouter/ai-sdk-provider` (GLM, Qwen — зарезервировано)

#### Prompt System

`lib/prompts/` — файловая система промптов (skills / agents / service-chats / professors / experts / clerks / briefing / core). Структура и детали — в [Карте фич → Prompt System](#prompt-system--skills--agents) ниже, полная документация → [ai-agents.md](ai-agents.md).

С v3.99.3 (ТЗ-MigrateArtifactPromptsToSkills) добавлена категория `lib/prompts/skills/artifact-generation/<kind>/` — system-промпты артефактов (text/markdown/excel/pptx/reveal) в формате Anthropic Agent Skills с loader-ом (`loader.ts`) и плейсхолдер-substitution через существующий `render()` из [lib/prompts/template.ts](../lib/prompts/template.ts). Подробности → [ai-artifacts.md § System-промпты артефактов](ai-artifacts.md#system-промпты-артефактов).

#### `lib/ai/tools/` — AI-инструменты

17 файлов в `lib/ai/tools/`, сгруппированы по пяти категориям: registration/infrastructure, web/research, artifacts/documents, context/files, utility.

#### `lib/ai/routing.ts` — capability-driven attachment routing (ТЗ-ExpertiseCreateVisionRouting, v3.98.0; расширено в TZ_FilesAPIMigration v3.101.0)

Чистый модуль без I/O. Две экспортируемые функции: `resolveActiveTaskId(ctx)` — единая SSOT-точка резолва активного taskId для запроса; `needsVisionFallback(parts, defaultTaskId)` — capability-check через `getModelEntry(getModelIdForTask(taskId))?.capabilities` из SSOT каталога. Алгоритм: резолв default taskId → если есть **не-image file part** (PDF/DOCX/XLSX/CSV/TXT/MD) → `chat-vision` (universal attachment routing slot, Шаг 4); если есть image и default не vision-capable → `chat-vision`; иначе → default. Ортогонален `/dev/models` override (Vladimir переключает файловый путь одним кликом). См. [ADR 055](decisions/055-capability-driven-attachment-routing.md).

#### `lib/ai/files/` — xAI Files API + Responses API (TZ_FilesAPIMigration, v3.101.0)

Два модуля для работы с xAI Files API в чат-пути:
- **`xai-files-client.ts`** — raw fetch обёртки над `/v1/files`: `xaiUploadFile` (multipart), `xaiDeleteFile`, `xaiGetFileMetadata`, `xaiListFiles` (для reaper). Retry на 5xx, typed `XaiFilesApiError`.
- **`xai-responses.ts`** — стрим `/v1/responses` с `input_file` parts. Парсит SSE chunks, адаптирует к UIMessage stream. На финальном chunk извлекает `usage.cost_in_usd_ticks` (точный USD per-turn) и `usage.server_side_tool_usage_details.document_search_calls` (1-6 calls per-turn — variable agentic depth) → запись в `ai_usage_log.costUsd` + `serverSideToolCalls jsonb`.

Развилка в [chat/route.ts](../app/(chat)/api/chat/route.ts): если message содержит file part с `xaiFileId` → Responses API path. Иначе обычный `streamText`. DOCX/XLSX/CSV конвертируются в text/plain до upload (`mammoth`, `xlsx`). PDF/MD/TXT уходят в xAI напрямую. Запись в `chat_attachment` транзакционно с save Message_v2. Cleanup при удалении чата — `cleanupAttachmentExternals` в [lib/db/queries.ts](../lib/db/queries.ts) (cascade DB delete + `Promise.allSettled` для xAI + Blob). Ночной reaper `/api/cron/reap-attachments` подчищает orphans старше 24ч. **SPEC и история:** archived в `specs/Simply_Migration/_archive/TZ_FilesAPIMigration/`. **ADR 058** — запрет inline file content в `Message_v2.parts` (рецидив 4+ раза, SSOT для будущих симптомов «портянки/билинг-спайк»).

#### `lib/ai/compaction/` — Simply Compaction middleware (ТЗ-COMPACTION-1, v3.94.0)

6 файлов: `types.ts` (CompactionContext / CompactionEvent / PrepareMessagesResult), `prompt.ts` (системный промпт + rolling-update паттерн), `summarize.ts` (`generateCompactionSummary` через Grok 4.1 Fast non-reasoning + Zod 5-секционная схема), `db-queries.ts` (get/saveCompactionState с собственным Neon HTTP клиентом), `prepare-messages.ts` (основная middleware с verbatim window и edge cases), `events.ts` (`emitCompactionEvent` для user-visible виджета). Capability-driven резолв через `getCompactionStrategy(modelId)` в [model-catalog.ts](../lib/ai/model-catalog.ts). Активна в `expertise` / `create` через gate в [chat/route.ts:1060](../app/(chat)/api/chat/route.ts#L1060). **Детали:** [ADR 053 § 5. context strategy](decisions/053-aisdk-invocation-contract.md), [SIMPLY_COMPACTION_ARCHITECTURE.md](../specs/_archive/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md).

**SSOT = [ai-tools.md](ai-tools.md)** — полный список каждого tool-а с API, примерами использования, форматами, лимитами. При добавлении нового tool обновлять **там**, не здесь.

---

### 4. Data Layer

**PostgreSQL (Neon) + Drizzle ORM**

**Схема:** [lib/db/schema.ts](../lib/db/schema.ts) — **SSOT, всегда сверять здесь**. Список ниже = актуальный снимок; если в диффе новая `pgTable` — добавить сюда в том же коммите.

#### Users / Auth
- `User` — пользователи (displayName, pronouns, occupation, bio, theme, hasSeenBenIntro, lastSeenSimplyVersion)
- NextAuth таблицы (`Account`, `Session`, `VerificationToken`)

#### Chats / Messages / Artifacts
- `Chat` — чаты (title, summary, isStarred, projectId, chatMode)
- `Message_v2` — сообщения (актуальная таблица). **Запрещено хранить inline file content в `parts`** — только file part с `url`/`xaiFileId`/`mediaType`/`name`. См. [ADR 058](decisions/058-no-inline-file-content-in-message-history.md)
- `Message` — deprecated (оставлена для миграции, не писать)
- `chat_attachment` — пара (xaiFileId, blobUrl, filename, mimeType, sizeBytes) на каждое вложение в чате. FK CASCADE на `Chat`/`Message_v2`. Индексы: `chat_id`, `xai_file_id`. Создаётся транзакционно с Message_v2, удаление каскадно через `cleanupAttachmentExternals` (xAI files + Vercel Blob) (TZ_FilesAPIMigration, v3.101.0)
- `Vote_v2` — голосование за сообщения
- `Vote` — deprecated
- `Document` — артефакты (text, markdown, excel, reveal, pptx)
- `Suggestion` — AI-suggestions к артефактам (dormant: инструмент `requestSuggestions` удалён 2026-04-17 после SQL audit 0 вызовов за всю историю, таблица и `lib/editor/suggestions.tsx` плагин остались на случай возврата фичи)
- `Stream` — streaming state (resumable streams)

#### Projects
- `Project` — проекты (изолированные рабочие пространства)
- `ProjectFolder` — иерархические папки внутри проекта
- `ProjectFile` — файлы проектов (v2 storage, Blob + metadata)
- `ProjectTask` — задачи проекта (enum `project_task_status`)

#### Briefing
- `BriefingSettings` — настройки брифинга (timezone, language, maxItems, deliveryEnabled, format)
- `BriefingSources` — источники новостей (topicId, sourceUrl, fetchMethod, tier)
- `BriefingTopics` — каталог тем (topicId, name, emoji, isDefault)
- `BriefingHistory` — история генераций (briefingJson, stats, deliveryStatus)
- `SavedBriefingTopics` — сохранённые темы брифинга (content, sources, briefingGeneratedAt)

#### MIND Memory / RAG
- `MemoryEntry` — извлечённые факты (userId, content, embedding, metadata, source chatId/messageId, consolidatedAt)
- `MemorySettings` — пользовательские настройки MIND (enabled, extractionMode, retention)
- `UserProfileSummary` — nightly narrative profile (userId PK, summary text, updatedAt)

#### Telegram
- `TelegramConnection` — связка Simply ↔ Telegram (userId unique, telegramUserId bigint unique, isActive)
- `TelegramLinkToken` — эфемерные токены линковки (token PK, userId FK, expiresAt = +10 min)
- `TelegramGroup` — группы Telegram (telegramChatId unique, title, type, isForum, ownerUserId FK, isActive)
- `TelegramGroupTopic` — топики форумов (groupId FK, telegramTopicId, name, unique по groupId+telegramTopicId)
- `TelegramMessage` — сообщения из групп (groupId FK, topicId FK, fromUserId, text, hasMedia, mediaType, sentAt; индексы: group+sentAt, group+topic+sentAt)

#### Meeting
- `MeetingRecord` — записи встреч (userId FK, title, durationSeconds, speakerCount, summaryLevel, transcript, summary, metadata JSONB, createdAt)

#### Observability / Ops
- `ai_usage_log` — учёт потребления AI (modelId, tokens, costUsd, chatMode, guardianFlags JSONB, **serverSideToolCalls JSONB** — per-turn xAI server-side tool counters: `{document_search_calls: N, …}` из `response.usage.server_side_tool_usage_details`, добавлено в TZ_FilesAPIMigration v3.101.0)
- `CronRunLog` — forensics каждого cron run (cronName, startedAt, finishedAt, usersProcessed, usersSkipped, usersFailed, results JSONB, durationMs)

**Vercel Blob Storage:**
- Загруженные файлы
- Attachments

---

## Карта фич (пофайлово)

> Для каждой крупной фичи — где её `app/` route, `lib/` pipeline, `components/` UI, БД-таблицы и тематический doc. **Первое место для поиска «где лежит код».** UI всегда переиспользует компоненты из `components/ui/` + `components/elements/` — см. [⛔ UI — закон](#-ui--закон-и-существующие-компоненты).

### Simply Chat (persistent)
- **Route:** `app/(chat)/simply/`, `app/(chat)/api/chat/route.ts` (streaming endpoint), `app/(chat)/api/files/upload/route.ts` (file upload + xAI Files API), `app/api/cron/reap-attachments/route.ts` (orphan reaper)
- **Models:** `simply-chat` / `simply-chat-think` + universal attachment routing slot `chat-vision` (Grok 4.1 Fast non-reasoning) для любого file part — через [lib/ai/task-assignments.ts](../lib/ai/task-assignments.ts) + [lib/ai/routing.ts](../lib/ai/routing.ts)
- **Files pipeline (v3.101.0):** [lib/ai/files/](../lib/ai/files/) — Files API client + Responses API stream, развилка в chat/route.ts на наличие `xaiFileId` в parts. Cleanup в [lib/db/queries.ts](../lib/db/queries.ts) (`cleanupAttachmentExternals`)
- **UI:** top-level `components/chat.tsx` + `components/messages.tsx` + `components/input/`
- **БД:** `Chat` (chatMode='simply'), `Message_v2`, `chat_attachment` (per-attachment xaiFileId + blobUrl)
- **Особенность:** ОДИН вечный чат на userId (нет операции «новый Simply чат»)

### Expertise (одноразовые экспертные запросы)
- **Route:** `app/(dashboard)/expertise/page.tsx` (landing) + `app/(expertise)/expertise/[id]/` (chat view)
- **Model:** `expertise` → Grok 4.20 reasoning (+ capability-driven fallback на `chat-vision` → Haiku для PDF-сканов, ADR 055)
- **UI:** переиспользует `components/chat.tsx`
- **БД:** `Chat` (chatMode='expertise')

### Create (одноразовые creation-чаты)
- **Route:** `app/(dashboard)/create/page.tsx` (landing) + `app/(create)/create/[id]/`
- **Model:** `create` → Grok 4.20 reasoning (+ capability-driven fallback на `chat-vision` → Haiku для PDF-сканов, ADR 055)
- **UI:** переиспользует `components/chat.tsx`
- **БД:** `Chat` (chatMode='create')

### Projects
- **Route:** `app/(dashboard)/projects/` (list, create, detail) + `app/(chat)/projects/` (project chat) + `app/(task)/projects/` (task-level chat)
- **Pipeline:** `lib/ai/professor-pipeline.ts` (planning, review, synthesize), `lib/ai/professors/`, `lib/ai/clerks/`
- **Tools:** `read-project-file.ts`, `create-document.ts`
- **UI:** `components/projects/`, `components/file-viewer/`
- **БД:** `Project`, `ProjectFolder`, `ProjectFile`, `ProjectTask` (enum `project_task_status`)
- **Models:** `project:expert:haiku|sonnet|opus` (tier), `professor:*`, `clerk:*`

### Briefing
- **Route:** `app/(dashboard)/briefing/`, `app/api/cron/briefing/` (Vercel Cron)
- **Pipeline:** `lib/briefing/` (fetch sources → filter → author → sections)
- **UI:** `components/briefing/` (settings, history, topic picker)
- **БД:** `BriefingSettings`, `BriefingSources`, `BriefingTopics`, `BriefingHistory`, `SavedBriefingTopics`
- **Models:** `briefing:filter` (Grok 4.1 Fast), `briefing:author|section|podcast-script` (Kimi K2.6, Instant mode)
- **Детали:** [ADR 026](decisions/026-background-briefing-architecture.md)

### Podcast
- **Pipeline:** `lib/podcast/` (script → TTS → blob storage)
- **UI:** `components/briefing/podcast-*.tsx`
- **Запуск:** как продолжение Briefing (`waitUntil(runPodcastPipeline)`, non-blocking)

### Meeting Recorder
- **Route:** `app/(dashboard)/meeting/`
- **Pipeline:** `lib/meeting/` (Deepgram Nova-3 STT → summary)
- **UI:** `components/meeting/`
- **БД:** `MeetingRecord`
- **Model:** `meeting:summary` → Claude Sonnet

### Telegram Bot
- **Route:** `app/api/telegram/` (webhook, commands)
- **Pipeline:** `lib/telegram/` (bot, groups, messages ingestion)
- **UI:** `components/groups/` (UI для Telegram groups)
- **БД:** `TelegramConnection`, `TelegramLinkToken`, `TelegramGroup`, `TelegramGroupTopic`, `TelegramMessage`

### База знаний (Слой 3 RAG) — MIND + Библиотека

Два независимых хранилища, разные tool: `librarySearch` для явно загруженных документов, MIND retrieve через системный промпт для авто-извлечённых фактов из разговоров.

#### MIND (Voyage AI + pgvector) — ✅ работает

Автоматическое извлечение фактов из разговоров. Пользователь говорит — Simply запоминает. Embeddings для semantic retrieval.

- **Pipeline:** `lib/ai/memory/` (extract, retrieve, consolidate, profile, voyage-client)
- **БД:** `MemoryEntry` (vector embeddings), `MemorySettings`, `UserProfileSummary`
- **Models:** `memory:extract` (Grok 4.20), `memory:extract-batch|consolidate|profile|dedup-verify` (Grok 4.1 Fast)
- **External:** Voyage AI для embeddings
- **Архитектура:** [specs/Simply_xAI/MIND_ARCHITECTURE.md](../specs/Simply_xAI/MIND_ARCHITECTURE.md)

#### Библиотека (xAI Collections) — ✅ работает (v3.99.0, ТЗ-XAI-COL-1)

Явная загрузка документов пользователем в Библиотеку. xAI индексирует, хранит, ищет фрагменты «из коробки» — **никакой собственной векторной инфраструктуры не строим**.

- **Pipeline:** `lib/ai/library/` (xai-collections, db, auto-analyze, summary-generator, citations-parser, types)
- **Tool:** `lib/ai/tools/library-search.ts` — подключён в Simply / Экспертиза / Создание / project chats
- **Routes:** `app/(chat)/api/library/` (collections CRUD, documents CRUD, content proxy, status polling)
- **UI:** `app/(dashboard)/library/` (страница `/library` + split-view `/library/[docId]`), `components/library/` (12 компонентов: page, grid, dialogs, source-picker-modal, library-sources-badge, document-split-view), карточка на главной `components/glavnaya/library-card.tsx`
- **БД:** `library_collection`, `library_document`, `library_collection_document` (миграции 0059–0063)
- **Models:** `library:auto-analyze` (автотип/теги/описание при upload), `library:generate-summary` (развёрнутый автообзор после indexing), `library-document-chat` (split-view мини-чат). Все на Grok 4.1 Fast non-reasoning
- **chatMode:** `library-document` (изолированный мини-чат, MIND off, tool set = только `librarySearch` с `lockedFileId`)
- **Архитектура:** [SIMPLY_LIBRARY_ARCHITECTURE.md](../specs/_archive/Simply_xAI/TZ_xai_col_1/SIMPLY_LIBRARY_ARCHITECTURE.md)
- **ADR:** [056-library-upload-collections-endpoint.md](decisions/056-library-upload-collections-endpoint.md) (почему management-api/v1/collections/{id}/documents вместо /v1/files)
- **Принцип:** для персональной памяти (разговоры) → Voyage + pgvector. Для документов-знаний → xAI Collections из коробки, не изобретаем.

### Service Chats (Ben, project-creation, project-manager, briefing-onboarding)
- **Route:** `app/(chat)/api/service-chat/route.ts` + `app/(chat)/api/ben/route.ts`
- **Pipeline:** `lib/prompts/agents/` (Ben), `lib/prompts/service-chats/`
- **UI:** `components/service-chat/`
- **Models:** `service-chat:ben|project-creation|project-manager|briefing-onboarding` (Claude Haiku/Sonnet)

### Artifacts
- **Pipeline:** `artifacts/` (корневая папка + handlers: text, markdown, excel, presentation-reveal, presentation-pptx)
- **Tools:** `create-document.ts`, `update-document.ts`
- **UI:** top-level `components/artifact.tsx`, `components/artifact-*.tsx`, `components/create-artifact.tsx`
- **БД:** `Document`, `Suggestion`, `Stream`
- **Модели:** `artifact:text|markdown|excel|pptx|reveal` → Claude Sonnet
- **Детали:** [ai-artifacts.md](ai-artifacts.md)

### Dev Switchboard
- **Route:** `app/(dashboard)/dev/models/`, `app/api/dev/`
- **Pipeline:** `lib/ai/model-overrides.ts` + `lib/ai/model-overrides-node.ts` (server-only fs)
- **UI:** `components/dev-panel/`
- **Gate:** `NEXT_PUBLIC_SIMPLY_DEV_MODE` + triple dev-gate
- **Детали:** [ADR 048](decisions/048-dev-switchboard-ui.md), [model-catalog-ops.md](model-catalog-ops.md)

### Prompt System — Skills + Agents

```
lib/prompts/
├── server.ts         - Server-only экспорты
├── index.ts          - Client-safe экспорты
├── builder/          - Система сборки промптов
├── skills/           - Атомарные навыки (SKILL.md, на запрос через load-skill tool)
├── agents/           - Персонажи-агенты (AGENT.md + config.yaml)
│   └── ben/
├── service-chats/    - Промпты сервисных чатов
├── professors/       - Промпты профессорского pipeline
├── experts/          - Промпты экспертов
├── clerks/           - Промпты клерков
├── briefing/         - Промпты briefing pipeline
├── contexts/         - Контекстные блоки
└── core/             - Базовые блоки (base, safety, formatting, russian-market)
```

**Детали:** [ai-agents.md](ai-agents.md)

---

## Streaming Pipeline & Observability

**Файлы:** `app/(chat)/api/chat/route.ts`, `app/(chat)/api/service-chat/route.ts`

Все AI-ответы проходят через streaming pipeline с инструментированием:

```
streamText(model, system, messages, tools)
    │
    ▼
result.toUIMessageStream()          ← AI SDK: converts to UI events
    │
    ▼
instrumentedStream (ReadableStream)  ← Observer layer: перехват событий
    │  ├── step-start      → reset step tracker
    │  ├── text-delta      → accumulate text
    │  ├── tool-input-start → count tool calls + emit data-tool-activity
    │  ├── tool-output-available → log duration
    │  └── step-finish     → Guardian.analyze() + TTFT tracking
    │
    ▼
dataStream.merge(instrumentedStream)
    │
    ▼
createUIMessageStream → JsonToSseTransformStream → Response (SSE)
    │
    └── onFinish: saveMessages + autoNameChat + saveAiUsageLog(guardianFlags)
```

**Developer Panel:**
- `lib/ai/debug-events.ts` — 4 типа events: `data-debug-step`, `data-debug-finish`, `data-debug-guardian`, `data-debug-prompt`
- Эмитятся через `dataStream.write()` в `onStepFinish`, `onFinish`, Guardian analyze, stream start
- Server guard: `isSimplyDevMode` в каждой emit function (no-op в production)
- Client: `DevPanelProvider` (React Context) → `DevPanelFooter` (compact) → `DevPanelDrawer` (6 sections)
- Client guard: `NEXT_PUBLIC_SIMPLY_DEV_MODE` early bailout в Provider
- **ADR:** [029-developer-panel](decisions/029-developer-panel.md)

**Dev Switchboard:**
- `/dev/models` — полная карта 39 задач + каталог моделей + ENV-статусы 8 провайдеров
- File-based overrides: `.simply-dev-overrides.json` → `model-overrides-node.ts` (server-only fs) → `lookupOverride()` в `getModel.ts`
- **Reader регистрация:** единственная точка в [`instrumentation.ts`](../instrumentation.ts) (Next.js SSOT, boot-time). Reader вынесен в `globalThis.__simplyOverridesReader` — HMR-immune (иначе dev HMR пересоздаёт модуль и сбрасывает module-level state в no-op).
- Per-message switcher в DevPanel drawer (`switchboard-section.tsx`)
- Triple dev-gate: `lookupOverride` (silent null), page (`notFound`), Server Actions (`throw`)
- Catalog SSOT: `chat/route.ts` резолвит capabilities через catalog entry, не угадывает из chatMode
- Workflow: [docs/model-catalog-ops.md](model-catalog-ops.md) — аудит цен, capabilities, добавление моделей
- **ADR:** [048-dev-switchboard-ui](decisions/048-dev-switchboard-ui.md), [053-aisdk-invocation-contract](decisions/053-aisdk-invocation-contract.md)

**Tool Call Guardian:**
- `lib/ai/tool-call-guardian.ts` — детектор галлюцинаций tool calls
- Observer в instrumentedStream: полная буферизация text events per step
- На finish-step: flush (clean) или block (hallucination). 2+ blocks → error message. Все 3 routes (chat, service-chat, tasks/chat)
- Записывает результаты в `ai_usage_log.guardianFlags` (JSONB)
- **ADR:** [022-tool-call-guardian](decisions/022-tool-call-guardian.md), [023-guardian-blocking-strategy](decisions/023-guardian-blocking-strategy.md)

**Usage Logging:**
- `ai_usage_log` — таблица учёта потребления (per-request)
- Fire-and-forget паттерн (не блокирует стриминг)
- **ADR:** [019-usage-logging-architecture](decisions/019-usage-logging-architecture.md)

**Background Briefing Generation:**

Автоматическая генерация брифингов по расписанию без участия браузера.

```
Vercel Cron (hourly)
    │
    ▼
/api/cron/briefing (GET)
    │ CRON_SECRET auth
    │
    ▼
getUsersForDelivery(currentUtcTime)  ← users with deliveryEnabled + matching generationTime
    │
    ▼
p-limit(3) concurrent processing
    │
    ├── Idempotency check: skip if ready briefing exists today
    │
    ├── runBriefingPipeline({ userId })  ← background mode (no onProgress)
    │   └── load settings → fetch sources → filter → generate article → save to DB
    │
    ├── updateBriefingDeliveryStatus(briefingId, 'pending')
    │
    └── if format includes audio:
        └── waitUntil(runPodcastPipeline({ userId, briefingId }))  ← non-blocking
```

- **Cron Schedule:** `0 * * * *` (hourly, Hobby plan). Pro plan: `*/15 * * * *`. **Список всех Vercel cron'ов** (см. [vercel.json](../vercel.json)): `/api/cron/memory-deep-consolidate` (0 22 * * *), `/api/cron/memory-profile` (0 0 * * *), `/api/cron/briefing` (0 5 * * *), `/api/cron/reap-attachments` (0 3 * * *) — orphan xAI files cleanup, добавлен в TZ_FilesAPIMigration v3.101.0.
- **Matching Window:** 30 min (WINDOW_MINUTES) — covers hourly cron
- **Concurrency:** p-limit(3) users processed in parallel
- **Idempotency:** skip if a `ready` briefing exists for today (UTC)
- **Podcast:** non-blocking via `waitUntil()` (@vercel/functions)
- **Delivery:** text ready → `deliveryStatus='pending'`. Actual Telegram sending — отдельный pipeline.
- **ADR:** [026-background-briefing-architecture](decisions/026-background-briefing-architecture.md)

---

## Security

### API Keys
- Хранятся в `.env.local`
- Server-side only
- Не передаются клиенту

### Authentication
- NextAuth 5.0
- PostgreSQL adapter
- bcrypt для паролей
- Secure cookies

### Authorization
- Middleware защищает routes
- Пользователи видят только свои чаты
- Агенты доступны по подписке (план)

---

## Почему такая архитектура?

### Принятые решения

**Next.js App Router:**
- RSC для безопасности
- Built-in API routes
- Легкий деплой на Vercel

**Мультипровайдерная маршрутизация:**
- **xAI Grok** — Simply Chat (4.1 Fast / 4.20), MIND memory, Экспертиза Multi-Agent
- **Anthropic Claude** — Haiku (vision OCR, утилиты, клерки), Sonnet (создание артефактов, meeting summary), Opus (профессор, project expert tier)
- **Moonshot AI (Kimi K2.6)** — briefing pipeline (`briefing:author`, `briefing:section`, `briefing:podcast-script`, Instant mode, 180s fetch timeout)
- SSOT резолва — `lib/ai/task-assignments.ts` + `lib/ai/model-catalog.ts`
- Детали: [ai-chats-map.md](ai-chats-map.md), [ai-providers.md](ai-providers.md)

**PostgreSQL + Drizzle:**
- Type-safe queries
- Удобные миграции
- Интеграция с NextAuth

---

## Связанные документы

- [design-system.md](design-system.md) ⭐ — **закон для UI**, компоненты, цвета, шрифты, hover-паттерны
- [ai-chats-map.md](ai-chats-map.md) ⭐ — карта всех чатов и моделей (taskId → модель)
- [ai-providers.md](ai-providers.md) — провайдеры, цены, namespace-ы registry
- [ai-agents.md](ai-agents.md) — Система промптов (Skills + Agents)
- [ai-artifacts.md](ai-artifacts.md) — Артефакты (5 типов)
- [ai-tools.md](ai-tools.md) — AI-инструменты (17 файлов в `lib/ai/tools/`)
- [model-catalog-ops.md](model-catalog-ops.md) — workflow каталога моделей
- [setup.md](setup.md) — Установка
- [deployment.md](deployment.md) — Деплой
- [troubleshooting.md](troubleshooting.md) — Частые проблемы
- [mcp-tools.md](mcp-tools.md) — MCP-инструменты
- [decisions/](decisions/) — ADR (архитектурные решения)

---

**Обновлено:** 2026-04-30 (TZ_FilesAPIMigration v3.101.0 — добавлены `lib/ai/files/`, таблица `chat_attachment`, колонка `ai_usage_log.serverSideToolCalls`, cron reap-attachments, расширен `routing.ts`).
