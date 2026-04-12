# Инструкция для Claude Code

**Проект:** Simply | **Версия:** 3.83.0 | **Статус:** Active development

**URL:** https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app

---

## UI и дизайн

⛔ **ОБЯЗАТЕЛЬНО:** Перед ЛЮБОЙ работой с UI — прочитай **[docs/design-system.md](docs/design-system.md)**.

Этот файл содержит:
- **Структуру интерфейса** — layout groups, карта страниц, существующие компоненты навигации
- **Цвета** — ТОЛЬКО семантические токены. Хардкоженные цвета ЗАПРЕЩЕНЫ
- **Hover-паттерны** — два паттерна (карточки с border / inline-элементы)
- **Правила создания компонентов** — не создавать дубли, проверять все layout-ы

**Ключевое:** Перед созданием нового UI-компонента — проверь раздел 1.3 (существующие компоненты навигации).

---

## Начни здесь

1. **[README.md](README.md)** — О проекте Simply
2. **[SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)** — Видение продукта (roadmap, инструменты, концепции)
3. **[SIMPLY_STATUS.md](SIMPLY_STATUS.md)** — Текущее состояние проекта
4. **[docs/design-system.md](docs/design-system.md)** — Дизайн-система (закон для UI)
5. **[DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md)** — Правила документации

**Главный принцип:** SSOT (Single Source of Truth)

---

## О проекте

**Simply** — AI-платформа для российского рынка. Шлюз к лучшим мировым AI-моделям с оплатой в рублях.

**Философия:**
- **Apple-подход** — качество важнее количества
- **Best-in-Class API** — не изобретаем велосипеды, интегрируем лучшие решения

**Ключевые особенности:**
- Универсальный AI-чат с инструментами (Claude Sonnet)
- Проекты: изолированные рабочие пространства (Claude Haiku/Sonnet/Opus)
- Сервисные чаты: Бен (❓), создание проекта, менеджер
- Три уровня персонализации: Профиль + RAG + Chat Memory
- Anthropic Claude — основной провайдер; MiniMax — Simply Chat + Briefing + Podcast script; Gemini — Podcast TTS
- Оплата в рублях (ЮKassa, Тинькофф, СБП)

---

## Технологии

**Frontend:** Next.js 15.3 (App Router, RSC), TypeScript, Tailwind CSS

**AI:**
- Vercel AI SDK v6 (@ai-sdk/anthropic v3, vercel-minimax-ai-provider, @google/genai для TTS)
- Текущий: Anthropic Claude (Sonnet + Haiku + Opus)
- Voice Input: Deepgram Nova-3 (русский язык)
- План: мультипровайдер (GPT)

**Backend:** NextAuth 5.0-beta.25, PostgreSQL (Neon), Drizzle ORM

**Storage:** Vercel Blob Storage

**Deploy:** Vercel

---

## Структура кода

**Prompt System (v3.3 — Skills + Agents):**
- `lib/prompts/` — Система промптов (Skills + Agents)
- `lib/prompts/server.ts` — Server-only экспорты (buildChatPrompt, buildBenPrompt, buildFullManagerPrompt)
- `lib/prompts/index.ts` — Client-safe экспорты (типы, утилиты)
- `lib/prompts/builder/` — Модульная система сборки (registry, loaders, composer)
- `lib/prompts/skills/` — Атомарные навыки (SKILL.md)
- `lib/prompts/agents/` — Персонажи-агенты (AGENT.md + config.yaml)
- `lib/prompts/professors/` — Промпты профессоров (planning.md, task-review.md)
- `lib/prompts/experts/` — Промпты экспертов (task-expert.md)
- `lib/prompts/build-task-expert-prompt.ts` — Prompt builder для Эксперта
- `lib/prompts/clerks/` — Промпты клерков (file-analyzer.md, task-summarizer.md, snapshot-creator.md)
- `lib/prompts/service-chats/` — Промпты сервисных чатов (project-creation.md, project-manager.md)
- `lib/prompts/briefing/` — Промпт автора брифинга (briefing-author.md)
- `lib/prompts/core/` — Базовые промпты (.md файлы: base, safety, formatting, russian-market, dev-mode)
- `lib/prompts/contexts/` — Контексты (user-profile, chat-memory)

**Unified Input System (v3.4.0):**
- `components/input/` — Унифицированная система инпутов (композиция)
- `components/input/input-context.tsx` — React Context для связи компонентов
- `components/input/input-base.tsx` — Базовый контейнер + toolbar
- `components/input/input-textarea.tsx` — Поле ввода с auto-resize
- `components/input/input-voice-button.tsx` — 🎤 Диктовка (Deepgram)
- `components/input/input-model-selector.tsx` — Селектор модели
- `components/input/compact-input.tsx` — Готовый пресет для главной/проектов

**Glavnaya (Home Page):**
- `app/(chat)/page.tsx` — Главная страница
- `components/glavnaya/` — Компоненты главной
- `components/glavnaya/glavnaya-input.tsx` — Инпут на главной (использует CompactInput)
- `components/glavnaya/chat-history-card.tsx` — Карточка "Мой контекст" (Brain icon, factCount → /context) (v3.74.0, бывш. "История чатов")
- `components/glavnaya/mode-cards-section.tsx` — 3 карточки-лаунчера (Экспертиза 🔍, Создать ✨, Проекты 📁) (v3.24.0)
- `components/glavnaya/tools-section.tsx` — Секция "Инструменты" на дашборде (v3.27.0)

**Simply Chat (v3.79.0 — ТЗ-SimplyToolsMinimax):**
- `app/(chat)/simply/page.tsx` — Маршрут `/simply` (Server Component, persistent chat)
- `lib/db/queries.ts` — `getOrCreateSimplyChat(userId)` — один чат на пользователя
- `lib/prompts/chat/simply-chat.md` — System prompt Simply Chat (роль, навигация)
- Маршрутизация модели: текст → MiniMax M2.7 (12 tools), фото/PDF → Gemini 3 Flash Preview, «Думать» → Sonnet (14 tools). **Детали:** [docs/ai-minimax.md](docs/ai-minimax.md)
- Tools для MiniMax: все стандартные кроме `deepResearch` (дорогой). При «Думать» (Sonnet) — все tools включая deepResearch
- `stripMediaPartsForTextModel()` — фильтрация image/file из истории для MiniMax (текстовая модель)
- `components/input/input-think-button.tsx` — Кнопка «Думать» (toggle → Sonnet override)

**Context Dashboard (v3.74.0 — ТЗ-KITT):**
- `app/(dashboard)/context/page.tsx` — Страница `/context` (Server Component, auth → ContextPage)
- `components/context/context-page.tsx` — Client Component (7 карточек MIND, Opus-профиль, кнопки)
- `components/context/context-card.tsx` — Карточка категории (иконка, badge count, 2 preview-факта)
- `app/(chat)/api/user/memory/context/route.ts` — GET API (факты по категориям + профиль)

**Briefing UI (v3.28.0 — Landing, v3.30.0 — Onboarding, v3.32.0 — Issue Page, v3.33.0 — Progress, v3.39.0 — SavedTopics, v3.40.0 — SimplyNews, v3.41.0 — SidebarRedesign, v3.42.0 — PerSectionRefresh, v3.44.0 — PodcastUI):**
- `lib/briefing/briefing-types.ts` — Shared типы BriefingArticle/Section/Source/Meta + BriefingProgressStep/Event + SavedBriefingTopicClient (client-safe)
- `app/(dashboard)/briefing/page.tsx` — Страница /briefing (Server Component → BriefingPageClient, роутинг: isActive → выпуск с sidebar, !isActive → лендинг, загрузка saved topics)
- `app/(dashboard)/briefing/setup/page.tsx` — Server Component: auth, mode detection (create/edit), загрузка topics/sources
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — Split layout (preview + chat), useChat, live preview, edit mode, progress при генерации, Save button + unsaved guard (v3.53.0), Delivery Popover (v3.54.0)
- `app/(dashboard)/briefing/setup/components/` — BriefingProfilePreview (темы, источники, tier) + BriefingChatPanel + ResearchProgressCard (live progress per topic, v3.52.0)
- `app/(chat)/api/briefing/latest/route.ts` — GET API (latest briefing + settings)
- `app/(chat)/api/briefing/topics/save/route.ts` — POST (save topic) / DELETE (delete topic) API
- `app/(chat)/api/briefing/topics/saved/route.ts` — GET (list saved topics) API
- `app/(chat)/api/briefing/save-profile/route.ts` — POST API сохранения профиля брифинга (topics + sources + settings) ← v3.53.0
- `lib/briefing/save-briefing-profile.ts` — Логика сохранения профиля (upsertSettings → deleteAll → addAll) ← v3.53.0
- `hooks/use-briefing-generation.ts` — Custom hook: streaming fetch → parse JSON Lines → state (steps, isGenerating, error, redirectUrl)
- `components/briefing/briefing-card.tsx` — Карточка на дашборде (3 состояния: пустое/готов/генерируется)
- `components/briefing/briefing-page.tsx` — Лендинг (hero + демо выпуска + CTA)
- `components/briefing/briefing-page-client.tsx` — Клиентская обёртка /briefing (управление генерацией, savedTopics state, headline extraction при сохранении, SimplyData state, h-svh fixed layout, per-section refresh state + API call, podcast orchestrator: usePodcastGeneration + usePodcastPlayer, viewMode state)
- `components/briefing/briefing-generation-progress.tsx` — UI прогресса генерации (4 шага, framer-motion, error/retry)
- `components/briefing/briefing-issue-header.tsx` — Header выпуска (title, ← Dashboard md:hidden, podcastSlot (ReactNode: PodcastButton или BriefingModeToggle), ⚙️, UserMenu, mobileTrigger)
- `components/briefing/briefing-article-view.tsx` — Рендер статьи (intro, sections + MarkdownViewer + Collapsible sources, outro, meta) + IntersectionObserver scroll spy + Bookmark + Copy + Refresh (↻) + Radix UI Tooltips + SavedTopicView + SimplyContentView + NoBriefingsYet
- `components/briefing/briefing-delivery-settings.tsx` — Delivery settings: toggle, time, format, Telegram status (Popover в header setup) ← v3.54.0
- `components/briefing/briefing-sidebar.tsx` — Sidebar (branded «S Simply» header, topic nav, collapsible saved-topic folders by category с localStorage persistence, headline extraction, Simply section с unread indicator, AlertDialog confirm, primary Generate button, podcast tracklist/generation state) + BriefingSidebarMobile (Sheet)
- `components/briefing/briefing-issue-content.tsx` — Клиентская обёртка (activeSectionId state, связь scroll spy → sidebar, switch article/savedTopic/simplyContent/podcast view, fixed scroll layout, podcast props threading)
- `components/briefing/briefing-player-placeholder.tsx` — (deprecated, подкаст-кнопка перенесена в briefing-issue-header)
- `components/briefing/briefing-source-card.tsx` — Карточка источника (tier badges на русском)
- `components/briefing/briefing-header.tsx` — Header лендинга (← Dashboard, заголовок, UserMenu)
- `components/service-chat/configs/briefing-onboarding.ts` — Reference config для service-chat
- `lib/briefing/simply-news.md` — ТЗ-BF2: Контент «Что нового» (frontmatter: version, hasUpdate, title, date)
- `lib/briefing/simply-overview.md` — ТЗ-BF2: Контент «Обзор платформы» (markdown)
- `lib/briefing/simply-news-utils.ts` — ТЗ-BF2: Парсер frontmatter + утилиты (getSimplyNewsData, getSimplyOverviewContent)
- `app/(chat)/api/briefing/simply-news/seen/route.ts` — ТЗ-BF2: PATCH API отметки просмотра Simply News
- `app/(chat)/api/briefing/refresh-section/route.ts` — ТЗ-BF4: POST API per-section refresh (fetch → filter → generate → JSONB patch)
- `lib/briefing/briefing-section-author.ts` — ТЗ-BF4: генерация одной секции (Claude Sonnet, упрощённый промпт)
- `lib/briefing/research-engine.ts` — ТЗ-FIX2: Research engine для онбординга (Perplexity → verify → classify, progress streaming) ← v3.52.0
- `hooks/use-podcast-generation.ts` — ТЗ-Б2: Streaming hook генерации подкаста (fetch POST → JSON Lines → per-topic statuses)
- `hooks/use-podcast-player.ts` — ТЗ-Б2: Player hook (new Audio(), play/pause, seek, speed, track switching, skip ±15s, autoplay next)
- `components/briefing/podcast-button.tsx` — ТЗ-Б2: Кнопка «Создать подкаст» (Popover с toggle «Все/Выбрать» + checkboxes)
- `components/briefing/podcast-progress.tsx` — ТЗ-Б2: Full-screen прогресс генерации (artwork, per-topic шаги, sound wave)
- `components/briefing/podcast-player.tsx` — ТЗ-Б2: Full-screen плеер (artwork, контролы, прогресс-бар, speed pills, MP3 download трека + «Всё» client-side merge)
- `components/briefing/briefing-mode-toggle.tsx` — ТЗ-Б2: Сегментированная кнопка [Читать | Слушать], outdated warning dot
- `components/briefing/podcast-sidebar.tsx` — ТЗ-Б2: Sidebar треклист (MiniEqualizer, failed topics gray + retry)

**ListDetailPage (v3.24.0):**
- `components/list-detail/list-detail-page.tsx` — Универсальный composition layout (header, two-column, empty state)
- `components/list-detail/index.ts` — exports

**Chat History (v3.5.0, v3.24.0 — ListDetailPage):**
- `app/(dashboard)/chats/page.tsx` — Страница истории чатов (chatMode='chat' only)
- `app/(dashboard)/expertise/page.tsx` — Страница экспертиз (chatMode='expertise')
- `app/(dashboard)/create/page.tsx` — Страница создания (chatMode='create')
- `components/chats/` — Компоненты для /chats
- `components/chats/chats-page-content.tsx` — Клиентский контейнер с ListDetailPage
- `components/chats/mode-chats-page.tsx` — Shared компонент для /expertise и /create
- `components/chats/chat-list.tsx` — Левая колонка (список чатов)
- `components/chats/chat-list-item.tsx` — Элемент списка (⭐, date, chatMode badge, actions)
- `components/chats/chat-detail-panel.tsx` — Правая колонка (summary, actions)

**ChatMode System (v3.24.0) + Route Groups (v3.25.0):**
- `lib/ai/chat-mode-config.ts` — Тонкая обёртка (v3.83+): `chatMode → taskId → getModel()`. `CHAT_MODE_CONFIG` хранит `displayName` и `tools`; модели берутся из task-assignments.
- `app/(chat)/chat/[id]/page.tsx` — Маршрут обычного чата (redirect для expertise/create)
- `app/(expertise)/expertise/[id]/page.tsx` — Маршрут экспертизы (chatMode=expertise)
- `app/(create)/create/[id]/page.tsx` — Маршрут создания (chatMode=create)
- `lib/utils.ts` — `getChatUrl()` — формирование URL по chatMode

**ServiceChat (v3.8.0):**
- `components/service-chat/` — Унифицированная система сервисных чатов
- `components/service-chat/service-chat-core.tsx` — Ядро (messages, streaming, quickActions)
- `components/service-chat/service-chat-floating.tsx` — Floating modal (center/bottom-right)
- `components/service-chat/service-chat-drawer.tsx` — Drawer справа
- `components/service-chat/service-chat-trigger.tsx` — Универсальная кнопка
- `components/service-chat/ben-intro-bubble.tsx` — Speech bubble для онбординга
- `components/service-chat/configs/` — Конфиги (ben, project-creation, project-manager)
- `app/(chat)/api/service-chat/route.ts` — Унифицированный API
- `app/(chat)/api/assistant/ben/route.ts` — Legacy API Бена

**UserMenu (глобальный):**
- `components/user-menu.tsx` — Автономный dropdown (avatar + Настройки, Тема, Выйти). Prop `align`

**Sidebar (контекстный, icon mode):**
- `components/sidebar-layout.tsx` — Layout с SidebarProvider
- `components/sidebar-history.tsx` — История чатов (контекстная фильтрация, ⭐ toggle)
- `components/sidebar-history-item.tsx` — Элемент чата (inline-редактирование, ⭐ toggle, tooltip)
- `components/app-sidebar.tsx` — Sidebar `collapsible="icon"` (паттерн Claude): навигация (Главная, Новый чат, Все чаты) + история (скрыта в icon mode)
- `components/ui/sidebar.tsx` — CSS variable `--sidebar-left-offset`

**Right Sidebar (v3.21.0 — ChatSidebar):**
- `components/right-sidebar.tsx` — Унифицированный правый сайдбар-shell (bg-sidebar, Sheet на мобильных, push-layout). Переиспользуемый контейнер для chat/projects/helpers
- `components/chat-sidebar.tsx` — Материалы чата (артефакты + вложения), scroll-to-message навигация, скачивание. Использует RightSidebar

**Core Model Registry (v3.83.0 — ТЗ-1):**
- `lib/ai/getModel.ts` — **SSOT резолва моделей**. `getModel(taskId)`, `getModelIdForTask`, `getProviderForTask`, `taskSupportsThinking`. Любая из 39 AI-точек получает модель **только** через эту функцию.
- `lib/ai/task-assignments.ts` — `DEFAULT_TASK_MODELS: Record<TaskId, string>` — 39 taskId. Смена default-модели = одна строка.
- `lib/ai/model-catalog.ts` — SSOT физических моделей: pricing (USD/1M), capabilities (vision/tools/thinking), contextWindow, алиасы.
- `lib/ai/registry.ts` — `createProviderRegistry` (AI SDK v6): 5 namespace — `anthropic`, `minimax`, `minimaxLong` (180s timeout для briefing), `xai`, `openrouter`.
- **Удалены в Stage 5:** `myProvider`, `claudeHaiku/Sonnet/Opus`, `minimaxM27/Long`, `getClaudeModel`, `MODEL_CONTEXT_WINDOW`, env-overrides (`PROFESSOR_MODEL`/`SUMMARIZER_MODEL`/`SNAPSHOT_CLERK_MODEL`/`EXPERT_MODEL`).
- См. [docs/decisions/047-core-model-registry.md](docs/decisions/047-core-model-registry.md) + [docs/ai-providers.md](docs/ai-providers.md)

**AI/Chat:**
- `app/(chat)/api/chat/route.ts` — Chat endpoint (streaming, sanitizeCoreMessages, isStarred PATCH)
- `app/(chat)/api/chat/[id]/route.ts` — Chat management (DELETE/PATCH)
- `app/(chat)/api/chat/[id]/generate-title/route.ts` — Автонейминг + summary (v3.5.0)
- `lib/ai/providers.ts` — **Чистый pricing/cost utility module** (после Stage 5): `calculateCostRub`, `calculateCostBreakdownRub`, `extractUsageForPricing`, `getContextWindow`, `calculateDeepgramCostUsd`, `calculateGeminiTtsCostUsd`. Не содержит model resolution.
- `lib/ai/usage-utils.ts` — Unified usage logging: `extractUsageFields()` + `logUsage()` (fire-and-forget). chatMode конвенция: `service:*|professor:*|clerk:*|briefing:*|podcast:*|tool:*|meeting:*|util:*|project:*|artifact:*` ← v3.69.0
- `lib/ai/retry-with-logging.ts` — Retry-обёртка для pipeline: `retryWithLogging()` с per-attempt логированием. Заменяет скрытые SDK retry (maxRetries:0) ← v3.69.0
- `lib/ai/model-tiers.ts` — Тонкая обёртка: `tier → taskId → getModel()` (v3.83+)
- `lib/ai/chat-mode-config.ts` — Тонкая обёртка: `chatMode → taskId → getModel()` (v3.83+)
- `lib/ai/professor-pipeline.ts` — Pipeline для режима Профессор
- `lib/ai/task-completion-types.ts` — Zod-схемы и типы для завершения задач
- `lib/ai/clerks/task-summarizer.ts` — Суммаризатор задач (Claude Haiku)
- `lib/ai/professors/task-reviewer.ts` — Ревьюер задач (Claude Opus)
- `lib/utils.ts` — `sanitizeCoreMessages()` — санитизация сообщений для Anthropic API (удаление orphan tool-calls/results, пустых сообщений)
- `lib/ai/tools/` — Инструменты (search, excel, web scraping, research)
- `lib/ai/tools/excel/` — Excel tools (create, parse, edit)
- `lib/ai/tools/read-project-file.ts` — Tool чтения файлов проекта по имени
- `lib/ai/tools/deep-research.ts` — Deep Research tool (Perplexity Sonar API, Pro/Deep) ← v3.29.0
- `lib/ai/tools/perplexity-client.ts` — Shared Perplexity API utility (extracted from deep-research) ← v3.52.0
- `lib/ai/tools/fetch-url.ts` — Fetch URL tool (cascade: Readability → Jina) ← v3.29.0, v3.35.0
- `lib/ai/tools/fetch-page.ts` — Shared utility: каскад Readability (8s) → semantic → Jina (10s), charset detection, source tracking, RSS discovery ← v3.29.0, v3.34.0, v3.35.0, v3.52.0
- `lib/ai/tools/jina-reader.ts` — Jina Reader API utility (headless Chrome fallback) ← v3.35.0
- `lib/ai/tools/read-telegram-channel.ts` — Чтение публичных Telegram-каналов (shared parser wrapper) ← v3.47.0

**Shared Telegram Parser (v3.47.0):**
- `lib/telegram/types.ts` — TelegramPost, TelegramParseResult, ParseTelegramOptions
- `lib/telegram/utils.ts` — normalizeChannelUrl, extractChannelHandle
- `lib/telegram/parser.ts` — parseTelegramChannel (cheerio, hasMedia, isValid, freshness, redirects)

**Telegram Bot (v3.49.0 — ТЗ-TG3, v3.56.0 — ТЗ-TG5):**
- `lib/telegram/bot.ts` — grammY бот (@GetSimplyBot): /start (deep link + cold + return), /stop, /help, unknown. Inline URL-кнопки. Group handlers: my_chat_member (add/remove), message (text/caption/media), forum_topic_created/edited
- `app/api/telegram/webhook/route.ts` — Webhook endpoint (webhookCallback, secret validation)
- `app/api/telegram/setup/route.ts` — Admin: POST setWebhook, GET getWebhookInfo (Bearer auth), allowed_updates: message + my_chat_member
- `app/(chat)/api/telegram/link/route.ts` — Link API: POST (generate deep link), GET (status), DELETE (unlink)
- `app/(chat)/api/telegram/groups/route.ts` — GET: список групп пользователя (messageCount, lastMessageAt)
- `app/(chat)/api/telegram/groups/[groupId]/messages/route.ts` — GET: сообщения группы (cursor-pagination, topic filter)
- `app/(chat)/api/telegram/groups/[groupId]/route.ts` — DELETE: деактивация группы
- `app/(chat)/api/telegram/groups/[groupId]/messages/[messageId]/route.ts` — DELETE: удаление сообщения
- `lib/telegram/file-downloader.ts` — Скачивание файлов: Telegram Bot API getFile → Vercel Blob upload (до 20 МБ, стикеры пропускаются)
- `app/(dashboard)/settings/settings-page.tsx` — +секция "Подключения" (ConnectionsSection: QR, polling, connect/disconnect) + ссылка «Группы Telegram» → /groups

**Telegram Groups UI (v3.56.0 — ТЗ-TG5):**
- `app/(dashboard)/groups/page.tsx` — Server Component (auth + fetch groups)
- `components/groups/groups-page.tsx` — Client Component (ListDetailPage layout, деактивация, state)
- `components/groups/group-list.tsx` — Список групп (название, тип, форум badge, статус, сообщения, дата, «Отключить»)
- `components/groups/group-detail.tsx` — Просмотр группы (header, табы топиков для форумов, лента сообщений, cursor-based «Загрузить ещё», удаление)
- `components/groups/group-message-list.tsx` — Утилитарная лента (автор, текст, дата, media icon, file preview/download, trash on hover)

**Background Briefing (v3.54.0 — ТЗ-TG4a, v3.55.0 — ТЗ-TG4b, v3.55.1 — PodcastFromCron, v3.66.0 — ТЗ-COSTCTRL):**
- `vercel.json` — Vercel Cron config (daily: `0 5 * * *` Hobby plan)
- `app/api/cron/briefing/route.ts` — Cron handler: CRON_SECRET auth, getUsersForDelivery (INNER JOIN Telegram), pre-flight check, p-limit(3), waitUntil(logUsage), saveCronRunLog
- `lib/briefing/delivery-service.ts` — Единая точка мутации deliveryEnabled: setBriefingDelivery (invariant: требует активный Telegram → 409), disableDeliveryOnTelegramDisconnect (cascade) ← v3.66.0
- `lib/briefing/briefing-pipeline.ts` — Core pipeline (browser + background)
- `lib/podcast/podcast-pipeline.ts` — Core podcast pipeline (browser + background)
- `lib/podcast/audio-merger.ts` — Склейка per-section MP3 → один файл → Vercel Blob ← v3.55.1
- `lib/telegram/briefing-delivery.ts` — Доставка брифинга в Telegram: formatBriefingMessage (HTML), deliverBriefingToTelegram (text + mergedAudioUrl), error handling
- `app/(chat)/api/briefing/delivery/route.ts` — GET/PATCH delivery settings + telegram status (PATCH через delivery-service, 409 при invariant violation)
- `components/briefing/briefing-delivery-settings.tsx` — UI настроек доставки: escape hatch (выключить всегда можно), tooltip без Telegram, 409 handling
- `app/api/admin/cost-audit/route.ts` — JSON API cost audit (gated: isSimplyDevMode) ← v3.66.0
- `app/(dashboard)/admin/cost-audit/page.tsx` — Cost audit dashboard: period selector (24ч/7д/30д/3м/12м), by model/chatMode/period, null cost, cron history ← v3.66.0

**Tool Call Guardian (v3.50.0 — ТЗ-FIX1, v3.51.0 — ТЗ-FIX1.2, v3.53.0 — Guardian Bypass):**
- `lib/ai/tool-call-guardian.ts` — Детектор галлюцинаций tool calls (паттерны RU/EN, `detectToolHallucination()`, `createStepTracker()`, `findToolMentions()`)
- Phase 2 (v3.51.0): полная буферизация text events per step в instrumentedStream → на finish-step: flush (чисто) или block (галлюцинация). 2+ блокировок подряд → error message. Все 3 routes.
- Guardian Bypass (v3.53.0): для `context === "briefing-onboarding"` текст проходит без буферизации, Guardian только логирует (console.warn). Паттерн расширяем на другие multi-step flows. См. [ADR 025](docs/decisions/025-guardian-bypass-pattern.md)

**Tool Activity UX (v3.20.0):**
- `lib/ai/tool-activity-config.ts` — Конфиг инструментов (icon, activeLabel, doneLabel, argsFormatter, resultFormatter, resultCounter)
- `components/tool-activity-indicator.tsx` — Индикатор активности (спиннер/галочка, ×N бейдж, раскрываемые детали)

**Developer Panel (v3.57.0 — ТЗ-DEV1, v3.59.0 — ТЗ-DEV3 Onboarding):**
- `lib/ai/debug-events.ts` — Типы + emit functions (DebugStepData с stepCostRub, DebugFinishData, DebugGuardianData, DebugPromptData) + truncateToolResultSmart(). Guard: isSimplyDevMode
- `lib/ai/providers.ts` — +MODEL_PRICING_RUB + calculateCostRub() + getStepCostRub() (SSOT: server-calculated → fallback to hardcoded) + RUB_PER_USD
- `lib/ai/tokenlens-catalog.ts` — +calcStepCostRub() (server-side: TokenLens → USD → RUB, fallback to MODEL_PRICING_RUB)
- `components/dev-panel/dev-panel-provider.tsx` — React Context, аккумуляция debug events per message, useDevPanel(messageId) hook, NEXT_PUBLIC_SIMPLY_DEV_MODE gate
- `components/dev-panel/onboarding-debug-provider.tsx` — Provider для онбординга (useOnboardingDebug → DevPanelContext) ← v3.59.0
- `hooks/use-onboarding-debug.ts` — Hook сбора debug events из useChat onData (localStorage persistence) ← v3.59.0
- `components/dev-panel/dev-panel-footer.tsx` — Компактная строка под AI-ответом (модель · токены · ₽стоимость · время), live elapsed timer, error state (красный), per-step cost sum
- `components/dev-panel/dev-panel-drawer.tsx` — Sheet справа (w-full sm:w-[440px]) с 8 секциями
- `components/dev-panel/sections/` — model-section, tokens-section, cost-breakdown-section, timeline-section, tools-section, guardian-section, prompt-section, raw-section
- `components/dev-panel/sections/tools-section.tsx` — Structured display per tool type (deepResearch, fetchUrl, readTelegramChannel, updateBriefingPreview) + source warnings ← v3.59.0
- `components/dev-panel/sections/cost-breakdown-section.tsx` — Per-step cost bar chart, reasoning tokens, delta warning ← v3.59.0
- `components/dev-panel/index.ts` — Exports
- `next.config.ts` — env mapping: SIMPLY_DEV_MODE → NEXT_PUBLIC_SIMPLY_DEV_MODE

**Pipeline Observability (v3.58.0 — ТЗ-DEV2):**
- `lib/ai/pipeline-trace.ts` — Типы (PipelineTrace, PipelineStageTrace, FetchTrace, UrlVerificationTrace) + TraceCollector класс + helpers (buildAiCallTrace, buildTtsTrace, verifyArticleUrls). Guard: isSimplyDevMode
- `lib/ai/providers.ts` — +MODEL_PRICING_RUB расширен (Gemini 2.0/2.5 Flash, Perplexity Sonar Pro, Claude Sonnet 4.5 fallback) + calculateTtsCostRub()
- `components/dev-panel/pipeline-trace-footer.tsx` — Compact monospace line: live status при генерации, итог после завершения. Persistent из DB metadata
- `components/dev-panel/pipeline-trace-drawer.tsx` — Sheet справа: Summary, Cost Breakdown (per-stage bars), Stages, Fetches, Raw JSON

**Projects (v3.16.0 — ExpertTaskChat):**
- `app/(dashboard)/projects/[id]/page.tsx` — Страница проекта (Server Component)
- `components/projects/project-page-layout.tsx` — Двухколоночный layout (Пульс + WorkArea + Drawer)
- `components/projects/project-pulse.tsx` — Навигационный Пульс (План, Файлы, Паспорт) + ProjectTask[] кликабельные
- `components/projects/project-work-area.tsx` — Рабочая область (switch по phase)
- `components/projects/manager-drawer.tsx` — Push-drawer Менеджера с живым AI-диалогом (ServiceChatCore)
- `components/projects/project-files-card.tsx` — Файлы проекта (auto-analyze, documentType, tooltip)
- `components/projects/phase-states/` — 5 компонентов фаз (welcome, planning, approved, execution, completed)
- `app/(dashboard)/projects/page.tsx` — Список проектов
- `app/(dashboard)/projects/new/page.tsx` — Создание проекта
- `app/(dashboard)/projects/[id]/chat/` — Чаты проекта
- `app/(chat)/api/projects/` — API проектов (CRUD)
- `app/(chat)/api/projects/[id]/plan/route.ts` — Профессор планирования (Claude Opus)
- `app/(chat)/api/projects/[id]/approve-plan/route.ts` — Утверждение плана → ProjectTask[]
- `app/(chat)/api/projects/[id]/tasks/route.ts` — GET ProjectTask[]
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — Чат с Экспертом (streaming)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/unlock/route.ts` — Разблокировка locked задачи
- `app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts` — Завершение задачи (summarize → review → save)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts` — Доработка (issues → in_progress)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts` — Принятие (issues → done + unlock)
- `app/(chat)/api/projects/[id]/analyze-file/route.ts` — Клерк-анализатор файлов (Claude Haiku)
- `lib/ai/professor-types.ts` — Zod-схемы плана (tasks, risks, recommendations, caveats)
- `lib/ai/tools/chat-tools.ts` — Shared tools (getStandardTools)
- `components/projects/professor-progress.tsx` — UI прогресса pipeline

**ExpertTaskChat (v3.16.0) + TaskCompletion (v3.17.0):**
- `app/(task)/layout.tsx` — Layout route group (SWRProvider + DataStreamProvider, без AppSidebar)
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — Страница задачи (Server Component, auth + guards)
- `components/projects/task-chat.tsx` — Полноценный чат с Экспертом (streaming, артефакты, auto-trigger, завершение задачи)
- `components/projects/task-sidebar.tsx` — Навигация между задачами (статусы, сворачивание, «← К проекту»)
- `components/projects/task-completion-card.tsx` — Карточка результата (success/issues/critical)
- `lib/prompts/experts/task-expert.md` — Промпт Эксперта
- `lib/prompts/build-task-expert-prompt.ts` — Prompt builder (project + task + completedTasks + manifest)

**Context Window Management (v3.18.0 — ТЗ-C1.5, v3.73.0 — ТЗ-RAG3 Compaction, v3.78.0 — ТЗ-ExtractCompression):**
- **Extract-on-compression** (v3.78.0) — Simply Chat: при 60% контекста (+ пауза 10мин) или 80% → batch extraction фактов (MiniMax M2.7) → обработанные сообщения исключаются из загрузки (`extractedAt IS NULL`). Событийная цепочка: ≥10 фактов → консолидация (MiniMax) → ≥10 изменений → профиль (MiniMax). Safety-cap 180K. Ночной cron как страховка (>24ч)
- **Compaction API** (v3.73.0) — Anthropic `compact_20260112` для Sonnet/Opus (expertise, create, project tasks). Trigger: 100K input tokens. Конфигурация через `providerOptions.anthropic.contextManagement` в streamText
- **Snapshot** (legacy, только Haiku `chatMode="chat"`) — самодельная суммаризация для Haiku 4.5 (не поддерживает Compaction)
- `lib/ai/context-limits.ts` — Конфиг (CONTEXT_BUDGET, SIMPLY_CONTEXT_LIMIT, EXTRACT_THRESHOLD_SOFT/HARD, EXTRACT_PAUSE_MS, SNAPSHOT_THRESHOLD, FALLBACK_MESSAGE_PAIRS)
- `lib/ai/tools/create-snapshot.ts` — Tool createSnapshot — только для Haiku
- `lib/ai/clerks/snapshot-creator.ts` — Fallback-клерк — только для Haiku
- `lib/prompts/clerks/snapshot-creator.md` — Промпт fallback-клерка
- `components/projects/snapshot-card.tsx` — SnapshotCard + SnapshotDivider
- `components/projects/context-indicator.tsx` — Progress bar над input — только для Haiku

**MIND Memory / RAG (v3.70.0 — ТЗ-RAG0, v3.71.0 — ТЗ-RAG1, v3.72.0 — ТЗ-RAG2, v3.78.0 — ТЗ-ExtractCompression):**
- `lib/ai/memory/voyage-client.ts` — Voyage AI клиент (raw fetch, embed + batch, voyage-4 / voyage-4-lite)
- `lib/ai/memory/memory-queries.ts` — CRUD + similarity search (pgvector cosine distance `<=>`), server-only
- `lib/ai/memory/types.ts` — MemoryCategory (6), MemorySourceType (4), SearchOptions, VoyageEmbedResponse
- `lib/ai/memory/extract.ts` — extractFactsFromMessages (Claude Sonnet + generateObject), extractAndStoreFacts (extract → embed → dedup → upsert), batchExtractFacts (batch из 50 сообщений, один Sonnet call) ← v3.78.0, мини-консолидация триггер ← v3.72.0, двухуровневая дедупликация (embedding 0.55 + Haiku LLM verify) ← v3.73.0
- `lib/ai/memory/retrieve.ts` — retrieveMemoryContext (semantic search top-5), formatMemoryForPrompt (XML `<memory>` блок) ← v3.71.0
- `lib/ai/memory/consolidate.ts` — consolidateUserMemory (полная ревизия, Sonnet), miniConsolidateUserMemory (event-triggered каждые 20 фактов) ← v3.72.0
- `lib/ai/memory/profile.ts` — generateUserProfile (Opus нарративный профиль), getProfileBlock (XML `<user-profile>`) ← v3.72.0
- `lib/ai/memory/index.ts` — Public API exports
- `lib/prompts/memory/extract.md` — Промпт извлечения фактов (категории, confidence, правила) ← v3.71.0
- `lib/prompts/memory/extract-batch.md` — Промпт batch-извлечения (целый фрагмент диалога) ← v3.78.0
- `lib/prompts/memory/consolidate.md` — Промпт ревизии фактов (supersede/merge/remove) ← v3.72.0
- `lib/prompts/memory/profile.md` — Промпт Opus-профиля (нарративный, 800-1200 слов) ← v3.72.0
- `lib/db/schema.ts` — +customType vector(1024), +memoryEntry table, +memorySettings table, +userProfileSummary table ← v3.72.0
- `lib/db/migrations/0048_memory-entry.sql` — pgvector extension + таблица + индексы
- `lib/db/migrations/0049_memory-settings-and-profile.sql` — memory_settings + user_profile_summary ← v3.72.0
- `app/(chat)/api/user/memory/route.ts` — GET (список фактов) / DELETE (один или все) ← v3.72.0
- `app/(chat)/api/user/memory/settings/route.ts` — GET/PATCH (memoryEnabled toggle) ← v3.72.0
- `lib/db/migrations/0052_extract-at-column.sql` — extractedAt в Message_v2 ← v3.78.0
- `app/api/cron/memory-profile/route.ts` — Ночной cron: только страховка — batch extract stale (>24h), цепочка событий внутри (consolidation → profile), 0:00 UTC ← v3.72.0, v3.78.0
- `components/settings/memory-section.tsx` — UI секция «Память» на /settings (toggle, профиль, факты, удаление) ← v3.72.0
- `components/dev-panel/sections/rag-section.tsx` — DevPanel секция MIND Memory (category badges, similarity, tokens) ← v3.71.0

**Voice Input (Deepgram):**
- `app/(chat)/api/deepgram/token/route.ts` — Token API
- `lib/audio/` — Аудио утилиты (types, constants, utils)
- `hooks/use-voice-recorder.ts` — Хук записи (Deepgram Nova-3)
- `components/voice-button.tsx` — Кнопка микрофона

**Meeting Recorder (v3.61.0 — ТЗ-MR, v3.62.0 — ТЗ-MR2):**
- `app/(dashboard)/meeting/page.tsx` — Server Component (auth → MeetingPage)
- `app/(chat)/api/meeting/process/route.ts` — POST endpoint: upload → Deepgram → Claude → save (NDJSON streaming)
- `app/(chat)/api/meeting/records/route.ts` — GET list (lightweight, без transcript/summary)
- `app/(chat)/api/meeting/records/[id]/route.ts` — GET full record / DELETE
- `app/(chat)/api/meeting/upload/route.ts` — POST endpoint: client-side Vercel Blob upload handler (handleUpload) ← v3.62.0
- `app/(chat)/api/meeting/regenerate/route.ts` — POST endpoint: regenerate summary from existing transcript (new format/instructions) ← v3.62.0
- `app/(chat)/api/meeting/export-pdf/route.ts` — POST endpoint: generate PDF from meeting record ← v3.62.0
- `lib/meeting/meeting-pipeline.ts` — Core pipeline (Deepgram Nova-3 transcription → Claude Sonnet summarization → DB save → blob cleanup) + extracted `summarizeTranscript()` ← v3.62.0
- `lib/meeting/meeting-types.ts` — Типы (MeetingPipelineInput, MeetingPipelineResult, MeetingProgressEvent, SummaryLevel)
- `lib/meeting/deepgram-transcribe.ts` — Deepgram batch API (raw fetch, nova-3, diarize, русский)
- `lib/meeting/pdf-generator.ts` — Markdown → PDF конвертер (pdfmake + remark AST, Roboto/Cyrillic, A4) ← v3.62.0
- `lib/prompts/meeting/` — Промпты суммаризации (3 .md файла: compact/standard/detailed)
- `lib/db/schema.ts` — +meetingRecord таблица (userId FK, title, durationSeconds, speakerCount, summaryLevel, transcript, summary, userInstructions, originalRecordId, metadata JSONB)
- `lib/db/queries.ts` — +saveMeetingRecord, getMeetingRecords, getMeetingRecord, deleteMeetingRecord, getMeetingRecordsCount
- `hooks/use-meeting-processing.ts` — Custom hook: fetch POST → parse NDJSON → state (steps, isProcessing, error)
- `components/meeting/meeting-page.tsx` — Страница записи (state machine: input→ready→uploading→processing→result→viewing, user instructions, regeneration)
- `components/meeting/meeting-progress.tsx` — UI прогресса pipeline (steps, animation, error/retry)
- `components/meeting/meeting-result.tsx` — Результат (MarkdownViewer, metadata pills, кликабельные таймкоды, аудио-плеер, copy/delete, PDF export, regenerate) ← v3.62.0
- `components/meeting/meeting-list.tsx` — Список предыдущих записей (относительные даты, навигация)
- `components/meeting/meeting-card.tsx` — Карточка на дашборде (count + lastTitle)
- `components/meeting/regenerate-modal.tsx` — Модалка регенерации (формат + инструкции) ← v3.62.0

**Morning Briefing Backend (v3.26.0):**
- `lib/db/schema.ts` — +3 таблицы (briefingSettings, briefingSources, briefingHistory)
- `lib/db/queries.ts` — +7 CRUD queries (getBriefingSettings, upsertBriefingSettings, getBriefingSources, addBriefingSource, deleteBriefingSource, saveBriefingHistory, getBriefingHistory)
- `lib/briefing/briefing-config.ts` — Константы (лимиты, таймауты, модели MiniMax M2.7, CRON_INTERVAL_MINUTES, CRON_CONCURRENCY_LIMIT)
- `lib/briefing/briefing-pipeline.ts` — Core pipeline: load settings → fetch → filter → generate → save (browser + background) ← v3.54.0
- `lib/briefing/topics-catalog.ts` — Каталог тем (10 тем × 3-4 источника с RSS)
- `lib/briefing/source-fetchers/` — Фетчеры: types.ts, rss-fetcher.ts, telegram-fetcher.ts, web-fetcher.ts, index.ts (dispatcher)
- `lib/briefing/briefing-filter.ts` — AI фильтр (MiniMax M2.7, streamText + JSON.parse + Zod, дедупликация → FilteredItem[])
- `lib/briefing/briefing-author.ts` — AI автор статьи (MiniMax M2.7, streamText + JSON.parse + Zod, generateArticle → BriefingArticle)
- `app/(chat)/api/briefing/generate/route.ts` — POST endpoint, streaming (тонкая обёртка вокруг briefing-pipeline)
- `app/(chat)/api/briefing/delivery/route.ts` — GET/PATCH delivery settings + telegram status ← v3.54.0
- `lib/db/seed-briefing.ts` — Seed-скрипт (20 источников для тестового юзера)

**Podcast Engine (v3.43.0 — ТЗ-Б1, v3.82.0 — финальная архитектура):**
- `lib/podcast/index.ts` — Public API: generatePodcastSegment() (M2.7 script → Gemini Flash TTS → PCM → MP3)
- `lib/podcast/script-generator.ts` — MiniMax M2.7: generateScript() — JSON+plain text universal parser
- `lib/podcast/tts-gemini.ts` — Gemini 2.5 Flash TTS: generateSpeechWithRetry() (multi-speaker: Kore + Iapetus) ← возвращён в v3.82.0
- `lib/podcast/audio-converter.ts` — PCM → MP3 (lamejs, lazy loading + pnpm path resolution) ← возвращён в v3.82.0
- `lib/podcast/audio-merger.ts` — Склейка MP3 треков + upload в Vercel Blob
- `lib/podcast/types.ts` — Все типы (TTSProvider, VoiceConfig, ScriptLine, PodcastSegment, PodcastProgressEvent)
- `lib/podcast/podcast-pipeline.ts` — Core podcast pipeline (browser + background)
- `app/(chat)/api/briefing/podcast/generate/route.ts` — Streaming POST endpoint
- `lib/prompts/briefing/briefing-scriptwriter.md` — System prompt скриптрайтера (v2: интонационные теги, антипаттерны)
- **Стоимость подкаста:** ~$0.019 (Script $0.005 + TTS $0.014). См. ADR 046

**Auth/DB:**
- `app/(auth)/` — NextAuth 5.0 setup
- `lib/db/schema.ts` — Database schema (Drizzle)
- `lib/db/queries.ts` — Database queries

**User Profile:**
- `app/(chat)/api/user/profile/route.ts` — API профиля (GET/PATCH)
- `app/(chat)/api/user/ben-intro/route.ts` — API флага Бена (GET/PATCH)
- `app/(dashboard)/settings/page.tsx` — Страница настроек (без sidebar)
- `components/onboarding-dialog.tsx` — Онбординг

**Config:**
- `.env.local` — API keys (НЕ коммитить!)
- `next.config.ts` — Next.js config
- `drizzle.config.ts` — Database config

---

## Текущий этап

**Завершены:** ТЗ-1 (v3.83.0 — CoreRegistry: getModel(taskId) + catalog + task-assignments + Neon HTTP + DevPanel artifact observability + ChatSDKError cause chain), ТЗ-MapReduce (v3.82.0 — PodcastTtsRevert+BriefingStability), ТЗ-Briefing-2 (v3.81.0 — PodcastMinimax), ТЗ-Briefing-1 (v3.80.0 — BriefingAuthorMinimax), ТЗ-SimplyToolsMinimax (v3.79.0 — SimplyToolsMinimax), ТЗ-ExtractCompression (v3.78.0 — ExtractOnCompression), ТЗ-MinimaxCleanup (v3.77.0 — MiniMaxM27+GeminiFlash+Cleanup), ТЗ-SlidingWindow (v3.76.0 — StableCostSlidingWindow), ТЗ-SaveFact (v3.75.0 — GuaranteedMINDWrite), ТЗ-KITT (v3.74.0 — SimplyChat+ContextDashboard), ТЗ-RAG3 (v3.73.0 — CompactionDualStrategy), ТЗ-RAG2 (v3.72.0 — MINDConsolidationProfileUI), ТЗ-RAG1 (v3.71.0 — MINDExtractRetrieve), ТЗ-RAG0 (v3.70.0 — SimplyRAG Infrastructure), ТЗ-PIPELINE1 (v3.69.0 — ReliablePipelineObservability), ТЗ-BILLING1 (v3.68.0 — FullCostCoverage), ТЗ-TOKENS1 (v3.67.0 — SdkNativeUsageTracking), ТЗ-COSTCTRL (v3.66.0 — BriefingCostControl), ТЗ-SDK6 (v3.65.0 — AiSdkV6Migration), ТЗ-CACHE3 (v3.64.0 — UnifiedCostUI), ТЗ-CACHE2 (v3.63.0 — UnifiedUsageLogging), ТЗ-MR2 (v3.62.0 — MeetingRegenerate+PDF), ТЗ-MR (v3.61.0 — MeetingRecorderMVP), ТЗ-CACHE1 (v3.60.0 — PromptCaching), ТЗ-DEV3 (v3.59.0 — OnboardingDevPanel), ТЗ-DEV2 (v3.58.0 — PipelineObservability), ТЗ-DEV1 (v3.57.0 — DeveloperPanel), ТЗ-TG5 (v3.56.0 — ClosedGroups), HOTFIX-PodcastFromCron (v3.55.1 — ADR 027), ТЗ-TG4b (v3.55.0 — TelegramDelivery), ТЗ-TG4a (v3.54.0 — BackgroundBriefing), ТЗ-FIX3 (v3.53.0 — OnboardingRestore), ТЗ-FIX2 (v3.52.0 — ResearchProgressMode), ТЗ-FIX1.2 (v3.51.0 — GuardianBlocking), ТЗ-FIX1 (v3.50.0 — ToolCallGuardian), ТЗ-TG3 (v3.49.0 — TelegramBotInfrastructure), ТЗ-TG2 (v3.48.0 — OnboardingTelegram), ТЗ-TG1 (v3.47.0 — TelegramPhase1), ТЗ-OPT1 (v3.46.0 — UsageLogging + SonnetMigration), PATCH-podcast (v3.45.1 — PodcastFixes), ТЗ-BF5 (v3.45.0 — BriefingDedup), ТЗ-Б2 (v3.44.0 — PodcastUI), ТЗ-Б1 (v3.43.0 — PodcastEngine), ТЗ-BF4 (v3.42.0 — PerSectionRefresh), ТЗ-BF3 (v3.41.0 — BriefingSidebarRedesign), ТЗ-BF2 (v3.40.0 — SimplyNews), ТЗ-BF1 (v3.39.0 — BriefingUIRefactor), ТЗ-BRIEFING-AUTHOR-CLAUDE (v3.38.0 — BriefingAuthorClaude), PATCH-volume (v3.37.1 — BriefingVolumePromptEnforcement), ТЗ-BF1-fix (v3.37.0 — BriefingItemIdFix), ТЗ-BRIEFING-VOLUME (v3.36.0 — BriefingVolume), ТЗ-WS2 (v3.35.0 — JinaReader), ТЗ-WS1 (v3.34.0 — CharsetUnification), ТЗ-HF1 (v3.33.1 — BriefingPEUpdate), ТЗ-А5 (v3.33.0 — BriefingProgress), ТЗ-А4 (v3.32.0 — BriefingIssuePage), ТЗ-А3 (v3.31.0 — BriefingAuthor), ТЗ-A2 (v3.30.0 — BriefingOnboarding), ТЗ-PX+FU (v3.29.0 — DeepResearch + FetchUrl), ТЗ-A1 (v3.28.0 — BriefingLanding), ТЗ-BR3 (v3.27.1 — PromptIntegration), ТЗ-BR2 (v3.27.0 — BriefingUI), ТЗ-BR1 (v3.26.0 — MorningBriefingBackend), ТЗ-RG (v3.25.0 — RouteGroups), ТЗ-DV2 (v3.24.0 — DashboardV2), ТЗ-C4 (v3.23.0 — AnthropicProviderSwitch), ТЗ-C3 (v3.22.0 — ChatContextManagement), ТЗ-08CS (v3.21.0 — ChatSidebar + RightSidebar), ТЗ-07 (v3.20.0 — ToolActivity + SidebarIconMode), ТЗ-DS (v3.19.0 — DesignSystem), ТЗ-C1.5 (v3.18.0 — ContextManagement), ТЗ-C2 (v3.17.0 — TaskCompletion), ТЗ-C1 (v3.16.0 — ExpertTaskChat), ТЗ-B2 (v3.15.0 — Approval + ProjectTask), ТЗ-B1 (v3.14.0 — Professor Planning), ТЗ-A3 (v3.13.0 — Manager + Clerk + Manifest), ТЗ-A1 (v3.12.0 — Project Page Layout), ТЗ-12 (v3.11.0 — Secretary), ТЗ-09 (v3.8.0 — ServiceChat), ТЗ-08 (v3.7.0 — File Viewer), ТЗ-07B (v3.5.0 — Chat History), ТЗ-07A (v3.4.0 — Glavnaya + Navigation + Sidebar), ТЗ-04 (v3.3.0 — Skills + Agents), ТЗ-03 (v3.2.0 — Проекты + Claude), ТЗ-02 (v3.1.0 — Dashboard + Sidebar), ТЗ-NEW-01 (v3.0.0 — новая архитектура промптов)
**Прогресс:** См. [SIMPLY_STATUS.md](SIMPLY_STATUS.md)

**Следующие этапы (по приоритету):**
| Этап | Описание | Приоритет |
|------|----------|-----------|
| 8 | Инструменты Фаза 1 (Perplexity, Plus AI, Ideogram) | Высокий |
| 9 | RAG (База знаний) | Средний |
| 10 | Chat Memory | Средний |
| 11 | Мультипровайдер (GPT) | Средний |
| 12 | Биллинг (Pay-as-you-go) | Средний |

**Документы в холсте (5 типов):**
- `text` — plain text для соцсетей
- `markdown` — форматированные документы
- `excel` — таблицы с формулами и графиками
- `presentation-reveal` — веб-презентации
- `presentation-pptx` — PowerPoint

**Детали:** [docs/ai-artifacts.md](docs/ai-artifacts.md) | [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md)

---

## Команды

```bash
# Разработка
npm install              # Установка зависимостей
npm run dev              # Dev сервер (localhost:3000)
npm run build            # Сборка production
npm run start            # Запуск production

# Database
npm run db:migrate       # Применить миграции
npm run db:studio        # Drizzle Studio

# Deploy
vercel --prod            # Deploy на Vercel
```

---

## Навигация

**Основная:**
- [README.md](README.md) — О проекте
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — Видение продукта
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — Текущее состояние проекта
- [CHANGELOG.md](CHANGELOG.md) — История изменений

**Техническая (AI):**
- [docs/ai-chats-map.md](docs/ai-chats-map.md) — **Карта всех чатов и моделей (SSOT)**
- [docs/ai-providers.md](docs/ai-providers.md) — Провайдеры, модели, цены
- [docs/model-catalog-ops.md](docs/model-catalog-ops.md) — **Workflow: аудит каталога, добавление моделей, кэширование**
- [docs/ai-minimax.md](docs/ai-minimax.md) — **MiniMax M2.7 — интеграция, pricing, ограничения**
- [docs/ai-agents.md](docs/ai-agents.md) — Система промптов и помощники
- [docs/ai-artifacts.md](docs/ai-artifacts.md) — Документы в холсте
- [docs/ai-tools.md](docs/ai-tools.md) — Инструменты (search, vision)

**Техническая (инфраструктура):**
- [docs/setup.md](docs/setup.md) — Установка
- [docs/architecture.md](docs/architecture.md) — Архитектура
- [docs/deployment.md](docs/deployment.md) — Deployment
- [docs/mcp-tools.md](docs/mcp-tools.md) — MCP инструменты (PostgreSQL, GitHub, Vercel)
- [docs/decisions/](docs/decisions/) — ADR

**Архив (не читать для новых задач):**
- [_archive/](_archive/) — завершённые ТЗ (история планирования)

> **Правило:** Папка `_archive/` содержит завершённые ТЗ. Вся актуальная информация уже в docs/. Не трать токены на изучение архива.

---

## MCP-инструменты (ВАЖНО!)

> **Используй MCP-инструменты для ускорения работы!** Не забывай про них.

**Доступные инструменты:**

| Инструмент | Что делает | Когда использовать |
|------------|------------|-------------------|
| `mcp__postgres__query` | SQL-запросы к базе | Проверка данных, отладка, анализ |
| `mcp__github__*` | Работа с GitHub | Коммиты, issues, PRs |
| Vercel (терминал) | Деплои, логи | Через `claude "..."` в терминале |

**Примеры использования:**
```sql
-- Вместо "посмотри в базе" — делай запрос напрямую:
SELECT * FROM "User" LIMIT 5;
SELECT COUNT(*) FROM "Chat";
```

**Документация:** [docs/mcp-tools.md](docs/mcp-tools.md)

---

## UI Guidelines

**Полные правила:** [docs/design-system.md](docs/design-system.md) — SSOT для всего UI.

**Кратко (не заменяет чтение docs/design-system.md):**
- **Компоненты:** shadcn/ui (components/ui/) + Lucide React
- **Цвета:** ТОЛЬКО семантические токены (bg-muted, text-foreground, border-border...)
- **Шрифты:** Source Sans 3 (sans), Lora (serif), JetBrains Mono (mono)
- **Hover:** Два паттерна — карточки (border-primary + shadow) и inline (bg-muted/60)
- **Принципы:** Mobile-first, SSOT компонентов, Apple-подход

**Текущие боли (backlog):**
1. Навигация между режимами не очевидна

---

## Workflow

**Моя роль:** Получаю ТЗ → Анализирую → Пишу код → Документирую

**⛔ ОБЯЗАТЕЛЬНАЯ ВАЛИДАЦИЯ:**
```
После КАЖДОЙ задачи: npx tsc --noEmit → 0 ошибок → [x]
После КАЖДОГО этапа: npm run build → ЗАПРОСИТЬ мануальный тест → ЖДАТЬ ОК
```
**НЕ делать "скопом"!** Этап → валидация → следующий этап.

**⛔ ROADMAP — ОСНОВНОЙ ЧЕКЛИСТ (НЕ TodoWrite!):**
```
НЕ использовать TodoWrite как основной чеклист задач.
Основной рабочий документ — ROADMAP.md в папке активного ТЗ.

Перед КАЖДОЙ задачей: Read ROADMAP.md → прочитать описание задачи
После КАЖДОЙ задачи: Edit ROADMAP.md → отметить [x]
После КАЖДОГО этапа: Edit ROADMAP.md → обновить статус (⬜ → ✅)
```

**При работе с новым ТЗ:**
1. Читай [specs/WORKFLOW.md](specs/WORKFLOW.md) — процесс работы с ТЗ
2. Создай папку `specs/TZ_XX_Name/`
3. Следуй фазам: Анализ → Планирование → Разработка → Финализация
4. Обновляй HANDOFF.md после каждой сессии

**Структура ТЗ:**
```
specs/
├── WORKFLOW.md         # Инструкция (передаётся с каждым ТЗ)
├── _template/          # Шаблоны файлов
└── TZ_XX_Name/         # Активное ТЗ
    ├── SPEC.md         # Само ТЗ
    ├── ANALYSIS.md     # Анализ, вопросы
    ├── ROADMAP.md      # План внедрения
    ├── CHANGELOG.md    # Лог изменений (локальный)
    └── HANDOFF.md      # Передача между сессиями
```

**При работе с существующими задачами:**
1. Читай [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние
2. Читай [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — куда идём
3. Читай docs/ — техническая документация

**Правило:** Не читай `_archive/` — там только история.

---

**Обновлено:** 2026-04-11
