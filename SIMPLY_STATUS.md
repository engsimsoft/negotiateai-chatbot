# Simply — Текущее состояние проекта

**Версия:** 3.78.0
**Дата:** 2026-04-08
**Статус:** Active development
**Production URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

> **Назначение:** Полная информация о состоянии проекта для разработки ТЗ и архитектурных решений.

---

## О проекте

### Что это?

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

### Философия

- **Apple-подход:** Качество важнее количества
- **Best-in-Class API:** Не изобретаем велосипеды — интегрируем лучшие решения (Perplexity, Plus AI, Ideogram)

### Ключевые особенности

| Особенность | Описание | Статус |
|-------------|----------|--------|
| **Simply Chat** | Persistent чат: MiniMax M2.7 (текст) + Gemini 3 Flash (vision) + Sonnet (думать), Extract-on-compression | ✅ v3.78.0 |
| **Мой контекст** | Dashboard MIND Memory — 7 категорий, Opus-профиль | ✅ v3.74.0 |
| **Универсальный AI-чат** | Один мощный чат со всеми инструментами | ✅ |
| **Проекты** | Изолированные рабочие пространства с Профессором, Менеджером, утверждением плана, картой задач, чатом с Экспертом, завершением задач и управлением контекстом | ✅ v3.18.0 |
| **Сервисные помощники** | Бен (❓), Секретарь (➕), Менеджер (👤) | ✅ v3.13.0 |
| **Три уровня персонализации** | Профиль + RAG + Chat Memory | Профиль ✅, RAG extract+retrieve+consolidation+profile ✅ v3.72.0, Memory 📋 |
| **Best-in-Class инструменты** | Perplexity ✅, Plus AI, Ideogram, AssemblyAI | 🔄 Фаза 1 |
| **Запись встречи** | Аудио → Deepgram транскрипция → Claude резюме (3 формата, инструкции, регенерация, PDF) | ✅ v3.62.0 |
| **AI-провайдер** | Мультипровайдер: MiniMax (Simply), Anthropic Claude (expertise/create/projects), Gemini (vision/briefing) | ✅ v3.77.0 |
| **Smart Routing** | Автовыбор модели для экономии без потери качества | 📋 |
| **Оплата в рублях** | ЮKassa, Тинькофф, СБП | 📋 |

**Подробнее:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## Унаследовано от Family AI Assistant

Проект Simply построен на базе Family AI Assistant (v2.5.0). Сохранены:

### Инфраструктура
- ✅ Next.js 15.3 (App Router, RSC)
- ✅ NextAuth 5.0-beta.25
- ✅ PostgreSQL (Neon) + Drizzle ORM + `@neondatabase/serverless` (WebSocket)
- ✅ Vercel AI SDK
- ✅ Vercel Blob Storage

### AI-возможности
- ✅ Streaming responses
- ✅ Anthropic Claude (Sonnet / Haiku / Opus) через @ai-sdk/anthropic
- ✅ Web Search (Brave API)
- ✅ Deep Research (Perplexity Sonar API — Pro/Deep)
- ✅ Fetch URL (Readability + JSDOM + charset detection + Jina Reader API fallback)
- ✅ Weather (Open-Meteo)
- ✅ Get Current Date

### Артефакты (документы в холсте)
- ✅ Text Artifact (plain text + emoji)
- ✅ Markdown Artifact (форматированные документы)
- ✅ Excel Artifact (таблицы, формулы, графики)
- ✅ Presentation-Reveal (веб-презентации)
- ✅ Presentation-PPTX (PowerPoint)
- ✅ Public Share (публичные ссылки)
- ✅ PDF Export (для Markdown и Excel)

---

## Система промптов (v3.3 — Skills + Agents)

> В версии 3.3.0 система промптов мигрирована на архитектуру Skills + Agents по стандарту Anthropic.

### Архитектура

| Концепция | Описание |
|-----------|----------|
| **Skills** | Атомарные навыки в формате Markdown (SKILL.md) |
| **Agents** | Персонажи-дирижёры с набором skills (AGENT.md + config.yaml) |
| **Builder** | Модульная система сборки промптов |
| **Progressive Disclosure** | Загрузка только необходимой информации |

### Промпты

| Промпт | Модель | Назначение |
|--------|--------|------------|
| **chat** | Claude Sonnet | Универсальный AI-чат |
| **ben** | Claude Haiku | Гид по платформе |
| **project-creation** | Claude Sonnet | Секретарь — AI-интервью для создания проектов |
| **project-manager** | Claude Haiku | Менеджер проекта (живой AI-диалог) |
| **professor-planning** | Claude Opus | Профессор планирования — генерация плана задач |
| **task-expert** | Claude Sonnet | Эксперт — AI-диалог по задаче проекта |
| **task-summarizer** (Клерк) | Claude Haiku | Суммаризация результатов задачи |
| **task-reviewer** (Профессор) | Claude Opus | Ревью завершённой задачи |
| **file-analyzer** (Клерк) | Claude Haiku | Автоанализ файлов проекта |
| **snapshot-creator** (Клерк) | Claude Haiku | Fallback-создание snapshot при заполнении контекста (v3.18) |

### Файловая структура

```
lib/prompts/
├── index.ts                 # Client-safe экспорты (типы, утилиты)
├── server.ts                # Server-only экспорты (fs-зависимые)
├── types.ts                 # TypeScript типы
├── template.ts              # Template engine
│
├── skills/                  # Атомарные навыки
│   ├── _template/SKILL.md   # Шаблон skill
│   ├── document/            # Skills для документов
│   │   ├── create-presentation/SKILL.md
│   │   ├── create-spreadsheet/SKILL.md
│   │   ├── create-text-document/SKILL.md
│   │   └── analyze-document/SKILL.md
│   ├── research/            # Skills для исследований
│   │   └── web-research/SKILL.md
│   └── utility/
│       └── prompt-helper/SKILL.md
│
├── agents/                  # Персонажи-агенты
│   ├── _template/           # Шаблон агента
│   │   ├── AGENT.md
│   │   └── config.yaml
│   └── ben/                 # Бен — гид по платформе
│       ├── AGENT.md
│       ├── config.yaml
│       ├── onboarding.md
│       └── references/
│           ├── features.md
│           └── scenarios.md
│
├── builder/                 # Система сборки промптов
│   ├── index.ts             # Public API
│   ├── registry.ts          # Сканирование skills/agents
│   ├── skill-loader.ts      # Загрузка SKILL.md
│   ├── agent-loader.ts      # Загрузка AGENT.md + config.yaml
│   └── composer.ts          # Сборка финального промпта
│
├── core/                    # Переиспользуемые блоки (.md)
│   ├── index.ts             # Загрузчик .md файлов
│   ├── base.md
│   ├── safety.md
│   ├── formatting.md
│   ├── russian-market.md
│   └── dev-mode.md          # Dev mode промпт (v3.23)
│
├── professors/                  # Промпты профессоров (v3.14+)
│   ├── planning.md          # Профессор планирования
│   └── task-review.md       # Профессор-ревьюер задач (v3.17)
│
├── experts/                     # Промпты экспертов (v3.16)
│   └── task-expert.md       # Эксперт по задаче
│
├── clerks/                      # Промпты клерков (v3.13+)
│   ├── file-analyzer.md     # Клерк-анализатор файлов
│   ├── task-summarizer.md   # Клерк-суммаризатор задач (v3.17)
│   └── snapshot-creator.md  # Клерк-создатель snapshot'ов (v3.18)
│
├── service-chats/               # Промпты сервисных чатов (v3.11+)
│   ├── project-creation.md  # XML-промпт Секретаря
│   └── project-manager.md   # Промпт Менеджера проекта
│
└── contexts/                # Контексты пользователя
    ├── index.ts
    ├── user-profile.ts
    └── chat-memory.ts
```

### Сервисные чаты (v3.8+)

> В версии 3.8.0 модальные помощники унифицированы в систему ServiceChat.
> В версии 3.13.0 Менеджер получил живой AI-диалог с серверной персистенцией.

| Чат | Кнопка | Оболочка | Назначение |
|-----|--------|----------|------------|
| **Бен** | ❓ | Floating (bottom-right) | Вопросы о платформе, онбординг |
| **Создание проекта** | ➕ | Full-page (split layout) | Секретарь — AI-интервью для создания проекта |
| **Менеджер проекта** | 👤 | Push-drawer (right) | Живой AI-диалог, серверная персистенция сообщений |

### Клерки (v3.13)

> Клерки — автоматические backend-процессы (без UI чата). Вызываются программно.

| Клерк | Модель | Триггер | Назначение |
|-------|--------|---------|------------|
| **Анализатор файлов** | Claude Haiku | Upload файла в проект | Описание, тип, папка, ключевые темы, manifest |
| **Суммаризатор задач** | Claude Haiku | Завершение задачи | Краткое описание результатов + статус + артефакты |
| **Snapshot Creator** | Claude Haiku | Fallback при заполнении контекста | Автоматический snapshot диалога (v3.18) |

### Профессоры (v3.14+)

> Профессоры — AI-агенты для сложных аналитических задач. Backend-процессы без интерактивного чата.

| Профессор | Модель | Триггер | Назначение |
|-----------|--------|---------|------------|
| **Планирование** | Claude Opus | Кнопка «Начать планирование» | Генерация плана задач проекта (tasks, risks, recommendations) |
| **Ревью задач** | Claude Opus | Завершение задачи (needsReview) | Проверка качества: decision, issues, score, overallComment |

### Эксперты (v3.16+)

> Эксперты — AI-агенты для конкретных задач проекта. Полноценный интерактивный чат с инструментами.

| Эксперт | Модель | Оболочка | Назначение |
|---------|--------|----------|------------|
| **Эксперт по задаче** | Claude Sonnet | Full-screen layout (`app/(task)/`) | AI-диалог по задаче, инструменты, артефакты, завершение задачи |

---

## Проекты (v3.2.0)

> Изолированные рабочие пространства с Claude (Anthropic) через `@ai-sdk/anthropic`.

### Концепция

Проект = изолированное рабочее пространство со своими чатами и настройками. Все AI-модели (и основной чат, и проекты) работают через Anthropic Claude.

### Три уровня моделей

| Уровень | Модель | Иконка | Назначение |
|---------|--------|--------|------------|
| **Исполнитель** | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`, $1/$5) | ⚡ | Быстрый, экономичный, простые задачи |
| **Эксперт** | Claude Sonnet 4.6 (`claude-sonnet-4-6`, $3/$15) | 🎯 | Баланс скорости и качества (по умолчанию) |
| **Профессор** | Claude Opus 4.6 (`claude-opus-4-6`, $5/$25) | 🎓 | Максимальное качество, сложный reasoning |

### Режим Профессор (Pipeline)

Многоэтапный reasoning pipeline:
1. **Анализ (Opus)** — разбивает задачу на подзадачи
2. **Исполнение (Haiku)** — параллельно выполняет подзадачи
3. **Синтез (Opus)** — объединяет результаты в финальный ответ

UI показывает прогресс с галочками для каждой подзадачи.

> **v3.23.0:** Все модели переключены с Gemini на Claude через `@ai-sdk/anthropic` (прямое подключение, без OpenRouter).

### Структура файлов

```
app/(chat)/projects/
├── page.tsx                    # Список проектов
├── new/page.tsx                # Создание проекта
└── [id]/
    ├── page.tsx                # Страница проекта
    └── chat/
        ├── page.tsx            # Новый чат в проекте
        └── [chatId]/page.tsx   # Существующий чат

lib/ai/
├── model-tiers.ts              # Конфиг уровней моделей
└── professor-pipeline.ts       # Pipeline для режима Профессор

components/projects/
└── professor-progress.tsx      # UI прогресса pipeline
```

### Не реализовано из ТЗ-03

| Функция | Статус | Примечание |
|---------|--------|------------|
| Иконки уровней | Изменено | ⚡🎯🎓 вместо ⚙️💼🎓 |
| "думает..." индикатор | Не реализовано | Во время генерации |
| Pipeline индикатор в header | Не реализовано | Динамический статус |
| Drag & drop файлов | Nice to have | Не в MVP |
| Предпросмотр файлов | Nice to have | Не в MVP |
| Поиск в проектах | Nice to have | Не в MVP |
| Сортировка проектов | Nice to have | Не в MVP |

---

## Профиль пользователя

### Поля профиля

| Поле | Тип | Описание |
|------|-----|----------|
| `displayName` | varchar(100) | Как обращаться к пользователю |
| `pronouns` | varchar(10) | "ты" / "вы" — форма обращения |
| `occupation` | varchar(100) | Сфера деятельности |
| `bio` | text | Контекст для AI |
| `theme` | varchar(20) | "light" / "dark" / "system" |
| `hasSeenBenIntro` | boolean | Флаг онбординга Бена |

### Функционал

- **Страница настроек** `/settings` — 3 секции (Профиль, Аккаунт, Внешний вид)
- **Меню пользователя** — имя вместо email, аватар, план, настройки
- **Онбординг** — 3-шаговый диалог для новых пользователей
- **Интеграция с AI** — user context в system prompts
- **Синхронизация темы** — БД ↔ next-themes

---

## AI-инструменты

**Текущие:**
- Web Search (Brave API)
- Get Current Date
- Get Weather (Open-Meteo)
- Read Document (только обычные чаты)
- Create Document (text, markdown, excel, presentations)
- Update Document (редактирование артефактов)
- Request Suggestions
- Parse Excel (анализ загруженных файлов)
- **Load Skill** (динамическая загрузка инструкций) ← v3.3.2
- **Read Project File** (чтение файлов проекта по имени из manifest) ← v3.17.0
- **Create Snapshot** (создание итога диалога для управления контекстом) ← v3.18.0
- **Deep Research** (Perplexity Sonar API — Pro/Deep исследование) ← v3.29.0
- **Fetch URL** (чтение веб-страниц через Readability) ← v3.29.0

**Планируемые:**
- Transcription (Whisper)
- Image Generation

---

## Технический стек

| Слой | Технология |
|------|------------|
| Frontend | Next.js 15.3, React 18, TypeScript, Tailwind CSS |
| AI | Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/google для vision-ocr + briefing-фильтр + podcast), @google/genai для TTS |
| Auth | NextAuth 5.0-beta.25 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Storage | Vercel Blob Storage |
| External | Brave Search, Perplexity, CloudConvert, Open-Meteo, Deepgram |
| Deploy | Vercel |

---

## План развития

### HOTFIX: PodcastFromCron — ✅ ЗАВЕРШЁН (v3.55.1)

**Проблема:** Подкаст НЕ генерировался из cron-функции. lamejs (MP3-кодер) не загружался — ENOENT. Пользователи с форматом «аудио» получали текст вместо MP3.

**Корневая причина:** Vercel NFT не трассирует динамически вычисленные пути. Каждая serverless-функция имеет свой бандл — lamejs попадал в бандл podcast API, но не в бандл cron. Дополнительно: pnpm-симлинки не сохраняются на Vercel, `require.resolve` заменяется webpack'ом на числовой ID.

**Решение:**
- **Lazy loading** — lamejs загружается при первом вызове `pcmToMp3()`, не при import
- **pnpm path resolution** — `fs.existsSync(pnpmPath)` → fallback на symlink path
- **outputFileTracingIncludes** — точный путь `.pnpm/lamejs@1.2.1/.../lame.all.js` в next.config.ts
- **Audio Merger** — `mergeAndUploadPodcast()`: склейка per-section MP3 → один файл → Vercel Blob
- **Синхронный podcast** — подкаст генерируется внутри cron до delivery (вместо non-blocking waitUntil)

**Ключевые файлы:**
- `lib/podcast/audio-converter.ts` — lazy loading + pnpm path resolution
- `lib/podcast/audio-merger.ts` — **NEW**: склейка MP3 + upload
- `next.config.ts` — outputFileTracingIncludes
- `app/api/cron/briefing/route.ts` — podcast pipeline + merge + delivery
- `lib/telegram/briefing-delivery.ts` — mergedAudioUrl param

**Тайминг cron:** briefing ~30-60с + podcast ~60-90с + merge ~5с + delivery ~5с = **~100-160с** (из 240с maxDuration)

**Возможный переход на Vercel Pro:** при 5+ пользователях с audio — maxDuration, cron frequency (daily → per-minute), Blob storage limits.

**ADR:** [027-lamejs-vercel-bundling](docs/decisions/027-lamejs-vercel-bundling.md)

### ТЗ-DEV1: DeveloperPanel — ✅ ЗАВЕРШЁН (v3.57.0)

**Выполнено:**
- **Debug Events** — 4 типа transient data-stream events (`data-debug-step/finish/guardian/prompt`), эмитятся в 3 routes (chat, service-chat, project tasks)
- **DevPanel Footer** — компактная строка под AI-ответом: модель, токены, стоимость (₽), время. Live elapsed timer, красный стиль при ошибках
- **DevPanel Drawer** — Sheet справа с 6 секциями: Model, Tokens, Timeline, Guardian, Prompt, Raw JSON
- **Production safety** — `NEXT_PUBLIC_SIMPLY_DEV_MODE` env mapping, early bailout в Provider, server-side guard в emit functions
- **Старый DEV mode удалён** — `injectDevMode()`, `dev-mode.md`, `devModelName` badge, `data-model-info` event

**Ключевые файлы:**
- `lib/ai/debug-events.ts` — типы + emit functions
- `lib/ai/providers.ts` — +MODEL_PRICING_RUB + calculateCostRub()
- `components/dev-panel/` — Provider, Footer, Drawer, 6 секций
- `next.config.ts` — env mapping

**ADR:** [029-developer-panel](docs/decisions/029-developer-panel.md)

### ТЗ-DEV2: Pipeline Observability — ✅ ЗАВЕРШЁН (v3.58.0)

**Выполнено:**
- **Pipeline Trace System** — типы `PipelineTrace`, `PipelineStageTrace`, `FetchTrace`, `UrlVerificationTrace`. `TraceCollector` класс (gated by `isSimplyDevMode`)
- **Полное инструментирование pipeline** — Briefing (fetchers, filter, author, URL verification), Podcast (script, TTS), Section Refresh, Research Engine
- **Extended Pricing** — +5 моделей в `MODEL_PRICING_RUB` (Gemini, Perplexity, Claude fallback). TTS pricing
- **Pipeline Trace Footer** — compact monospace line: live status при генерации, итог после завершения. Persistent footer из DB metadata
- **Pipeline Trace Drawer** — Sheet с 5 секциями: Summary, Cost Breakdown, Stages, Fetches, Raw JSON
- **DB persistence** — full trace saved to `briefingHistory.metadata` (jsonb), loaded on page reload
- **Silent failures → warnings** — `.catch(() => {})` заменены на proper logging

**Ключевые файлы:**
- `lib/ai/pipeline-trace.ts` — типы + TraceCollector + helpers
- `components/dev-panel/pipeline-trace-footer.tsx` — compact footer
- `components/dev-panel/pipeline-trace-drawer.tsx` — full trace drawer (Summary, Cost Breakdown, Stages, Fetches, Raw)
- `lib/briefing/briefing-pipeline.ts` — trace orchestration
- `lib/podcast/podcast-pipeline.ts` — podcast trace

**ADR:** [030-pipeline-observability](docs/decisions/030-pipeline-observability.md)

### ТЗ-TG5: ClosedGroups — ✅ ЗАВЕРШЁН (v3.56.0)

**Выполнено:**
- **DB schema** — 3 таблицы: TelegramGroup, TelegramGroupTopic, TelegramMessage + индексы + миграция 0041
- **Bot handlers** — `my_chat_member` (добавление/удаление из групп, auto-owner), групповой message handler (text/caption, hasMedia, topic resolve), forum_topic_created/edited
- **11 DB queries** — CRUD для групп, топиков, сообщений (upsert, get, deactivate, list с messageCount, cursor-pagination)
- **3 API endpoints** — GET groups (список с messageCount), GET messages (cursor + topic filter), DELETE group (деактивация)
- **UI /groups page** — ListDetailPage layout, GroupList (название, тип, форум badge, статус, сообщения), GroupDetail (header + табы топиков + лента + «Загрузить ещё»), GroupMessageList (автор, текст, дата, media icon), empty state
- **Settings → Connections** — ссылка «Группы Telegram — N групп подключено» → /groups

**Ключевые файлы:**
- `lib/db/schema.ts` — 3 таблицы + типы
- `lib/db/queries.ts` — 11 queries
- `lib/telegram/bot.ts` — group handlers
- `app/(chat)/api/telegram/groups/` — 3 API routes
- `app/(dashboard)/groups/page.tsx` — Server Component
- `components/groups/` — 4 клиентских компонента
- `app/(dashboard)/settings/settings-page.tsx` — groups link в Connections

### ТЗ-TG4b: TelegramDelivery — ✅ ЗАВЕРШЁН (v3.55.0)

**Выполнено:**
- **Delivery module** — `deliverBriefingToTelegram()`: форматирование BriefingArticle как HTML-дайджест + отправка через grammY
- **Message formatting** — заголовок с датой, до 7 секций с emoji + first sentence, inline-кнопки
- **Audio delivery** — MP3 через `sendAudio` с merged podcast URL
- **Error handling** — классификация ошибок Telegram API, non-blocking для cron

**Ключевые файлы:**
- `lib/telegram/briefing-delivery.ts` — delivery module
- `app/api/cron/briefing/route.ts` — generateAndDeliver + delivery

### ТЗ-TG4a: BackgroundBriefing — ✅ ЗАВЕРШЁН (v3.54.0)

**Выполнено:**
- **Vercel Cron** — daily job (`0 5 * * *`) триггерит `/api/cron/briefing` для фоновой генерации брифингов
- **Briefing Pipeline** — core-логика генерации вынесена в `lib/briefing/briefing-pipeline.ts` (browser + background)
- **Podcast Pipeline** — core-логика подкаста вынесена в `lib/podcast/podcast-pipeline.ts`
- **Cron endpoint** — авторизация CRON_SECRET, p-limit(3), идемпотентность, deliveryStatus tracking
- **DB расширение** — deliveryEnabled, deliveryFormat в BriefingSettings; deliveryStatus в BriefingHistory
- **Delivery Settings UI** — Popover от Clock-иконки в header /briefing/setup (toggle, time, format, Telegram status)
- **3 формата доставки** — text, audio (только подкаст), text_audio

**Ключевые файлы:**
- `vercel.json` — cron config
- `app/api/cron/briefing/route.ts` — cron handler
- `lib/briefing/briefing-pipeline.ts` — extracted briefing core
- `lib/podcast/podcast-pipeline.ts` — extracted podcast core
- `app/(chat)/api/briefing/delivery/route.ts` — delivery settings API
- `components/briefing/briefing-delivery-settings.tsx` — delivery settings UI
- `lib/briefing/briefing-config.ts` — +CRON constants

**Детали:** [specs/TZ_TG4A_BackgroundBriefing/](specs/TZ_TG4A_BackgroundBriefing/)

### ТЗ-BF5: BriefingDedup — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Дедупликация контента** — повторная генерация брифинга выдаёт другие новости, а не пересказ тех же статей
- **Sliding window** — `deleteOldBriefingHistory(keepLast: 1)` сохраняет предыдущий ready-брифинг для контекста
- **`getPreviousBriefing()`** — загрузка последнего ready-брифинга из БД
- **Data-level маркировка** — кандидаты с совпадающим URL помечаются `⚠️ БЫЛ В ПРОШЛОМ ВЫПУСКЕ`
- **Промпт v6** — жёсткие правила дедупликации + самопроверка Author
- **Per-section dedup** — refresh одной секции (↻) тоже получает контекст прошлого выпуска

**Ключевые файлы:**
- `lib/db/queries.ts` — +getPreviousBriefing(), расширен deleteOldBriefingHistory(keepLast)
- `lib/briefing/briefing-author.ts` — +buildPreviousHeadlines(), маркировка кандидатов по URL
- `lib/briefing/briefing-section-author.ts` — аналогичная маркировка для per-section
- `lib/prompts/briefing/briefing-author.md` — v6: секция дедупликации
- `app/(chat)/api/briefing/generate/route.ts` — интеграция pipeline
- `app/(chat)/api/briefing/refresh-section/route.ts` — интеграция per-section
- `docs/decisions/018-prompt-engineering-lessons.md` — ADR: уроки prompt-инженерии

**Детали:** [_archive/TZ_BF5_BriefingDedup/](_archive/TZ_BF5_BriefingDedup/)

### ТЗ-CACHE3: UnifiedCostUI — ✅ ЗАВЕРШЁН (v3.64.0)

**Выполнено:**
- **`lib/constants/pricing.ts`** — единый SSOT для `RUB_PER_USD = 100`
- **Context dropdown** — стоимость переведена с USD (`$0.00XXXX`) на RUB (`₽X.XX`)
- **DevPanel Footer/Tokens** — fallback-стоимость помечается `~₽X.XX` (когда steps=0)
- **Timeline** — токены step включают reasoning tokens
- **Pipeline traces** — все stages используют `calcStepCostRub()` (TokenLens → fallback)
- **DevPanel first-message bug** — исправлено: AI SDK v5 shell-messages фильтруются из position matching

**Ключевые файлы:**
- `lib/constants/pricing.ts` — RUB_PER_USD SSOT
- `components/elements/context.tsx` — USD → RUB
- `components/dev-panel/dev-panel-provider.tsx` — shell filter + React 19 safe state
- `components/dev-panel/dev-panel-footer.tsx` — fallback ~
- `components/dev-panel/sections/timeline-section.tsx` — + reasoning tokens

### ТЗ-RAG3: Compaction — Бесконечный чат — ✅ ЗАВЕРШЁН (v3.73.0)

**Выполнено:**
- **Anthropic Compaction API** (`compact_20260112`) — включён для Sonnet/Opus routes (expertise, create, project tasks). Trigger: 100K input tokens. Haiku не поддерживает → snapshot остаётся для `chatMode="chat"`
- **Dual strategy** — Compaction для Sonnet/Opus, snapshot для Haiku. Snapshot-логика в chat route обёрнута в `if (chatMode === "chat")`
- **Task chat route** — полностью очищен от snapshot-логики (всегда Sonnet/Opus)
- **DevPanel** — Compaction badge в footer (amber), iterations breakdown в model-section, compaction block в cost-breakdown
- **Message persistence fix** — добавлен `originalMessages` в `createUIMessageStream`, без него SDK не сохранял сообщения в БД
- **MIND двухуровневая дедупликация** — embedding candidates (порог 0.55) → LLM Haiku верификация. Решает проблему дублирования фактов при разных формулировках
- **Cumulative usage** — usage popup после перезагрузки показывает накопленную сумму сессии, не последнее сообщение
- **Extract prompt** — настроен на запоминание багов, решений, архитектурных выборов

**Ключевые файлы:**
- `app/(chat)/api/chat/route.ts` — compaction (условный), originalMessages, cumulative usage
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — compaction, очистка snapshot
- `lib/ai/memory/extract.ts` — двухуровневая дедупликация (verifyDuplicatesWithLLM)
- `lib/ai/debug-events.ts` — DebugCompactionData
- `docs/decisions/042-compaction-dual-strategy.md` — ADR

**Детали:** [specs/TZ_RAG_SimplyRAG/RAG3_ROADMAP.md](specs/TZ_RAG_SimplyRAG/RAG3_ROADMAP.md)

### ТЗ-RAG2: MIND Consolidation + Profile + UI — ✅ ЗАВЕРШЁН (v3.72.0)

**Выполнено:**
- **Sonnet консолидация** (`lib/ai/memory/consolidate.ts`) — гибрид: полная ревизия (ночной cron) + мини-ревизия (каждые 20 новых фактов, event-triggered из extract.ts). Actions: supersede/merge/remove
- **Opus-профиль** (`lib/ai/memory/profile.ts`) — ночной cron генерирует нарративный профиль (800-1200 слов) из всех фактов. Инжектируется как `<user-profile>` перед `<memory>` — два слоя контекста
- **Memory API** — `/api/user/memory` (GET facts, DELETE), `/api/user/memory/settings` (GET/PATCH memoryEnabled)
- **UI «Память»** (`components/settings/memory-section.tsx`) — секция на /settings: toggle вкл/выкл, профиль read-only, список фактов с category badges, удаление одного/всех
- **memoryEnabled gate** — пользователь может отключить извлечение + retrieval через UI
- **DB** — таблицы `memory_settings` (factsSinceConsolidation, memoryEnabled) + `user_profile_summary` (content, factCount, costUsd)
- **Cron** — `0 0 * * *` (3:00 MSK): consolidation → profile, p-limit(3), saveCronRunLog

**Детали:** [specs/TZ_RAG_SimplyRAG/RAG2_ROADMAP.md](specs/TZ_RAG_SimplyRAG/RAG2_ROADMAP.md)

### ТЗ-RAG1: MIND Extract + Retrieve — ✅ ЗАВЕРШЁН (v3.71.0)

**Выполнено:**
- **Extract pipeline** (`lib/ai/memory/extract.ts`) — Claude Sonnet извлекает факты из пар сообщений (user+assistant) через `generateObject()` + Zod-схема. Fire-and-forget в `onFinish` — не увеличивает latency ответа
- **Retrieve + inject** (`lib/ai/memory/retrieve.ts`) — semantic search top-5 фактов через Voyage AI, инжекция XML-блока `<memory>` в system prompt с мягкой формулировкой "Из предыдущих разговоров известно..."
- **Дедупликация** — двухуровневая (v3.73.0): embedding candidates (cosine > 0.55 + category match) → LLM Haiku верификация → supersede старый факт
- **Интеграция** — chat/expertise/create + project tasks. Оба route: retrieve перед streamText, extract в onFinish
- **Graceful degradation** — при ошибке Voyage API чат работает без памяти (log warning, не crash)
- **Dev Panel — RagSection** — секция "MIND Memory": category badges (fact/task/preference/calendar/person/decision), similarity scores, confidence, voyage tokens, duration
- **Cost tracking** — `memory:extract` (Claude Sonnet), `memory:embed` (Voyage-4), `memory:search` (Voyage-4-lite) в ai_usage_log с costUsd

**Ключевые файлы:**
- `lib/ai/memory/extract.ts` — extractFactsFromMessages + extractAndStoreFacts
- `lib/ai/memory/retrieve.ts` — retrieveMemoryContext + formatMemoryForPrompt
- `lib/prompts/memory/extract.md` — промпт извлечения (категории, confidence, правила)
- `components/dev-panel/sections/rag-section.tsx` — MIND Memory секция в Dev Panel
- `docs/decisions/040-mind-extract-retrieve-architecture.md` — ADR

**Детали:** [specs/TZ_RAG_SimplyRAG/RAG1_ROADMAP.md](specs/TZ_RAG_SimplyRAG/RAG1_ROADMAP.md)

### ТЗ-RAG0: SimplyRAG Infrastructure — ✅ ЗАВЕРШЁН (v3.70.0)

**Выполнено:**
- **pgvector v0.8.0** в Neon PostgreSQL — vector(1024) + HNSW-индекс
- **Таблица `memory_entry`** — хранение фактов (embedding, category, confidence, sourceType, supersededBy chain)
- **Voyage AI клиент** — raw fetch к `/v1/embeddings`, voyage-4 (indexing) + voyage-4-lite (queries)
- **Memory queries** — CRUD + similarity search (cosine distance `<=>`)
- **Pricing** — Voyage в MODEL_PRICING_RUB

**Ключевые файлы:**
- `lib/ai/memory/voyage-client.ts` — Voyage AI embeddings
- `lib/ai/memory/memory-queries.ts` — pgvector CRUD + search
- `lib/ai/memory/types.ts` — MemoryCategory, MemorySourceType
- `docs/decisions/039-pgvector-voyage-ai-rag-infrastructure.md` — ADR

**Детали:** [specs/TZ_RAG_SimplyRAG/ROADMAP.md](specs/TZ_RAG_SimplyRAG/ROADMAP.md)

### ТЗ-PIPELINE1: ReliablePipelineObservability — ✅ ЗАВЕРШЁН (v3.69.0)

**Выполнено:**
- **Fix multi-step usage (CRITICAL)** — `onFinish: ({ usage })` → `onFinish: ({ totalUsage })` в 4 streaming routes. До фикса терялось 74% tokens (159K в Console vs 42K в БД). После фикса дельта <1%
- **Artifact usage logging** — 5 artifact handlers (text, markdown, excel, reveal, pptx) использовали Sonnet 4.6 без logUsage. Добавлено `result.totalUsage` + `logUsage()` с chatModes `artifact:*`
- **Pipeline retry transparency** — `maxRetries: 0` отключает скрытые SDK retry. `retryWithLogging()` логирует каждую попытку отдельно (briefing-author, section-author)
- **Removed fallback Sonnet 4.5** — `AUTHOR_MODEL_FALLBACK` удалён (та же цена, нет смысла). Retry с основной моделью через обёртку
- **Safe stream controller** — safeEnqueue wrapper предотвращает "Controller is already closed" crash
- **DevPanel extensions** — Retry History в Stages, URL Verification секция (✓/✗ маркеры для детекции галлюцинаций)

**Ключевые файлы:**
- `lib/ai/retry-with-logging.ts` — retry-обёртка с per-attempt logging
- `lib/ai/pipeline-trace.ts` — AiCallAttempt тип для retry visibility
- `docs/decisions/037-total-usage-and-retry-logging.md` — ADR решения
- `docs/decisions/038-cost-tracking-architecture.md` — ADR полной архитектуры учёта расходов

**Детали:** [_archive/TZ_PIPELINE1_ReliablePipelineObservability/](_archive/TZ_PIPELINE1_ReliablePipelineObservability/)

### ТЗ-CACHE2: UnifiedUsageLogging — ✅ ЗАВЕРШЁН

**Выполнено:**
- **`lib/ai/usage-utils.ts`** — утилиты `extractUsageFields()` + `logUsage()`: единая точка логирования для всех AI-вызовов
- **~20 новых endpoints** покрыты usage logging: service-chat, ben, professors, clerks, briefing, podcast, meeting, deep-research, vision-ocr
- **chatMode конвенция** для всех точек: `service:*`, `professor:*`, `clerk:*`, `briefing:*`, `podcast:*`, `tool:*`, `meeting:*`, `util:*`, `project:*`
- **6 существующих points** переведены на `extractUsageFields()` (cacheReadTokens, thinkingTokens)
- **userId проброс** через все pipeline chains (briefing, podcast, meeting, deep-research)
- **Фикс Deepgram modelId** — UUID → `"deepgram-nova-3"`

**Ключевые файлы:**
- `lib/ai/usage-utils.ts` — extractUsageFields(), logUsage()
- ~28 файлов с добавлением logUsage()

**Детали:** [specs/TZ_CACHE2_UnifiedUsageLogging/](specs/TZ_CACHE2_UnifiedUsageLogging/)



**Выполнено:**
- **Таблица `ai_usage_log`** — 13 колонок (modelId, 5 token counters, costUsd numeric(10,6), chatMode, durationMs), 2 индекса, chatId nullable FK
- **`saveAiUsageLog()`** — fire-and-forget функция, никогда не блокирует стриминг
- **Интеграция в 3 эндпоинта**: chat/route.ts (основной + expertise + create), task-chat/route.ts (проекты), professor-pipeline.ts (3 фазы)
- **Миграция Sonnet 4.5 → 4.6** — `claude-sonnet-4-5-20250929` → `claude-sonnet-4-6` в providers.ts (3 алиаса)

**Ключевые файлы:**
- `lib/db/schema.ts` — таблица `aiUsageLog`
- `lib/db/queries.ts` — `saveAiUsageLog()`
- `lib/db/migrations/0038_ai-usage-log.sql` — миграция
- `lib/ai/providers.ts` — Sonnet 4.6
- `app/(chat)/api/chat/route.ts` — usage logging
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — usage logging
- `lib/ai/professor-pipeline.ts` — usage logging (3 фазы)

**Детали:** [specs/TZ_OPT1_UsageAndMigration/](specs/TZ_OPT1_UsageAndMigration/)

### ТЗ-Б2: PodcastUI — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Podcast Generation UI** — кнопка «Создать подкаст» с Popover (выбор тем), потоковый full-screen прогресс с per-topic статусами
- **Podcast Player** — Apple-level плеер: artwork, контролы (⏮ -15 ▶/❚❚ +15 ⏭), прогресс-бар, speed pills, скачивание MP3
- **Mode Toggle** — сегментированная кнопка [Читать | Слушать] в header брифинга
- **Sidebar Tracklist** — навигация по трекам, MiniEqualizer для текущего, синхронизация с плеером
- **Edge Cases** — partial state (failed topics gray + retry), outdated banner/warning dot, 44px mobile touch targets
- **Auto-transition** — автопереключение на «Слушать» после генерации

**Ключевые файлы:**
- `hooks/use-podcast-generation.ts` — streaming generation hook
- `hooks/use-podcast-player.ts` — player hook (Audio management)
- `components/briefing/podcast-player.tsx` — full-screen плеер
- `components/briefing/podcast-progress.tsx` — full-screen прогресс
- `components/briefing/podcast-button.tsx` — кнопка генерации
- `components/briefing/podcast-sidebar.tsx` — sidebar треклист
- `components/briefing/briefing-mode-toggle.tsx` — [Читать | Слушать]

**Детали:** [specs/TZ_B2_PodcastUI/](specs/TZ_B2_PodcastUI/)

### ТЗ-Б1: PodcastEngine — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Podcast Engine модуль** — `lib/podcast/`: полный pipeline генерации подкастов из брифингов
- **Script Generator** — Gemini 2.5 Flash (`@ai-sdk/google`): генерация диалогового сценария (Host/Expert) из секции брифинга
- **TTS** — Gemini 2.5 Flash TTS (`@google/genai`): нативный multi-speaker (Host → Kore, Expert → Puck), PCM 24kHz mono
- **Audio Converter** — PCM → MP3 через lamejs (CJS/ESM workaround через `new Function()`)
- **Streaming API** — `POST /api/briefing/podcast/generate`: p-limit(2), JSON Lines прогресс, Blob upload, DB update
- **DB расширение** — 3 колонки в briefingHistory: audioUrls, audioStatus, audioDurations
- **Outdated hook** — при refresh-section audioStatus → 'outdated'

**Ключевые файлы:**
- `lib/podcast/index.ts` — public API (generatePodcastSegment)
- `lib/podcast/script-generator.ts` — Gemini Flash скрипт
- `lib/podcast/tts-gemini.ts` — Gemini TTS озвучка
- `lib/podcast/audio-converter.ts` — PCM → MP3
- `lib/podcast/types.ts` — TypeScript типы
- `app/(chat)/api/briefing/podcast/generate/route.ts` — streaming endpoint
- `lib/prompts/briefing/briefing-scriptwriter.md` — промпт скриптрайтера
- `lib/db/queries.ts` — +updateBriefingAudio(), расширен deleteOldBriefingHistory

**Детали:** [specs/TZ_B1_PodcastEngine/](specs/TZ_B1_PodcastEngine/)

### ТЗ-BF4: PerSectionRefresh — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Кнопка ↻ на каждой секции** — RefreshCw icon (animate-spin при загрузке) между Copy и Bookmark с Radix UI Tooltip
- **Section Author** — `briefing-section-author.ts`: генерация одной секции (Claude Sonnet) с контекстом остальных тем
- **POST API** — `/api/briefing/refresh-section`: fetch sources → filter → generate → JSONB patch DB → return section
- **`updateBriefingSection()`** — JSONB patch в queries.ts (замена секции, пересчёт meta)
- **Content-based bookmark matching** — после refresh bookmark auto-reset, старый save в sidebar, новый добавляется отдельно
- **Tooltip унификация** — все icon-кнопки переведены на Radix UI Tooltip, раздел 6 в design-system.md

**Ключевые файлы:**
- `lib/briefing/briefing-section-author.ts` — генерация одной секции
- `app/(chat)/api/briefing/refresh-section/route.ts` — POST API endpoint
- `lib/db/queries.ts` — +updateBriefingSection()
- `components/briefing/briefing-article-view.tsx` — кнопка ↻ + Tooltip унификация
- `components/briefing/briefing-page-client.tsx` — article state + handleRefreshSection
- `components/briefing/briefing-issue-content.tsx` — props threading
- `docs/design-system.md` — +раздел 6 «Tooltip»

**Детали:** [_archive/TZ_BF4_PerSectionRefresh/](_archive/TZ_BF4_PerSectionRefresh/)

### ТЗ-BF2: SimplyNews — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Simply News контент** — markdown-файлы с frontmatter (`simply-news.md`, `simply-overview.md`) + regex-парсер
- **Секция «Simply» в sidebar** — «📋 Обзор платформы» (всегда), «🆕 Что нового» (при hasUpdate) с unread-индикатором (жирный шрифт + точка)
- **SimplyContentView** — просмотр Simply-контента в article reader (паттерн SavedTopicView)
- **Индикатор непрочитанного** — на дашборде «1 новое» (только для активных пользователей), в sidebar — font-semibold + dot
- **PATCH API** — `/api/briefing/simply-news/seen` для отметки просмотра
- **Инъекция в генерацию** — simply-news как последняя секция брифинга (topicId: `simply_news`, emoji: 🔔)
- **Лендинг** — неактивные пользователи видят «Что нового» на странице онбординга
- **DB миграция 0036** — поле `lastSeenSimplyVersion` в таблице `User`
- **Scroll fix** — sidebar фиксирован, контент скроллится независимо (`h-svh overflow-hidden`)
- **Подкаст-кнопка** — перенесена из контентной области в header (bg-primary, disabled)

**Ключевые файлы:**
- `lib/briefing/simply-news.md` — контент «Что нового» (frontmatter)
- `lib/briefing/simply-overview.md` — контент обзора платформы
- `lib/briefing/simply-news-utils.ts` — парсер frontmatter + утилиты
- `app/(chat)/api/briefing/simply-news/seen/route.ts` — PATCH API
- `lib/db/schema.ts` — +lastSeenSimplyVersion в User
- `lib/db/queries.ts` — +updateLastSeenSimplyVersion
- `components/briefing/briefing-sidebar.tsx` — +секция Simply, +unread indicator
- `components/briefing/briefing-article-view.tsx` — +SimplyContentView
- `components/briefing/briefing-page-client.tsx` — +SimplyData, +state management
- `components/briefing/briefing-issue-header.tsx` — +кнопка подкаста

**Детали:** [_archive/TZ_BF2_SimplyNews/](_archive/TZ_BF2_SimplyNews/)

### ТЗ-BF1: Briefing UI Refactor — ✅ ЗАВЕРШЁН

**Выполнено:**
- **SavedBriefingTopics** — новая таблица + CRUD API + TTL-логика при генерации
- **Bookmark кнопка** — на каждой секции статьи (save/delete тему + toast)
- **Copy кнопка** — копирование текста секции в буфер обмена
- **Sidebar рефакторинг** — "Текущий выпуск" + "Сохранённые" (группировка по брифингу с датой+временем)
- **SavedTopicView** — просмотр сохранённой темы в main area (← Назад, markdown, sources, удалить)
- **AlertDialog** — подтверждение при генерации нового брифинга
- **Markdown links** — открываются в новой вкладке (`target="_blank"`)
- **Удалён `/briefing/[date]`** — маршрут мёртвый из-за TTL
- **Удалён `getBriefingByDate()`** — query больше не используется

**Ключевые файлы:**
- `lib/db/schema.ts` — +таблица SavedBriefingTopics
- `lib/db/queries.ts` — +saveBriefingTopic, getSavedBriefingTopics, deleteSavedBriefingTopic, deleteOldBriefingHistory
- `app/(chat)/api/briefing/topics/save/route.ts` — POST/DELETE API
- `app/(chat)/api/briefing/topics/saved/route.ts` — GET API
- `components/briefing/briefing-sidebar.tsx` — рефакторинг (saved topics grouped by briefing)
- `components/briefing/briefing-article-view.tsx` — +Bookmark, +Copy, +SavedTopicView
- `components/briefing/briefing-page-client.tsx` — lifted state (savedTopics, selectedSavedTopic)
- `components/markdown-viewer.tsx` — links open in new tab

**Детали:** [_archive/TZ_BF1_BriefingUIRefactor/](_archive/TZ_BF1_BriefingUIRefactor/)

### ТЗ-BRIEFING-AUTHOR-CLAUDE: Briefing Author → Claude — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Briefing Author** — провайдер заменён с Gemini 3 Pro на Claude Sonnet 4.6. Fallback: `claude-sonnet-4-5-20250929`
- **Adaptive thinking (effort)** — настроен для 3 точек: briefing-onboarding (`high`), профессор планирования (`high`), ревьюер задач (`high`)
- **Результат:** outputTokens 5104 → 10163 (+99%), качество статей значительно выше

**Ключевые файлы:**
- `lib/briefing/briefing-config.ts` — AUTHOR_MODEL → claude-sonnet-4-6
- `lib/briefing/briefing-author.ts` — createAnthropic вместо createGoogleGenerativeAI
- `app/(chat)/api/service-chat/route.ts` — providerOptions для онбординга
- `app/(chat)/api/projects/[id]/plan/route.ts` — providerOptions для профессора
- `lib/ai/professors/task-reviewer.ts` — providerOptions для ревьюера

**Детали:** [specs/TZ_BRIEFING_AUTHOR_CLAUDE/](specs/TZ_BRIEFING_AUTHOR_CLAUDE/)

### ТЗ-HF1: Briefing PE Update — ✅ ЗАВЕРШЁН

**Выполнено:**
- **briefingStyle** — новое поле в `BriefingTopics` (text, nullable) для персонализированных инструкций автору
- **Промпты обновлены** — onboarding v6 (обязательная верификация fetchUrl, приоритет тем), author v3 (приоритет тем, крупные события)
- **maxSteps: 30** — увеличен лимит tool-шагов для поддержки параллельных fetchUrl
- **Edit mode** — briefingStyle отображается в preview и передаётся в контекст
- **Sidebar history fix** — `getBriefingHistory()` фильтрует по `status='ready'` в SQL

**Ключевые файлы:**
- `lib/db/schema.ts` — +briefingStyle
- `lib/db/queries.ts` — обновлён addBriefingTopic, getBriefingHistory (status filter)
- `app/(chat)/api/service-chat/route.ts` — Zod schema, saveBriefingProfile, maxSteps
- `lib/prompts/service-chats/briefing-onboarding.md` — v6
- `lib/prompts/briefing/briefing-author.md` — v3

**Детали:** [_archive/TZ_HF1_BriefingSetupUpdate/](_archive/TZ_HF1_BriefingSetupUpdate/)

### ТЗ-А5: Briefing Generation Progress — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Streaming progress** — `POST /api/briefing/generate` конвертирован из `Response.json()` в `ReadableStream` (JSON Lines, `application/x-ndjson`)
- **4 шага pipeline** — подключение → сбор новостей → фильтрация → написание статьи, с реальными данными от сервера
- **useBriefingGeneration** — custom hook (streaming fetch + parse + state + AbortController)
- **BriefingGenerationProgress** — компонент с framer-motion анимацией, emoji-иконками, error state с retry
- **BriefingPageClient** — клиентская обёртка для управления состоянием генерации на /briefing
- **Централизация триггеров** — sidebar, NoBriefingsYet, setup success card используют единый хук
- **Авто-перезагрузка** — `window.location.href` после завершения генерации

**Ключевые файлы:**
- `hooks/use-briefing-generation.ts` — custom hook (streaming fetch + parse)
- `components/briefing/briefing-generation-progress.tsx` — UI прогресса
- `components/briefing/briefing-page-client.tsx` — клиентская обёртка /briefing
- `app/(chat)/api/briefing/generate/route.ts` — streaming endpoint
- `lib/briefing/briefing-types.ts` — +BriefingProgressStep/Event типы

**Детали:** [_archive/TZ_A5_BriefingProgress/](_archive/TZ_A5_BriefingProgress/)

### ТЗ-А4: Briefing Issue Page — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Страница выпуска** — полноценный article reader (intro, sections с MarkdownViewer + Collapsible sources, outro, meta)
- **Sidebar** — навигация по темам с active state (IntersectionObserver scroll spy), кнопка генерации
- **Responsive** — Sheet sidebar на мобильных, гамбургер-кнопка в header
- **Graceful fallback** — старый формат выпусков показывает сообщение вместо ошибки
- **Cleanup** — удалён устаревший `briefing-active-page.tsx`
- ~~`/briefing/[date]`~~ — удалён в v3.39.0 (ТЗ-BF1, TTL делает маршрут мёртвым)
- ~~`getBriefingByDate()`~~ — удалён в v3.39.0 (ТЗ-BF1)

**Ключевые файлы:**
- `components/briefing/briefing-issue-header.tsx` — header (title, ← Dashboard, ⚙️, UserMenu, mobileTrigger)
- `components/briefing/briefing-article-view.tsx` — рендер статьи + IntersectionObserver scroll spy + Bookmark + Copy + SavedTopicView
- `components/briefing/briefing-sidebar.tsx` — sidebar (topic nav, saved topics, generate, settings) + mobile Sheet
- `components/briefing/briefing-issue-content.tsx` — клиентская обёртка (activeSectionId state)
- `components/briefing/briefing-player-placeholder.tsx` — sticky заглушка плеера
- `components/briefing/briefing-source-card.tsx` — карточка источника (tier badges)
- `app/(dashboard)/briefing/page.tsx` — обновлён (двухколоночный layout + saved topics loading)

### ТЗ-PX + ТЗ-FU: Deep Research + Fetch URL — ✅ ЗАВЕРШЁН

**Выполнено:**
- **deepResearch** — глубокое исследование через Perplexity Sonar API. Два режима: Pro (sonar-pro, ~$0.02) и Deep (sonar-deep-research, ~$0.80). Factory-pattern с `defaultDepth` через замыкание
- **fetchUrl** — чтение веб-страниц по URL (@mozilla/readability + jsdom). Shared utility `fetch-page.ts`
- **chatMode-фильтрация** — fetchUrl и deepResearch исключены для chatMode='chat' (Haiku) через `CHAT_MODE_EXCLUDED_TOOLS`
- **Dev-mode toggle** — переключатель 🔬 Auto/Pro/Deep в toolbar + server-side depth emission через dataStream
- **webSearch description** — дифференциация с deepResearch

**Ключевые файлы:**
- `lib/ai/tools/deep-research.ts` — deepResearch tool (factory pattern, Perplexity API)
- `lib/ai/tools/fetch-url.ts` — fetchUrl tool (Readability + JSDOM)
- `lib/ai/tools/fetch-page.ts` — shared utility для чтения веб-страниц
- `lib/ai/tools/chat-tools.ts` — регистрация + chatMode-фильтрация
- `lib/ai/tool-activity-config.ts` — UI конфиг (deepResearch + fetchUrl)
- `components/multimodal-input.tsx` — dev-mode toggle (🔬 Auto/Pro/Deep)
- `components/message.tsx` — dev-mode depth display from dataStream

**Детали:** [_archive/TZ_PX_DeepResearch/](_archive/TZ_PX_DeepResearch/)

### ТЗ-A1: Briefing Landing — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Лендинг /briefing** — продающая страница (hero, демо выпуска, CTA "Настроить мой брифинг")
- **Заглушка /briefing/setup** — страница "Скоро" (для ТЗ-А2)
- **Очистка** — удалены 5 старых UI-компонентов JSON-карточек (content, block, item, empty, generate-button)
- **Адаптация** — briefing-header упрощён, briefing-page переписан в лендинг

**Ключевые файлы:**
- `components/briefing/briefing-page.tsx` — лендинг (hero + демо + CTA)
- `components/briefing/briefing-header.tsx` — header (← Dashboard, заголовок, UserMenu)
- `components/briefing/briefing-card.tsx` — карточка на дашборде (без изменений)
- `app/(dashboard)/briefing/page.tsx` — страница /briefing (auth guard, лендинг)
- `app/(dashboard)/briefing/setup/page.tsx` — заглушка

**Детали:** [_archive/TZ_A1_BriefingLanding/](_archive/TZ_A1_BriefingLanding/)

### ТЗ-BR2: Briefing UI — ✅ ЗАВЕРШЁН

**Выполнено:**
- **BriefingCard** — карточка на /dashboard в секции "Инструменты" (3 состояния: пустое/готов/генерируется)
- **GET /api/briefing/latest** — endpoint для получения последнего брифинга
- **briefing-types.ts** — shared TypeScript types (client-safe)

**Ключевые файлы:**
- `lib/briefing/briefing-types.ts` — shared types (BriefingArticle, BriefingArticleSection, BriefingArticleSource, BriefingArticleMeta)
- `components/briefing/briefing-card.tsx` — карточка на дашборде
- `components/glavnaya/tools-section.tsx` — секция "Инструменты" на дашборде
- `app/(chat)/api/briefing/latest/route.ts` — GET API

**Детали:** [_archive/TZ_BR2_BriefingUI/](_archive/TZ_BR2_BriefingUI/)

### ТЗ-BR1: Morning Briefing Backend — ✅ ЗАВЕРШЁН

**Выполнено:**
- **3 таблицы в БД** — BriefingSettings, BriefingSources, BriefingHistory (Drizzle ORM, миграция 0031)
- **Конфигурация + Каталог тем** — `lib/briefing/briefing-config.ts`, `lib/briefing/topics-catalog.ts` (10 тем × 3-4 источника)
- **3 фетчера** — RSS (rss-parser), Telegram (cheerio t.me/s/), Web (@mozilla/readability + jsdom) с единым dispatcher
- **AI-пайплайн** — двухэтапный: Gemini 2.0 Flash (фильтрация, дедупликация) → Claude Sonnet 4.6 (генерация статьи) ← обновлено в v3.38.0
- **API endpoint** — `POST /api/briefing/generate` (auth, fetch, filter, analyze, save)
- **Seed-скрипт** — `lib/db/seed-briefing.ts` + `npm run db:seed-briefing`
- **7 CRUD queries** — полный набор для briefing settings, sources, history

**Ключевые файлы:**
- `lib/db/schema.ts` — +3 таблицы (briefingSettings, briefingSources, briefingHistory)
- `lib/db/queries.ts` — +7 CRUD queries
- `lib/briefing/briefing-config.ts` — константы (лимиты, таймауты, модели)
- `lib/briefing/topics-catalog.ts` — каталог тем с RSS
- `lib/briefing/source-fetchers/` — 5 файлов (types, rss, telegram, web, index)
- `lib/briefing/briefing-filter.ts` — AI фильтр (Gemini Flash)
- `lib/briefing/briefing-author.ts` — AI автор статьи (Gemini 3 Pro, generateArticle → BriefingArticle)
- `app/(chat)/api/briefing/generate/route.ts` — API endpoint
- `lib/db/seed-briefing.ts` — seed-скрипт

**Детали:** [_archive/TZ_BR1_BriefingBackend/](_archive/TZ_BR1_BriefingBackend/)

### ТЗ-RG: Route Groups — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Route Groups** — три режима чатов (chat/expertise/create) получили отдельные URL: `/chat/[id]`, `/expertise/[id]`, `/create/[id]`
- **`getChatUrl()`** — утилита формирования URL чатов по chatMode, замена всех хардкодов `/chat/${id}`
- **Mode-aware sidebar** — заголовок ("Чаты"/"Запросы"/"Задания"), кнопка создания, ссылка "Все..." адаптируются к текущему режиму
- **History API фильтрация** — `?chatMode=` параметр в `/api/history`, `getChatsByUserId()` фильтрует по chatMode
- **Redirect** — `/chat/[id]` для expertise/create чатов автоматически редиректит на правильный route group
- **Server-side auto-naming** — генерация title+summary перенесена с клиента на сервер (устранение race condition)
- **SWR cache** — mode-aware pagination keys для корректной инвалидации кэша sidebar

**Ключевые файлы:**
- `lib/utils.ts` — `getChatUrl()` утилита
- `app/(expertise)/layout.tsx` + `app/(expertise)/expertise/[id]/page.tsx` — route group экспертиза
- `app/(create)/layout.tsx` + `app/(create)/create/[id]/page.tsx` — route group создание
- `components/app-sidebar.tsx` — `getSidebarContext()`, mode-aware навигация
- `components/sidebar-history.tsx` — `makeChatHistoryPaginationKey()` factory
- `app/(chat)/api/history/route.ts` — `?chatMode=` параметр
- `lib/db/queries.ts` — `getChatsByUserId({ chatMode })`

**Детали:** [_archive/TZ_RG_RouteGroups/](_archive/TZ_RG_RouteGroups/)

### ТЗ-DV2: Dashboard V2 — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Удаление помощников** — полностью убрана экосистема helpers (код, UI, API, DB)
- **chatMode** — новое поле в Chat (chat/expertise/create), модель определяется на сервере по режиму
- **Три режима чатов** — chat (Haiku), expertise (Sonnet), create (Sonnet) с отдельными composer-функциями и tools-конфигурацией
- **Дашборд: 3 карточки** — Экспертиза (🔍), Создать (✨), Проекты (📁) вместо ProjectsSection и HelpersSection
- **ListDetailPage** — универсальный composition layout-shell для двухколоночных страниц (список + детали)
- **`/expertise`** и **`/create`** — новые страницы с фильтрацией чатов по chatMode
- **`/projects`** — рефакторинг на ListDetailPage (project-list-item + project-detail-panel)
- **`/chats`** — рефакторинг на ListDetailPage, фильтрация только chatMode='chat'
- **chatMode badges** — 🔍/✨ рядом с названием чата в sidebar и списках чатов
- **Убран селектор модели** — модель определяется по chatMode, нет UI выбора
- **DB cleanup** — удалена таблица Helper и колонка helperId из Chat (миграция 0030)

**Ключевые файлы:**
- `lib/ai/chat-mode-config.ts` — конфигурация режимов
- `components/list-detail/list-detail-page.tsx` — универсальный layout
- `components/glavnaya/mode-cards-section.tsx` — 3 карточки на дашборде
- `components/chats/mode-chats-page.tsx` — shared компонент для /expertise, /create
- `components/projects/projects-page-content.tsx` — /projects на ListDetailPage
- `app/(dashboard)/expertise/page.tsx` — страница экспертиз
- `app/(dashboard)/create/page.tsx` — страница создания

**Детали:** [_archive/TZ_DV2_DashboardV2/](_archive/TZ_DV2_DashboardV2/)

### ТЗ-C3: Chat Context Management — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Context Management для обычного чата** — портирование snapshot-системы из проектного чата (ТЗ-C1.5) в универсальный чат
- **Snapshot-aware message trimming** — автоматическая обрезка старых сообщений при наличии snapshot
- **ContextIndicator** — индикатор заполненности контекста над инпутом (3 цвета: зелёный/жёлтый/красный)
- **ChatSidebar "Итоги"** — секция snapshots в правом сайдбаре с навигацией к сообщению
- **Fallback clerk** — автоматическое создание snapshot при игнорировании предложения AI
- **Tool Activity для createDocument/updateDocument** — устранение 10-30 сек пустоты при создании документов
- **Файловые имена** — корректное отображение оригинальных имён файлов вместо "file"
- **XLSM/CSV upload** — поддержка загрузки Excel с макросами и CSV
- **Auto-scroll fix** — чат корректно скроллится при открытом артефакте

**Ключевые файлы:**
- `app/(chat)/api/chat/route.ts` — snapshot loading, trimming, context injection, fallback
- `components/chat.tsx` — ContextIndicator + context percent state
- `components/chat-sidebar.tsx` — секция "Итоги" (snapshots)
- `lib/ai/tool-activity-config.ts` — createDocument/updateDocument configs
- `components/message.tsx` — loading states для document tools + file naming fix

**Детали:** [_archive/TZ_C3_ChatContext/](_archive/TZ_C3_ChatContext/)

### ТЗ-C4: Anthropic Provider Switch — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Полное переключение AI-провайдера** — все AI-модели переведены с Google Gemini на Anthropic Claude через `@ai-sdk/anthropic` (прямое подключение, без OpenRouter)
- **Три модели Claude** — Sonnet (`claude-sonnet-4-6`), Haiku (`claude-haiku-4-5-20251001`), Opus (`claude-opus-4-6`)
- **~28 файлов обновлены** — providers, routes, pipeline, clerks, professors, UI components, configs
- **Tool schema fix** — `getWeather` tool: `z.union()` → `z.object()` с optional полями (Claude API требует `type: "object"` в input_schema)
- **vision-ocr.ts** — намеренно оставлен на Google Gemini (отдельный `createGoogleGenerativeAI` экземпляр)
- **`@ai-sdk/anthropic@2.0.63`** — не v3.x, т.к. `LanguageModelV3` несовместим с `ai@5.0.123` (LanguageModelV2)

**Маппинг моделей:**
| Было (Gemini) | Стало (Claude) | Где используется |
|---------------|----------------|-----------------|
| `gemini-3-pro` | `claude-sonnet` | Основной чат, Секретарь, Эксперт |
| `gemini-2.5-flash` | `claude-haiku` | Бен, Менеджер, Клерки |
| — | `claude-opus` | Профессоры (планирование, ревью) |

**Пост-тестирование (v3.23.0):**
- **`sanitizeCoreMessages()`** — 4-проходная санитизация CoreMessage[] для Anthropic API: удаление orphan tool-calls (без tool_result), orphan tool-results (без tool-call), пустых сообщений. Применяется в обоих chat routes
- **Фикс двойного аватара** — удалено условие `&& isLoading` в `message.tsx`, пустые assistant-сообщения скрываются всегда
- **Фикс сохранения пустых сообщений** — `onFinish` в обоих routes фильтрует assistant-сообщения без текста/tools перед `saveMessages()`
- **Dev Mode** — `SIMPLY_DEV_MODE=true`: badge модели в чате + prompt injection, промпт `lib/prompts/core/dev-mode.md`
- **Переписаны core промпты** — base.md, safety.md, formatting.md, russian-market.md адаптированы под Claude

**Ключевые файлы:**
- `lib/ai/providers.ts` — полная перезапись (createAnthropic + customProvider)
- `lib/prompts/types.ts` — ModelId: `'claude-haiku' | 'claude-sonnet' | 'claude-opus'`
- `lib/ai/models.ts` — UI-список моделей (3 модели Claude)
- `lib/ai/model-tiers.ts` — executor=haiku, expert=sonnet, professor=opus
- `lib/ai/professor-pipeline.ts` — analyze/synthesize=opus, execute=haiku
- `app/(chat)/api/chat/route.ts` — удалён providerOptions, включён convertTextFilePartsInMessage
- `lib/ai/tools/get-weather.ts` — fix z.union() → z.object() для Claude API

**Детали:** [_archive/TZ_C4_AnthropicProvider/](_archive/TZ_C4_AnthropicProvider/)

### ТЗ-08CS: Chat Sidebar + RightSidebar — ✅ ЗАВЕРШЁН

**Выполнено:**
- **RightSidebar** (`components/right-sidebar.tsx`) — унифицированный правый сайдбар-shell. Desktop: fixed push-panel (bg-sidebar, inset-y-0, duration-200). Mobile: Sheet overlay. Готов к переиспользованию в проектах/помощниках
- **ChatSidebar** (`components/chat-sidebar.tsx`) — панель материалов чата (артефакты + вложения), scroll-to-message навигация, скачивание
- **Push-layout** — правый сайдбар сдвигает контент (`md:mr-[380px]`), авто-закрытие: открытие одного закрывает другой
- **Визуальная унификация** — оба сайдбара (левый + правый) используют единые sidebar-токены: bg-sidebar, bg-sidebar-accent, text-sidebar-foreground, border-sidebar-border
- **Design System обновлён** — `docs/design-system.md`: зарегистрированы RightSidebar, ChatSidebar, sidebar-токены

**Ключевые файлы:**
- `components/right-sidebar.tsx` — переиспользуемый shell (Sheet mobile + fixed desktop)
- `components/chat-sidebar.tsx` — материалы чата (артефакты + вложения)
- `components/chat-header.tsx` — кнопка PanelRight (toggle)
- `components/chat.tsx` — state + push-layout + авто-закрытие
- `components/message.tsx` — id для scroll targeting
- `app/globals.css` — sidebar-highlight анимация

**Детали:** [_archive/TZ_08_ChatSidebar/](_archive/TZ_08_ChatSidebar/)

### ТЗ-07: Tool Activity UX + Sidebar Icon Mode — ✅ ЗАВЕРШЁН

**Выполнено:**
- **ToolActivityIndicator** — компактные индикаторы активности инструментов (webSearch, parseExcel, readProjectFile) с группировкой параллельных вызовов
- **Backend data-tool-activity** — перехват `tool-input-start` в chat + task expert routes, отправка через dataStream
- **Группировка** — параллельные вызовы одного инструмента объединяются: бейдж ×N, агрегированный summary, раскрываемые детали
- **Sidebar Icon Mode** — `collapsible="icon"` вместо `collapsible="offcanvas"` (паттерн Claude/Anthropic)
- **Sidebar навигация** — SidebarMenuButton с tooltip: Главная, Новый чат, Все чаты (иконки видны в свёрнутом режиме)
- **Chat history скрыта в icon mode** — при свёртке видны только иконки навигации + avatar (как у Claude)
- **Sidebar offset fix** — `SIDEBAR_LEFT_OFFSET = "0"` (убран offset для удалённой tab-панели)
- **Chat header упрощён** — убраны breadcrumbs "Главная" (навигация в sidebar), оставлены контекстные breadcrumbs проектов/помощников

**Ключевые файлы:**
- `lib/ai/tool-activity-config.ts` — конфиг инструментов (icon, labels, formatters, resultCounter)
- `components/tool-activity-indicator.tsx` — UI компонент (спиннер/галочка, ×N бейдж, детали)
- `components/message.tsx` — `groupedToolActivities` useMemo (единый источник данных)
- `components/app-sidebar.tsx` — icon mode, навигация, скрытие истории
- `components/chat-header.tsx` — упрощённый header
- `components/sidebar-history-item.tsx` — tooltip для чатов в icon mode
- `app/(chat)/api/chat/route.ts` — backend data-tool-activity events
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично для task expert

**Детали:** [_archive/TZ_07_ToolActivity/](_archive/TZ_07_ToolActivity/)

### ТЗ-DS: Simply Design System — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Дизайн-система** — `docs/design-system.md` — файл-закон для всех UI-компонентов (ADR-013)
- **Шрифты** — Source Sans 3 (sans), Lora (serif для заголовков), JetBrains Mono (mono) через next/font/google
- **Тёплая палитра** — light `#FAF9F5`, dark `#1C1B19`, primary терракот, мягкие тени
- **Семантические токены** — 50+ замен hardcoded цветов (gray/zinc/slate/stone/neutral/blue → muted/foreground/primary/accent/border)
- **Hover unification** — единый паттерн для карточек (hover:border-primary) и sidebar items (rounded-lg + bg-muted)
- **Удалён пакет geist** — полностью заменён новыми шрифтами

**Ключевые файлы:**
- `docs/design-system.md` — дизайн-система (закон)
- `app/fonts.ts` — шрифты
- `app/globals.css` — CSS токены, @theme
- `app/layout.tsx` — подключение шрифтов

**Детали:** [_archive/TZ_DesignSystem/](_archive/TZ_DesignSystem/)

### ТЗ-C1.5: Context Window Management — ✅ ЗАВЕРШЁН (обновлено v3.73.0)

**Обновление v3.73.0:** Snapshot-система теперь используется только для Haiku-чатов (`chatMode="chat"`). Sonnet/Opus routes используют Anthropic Compaction API (см. ТЗ-RAG3).

**Выполнено:**
- **Автоматическое управление контекстом** — snapshot-система для сжатия истории чата (только Haiku) при заполнении контекстного окна
- **`createSnapshot` tool** — Эксперт создаёт структурированный итог диалога (shortSummary + fullMarkdown из 6 параметров)
- **Snapshot-aware trimming** — после snapshot модель видит только snapshot + новые сообщения
- **Usage monitoring** — оценка использования контекста до стриминга, annotation `data-context-usage`
- **Системный сигнал** — при ≥70% контекста Эксперт получает инструкцию предложить snapshot
- **Fallback-клерк** — `snapshot-creator.ts` автоматически создаёт snapshot если Эксперт игнорирует 5 пар сообщений после порога
- **SnapshotCard** — expand/collapse карточка с секциями (Решения, Состояние, Артефакты, Вопросы, Шаги)
- **SnapshotDivider** — визуальный разделитель "Контекст обновлён" / "Контекст сжат"
- **Message dimming** — сообщения до snapshot приглушены (opacity-50)
- **ContextIndicator** — тонкий progress bar над input (3 цвета по уровню заполнения)

**DB поля добавлены:**
- `Chat.snapshots` (jsonb[]) — метаданные snapshot'ов (messageId, createdAt, summary)
- `Chat.contextState` (jsonb) — состояние системы (suggestionActive, messagesSinceSuggestion)

**DB queries добавлены:**
- `addChatSnapshot()`, `getChatWithSnapshotState()`, `updateChatContextState()`, `resetChatContextState()`

**Ключевые файлы:**
- `lib/ai/context-limits.ts` — конфиг бюджетов
- `lib/ai/tools/create-snapshot.ts` — tool createSnapshot
- `lib/ai/clerks/snapshot-creator.ts` — fallback-клерк
- `lib/prompts/clerks/snapshot-creator.md` — промпт клерка
- `components/projects/snapshot-card.tsx` — SnapshotCard + SnapshotDivider
- `components/projects/context-indicator.tsx` — ContextIndicator

**Детали:** [_archive/TZ_C1_5_ContextManagement/](_archive/TZ_C1_5_ContextManagement/)

### ТЗ-C2: TaskCompletion — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Завершение задач** — полный flow: кнопка «Завершить задачу» → суммаризация (Claude Haiku) → ревью Профессором (Claude Opus) → карточка результата
- **Три типа карточек** — success (задача принята), issues (замечания, можно доработать/принять), critical (замечания, только доработка)
- **API endpoints** — `POST .../complete` (summarize → review → save), `POST .../reopen` (issues → in_progress), `POST .../accept` (issues → done + unlock)
- **Разблокировка зависимых** — при завершении задачи автоматически разблокируются все зависимые задачи (locked → pending), если ВСЕ их зависимости done
- **Project completion** — при завершении последней задачи проект переходит в phase='completed'
- **CompletedState** — полноценная реализация: список завершённых задач с ссылками, счётчик, трофей
- **readProjectFile tool** — инструмент Эксперта для чтения файлов проекта по имени из manifest (текст + fallback по расширению, бинарные → описание)
- **Sidebar revalidation** — `router.refresh()` после завершения задачи обновляет TaskSidebar
- **AI-суммаризатор** — `summarizeTask()`: загрузка промпта, generateText (Flash), Zod-парсинг, fallback
- **AI-ревьюер** — `reviewTask()`: загрузка промпта, generateText (Pro), XML-парсинг + Zod-валидация, fallback → approved

**DB queries добавлены:**
- `completeTask({ taskId, projectId, outputSummary, professorVerdict })` — статус → done/issues, сохранение результатов, разблокировка зависимых, проверка project completion
- `reopenTask({ taskId })` — status issues → in_progress
- `acceptTask({ taskId, projectId })` — status issues → done + разблокировка зависимых
- `getProjectFileByName({ projectId, name })` — поиск файла по имени

**API endpoints добавлены:**
- `POST /api/projects/[id]/tasks/[taskId]/complete` — завершение задачи
- `POST /api/projects/[id]/tasks/[taskId]/reopen` — доработка
- `POST /api/projects/[id]/tasks/[taskId]/accept` — принятие с замечаниями

**Ключевые файлы:**
- `lib/ai/task-completion-types.ts` — Zod-схемы + TypeScript типы
- `lib/ai/clerks/task-summarizer.ts` — суммаризатор
- `lib/ai/professors/task-reviewer.ts` — ревьюер
- `lib/prompts/clerks/task-summarizer.md` — промпт суммаризатора
- `lib/prompts/professors/task-review.md` — промпт ревьюера
- `lib/ai/tools/read-project-file.ts` — tool readProjectFile
- `components/projects/task-completion-card.tsx` — карточка результата
- `components/projects/phase-states/completed-state.tsx` — фаза completed

**Детали:** [_archive/TZ_C2_TaskCompletion/](_archive/TZ_C2_TaskCompletion/)

### ТЗ-C1: ExpertTaskChat — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Route group `app/(task)/`** — отдельная от `(chat)`, layout без AppSidebar но с SidebarProvider (для артефактов)
- **Чат с Экспертом (TaskChat)** — полноценный AI-диалог для каждой ProjectTask: streaming, артефакты (canvas), shared tools, голосовой ввод
- **Auto-trigger** — Эксперт начинает первым при открытии новой задачи (`[SYSTEM: Задача открыта. Начни работу.]`)
- **TaskSidebar** — навигация между задачами проекта (иконки 6 статусов, сворачивание, «← К проекту»)
- **Expert Prompt** — `task-expert.md` + `buildTaskExpertPrompt()` с контекстом проекта, задачи и outputSummary завершённых задач
- **Shared Tools** — `chat-tools.ts` — фабричная функция `getStandardTools({ session, dataStream, isProjectChat })`, рефакторинг inline tools из `chat/route.ts`
- **Phase transition** — автопереход `approved → execution` при первом открытии задачи (server-side в page.tsx)
- **Навигация из проекта** — клик по карточке задачи в Пульсе и ApprovedState → `router.push()` к чату
- **AlertDialog для locked задач** — Controlled state в ProjectPulse и ApprovedState: предупреждение о зависимостях, разблокировка по подтверждению
- **Unlock API** — `POST /api/projects/[id]/tasks/[taskId]/unlock` (auth + ownership guard + status guard + unlockTask)

**Архитектурные решения:**
- Route group `(task)` — изолированный layout без AppSidebar, но с SidebarProvider для Artifact useSidebar context
- `DefaultChatTransport` — custom API path `/api/projects/${projectId}/tasks/${taskId}/chat`
- Модель через env: `process.env.EXPERT_MODEL || 'claude-sonnet'` — гибкость без хардкода
- `startTask()` — атомарная операция: создание Chat + обновление ProjectTask.chatId + status → in_progress
- `createTaskSnapshot` — пропущен (запланирован в C1.5)
- Карточки задач `<div>` → `<button>` с hover эффектами и cursor pointer

**User flow:**
1. Страница проекта → Пульс/ApprovedState → клик по задаче
2. Locked → AlertDialog → подтверждение → unlock API → navigate
3. Pending → navigate → `page.tsx` (Server Component) → `startTask()` → создание Chat + phase transition
4. Auto-trigger → Эксперт стримит первое сообщение
5. Пользователь ведёт диалог → Эксперт использует tools, создаёт артефакты
6. TaskSidebar → переключение между задачами
7. «← К проекту» → возврат, Пульс показывает обновлённые статусы

**DB queries добавлены:**
- `getProjectTaskById({ taskId, projectId })` — загрузка задачи с проверкой принадлежности
- `getCompletedTaskSummaries({ projectId })` — задачи со status='done' и outputSummary
- `startTask({ taskId, userId, projectId, taskTitle })` — создание Chat, обновление ProjectTask
- `unlockTask({ taskId })` — status: locked → pending

**API endpoints добавлены:**
- `POST /api/projects/[id]/tasks/[taskId]/chat` — streaming чат с Экспертом
- `POST /api/projects/[id]/tasks/[taskId]/unlock` — разблокировка задачи

**Ключевые файлы:**
- `app/(task)/layout.tsx` — layout route group (SWRProvider + DataStreamProvider + SidebarProvider)
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — Server Component (auth + guards + startTask + phase transition)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — streaming endpoint (expert prompt + shared tools)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/unlock/route.ts` — unlock endpoint (auth + guards)
- `components/projects/task-chat.tsx` — чат с Экспертом (useChat + Messages + Artifact + MultimodalInput)
- `components/projects/task-sidebar.tsx` — навигация по задачам (статусы, сворачивание)
- `lib/ai/tools/chat-tools.ts` — shared tools factory (getStandardTools)
- `lib/prompts/experts/task-expert.md` — промпт Эксперта
- `lib/prompts/build-task-expert-prompt.ts` — prompt builder (project + task + completedTasks + manifest)
- `components/projects/project-pulse.tsx` — кликабельные карточки задач + AlertDialog
- `components/projects/phase-states/approved-state.tsx` — кнопка «Начать первую задачу» + навигация + AlertDialog
- `lib/db/queries.ts` — 4 новые функции (getProjectTaskById, getCompletedTaskSummaries, startTask, unlockTask)

**Детали:** [_archive/TZ_C1_ExpertTaskChat/](_archive/TZ_C1_ExpertTaskChat/)

### ТЗ-B2: Approval + ProjectTask — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Таблица `ProjectTask`** — 18 колонок в БД, pgEnum `project_task_status` (locked / pending / in_progress / review / issues / done)
- **`POST /api/projects/[id]/approve-plan`** — утверждение плана: парсит planJson.tasks → создаёт ProjectTask[], переводит phase → approved, guard дубликатов (409 Conflict)
- **`GET /api/projects/[id]/tasks`** — получение списка задач проекта (ORDER BY orderIndex)
- **Кнопка «Утвердить план»** — в PlanningState, AlertDialog подтверждения с количеством задач
- **ApprovedState** — полная карта задач в рабочей области: номер, title, goal, tools badge, needsReview badge, status badge (pending/locked)
- **Pulse: ProjectTask[]** — при phase != planning и наличии projectTasks показывает реальные задачи из БД с 6 иконками статусов (Circle, Lock, Loader2-spin, Brain, AlertTriangle, Check) и счётчиками в шапке
- **Manager: taskStatuses XML** — `buildPlanPresentationMode()` загружает ProjectTask[] и инжектирует `<task_statuses>` XML в system prompt Менеджера с order, status, title и summary
- **Логика статусов при создании** — задачи без зависимостей → `pending`, с зависимостями → `locked`
- **Cascade delete** — ProjectTask удаляется при удалении проекта (перед chats)
- **Кнопка «Начать первую задачу»** — toast-заглушка (реализация в следующем ТЗ)

**Архитектурные решения:**
- pgEnum вместо varchar для статусов задач (строгая типизация на уровне БД)
- `foreignKey` helper для chatId (forward reference на таблицу Chat)
- Partial планы можно утверждать (поддержка planJson.status = "partial")
- `buildModeInjection()` стал async (из-за загрузки ProjectTask[] в approved-режиме)

**Схема БД — ProjectTask:**

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | uuid PK | Уникальный ID |
| `projectId` | uuid FK → Project | Проект-владелец |
| `orderIndex` | integer | Порядковый номер задачи |
| `title` | varchar(500) | Заголовок задачи |
| `description` | text | Описание |
| `goal` | text | Цель задачи |
| `input` | text | Входные данные |
| `expectedOutput` | text | Ожидаемый результат |
| `status` | enum | locked / pending / in_progress / review / issues / done |
| `chatId` | uuid FK → Chat | Привязанный чат (nullable) |
| `inputSummary` | text | Краткое содержание входа |
| `outputSummary` | text | Краткое содержание результата |
| `professorVerdict` | jsonb | Вердикт проверки Профессором |
| `dependsOn` | integer[] | Массив orderIndex зависимостей |
| `tools` | text[] | Массив инструментов |
| `needsReview` | boolean | Требует проверки Профессором |
| `createdAt` | timestamp | Дата создания |
| `updatedAt` | timestamp | Дата обновления |

**Ключевые файлы:**
- `lib/db/schema.ts` — pgEnum + таблица projectTask + тип ProjectTask
- `lib/db/queries.ts` — createProjectTasks(), getProjectTasksByProjectId(), каскад в deleteProjectById()
- `lib/db/migrations/0026_useful_supernaut.sql` — миграция
- `app/(chat)/api/projects/[id]/approve-plan/route.ts` — POST endpoint утверждения
- `app/(chat)/api/projects/[id]/tasks/route.ts` — GET endpoint задач
- `components/projects/phase-states/planning-state.tsx` — кнопка + AlertDialog
- `components/projects/phase-states/approved-state.tsx` — карта задач
- `components/projects/project-pulse.tsx` — ProjectTask[] в Пульсе с 6 статусами
- `components/projects/project-work-area.tsx` — проброс projectTasks
- `app/(dashboard)/projects/[id]/page.tsx` — загрузка и проброс ProjectTask[]
- `app/(chat)/api/service-chat/route.ts` — buildPlanPresentationMode() с taskStatuses XML

**Детали:** [_archive/TZ_B2_ApprovalTasks/](_archive/TZ_B2_ApprovalTasks/)

### ТЗ-B1: Professor Planning — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Профессор планирования** — AI-агент (Claude Opus), анализирует проект и генерирует структурированный план задач
- **`POST /api/projects/[id]/plan`** — endpoint Профессора: принимает passport, manifest, files, возвращает plan JSON
- **`Project.planJson`** (jsonb) — хранение плана (discriminated union: complete / partial / needs_input)
- **`Project.planStatus`** — статус планирования (idle / generating / done / error)
- **Zod-валидация** — строгие типизированные схемы для tasks, risks, recommendations, caveats, questions с lenient parsing
- **PlanningState UI** — три состояния:
  - Loading: анимация прогресса (4 шага: Анализ → Декомпозиция → Оценка рисков → Формирование)
  - NeedsInput: карточки вопросов от Профессора (blocking/non-blocking)
  - PlanView: карточки задач (order, title, description, dependencies, tools), секция рисков (severity badge), рекомендации, кавеаты
- **Pulse: превью плана** — в фазе planning: нумерованные задачи (badge + title), или "Анализ проекта..." с Brain animate-pulse
- **Manager: контекст плана** — `<professor_plan>` XML-блок инжектируется в system prompt Менеджера (tasks, risks, recommendations)
- **Delete cascade fix** — корректное удаление проекта с учётом всех FK (Stream, Vote_v2, Message_v2, legacy tables, Chat, ProjectFile, ProjectFolder)

**Ключевые файлы:**
- `app/(chat)/api/projects/[id]/plan/route.ts` — endpoint Профессора
- `lib/ai/professor-types.ts` — Zod-схемы и типы плана
- `lib/prompts/professors/planning.md` — промпт Профессора
- `components/projects/phase-states/planning-state.tsx` — UI планирования (3 состояния)
- `components/projects/project-pulse.tsx` — Пульс с превью плана
- `app/(chat)/api/service-chat/route.ts` — Manager с план-контекстом
- `app/(dashboard)/projects/[id]/page.tsx` — передача planJson и phase в компоненты

**Детали:** [_archive/TZ_B1_ProfessorPlanning/](_archive/TZ_B1_ProfessorPlanning/)

### ТЗ-A3: Manager + Clerk + Manifest — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Клерк-анализатор файлов** — `POST /api/projects/[id]/analyze-file` (Claude Haiku): анализ файла, определение типа, описания, папки, ключевых тем
- **Auto-folder + move-to-folder** — автоматическое создание папок и перемещение файлов по рекомендации Клерка
- **Project Manifest** — `Project.manifestJson` (jsonb), автоматическая агрегация всех анализов
- **Живой Менеджер в drawer** — `ServiceChatCore` вместо заглушки, серверная персистенция сообщений
- **Prompt builder** — `buildFullManagerPrompt()` с passport, manifest, mode injection по phase
- **Fire-and-forget анализ** — после upload файла → автоматический вызов Клерка
- **UI обратная связь** — пульсация "Анализ...", documentType тег, tooltip с описанием
- **Адаптивная кнопка планирования** — "Начать планирование" / "без документов"

**Ключевые файлы:**
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — endpoint Клерка
- `lib/prompts/clerks/file-analyzer.md` — промпт Клерка
- `lib/prompts/service-chats/project-manager.md` — промпт Менеджера
- `components/projects/manager-drawer.tsx` — живой AI-диалог
- `components/projects/project-files-card.tsx` — auto-analyze + UI
- `components/projects/phase-states/welcome-state.tsx` — адаптивная кнопка

**Детали:** [_archive/TZ_A3_ManagerClerkManifest/](_archive/TZ_A3_ManagerClerkManifest/)

### ТЗ-A1: Project Page Layout — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Колонка `phase`** в таблице Project — фазовая система проектов (setup/documents/planning/approved/execution/completed)
- **ProjectPageLayout** — двухколоночный layout (Пульс ~300px + WorkArea flex-1), полноэкранный
- **ProjectPulse** — три сворачиваемые секции: План (задачи со статусами), Файлы (compact), Паспорт (описание, контекст, инструкция, мета)
- **ProjectWorkArea** — switch-рендеринг по фазе проекта (5 компонентов: welcome, planning, approved, execution, completed)
- **ManagerDrawer** — push-drawer справа (400px, WorkArea сжимается), мобильный bottom sheet (vaul)
- **Авто-переход setup → documents** — server-side при первом открытии проекта
- **Мобильная адаптация** — bottom sheet для Пульса + Менеджера
- **Удалены** project-actions.tsx, manager-card.tsx, new-task-card.tsx, task-history-card.tsx

**Ключевые файлы:**
- `components/projects/project-page-layout.tsx` — двухколоночный layout + drawer state
- `components/projects/project-pulse.tsx` — навигационный Пульс (3 секции)
- `components/projects/project-work-area.tsx` — рабочая область по фазе
- `components/projects/manager-drawer.tsx` — push-drawer Менеджера
- `components/projects/phase-states/` — 5 компонентов фаз
- `app/(dashboard)/projects/[id]/page.tsx` — обновлённая страница проекта
- `lib/db/queries.ts` — updateProjectPhase

**Детали:** [_archive/TZ_A1_ProjectPageLayout/](_archive/TZ_A1_ProjectPageLayout/)

### ТЗ-12: Secretary Integration — ✅ ЗАВЕРШЁН

**Выполнено:**
- **XML-промпт Секретаря** — качественное адаптивное интервью (2-4 вопроса, не допрос)
- **Промпт в отдельном файле** — `lib/prompts/service-chats/project-creation.md` (SSOT)
- **Claude Sonnet** — модель для качественного интервью
- **Динамический user_context** — pronouns, bio, occupation, displayName (пустые поля не включаются)
- **Pronouns в greeting** — клиент учитывает ты/вы при приветствии
- **Убраны Quick Actions** — секретарь сам ведёт диалог, кнопки не нужны
- **Фикс скролла чата** — `min-h-0` на flex-контейнерах
- **Tool description** — "2-4 предложения" вместо "1-2"

**Ключевые файлы:**
- `lib/prompts/service-chats/project-creation.md` — XML-промпт Секретаря
- `app/(chat)/api/service-chat/route.ts` — загрузка промпта, user context, Gemini 3 Pro
- `app/(dashboard)/projects/new/page.tsx` — передача pronouns
- `app/(dashboard)/projects/new/project-creation-client.tsx` — greeting с pronouns, без quick actions
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx` — без quick actions, фикс скролла

**Детали:** [_archive/TZ_12_SecretaryIntegration/](_archive/TZ_12_SecretaryIntegration/)

### ТЗ-10: Project Creation Live Preview — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Split Layout** — Preview слева (400px) + Chat справа
- **Live Preview** — поля заполняются в реальном времени при вызове AI tool
- **Tool updateProjectDraft** — AI обновляет черновик постепенно (name, description, context)
- **Кнопка "Создать проект"** — появляется когда name + description заполнены
- **API создания** — POST /api/projects с данными из черновика
- **Success card** — показывается после создания с навигацией
- **Фикс скролла** — левая панель не скроллится вместе с чатом
- **ServiceChatInput баги** — исправлены stale closure, добавлены attachments и voice mode

**Ключевые файлы:**
- `app/(dashboard)/projects/new/project-creation-client.tsx` — клиент со split layout
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx` — preview с кнопкой
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx` — chat panel
- `app/(chat)/api/service-chat/route.ts` — updateProjectDraft tool
- `components/input/input-context.tsx` — фикс stale closure для controlled mode

**Детали:** [_archive/TZ_10_ProjectCreationLivePreview/](_archive/TZ_10_ProjectCreationLivePreview/)

### ТЗ-11: Project Creation Polish — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Фикс скролла чата** — scroll anchor + auto-scroll к новым сообщениям
- **Placeholder-подсказки** — «Ожидание...» заменены на полезные примеры
- **Лейбл «Контекст проекта»** — вместо «Инструкция для AI» в preview создания
- **Колонка `context` в БД** — отдельное поле для справки о бизнесе (миграция 0022)
- **Tool updateProjectDraft** — параметр `instruction` → `context`
- **API POST /api/projects** — сохраняет в колонку `context`
- **Страница проекта** — вкладка «Паспорт» → КОНТЕКСТ читает реальные данные из БД
- **ADR 012** — документировано разделение Context vs Instruction

**Архитектурное решение (ADR 012):**
- Секретарь → `context` (справка о бизнесе, собирается при создании)
- Менеджер → `instruction` (инструкция для AI, заполняется позже)

**Ключевые файлы:**
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx` — scroll fix
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx` — placeholders + label
- `app/(chat)/api/service-chat/route.ts` — tool parameter context
- `app/(chat)/api/projects/route.ts` — POST saves context
- `lib/db/schema.ts` — колонка `context` в Project
- `lib/db/migrations/0022_flat_adam_destine.sql` — миграция
- `components/projects/project-passport.tsx` — отображает context из БД

**Детали:** [_archive/TZ_11_ProjectCreationPolish/](_archive/TZ_11_ProjectCreationPolish/) | [docs/decisions/012-context-vs-instruction-separation.md](docs/decisions/012-context-vs-instruction-separation.md)

### ТЗ-09: ServiceChat — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Унифицированная система сервисных чатов** — единая архитектура для Бен, создания проекта, менеджера
- **ServiceChatCore** — ядро с messages, streaming, quickActions
- **ServiceChatFloating** — floating modal (center/bottom-right) для Бена и создания проекта
- **ServiceChatDrawer** — drawer справа для менеджера проекта
- **Конфиги** — BEN_CONFIG, PROJECT_CREATION_CONFIG, PROJECT_MANAGER_CONFIG
- **Унифицированный API** — `/api/service-chat` с context-параметром
- **Удалён Prompt-Agent** — архивирован в `_archive/prompts/`
- **Очистка** — удалены modal-assistants, universal-dialog

**Ключевые файлы:**
- `components/service-chat/` — новая система (12 файлов)
- `app/(chat)/api/service-chat/route.ts` — унифицированный API
- `app/(dashboard)/projects/new/project-creation-client.tsx` — клиент создания проекта

**Детали:** [_archive/TZ_09_ServiceChat/](_archive/TZ_09_ServiceChat/)

### ТЗ-08: File Viewer — ✅ ЗАВЕРШЁН

**Выполнено:**
- **FileViewer модалка** — просмотр файлов проекта без скачивания
- **Поддержка форматов** — изображения, PDF, текст, Markdown, CSV, Excel, PPTX
- **Навигация** — стрелки ← → между файлами, индикатор позиции (1/5)
- **UX** — анимация (fade + zoom), мобильная адаптация, touch targets 48px
- **Shared компонент** — MarkdownViewer вынесен из artifacts

**Ключевые файлы:**
- `components/file-viewer/` — модуль просмотра файлов (12 файлов)
- `components/file-viewer/file-viewer.tsx` — главный компонент (Radix Dialog)
- `components/file-viewer/renderers/` — 7 рендереров по типу файла
- `components/markdown-viewer.tsx` — shared компонент для Markdown
- `components/projects/project-files-card.tsx` — интеграция (клик → FileViewer)

**Детали:** [_archive/TZ_08_FileViewer/](_archive/TZ_08_FileViewer/)

### ТЗ-07C3: Project Entry Points — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Карточка "Новая задача"** — быстрое создание задачи (➕), переход в чат
- **Карточка "Менеджер"** — точка входа в управление проектом (👤)
- **Модалка Менеджера** — заглушка с превью будущих функций
- **Секция ProjectActions** — wrapper для 3 карточек (Задачи, Новая задача, Менеджер)
- **Убран ProjectInput** — поле ввода убрано со страницы проекта

**Ключевые файлы:**
- `components/projects/new-task-card.tsx` — карточка "Новая задача"
- `components/projects/manager-card.tsx` — карточка "Менеджер"
- `components/projects/manager-dialog.tsx` — модалка Менеджера
- `components/projects/project-actions.tsx` — секция с карточками
- `app/(dashboard)/projects/[id]/page.tsx` — обновлённая страница проекта

**Детали:** [_archive/TZ_07C3_ProjectEntryPoints/](_archive/TZ_07C3_ProjectEntryPoints/)

### ТЗ-07C2: Project Pulse — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Панель "Пульс проекта"** — живая панель состояния на странице проекта
- **Статусы задач** — not_started / in_progress / done
- **Автопереход статуса** — not_started → in_progress при первом сообщении
- **AI-итог проекта** — генерация summary через Claude Haiku
- **UI статусов** — визуальные индикаторы в списке задач, детальной панели, sidebar

**Ключевые файлы:**
- `components/projects/project-pulse.tsx` — панель Пульс проекта
- `app/(chat)/api/projects/[id]/generate-summary/route.ts` — API генерации итога
- `app/(chat)/api/chat/route.ts` — автопереход статуса
- `components/tasks/` — обновлённые компоненты с кнопками статуса
- `lib/db/queries.ts` — updateChatTaskStatus, updateProjectSummary

**Детали:** [_archive/TZ_07C2_ProjectPulse/](_archive/TZ_07C2_ProjectPulse/)

### ТЗ-07B: Chat History — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Страница /chats** — двухколоночный layout (список + детали)
- **Карточка на главной** — "💬 История чатов" со счётчиком, переход на /chats
- **Автогенерация summary** — AI генерирует краткое описание чата
- **Звёзды (isStarred)** — отметка важных чатов (toggle в sidebar и на /chats)
- **Database** — поля `summary`, `isStarred` в Chat

**Ключевые файлы:**
- `app/(dashboard)/chats/page.tsx` — страница истории чатов
- `components/chats/` — 6 компонентов для /chats
- `components/glavnaya/chat-history-card.tsx` — карточка на главной
- `lib/db/queries.ts` — новые queries (getGeneralChatsCount, getGeneralChatsWithStats)
- `sidebar-history-item.tsx` — ⭐ toggle в меню

**Детали:** [_archive/TZ_07B_ChatHistory/](_archive/TZ_07B_ChatHistory/)

### ТЗ-07A: Glavnaya + Navigation + Sidebar — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Новая главная страница** — `/` с инпутом в стиле Google Gemini / Claude Desktop
- **Унифицированная система инпутов** — `components/input/` (композиционная архитектура)
- **Контекстный sidebar** — показывает релевантные чаты (главные / проектные)
- **Автонейминг чатов** — автоматическая генерация названий через Gemini Flash
- **Переименование чатов** — inline-редактирование в sidebar
- **Universal Dialog** — унифицированный компонент диалогов
- **Breadcrumbs** — навигационные хлебные крошки на всех уровнях
- **API управления чатами** — DELETE/PATCH для `/api/chat/[id]`

**Ключевые файлы:**
- `components/input/` — унифицированная система инпутов (10 файлов)
- `components/glavnaya/` — компоненты главной страницы
- `components/universal-dialog/` — система диалогов
- `app/(chat)/api/chat/[id]/route.ts` — API чатов
- `app/(chat)/api/chat/[id]/generate-title/route.ts` — генерация заголовков

**Детали:** [_archive/TZ_07A_Glavnaya/](_archive/TZ_07A_Glavnaya/)

### ТЗ-04: Skills + Agents Architecture — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Skills** — атомарные навыки в формате Markdown (SKILL.md с frontmatter)
- **Agents** — персонажи с AGENT.md + config.yaml
- **Builder** — модульная система сборки промптов
- **Progressive Disclosure** — загрузка metadata → full content по требованию
- **Server-only exports** — изоляция fs-зависимых функций
- **Core в Markdown** — base.md, safety.md, formatting.md, russian-market.md
- **Миграция Ben** — полноценный агент с references
- **Миграция Prompt-agent** — skill в utility/prompt-helper/

**Ключевые файлы:**
- `lib/prompts/builder/` — система сборки (registry, loaders, composer)
- `lib/prompts/agents/ben/` — агент Бен
- `lib/prompts/skills/utility/prompt-helper/` — skill Prompt-helper
- `lib/prompts/server.ts` — server-only экспорты

**Детали:** [_archive/TZ_04_ROADMAP.md](_archive/TZ_04_ROADMAP.md)

### ТЗ-03: Проекты + Claude + Режим Профессор — ✅ ЗАВЕРШЁН

**Выполнено:**
- **Проекты** — изолированные рабочие пространства
- **Claude интеграция** — Haiku, Sonnet, Opus (v3.23.0: через @ai-sdk/anthropic напрямую)
- **Три уровня моделей** — Исполнитель/Эксперт/Профессор
- **Режим Профессор** — Pipeline с Opus→Haiku→Opus
- **UI прогресса** — галочки для подзадач в pipeline
- **Breadcrumb навигация** — Home > Project > Чат
- **Database** — таблица `Project`, поле `projectId` в `Chat`

**Ключевые файлы:**
- `lib/ai/model-tiers.ts` — конфиг уровней моделей
- `lib/ai/professor-pipeline.ts` — pipeline для Профессора
- `components/projects/professor-progress.tsx` — UI прогресса
- `app/(chat)/projects/` — страницы проектов

**Детали:** [_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md](_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md)

### ТЗ-02: Dashboard + Sidebar + Routing — ✅ ЗАВЕРШЁН

**Выполнено:**
- Dashboard (`/dashboard`) — новая точка входа с карточками инструментов
- Sidebar с вертикальными вкладками (Search, Chats, Projects)
- SidebarLayout — табы остаются видимыми при сворачивании sidebar
- Settings без sidebar (`/settings`)
- Ben персонализация — intro bubble для новых пользователей
- Modal drawer responsive — корректная работа при смене desktop/mobile

**Ключевые файлы:**
- `components/sidebar-layout.tsx` — layout с табами вне Sidebar
- `components/modal-assistants/ben/intro-bubble.tsx` — speech bubble для онбординга
- `components/ui/sidebar.tsx` — CSS variable `--sidebar-left-offset`

**Детали:** [_archive/TZ_02_ROADMAP.md](_archive/TZ_02_ROADMAP.md)

### ТЗ-NEW-01: Новая архитектура (v3.0.0) — ✅ ЗАВЕРШЁН

**Выполнено:**
- Файловая система промптов (`lib/prompts/`)
- Модальные помощники (Prompt-агент, Бен)
- Удалены таблицы `Agent` и `UserAgent`
- Удалены поля `agentId` из `Chat` и `Message`
- Удалён UI выбора агента и @-mentions
- Добавлено поле `hasSeenBenIntro` в `User`
- Anthropic SDK через OpenRouter

**Фазы:**
1. ✅ Инфраструктура промптов
2. ✅ Anthropic SDK
3. ✅ Модальные помощники
4. ✅ Чистка UI
5. ✅ Чистка кода
6. ✅ Миграция БД
7. ✅ Интеграция
8. ✅ Тестирование
9. ✅ Финализация

**Детали:** [_archive/TZ_NEW_01_ROADMAP.md](_archive/TZ_NEW_01_ROADMAP.md)

### Предыдущие этапы

| Этап | Описание | Статус |
|------|----------|--------|
| 0 | Документация и ребрендинг | ✅ |
| 1 | Архитектура агентов (ТЗ-1) | ✅ → Заменено в v3.0 |
| 2 | Мультиагентный чат (ТЗ-2) | ✅ → Заменено в v3.0 |
| 3A | Профиль пользователя (ТЗ-3A) | ✅ |
| 3B | Персонализация агентов (ТЗ-3B) | ✅ → Заменено в v3.0 |
| 4 | Упрощение UX (ТЗ-4) | ✅ |
| 5 | Markdown документы (ТЗ-5) | ✅ |
| 6 | Excel Tool (ТЗ-6) | ✅ |
| — | Performance Audit | ✅ |
| — | Artifact Loading UX | ✅ |
| — | Voice Input (Deepgram) | ✅ |

### Следующие этапы

| Этап | Описание | Приоритет |
|------|----------|-----------|
| **8** | Инструменты Фаза 1 (Perplexity ✅, Plus AI, Ideogram) | 🔄 В работе |
| **9** | RAG: MIND extract+retrieve ✅ v3.71.0, Consolidation+Profile+UI ✅ v3.72.0, Compaction ✅ v3.73.0, Библиотека 📋 | 🔄 В работе |
| **10** | Chat Memory | 🟡 Средний |
| **11** | Мультипровайдер (GPT) | 🟡 Средний |
| **12** | Биллинг (Pay-as-you-go) | 🟡 Средний |
| **13** | Инструменты Фаза 2 | 🟢 Низкий |
| **14** | Инструменты Фаза 3 + Morning Briefing Frontend | 🟢 Низкий |

**Философия инструментов:** Best-in-Class API — интегрируем лучшие готовые решения, не изобретаем велосипеды.

**Подробности:** [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## Статистика

| Метрика | Значение |
|---------|----------|
| Версия | 3.73.0 |
| Статус | Active development |
| Voice Input | Deepgram Nova-3 (русский) |
| Архитектура промптов | Skills + Agents (v3.3) |
| Архитектура UI | Унифицированные инпуты (v3.4), File Viewer (v3.7), ServiceChat (v3.8), Live Preview (v3.9), Context/Instruction (v3.10), Secretary (v3.11), Project Layout (v3.12), Manager+Clerk+Manifest (v3.13), Professor Planning (v3.14), Approval+ProjectTask (v3.15), ExpertTaskChat (v3.16), TaskCompletion (v3.17), ContextManagement (v3.18), DesignSystem (v3.19), ToolActivity+SidebarIconMode (v3.20), ChatSidebar+RightSidebar (v3.21), ChatContextManagement (v3.22), AnthropicProviderSwitch (v3.23), DashboardV2 (v3.24), RouteGroups (v3.25), MorningBriefingBackend (v3.26), DeepResearch+FetchUrl (v3.29) |
| Skills | 5 (document: 4, research: 1) |
| Agents | 1 (ben) |
| Профессоры | 2 (planning, task-review) |
| Клерки | 3 (file-analyzer, task-summarizer, snapshot-creator) |
| Сервисные чаты | 3 (ben, project-creation, project-manager) |
| Промптов | 10 (chat, ben, project-creation, project-manager, professor-planning, task-expert, task-summarizer, task-review, file-analyzer, snapshot-creator) |
| AI моделей | 3 (Claude Sonnet, Haiku, Opus) + Gemini для vision-ocr |
| AI-инструментов | 13 |
| Типов документов | 5 (text, markdown, excel, presentation-reveal, presentation-pptx) |
| Тем презентаций | 5 |
| Тем Excel | 5 |
| Шаблонов Excel | 10 |
| Форматов FileViewer | 8 (image, pdf, text, markdown, csv, excel, pptx, unsupported) |
| Production build | ✅ Успешен |

---

## Документация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая:**
- [docs/ai-agents.md](docs/ai-agents.md) — Система промптов и помощники
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Артефакты
- [docs/ai-tools.md](docs/ai-tools.md) — Инструменты
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/setup.md](docs/setup.md) — Установка
- [docs/decisions/](docs/decisions/) — ADR

**ТЗ (архив):**
- [_archive/TZ_PIPELINE1_ReliablePipelineObservability/](_archive/TZ_PIPELINE1_ReliablePipelineObservability/) — ТЗ-PIPELINE1 Reliable Pipeline Observability (v3.69.0)
- [_archive/TZ_BILLING1_FullCostCoverage/](_archive/TZ_BILLING1_FullCostCoverage/) — ТЗ-BILLING1 Full Cost Coverage (v3.68.0)
- [_archive/TZ_TOKENS1_SdkNativeUsage/](_archive/TZ_TOKENS1_SdkNativeUsage/) — ТЗ-TOKENS1 SDK Native Usage Tracking (v3.67.0)
- [specs/TZ_COSTCTRL_BriefingCostControl/](specs/TZ_COSTCTRL_BriefingCostControl/) — ТЗ-COSTCTRL Briefing Cost Control (v3.66.0)
- [_archive/TZ_BF4_PerSectionRefresh/](_archive/TZ_BF4_PerSectionRefresh/) — ТЗ-BF4 PerSectionRefresh
- [_archive/TZ_BF2_SimplyNews/](_archive/TZ_BF2_SimplyNews/) — ТЗ-BF2 SimplyNews
- [_archive/TZ_HF1_BriefingSetupUpdate/](_archive/TZ_HF1_BriefingSetupUpdate/) — ТЗ-HF1 Briefing PE Update
- [_archive/TZ_PX_DeepResearch/](_archive/TZ_PX_DeepResearch/) — ТЗ-PX + ТЗ-FU Deep Research + Fetch URL
- [_archive/TZ_BR1_BriefingBackend/](_archive/TZ_BR1_BriefingBackend/) — ТЗ-BR1 Morning Briefing Backend
- [_archive/TZ_RG_RouteGroups/](_archive/TZ_RG_RouteGroups/) — ТЗ-RG Route Groups
- [_archive/TZ_DV2_DashboardV2/](_archive/TZ_DV2_DashboardV2/) — ТЗ-DV2 Dashboard V2
- [_archive/TZ_C4_AnthropicProvider/](_archive/TZ_C4_AnthropicProvider/) — ТЗ-C4 Anthropic Provider Switch
- [_archive/TZ_C3_ChatContext/](_archive/TZ_C3_ChatContext/) — ТЗ-C3 Chat Context Management
- [_archive/TZ_08_ChatSidebar/](_archive/TZ_08_ChatSidebar/) — ТЗ-08CS Chat Sidebar + RightSidebar
- [_archive/TZ_07_ToolActivity/](_archive/TZ_07_ToolActivity/) — ТЗ-07 Tool Activity UX + Sidebar Icon Mode
- [_archive/TZ_DesignSystem/](_archive/TZ_DesignSystem/) — ТЗ-DS Simply Design System
- [_archive/TZ_C1_5_ContextManagement/](_archive/TZ_C1_5_ContextManagement/) — ТЗ-C1.5 Context Window Management
- [_archive/TZ_C2_TaskCompletion/](_archive/TZ_C2_TaskCompletion/) — ТЗ-C2 TaskCompletion
- [_archive/TZ_C1_ExpertTaskChat/](_archive/TZ_C1_ExpertTaskChat/) — ТЗ-C1 ExpertTaskChat
- [_archive/TZ_B2_ApprovalTasks/](_archive/TZ_B2_ApprovalTasks/) — ТЗ-B2 Approval + ProjectTask
- [_archive/TZ_B1_ProfessorPlanning/](_archive/TZ_B1_ProfessorPlanning/) — ТЗ-B1 Professor Planning
- [_archive/TZ_A3_ManagerClerkManifest/](_archive/TZ_A3_ManagerClerkManifest/) — ТЗ-A3 Manager + Clerk + Manifest
- [_archive/TZ_A1_ProjectPageLayout/](_archive/TZ_A1_ProjectPageLayout/) — ТЗ-A1 Project Page Layout
- [_archive/TZ_12_SecretaryIntegration/](_archive/TZ_12_SecretaryIntegration/) — ТЗ-12 Secretary Integration
- [_archive/TZ_11_ProjectCreationPolish/](_archive/TZ_11_ProjectCreationPolish/) — ТЗ-11 Project Creation Polish
- [_archive/TZ_10_ProjectCreationLivePreview/](_archive/TZ_10_ProjectCreationLivePreview/) — ТЗ-10 Project Creation Live Preview
- [_archive/TZ_09_ServiceChat/](_archive/TZ_09_ServiceChat/) — ТЗ-09 ServiceChat
- [_archive/TZ_08_FileViewer/](_archive/TZ_08_FileViewer/) — ТЗ-08 File Viewer
- [_archive/TZ_07C3_ProjectEntryPoints/](_archive/TZ_07C3_ProjectEntryPoints/) — ТЗ-07C3 Project Entry Points
- [_archive/TZ_07C2_ProjectPulse/](_archive/TZ_07C2_ProjectPulse/) — ТЗ-07C2 Project Pulse
- [_archive/TZ_07B_ChatHistory/](_archive/TZ_07B_ChatHistory/) — ТЗ-07B Chat History
- [_archive/TZ_07A_Glavnaya/](_archive/TZ_07A_Glavnaya/) — ТЗ-07A Glavnaya + Navigation + Sidebar
- [_archive/TZ_04_ROADMAP.md](_archive/TZ_04_ROADMAP.md) — ТЗ-04 Skills + Agents
- [_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md](_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md) — ТЗ-03 Проекты + Claude
- [_archive/TZ_02_ROADMAP.md](_archive/TZ_02_ROADMAP.md) — ТЗ-02 Dashboard + Sidebar
- [_archive/TZ_NEW_01_ROADMAP.md](_archive/TZ_NEW_01_ROADMAP.md) — ТЗ-NEW-01 (v3.0.0)
- [_archive/TZ_VOICE_01_MIGRATION_TO_DEEPGRAM.md](_archive/TZ_VOICE_01_MIGRATION_TO_DEEPGRAM.md) — Voice Input Deepgram
- [_archive/TZ_01_AGENTS_ARCHITECTURE.md](_archive/TZ_01_AGENTS_ARCHITECTURE.md) — Этап 1
- [_archive/TZ_02_MULTIAGENT_CHAT.md](_archive/TZ_02_MULTIAGENT_CHAT.md) — Этап 2
- [_archive/TZ_03A_USER_PROFILE.md](_archive/TZ_03A_USER_PROFILE.md) — Этап 3A
- [_archive/TZ_03B_AGENT_PERSONALIZATION.md](_archive/TZ_03B_AGENT_PERSONALIZATION.md) — Этап 3B
- [_archive/TZ_04_UX_SIMPLIFICATION.md](_archive/TZ_04_UX_SIMPLIFICATION.md) — Этап 4
- [_archive/TZ_05_MARKDOWN_ARTIFACTS.md](_archive/TZ_05_MARKDOWN_ARTIFACTS.md) — Этап 5
- [_archive/TZ_EXCEL_TOOL.md](_archive/TZ_EXCEL_TOOL.md) — Этап 6
- [_archive/TZ_06_ROADMAP.md](_archive/TZ_06_ROADMAP.md) — Этап 6 Roadmap

---

**Обновлено:** 2026-04-05
