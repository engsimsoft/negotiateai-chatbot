# Архитектура Simply

Описание архитектуры платформы AI-агентов Simply.

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
│  │  ├── (auth)/           - Auth routes (NextAuth)      │  │
│  │  ├── (chat)/           - Chat UI, Projects, Helpers  │  │
│  │  ├── (dashboard)/      - Dashboard, Chats, Settings  │  │
│  │  └── api/              - API endpoints               │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Business Logic (lib/)                               │  │
│  │  ├── ai/providers.ts   - AI Provider config + pricing  │  │
│  │  ├── ai/pipeline-trace.ts - Pipeline trace (v3.58)    │  │
│  │  ├── ai/retry-with-logging.ts - Retry wrapper with per-attempt logging (v3.69) │
│  │  ├── ai/tools/         - AI-инструменты              │  │
│  │  ├── briefing/         - Briefing pipeline + types + research engine (v3.27, v3.52) │
│  │  ├── podcast/          - Podcast Engine (v3.43)           │
│  │  ├── prompts/          - Skills + Agents system      │  │
│  │  ├── db/queries.ts     - Database queries            │  │
│  │  └── db/schema.ts      - Database schema             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                     │
                     │ External Services
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  External Services                                          │
│  ├── AI Providers      - Anthropic Claude (@ai-sdk/anthropic) │
│  ├── AI Providers      - Google Gemini (vision-ocr, Briefing, Podcast) │
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

#### providers.ts
- Конфигурация AI-моделей
- Anthropic Claude: Haiku, Sonnet, Opus (через @ai-sdk/anthropic)
- Google Gemini: vision-ocr + Briefing pipeline + Podcast Engine (Flash, TTS)

#### Prompt System (v3.3 — Skills + Agents)
- `lib/prompts/` — Файловая система промптов
- `lib/prompts/skills/` — Атомарные навыки (SKILL.md)
- `lib/prompts/agents/` — Персонажи-агенты (AGENT.md + config.yaml)
- `lib/prompts/builder/` — Модульная система сборки

**Детали:** [ai-agents.md](ai-agents.md)

#### tools/
- `web-search.ts` — Brave Search API
- `get-current-date.ts` — текущая дата
- `get-weather.ts` — погода (Open-Meteo)
- `presentation-reveal.ts` — веб-презентации
- `presentation-pptx.ts` — PowerPoint
- `excel/` — Excel tools (create, parse, edit)

**Детали:** [ai-tools.md](ai-tools.md)

---

### 4. Data Layer

**PostgreSQL (Neon) + Drizzle ORM**

**Основные таблицы:**
- `User` — пользователи (displayName, pronouns, occupation, bio, theme, hasSeenBenIntro, lastSeenSimplyVersion)
- `Chat` — чаты (title, summary, isStarred, projectId, chatMode)
- `Message_v2` — сообщения
- `Document` — артефакты
- `Project` — проекты (изолированные рабочие пространства)
- `ProjectFile` — файлы проектов
- `ProjectTask` — задачи проекта
- `BriefingSettings` — настройки брифинга (timezone, language, maxItems)
- `BriefingSources` — источники новостей (topicId, sourceUrl, fetchMethod, tier)
- `BriefingHistory` — история генераций (briefingJson, stats, status)
- `SavedBriefingTopics` — сохранённые темы брифинга (topicId, topicName, emoji, content, sources, briefingGeneratedAt)
- `TelegramConnection` — связка Simply ↔ Telegram (userId unique, telegramUserId bigint unique, isActive)
- `TelegramLinkToken` — эфемерные токены линковки (token PK, userId FK, expiresAt = +10 min)
- `TelegramGroup` — группы Telegram (telegramChatId unique, title, type, isForum, ownerUserId FK, isActive)
- `TelegramGroupTopic` — топики форумов (groupId FK, telegramTopicId, name, unique по groupId+telegramTopicId)
- `TelegramMessage` — сообщения из групп (groupId FK, topicId FK, fromUserId, text, hasMedia, mediaType, sentAt; индексы: group+sentAt, group+topic+sentAt)
- `ai_usage_log` — учёт потребления AI (modelId, tokens, costUsd, chatMode, guardianFlags JSONB)
- `CronRunLog` — forensics каждого cron run (cronName, startedAt, finishedAt, usersProcessed, usersSkipped, usersFailed, results JSONB, durationMs)
- `Vote_v2` — голосование за сообщения
- `MeetingRecord` — записи встреч (userId FK, title, durationSeconds, speakerCount, summaryLevel, transcript, summary, metadata JSONB, createdAt)
- NextAuth таблицы (Account, Session, VerificationToken)

**Схема:** `lib/db/schema.ts` (SSOT)

**Vercel Blob Storage:**
- Загруженные файлы
- Attachments

---

## Система промптов (v3.3 — Skills + Agents)

### Архитектура

```
lib/prompts/
├── server.ts         - Server-only экспорты
├── index.ts          - Client-safe экспорты
├── builder/          - Система сборки промптов
│   ├── registry.ts   - Сканирование skills/agents
│   ├── skill-loader.ts
│   ├── agent-loader.ts
│   └── composer.ts
├── skills/           - Атомарные навыки (SKILL.md)
│   ├── document/     - create-presentation, create-spreadsheet, etc.
│   ├── research/     - web-research
│   └── utility/      - prompt-helper
├── agents/           - Персонажи-агенты
│   └── ben/          - AGENT.md + config.yaml + references/
└── core/             - Базовые блоки (.md)
    ├── base.md
    ├── safety.md
    ├── formatting.md
    └── russian-market.md
```

**Детали:** [ai-agents.md](ai-agents.md)

---

### 5. Streaming Pipeline

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

**Developer Panel (v3.57.0):**
- `lib/ai/debug-events.ts` — 4 типа events: `data-debug-step`, `data-debug-finish`, `data-debug-guardian`, `data-debug-prompt`
- Эмитятся через `dataStream.write()` в `onStepFinish`, `onFinish`, Guardian analyze, stream start
- Server guard: `isSimplyDevMode` в каждой emit function (no-op в production)
- Client: `DevPanelProvider` (React Context) → `DevPanelFooter` (compact) → `DevPanelDrawer` (6 sections)
- Client guard: `NEXT_PUBLIC_SIMPLY_DEV_MODE` early bailout в Provider
- **ADR:** [029-developer-panel](decisions/029-developer-panel.md)

**Tool Call Guardian (v3.50.0 + v3.51.0):**
- `lib/ai/tool-call-guardian.ts` — детектор галлюцинаций tool calls
- **Phase 1 (v3.50.0):** detection + logging. Observer в instrumentedStream
- **Phase 2 (v3.51.0):** полная буферизация text events per step. На finish-step: flush (clean) или block (hallucination). 2+ blocks → error message. Все 3 routes (chat, service-chat, tasks/chat)
- Записывает результаты в `ai_usage_log.guardianFlags` (JSONB)
- **ADR:** [022-tool-call-guardian](decisions/022-tool-call-guardian.md), [023-guardian-blocking-strategy](decisions/023-guardian-blocking-strategy.md)

**Usage Logging (v3.46.0):**
- `ai_usage_log` — таблица учёта потребления (per-request)
- Fire-and-forget паттерн (не блокирует стриминг)
- **ADR:** [019-usage-logging-architecture](decisions/019-usage-logging-architecture.md)

**Background Briefing Generation (v3.54.0):**

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

- **Cron Schedule:** `0 * * * *` (hourly, Hobby plan). Pro plan: `*/15 * * * *`
- **Matching Window:** 30 min (WINDOW_MINUTES) — covers hourly cron
- **Concurrency:** p-limit(3) users processed in parallel
- **Idempotency:** skip if a `ready` briefing exists for today (UTC)
- **Podcast:** non-blocking via `waitUntil()` (@vercel/functions)
- **Delivery:** text ready → `deliveryStatus='pending'`. Actual Telegram sending — future ТЗ-TG4b
- **ADR:** [026-background-briefing-architecture](decisions/026-background-briefing-architecture.md)

---

## Smart Routing (план)

Автоматический выбор модели для экономии:

| Сложность | Модель | Примерная цена |
|-----------|--------|----------------|
| Простой вопрос | Gemini Flash / GPT-4o-mini | ~$0.10/1M |
| Средняя задача | Gemini Pro / GPT-4o | ~$2-5/1M |
| Сложный анализ | Claude Sonnet | ~$3-15/1M |
| Максимум качества | Claude Opus | ~$15-60/1M |

**Текущее:** Ручной выбор или auto (Gemini 3 Pro/2.5 Flash)
**План:** Интеллектуальный роутинг на основе анализа запроса

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

**Anthropic Claude (основной — v3.23.0+):**
- Три модели: Haiku (быстрый), Sonnet (баланс), Opus (качество)
- Прямое подключение через @ai-sdk/anthropic
- Google Gemini — vision-ocr + Briefing pipeline + Podcast Engine ([ADR 016](decisions/016-briefing-backend-architecture.md))

**PostgreSQL + Drizzle:**
- Type-safe queries
- Удобные миграции
- Интеграция с NextAuth

---

## Связанные документы

- [setup.md](setup.md) — Установка
- [deployment.md](deployment.md) — Деплой
- [ai-agents.md](ai-agents.md) — Система промптов (Skills + Agents)
- [ai-artifacts.md](ai-artifacts.md) — Артефакты
- [ai-tools.md](ai-tools.md) — Инструменты
- [ai-providers.md](ai-providers.md) — AI провайдеры и модели
- [ADR](decisions/) — Архитектурные решения

---

**Обновлено:** 2026-02-28 (v3.57.0 — Developer Panel)
