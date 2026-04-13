# AI Chats Map — Simply

> **SSOT:** Полная карта всех AI-чатов, моделей и их конфигураций

**Обновлено:** 2026-04-11

---

## Быстрый обзор

> **v3.83.0 (ТЗ-1 Core Registry):** Все 39 AI-точек резолвят модель через единый `getModel(taskId)`. SSOT — [task-assignments.ts](../lib/ai/task-assignments.ts) (taskId → catalogId), [model-catalog.ts](../lib/ai/model-catalog.ts) (pricing + capabilities), [getModel.ts](../lib/ai/getModel.ts) (resolver). Смена модели для любой задачи = одна строка. Удалены `myProvider`, прямые экспорты `claudeHaiku/Sonnet/Opus`, `minimaxM27`, env-overrides (PROFESSOR_MODEL и т.д.). Добавлен `ai_usage_log.provider` column. См. [ADR 047](decisions/047-core-model-registry.md) и [ai-providers.md](ai-providers.md#core-registry-v3830-тз-1).
>
> **v3.43.0:** Podcast Engine — генерация подкастов из брифингов (Gemini 2.5 Flash скрипт + Gemini 2.5 Flash TTS озвучка, multi-speaker, MP3 → Vercel Blob).
>
> **v3.30.0:** Briefing Onboarding — AI-собеседование для настройки брифинга (Claude Sonnet 4.6, split layout, deepResearch, edit mode).
>
> **v3.80.0:** Briefing Filter + Author → MiniMax M2.7 (из Gemini Flash + Claude Sonnet). Убрана геоблокировка Google API.
> **v3.38.0:** Briefing Author → Claude Sonnet 4.6 (из Gemini). Effort для профессора и ревьюера.
>
> **v3.26.0:** Morning Briefing Backend — двухэтапный AI-пайплайн (Gemini Flash фильтр + Claude Sonnet автор) для генерации новостных сводок.
>
> **v3.24.0:** Дашборд V2 — три режима чатов (chat/expertise/create), удалены помощники, ListDetailPage.
>
> **v3.23.0:** Все AI-модели переключены с Google Gemini на Anthropic Claude через `@ai-sdk/anthropic`.

> **⚠️ Важно для разработчиков:** Этот документ описывает **чаты и UI**. Модели в таблицах ниже — **актуальный снимок на дату документа**, реальный источник правды — `task-assignments.ts`. Если эта таблица расходится с task-assignments.ts — правда в коде.

| Чат | Модель | Статус | Назначение |
|-----|--------|--------|-----------|
| **Simply Chat (chatMode=simply)** | MiniMax M2.7 (12 tools) / Gemini 3 Flash Preview (vision) / Sonnet (think, 14 tools) | ✅ Работает | Persistent чат, маршрутизация по контенту, tools v3.79 |
| **Чат (chatMode=chat)** | Claude Haiku | ✅ Работает | Обычный чат |
| **Экспертиза (chatMode=expertise)** | Claude Sonnet | ✅ Работает | Точные ответы с проверкой фактов |
| **Создание (chatMode=create)** | Claude Sonnet | ✅ Работает | Презентации, отчёты, изображения |
| **Проект: Исполнитель** | Claude Haiku | ✅ Работает | Быстрые простые задачи |
| **Проект: Эксперт** | Claude Sonnet | ✅ Работает | Баланс качества и скорости (DEFAULT) |
| **Проект: Профессор** | Claude Opus | ✅ Работает | Сложные задачи |
| **Бен** | Claude Haiku | ✅ Работает | Помощник по платформе |
| **Создание проекта** | Claude Sonnet | ✅ Работает | Секретарь — AI-интервью для создания проекта |
| **Менеджер проекта** | Claude Haiku | ✅ Работает | Живой AI-диалог, управление проектом |
| **Профессор планирования** | Claude Opus | ✅ Работает | Генерация плана задач проекта (v3.14) |
| **Эксперт по задаче** | Claude Sonnet | ✅ Работает | AI-диалог по конкретной задаче проекта (v3.16) |
| **Суммаризатор задач** | Claude Haiku | ✅ Работает | Клерк — суммаризация результатов задачи (v3.17) |
| **Ревьюер задач** | Claude Opus | ✅ Работает | Профессор — ревью завершённой задачи (v3.17) |
| **Клерк-анализатор** | Claude Haiku | ✅ Работает | Автоматический анализ файлов проекта |
| **Briefing: Онбординг** | Claude Sonnet 4.6 | ✅ Работает | AI-интервью для настройки брифинга (v3.30, v3.53 — save via UI) |
| **Briefing: Фильтр** | MiniMax M2.7 | ✅ Работает | Фильтрация и дедупликация новостей (v3.26→v3.80) |
| **Briefing: Автор** | MiniMax M2.7 | ✅ Работает | Генерация статьи из отфильтрованных новостей (v3.31→v3.80, монолит) |
| **Podcast: Скрипт** | MiniMax M2.7 | ✅ Работает | Генерация диалогового сценария из секции брифинга (v3.43→v3.81) |
| **Podcast: TTS** | Gemini 2.5 Flash TTS | ✅ Работает | Озвучка сценария (multi-speaker: Host + Expert) (v3.43, revert v3.82) |
| **Meeting: Транскрипция** | Deepgram Nova-3 | ✅ Работает | Batch transcription аудио встреч (русский, diarize) (v3.61) |
| **Meeting: Суммаризация** | Claude Sonnet 4.6 | ✅ Работает | Генерация структурированного резюме встречи (3 уровня) (v3.61) |
| **Artifact handlers** | Claude Sonnet 4.6 | ✅ Работает | Генерация/обновление артефактов (text, markdown, excel, reveal, pptx), chatMode: `artifact:*` (v3.69) |
| **Помощники проекта** | — | 🚧 Заглушка | Кастомные помощники |

---

## ✅ Работающие чаты (детали)

### Сервисные чаты (ServiceChat v3.8)

> **Архитектура:** Все сервисные чаты используют единую систему `components/service-chat/`.

#### Создание проекта (Секретарь)
**Где:** Карточка "+ Новый проект" на dashboard, URL `/projects/new`

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Sonnet |
| **Оболочка** | Full-page (split layout: preview + chat) |
| **Промпт** | XML-промпт Секретаря (`lib/prompts/service-chats/project-creation.md`) |
| **Инструменты** | `updateProjectDraft` — обновляет черновик в реальном времени |

**Как работает:**
1. Секретарь здоровается по имени, учитывает pronouns (ты/вы)
2. Проводит адаптивное интервью (2-4 вопроса максимум)
3. Вызывает `updateProjectDraft` по мере получения информации — паспорт заполняется в реальном времени
4. После заполнения предлагает нажать "Создать проект" + даёт подсказку о проекте

**Файлы:**
```
app/(dashboard)/projects/new/page.tsx               # Страница
app/(dashboard)/projects/new/project-creation-client.tsx # Клиент
components/service-chat/configs/project-creation.ts # Конфигурация
app/(chat)/api/service-chat/route.ts                # API (context: project-creation)
```

#### Менеджер проекта (v3.13 — живой AI-диалог)
**Где:** Кнопка "👤 Менеджер" в header страницы проекта `/projects/[id]`

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Haiku |
| **Оболочка** | Push-drawer справа (400px desktop, bottom sheet mobile) |
| **Инструменты** | — (консультативный режим) |
| **Персистенция** | Серверная (сообщения в БД, Chat с title `__service:project-manager`) |

**Как работает:**
1. При открытии drawer загружаются сохранённые сообщения из БД
2. System prompt собирается динамически: базовый промпт + mode injection по phase
3. Контекст включает: passport (name, description, context), manifest, files_status
4. Streaming ответы через Vercel AI SDK
5. Сообщения сохраняются на сервере (user — до стриминга, assistant — после)

**Mode injection по phase:**
- `first_contact` (phase: setup/documents) — полный режим знакомства + план Профессора (если есть) через `<professor_plan>` XML-блок
- `plan_presentation` (phase: approved) — taskStatuses XML в system prompt (ТЗ-B2)
- `navigation` (phase: execution) — taskStatuses XML в system prompt (ТЗ-B2)

**Файлы:**
```
components/projects/manager-drawer.tsx              # Push-drawer с ServiceChatCore
components/service-chat/service-chat-core.tsx        # Ядро (loadedMessages)
components/service-chat/configs/project-manager.ts   # Конфигурация
lib/prompts/service-chats/project-manager.md         # Промпт Менеджера
app/(chat)/api/service-chat/route.ts                 # API (context: project-manager)
lib/db/queries.ts                                    # getOrCreateManagerChat, findManagerChat
```

#### Профессор планирования (v3.14)
**Где:** Автоматически вызывается при нажатии "Начать планирование" на странице проекта

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Opus |
| **Тип** | Backend endpoint (не интерактивный чат) |
| **Триггер** | Кнопка "Начать планирование" → `POST /api/projects/[id]/plan` |

**Как работает:**
1. Frontend вызывает `POST /api/projects/[id]/plan` с passport, manifest, files
2. Профессор анализирует проект и генерирует JSON (discriminated union: complete / partial / needs_input)
3. Complete/Partial: список задач (order, title, description, dependencies, tools), риски (severity), рекомендации
4. Needs_input: список вопросов к пользователю (blocking/non-blocking)
5. Результат сохраняется в `Project.planJson` (jsonb), статус в `Project.planStatus`

**UI обратная связь:**
- PlanningState: анимация прогресса (4 шага с animate-pulse)
- PlanView: карточки задач, секция рисков, рекомендации, кавеаты (для partial)
- NeedsInput: карточки вопросов от Профессора
- Pulse: нумерованные задачи (badge + title) или "Анализ проекта..."
- Manager: знает о плане через `<professor_plan>` XML в system prompt

**Файлы:**
```
app/(chat)/api/projects/[id]/plan/route.ts         # Endpoint Профессора
lib/ai/professor-types.ts                           # Zod-схемы и типы
lib/prompts/professors/planning.md                  # Промпт Профессора
components/projects/phase-states/planning-state.tsx  # UI (3 состояния)
components/projects/project-pulse.tsx                # Превью плана в Пульсе
app/(chat)/api/service-chat/route.ts                # Manager с план-контекстом
```

#### Эксперт по задаче (ExpertTaskChat v3.16)
**Где:** Клик по задаче в Пульсе или ApprovedState → `/projects/[id]/tasks/[taskId]`

| Параметр | Значение |
|----------|----------|
| **Модель** | `getModel("project:expert:${tier}")` (tier из ProjectTask, см. `task-assignments.ts`) |
| **Оболочка** | Отдельная route group `app/(task)/` — полноэкранный layout без AppSidebar |
| **Промпт** | `lib/prompts/experts/task-expert.md` + `buildTaskExpertPrompt()` |
| **Инструменты** | Shared tools (search, deepResearch, fetchUrl, documents, excel, readProjectFile) — `getStandardTools()` |
| **Персистенция** | Серверная (Chat в БД, привязан к ProjectTask через chatId) |
| **Артефакты** | Поддерживаются (SidebarProvider в layout) |

**Как работает:**
1. Пользователь кликает задачу в Пульсе или ApprovedState
2. Locked задачи → AlertDialog с предупреждением, разблокировка через `POST /unlock`
3. При первом визите: `startTask()` создаёт Chat, обновляет ProjectTask.chatId + status → in_progress
4. Phase transition: если project.phase === 'approved' → автоматически обновляется на 'execution'
5. Auto-trigger: Эксперт начинает первым — `sendMessage('[SYSTEM: Задача открыта. Начни работу.]')`
6. System prompt включает: контекст проекта, описание задачи, результаты завершённых задач, manifest
7. TaskSidebar позволяет переключаться между задачами

**Context Management (v3.73.0, обновлено v3.87.3):**
1. Для проектных задач активирован **Anthropic Compaction API** (`providerOptions.anthropic.contextManagement`) — сжимает старые сообщения на стороне провайдера прозрачно для нас
2. Sliding window safety cap (180K токенов) — жёсткий потолок
3. Сняты: `createSnapshot` tool, `SnapshotCard` UI, `ContextIndicator`, `snapshot-creator` клерк (v3.87.3). Подробности — [ADR 052](decisions/052-context-management-strategy-per-provider.md)

**Завершение задачи (v3.17):**
1. Кнопка «Завершить задачу» в header → AlertDialog подтверждения → spinner
2. `POST .../complete` → суммаризатор (Flash) → ревьюер (Pro, если needsReview) → сохранение
3. Completion card: success (зелёная), issues (жёлтая), critical (красная)
4. «Доработать» → `POST .../reopen`, «Принять» → `POST .../accept`
5. Разблокировка зависимых задач, проверка project completion

**UI компоненты:**
- **TaskChat** — полноценный чат: Messages, Artifact, MultimodalInput, DataStreamHandler, кнопка завершения
- **TaskCompletionCard** — карточка результата с кнопками навигации (v3.17)
- **TaskSidebar** — навигация: список задач с иконками статусов, сворачивание, «← К проекту»

**Файлы:**
```
app/(task)/layout.tsx                                    # Layout (SWRProvider + DataStreamProvider + SidebarProvider)
app/(task)/projects/[id]/tasks/[taskId]/page.tsx          # Server Component (auth + guards + startTask)
app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts # Streaming endpoint
app/(chat)/api/projects/[id]/tasks/[taskId]/unlock/route.ts # Unlock locked → pending
app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts # Завершение задачи (v3.17)
app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts  # Доработка (v3.17)
app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts  # Принятие (v3.17)
components/projects/task-chat.tsx                         # Клиент чата + кнопка завершения
components/projects/task-completion-card.tsx              # Карточка результата (v3.17)
components/projects/task-sidebar.tsx                      # Навигация по задачам
lib/ai/tools/chat-tools.ts                               # Shared tools (getStandardTools)
lib/ai/tools/read-project-file.ts                        # Чтение файлов проекта (v3.17)
lib/prompts/experts/task-expert.md                        # Промпт Эксперта
lib/prompts/build-task-expert-prompt.ts                   # Prompt builder
```

#### Клерк-анализатор файлов (v3.13)
**Где:** Автоматически вызывается после upload файла в проект

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Haiku |
| **Тип** | Backend endpoint (не интерактивный чат) |
| **Триггер** | Fire-and-forget после upload файла |

**Как работает:**
1. Frontend загружает файл → сразу вызывает `POST /api/projects/[id]/analyze-file`
2. Клерк анализирует: description, documentType, suggestedFolder, relevance, keyTopics, language
3. Создаёт папку если suggestedFolder не существует
4. Перемещает файл в рекомендованную папку
5. Сохраняет анализ в `ProjectFile.metadata.analysis`
6. Перестраивает `Project.manifestJson` (агрегация всех анализов)

**UI обратная связь:**
- Пульсирующая синяя точка + "Анализ..." во время работы
- documentType тег под именем файла после завершения
- Tooltip с полным описанием при наведении

**Файлы:**
```
app/(chat)/api/projects/[id]/analyze-file/route.ts  # Endpoint Клерка
lib/prompts/clerks/file-analyzer.md                  # Промпт Клерка
components/projects/project-files-card.tsx            # UI (auto-analyze + feedback)
lib/db/queries.ts                                    # rebuildProjectManifest
```

#### Суммаризатор задач (Клерк v3.17)
**Где:** Автоматически вызывается при завершении задачи (`POST .../complete`)

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Haiku |
| **Тип** | Backend (внутренний вызов, не отдельный endpoint) |
| **Триггер** | Вызов в `complete/route.ts` → `summarizeTask()` |

**Как работает:**
1. Получает последние 40 сообщений чата (user/assistant, с fallback на snapshots)
2. `generateText` с промптом суммаризатора → Zod-парсинг `taskSummarySchema`
3. Возвращает `outputSummary` (title, summary, keyResults, artifacts, status)
4. Fallback при ошибке → базовый текст

**Файлы:**
```
lib/ai/clerks/task-summarizer.ts          # summarizeTask()
lib/ai/task-completion-types.ts           # taskSummarySchema
lib/prompts/clerks/task-summarizer.md     # Промпт
```

#### Ревьюер задач (Профессор v3.17)
**Где:** Автоматически вызывается при завершении задачи с `needsReview=true`

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Opus |
| **Тип** | Backend (внутренний вызов, не отдельный endpoint) |
| **Триггер** | Вызов в `complete/route.ts` → `reviewTask()` (если needsReview) |

**Как работает:**
1. Получает outputSummary + описание задачи + goal + expectedOutput
2. `generateText` с промптом ревьюера → XML-парсинг `<review_analysis>` + `<review_json>`
3. Zod-валидация `professorVerdictSchema` → verdict (decision, issues, score, overallComment)
4. `needs_revision` + severity=critical → статус задачи `issues`
5. Fallback при ошибке → `approved`

**Файлы:**
```
lib/ai/professors/task-reviewer.ts        # reviewTask()
lib/ai/task-completion-types.ts           # professorVerdictSchema
lib/prompts/professors/task-review.md     # Промпт
```

#### Briefing Onboarding (ТЗ-A2, v3.30)
**Где:** `/briefing/setup` (split layout: preview + chat)

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| **Оболочка** | Full-page (split layout: aside 400px preview + main chat) |
| **Промпт** | `lib/prompts/service-chats/briefing-onboarding.md` (v11) + mode injection |
| **Инструменты** | `updateBriefingPreview`, `deepResearch`, `fetchUrl`, `readTelegramChannel` |
| **Guardian** | Bypass mode — текст проходит без буферизации, Guardian только логирует ([ADR 025](decisions/025-guardian-bypass-pattern.md)) |

**Как работает:**
1. Server Component определяет mode (create/edit), загружает userProfile + topics/sources
2. AI проводит интервью: узнаёт интересы, ищет источники через deepResearch
3. `updateBriefingPreview` обновляет live preview в реальном времени
4. Пользователь нажимает «Сохранить» → `POST /api/briefing/save-profile` (v3.53.0, ранее — AI tool `saveBriefingProfile`)
5. Success card с кнопкой "Сгенерировать первый брифинг"
6. Edit mode: загружает сохранённый профиль, greeting адаптирован
7. Unsaved changes guard: AlertDialog при попытке уйти без сохранения (v3.53.0)

**Файлы:**
```
app/(dashboard)/briefing/setup/page.tsx                    # Server Component (auth, mode, profile)
app/(dashboard)/briefing/setup/briefing-setup-client.tsx    # Client (split layout, useChat)
app/(dashboard)/briefing/setup/components/                  # Preview + chat panel
components/service-chat/configs/briefing-onboarding.ts      # Reference config
lib/prompts/service-chats/briefing-onboarding.md            # Промпт
app/(chat)/api/service-chat/route.ts                        # API (context: briefing-onboarding, Guardian bypass)
app/(chat)/api/briefing/save-profile/route.ts               # POST API сохранения профиля (v3.53.0)
lib/briefing/save-briefing-profile.ts                       # Логика сохранения (v3.53.0)
```

#### Briefing: AI-пайплайн (v3.26)
**Где:** `POST /api/briefing/generate` (backend-only, без интерактивного UI)

> **v3.80.0 (ТЗ-Briefing-1):** Filter и Author переведены на MiniMax M2.7 (с Gemini 2.0 Flash и Claude Sonnet 4.6). Цена: $0.074 → $0.011 за брифинг (6.6×).
> **v3.82.0 (ТЗ-MapReduce):** Map-Reduce подход для Author отклонён — sequential streamText вызывает socket reuse bug в MiniMax. Монолит стабилен на 26K+ input tokens. См. [ADR 046](decisions/046-podcast-tts-revert-and-briefing-stability.md).

**Этап 1 — Фильтр:**

| Параметр | Значение |
|----------|----------|
| **Модель** | MiniMax M2.7 (task `briefing:filter` → registry `minimaxLong` namespace с 180s timeout) |
| **Тип** | Backend (внутренний вызов в generate/route.ts) |
| **Вход** | ~200 RawContent[] из 3 фетчеров (RSS, Telegram, Web), content truncation 2K chars |
| **Выход** | ~30 FilteredItem[] (дедуплицированные, с оценкой релевантности) |
| **Retry** | retryWithLogging (3 попытки) |

**Этап 2 — Автор (монолитный):**

| Параметр | Значение |
|----------|----------|
| **Модель** | MiniMax M2.7 (task `briefing:author` → registry `minimaxLong` namespace с 180s timeout) |
| **Тип** | Backend (монолитный вызов — все секции за один streamText) |
| **Вход** | ~30 FilteredItem[] + userTopics + settings + previousBriefing (для дедупа) |
| **Выход** | BriefingArticle (intro + sections[] + outro + meta), Zod validation + topicId dedup safety net |
| **Retry** | retryWithLogging (3 попытки) |

**Полный flow:**
1. Endpoint получает POST с auth
2. Загружает настройки, темы и источники пользователя из БД
3. Параллельный fetch всех источников → RawContent[]
4. MiniMax M2.7: фильтрация, дедупликация → FilteredItem[] (streamText + JSON.parse + Zod)
5. MiniMax M2.7: генерация статьи → BriefingArticle (streamText + JSON.parse + Zod)
6. Сохранение в BriefingHistory

**Файлы:**
```
app/(chat)/api/briefing/generate/route.ts    # POST endpoint (auth, orchestration)
lib/briefing/briefing-filter.ts              # MiniMax M2.7: filterContent() (streamText + JSON.parse + Zod)
lib/briefing/briefing-author.ts              # MiniMax M2.7: generateArticle() (streamText + JSON.parse + Zod)
lib/briefing/briefing-config.ts              # Константы (модели, лимиты)
lib/prompts/briefing/briefing-author.md      # Промпт автора (стиль Т—Ж)
lib/briefing/source-fetchers/index.ts        # fetchSource() dispatcher
lib/briefing/source-fetchers/rss-fetcher.ts  # RSS через rss-parser
lib/briefing/source-fetchers/telegram-fetcher.ts # Telegram через cheerio
lib/briefing/source-fetchers/web-fetcher.ts  # Web через Readability + jsdom
```

#### Podcast Engine (ТЗ-Б1, v3.43; финальная архитектура v3.82)
**Где:** `POST /api/briefing/podcast/generate` (backend-only, streaming)

> **v3.81.0 → v3.82.0:** TTS попытались мигрировать на MiniMax Speech 2.8 HD — откат из-за худшего качества русского и цены $1+ за подкаст (vs $0.014 у Gemini). Script остался на M2.7 (диалоги интереснее). См. [ADR 046](decisions/046-podcast-tts-revert-and-briefing-stability.md).

**Этап 1 — Скрипт (MiniMax M2.7):**

| Параметр | Значение |
|----------|----------|
| **Модель** | MiniMax M2.7 (task `briefing:podcast-script` → registry `minimax` namespace) |
| **SDK** | `vercel-minimax-ai-provider` (`generateText`) |
| **Вход** | BriefingArticleSection + ScriptContext |
| **Выход** | ScriptLine[] (universal parser: JSON или plain text `Host: / Expert:`) |
| **Retry** | Внутренний цикл (4 попытки) |

**Этап 2 — TTS (Gemini 2.5 Flash TTS):**

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 2.5 Flash TTS (`gemini-2.5-flash-preview-tts`) |
| **SDK** | `@google/genai` (native multi-speaker) |
| **Голоса** | Host → Kore, Expert → Iapetus |
| **Выход** | PCM 24kHz mono → MP3 (lamejs) → Vercel Blob |

**Стоимость:** ~$0.019 за подкаст (Script $0.005 + TTS $0.014)

**Полный flow:**
1. Загружает последний готовый брифинг из БД
2. Для каждой секции (p-limit(2)): скрипт → TTS → MP3 → Blob → DB
3. Streaming JSON Lines: script → recording → done → complete
4. При обновлении секции брифинга → audioStatus = 'outdated'

**Файлы:**
```
app/(chat)/api/briefing/podcast/generate/route.ts  # Streaming POST endpoint
lib/podcast/index.ts                                # Public API (generatePodcastSegment)
lib/podcast/script-generator.ts                     # MiniMax M2.7: generateScript()
lib/podcast/tts-gemini.ts                           # Gemini TTS: generateSpeechWithRetry()
lib/podcast/audio-converter.ts                      # PCM → MP3 (lamejs)
lib/podcast/types.ts                                # TypeScript типы
lib/prompts/briefing/briefing-scriptwriter.md       # Промпт скриптрайтера
```

---

## 🚧 Заглушки (не подключены к AI)

### Помощники проекта
**Где:** Кнопка "+ добавить" в паспорте проекта
**Статус:** Статичный текст, не кликается

**Файл:** [components/projects/project-passport.tsx](../components/projects/project-passport.tsx) (строка 84)

### Новая задача
**Где:** Кнопка "➕ Новая задача" на странице проекта
**Статус:** ✅ Работает — просто ссылка на `/projects/[id]/chat`

Это не отдельный чат, а создание нового чата в проекте с моделями Claude.

---

## 1. Чаты по режимам (chatMode v3.24)

**Где:** Главная страница (`/chat`), `/expertise`, `/create`, `/chats`

> **v3.24.0:** Модель определяется на сервере по chatMode. Убран UI-селектор модели.

### chatMode routing

| chatMode | Модель | Страница | Описание |
|----------|--------|----------|----------|
| `chat` | Claude Haiku | `/chats` | Обычный чат (по умолчанию) |
| `expertise` | Claude Sonnet | `/expertise` | Точные ответы с проверкой фактов |
| `create` | Claude Sonnet | `/create` | Презентации, отчёты, изображения |

**Создание чата:** `/chat?mode=expertise` → чат с chatMode=expertise, модель Sonnet.

**Особенности:**
- Полная поддержка инструментов (search, deepResearch, fetchUrl, documents, excel)
- Skills-based routing
- Персонализация (профиль + память)
- Стриминг ответов

**Файлы:**
```
app/(chat)/api/chat/route.ts          # API endpoint (chatMode routing)
lib/ai/chat-mode-config.ts           # Конфиг: chatMode → модель, tools
lib/ai/providers.ts                   # Конфигурация Anthropic Claude
lib/prompts/builder/index.ts          # buildChatPrompt, buildExpertisePrompt, buildCreatePrompt
```

---

## 2. Чаты в проектах (Project Chats)

**Где:** `/projects/[id]/chat`

**Провайдер:** Anthropic Claude через `@ai-sdk/anthropic`

> **v3.23.0:** Переключены с Gemini на Claude через `@ai-sdk/anthropic` (прямое подключение).

### 2.1 Исполнитель (Executor)

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| **Input** | $1 / 1M токенов |
| **Output** | $5 / 1M токенов |
| **Контекст** | 200K |
| **Max output** | 64K токенов |
| **Когда использовать** | Простые задачи, черновики, быстрые ответы |

### 2.2 Эксперт (Expert) — DEFAULT

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| **Input** | $3 / 1M токенов |
| **Output** | $15 / 1M токенов |
| **Контекст** | 200K (1M бета) |
| **Max output** | 64K токенов |
| **Когда использовать** | Большинство задач, баланс качества и цены |

### 2.3 Профессор (Professor)

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Opus 4.6 (`claude-opus-4-6`) |
| **Input** | $5 / 1M токенов |
| **Output** | $25 / 1M токенов |
| **Контекст** | 200K (1M бета) |
| **Max output** | 128K токенов |
| **Когда использовать** | Сложные задачи, анализ, стратегия |

> **Pipeline активен:** Opus (анализ) → Haiku (исполнение) → Opus (синтез).

**Файлы:**
```
lib/ai/task-assignments.ts            # professor:pipeline-{analyze,execute,synthesize} — tier-to-taskId
lib/ai/model-tiers.ts                 # Тонкая обёртка (tier → taskId → getModel)
lib/ai/getModel.ts                    # Единая точка резолва моделей
lib/ai/professor-pipeline.ts          # Multi-step pipeline
```

---

## 3. Бен (Ben) — Помощник по платформе

**Где:** Кнопка ❓ в интерфейсе (header)

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Haiku |
| **Оболочка** | Floating modal (bottom-right) |
| **Назначение** | Помощь с вопросами о Simply |
| **Стиль** | Дружелюбный, конкретный, с примерами |

**Что делает:**
- Объясняет возможности платформы
- Показывает примеры запросов
- Помогает с навигацией
- **НЕ выполняет** рабочие задачи (перенаправляет в основной чат)

**Два режима:**
- `isFirstTime: true` — онбординг для новых пользователей
- `isFirstTime: false` — краткая помощь для существующих

**Файлы (ServiceChat v3.8):**
```
components/service-chat/service-chat-floating.tsx  # Floating modal
components/service-chat/service-chat-trigger.tsx   # Кнопка ❓
components/service-chat/ben-intro-bubble.tsx       # Приветственный bubble
components/service-chat/configs/ben.ts             # Конфигурация
app/(chat)/api/service-chat/route.ts               # API (context: ben)
app/(chat)/api/assistant/ben/route.ts              # Legacy API
lib/prompts/agents/ben/AGENT.md                    # Промпт с frontmatter
```

---

## Конфигурация провайдеров

### Core Registry (v3.83.0+)

С версии 3.83.0 модели резолвятся через единую функцию `getModel(taskId)`. Старая конфигурация (`myProvider`, `createAnthropic` напрямую) удалена из `providers.ts`.

```typescript
// lib/ai/registry.ts
import { createProviderRegistry } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { minimax } from "vercel-minimax-ai-provider";
import { xai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const registry = createProviderRegistry({
  anthropic,
  minimax,         // default timeout
  minimaxLong,     // 180s timeout для briefing pipelines
  xai,
  openrouter,
});
```

```typescript
// lib/ai/getModel.ts
export function getModel(taskId: TaskId, context?: GetModelContext): LanguageModel {
  // 1. test mocks → 2. overrides (stub, ТЗ-2) → 3. task-assignments → 4. catalog → 5. registry
}
```

```typescript
// call-site
import { getModel, getModelIdForTask, getProviderForTask } from "@/lib/ai/getModel";

const result = await streamText({
  model: getModel("expertise"),  // ← SSOT в task-assignments.ts
  // ...
});
```

> **Детали и обоснование** — см. [ai-providers.md](ai-providers.md#core-registry-v3830-тз-1) и [ADR 047](decisions/047-core-model-registry.md).

**API Key:** `ANTHROPIC_API_KEY`

### Google Gemini (vision-ocr + Briefing фильтр + Podcast)

```typescript
// lib/ai/vision-ocr.ts, lib/podcast/script-generator.ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

// lib/podcast/tts-gemini.ts (native SDK for multi-speaker TTS)
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
```

**API Key:** `GOOGLE_GENERATIVE_AI_API_KEY` (vision-ocr + Briefing фильтр + Podcast)

---

## Таблица цен

| Модель | Input | Output | Контекст | Используется в |
|--------|-------|--------|----------|---------------|
| Claude Sonnet 4.6 (`claude-sonnet-4-6`) | $3 | $15 | 200K | Основной чат (DEFAULT), Секретарь, Эксперт, артефакты, Briefing (онбординг, автор, секция) |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | $1 | $5 | 200K | Бен, Менеджер, Исполнитель, Клерки (анализатор, суммаризатор) |
| Claude Opus 4.6 (`claude-opus-4-6`) | $5 | $25 | 200K | Профессоры (планирование, ревью задач) |
| Gemini 2.0 Flash (`gemini-2.0-flash`) | ~$0.10 | ~$0.40 | 1M | Briefing: фильтрация и дедупликация (v3.26) |
| Gemini 2.5 Flash (`gemini-2.5-flash`) | — | — | 1M | Vision OCR: image + PDF, Podcast: скрипт |
| Gemini 2.5 Flash TTS (`gemini-2.5-flash-preview-tts`) | — | — | — | Podcast: озвучка (multi-speaker) |

*Цены за 1M токенов*

---

## Архитектура промптов

```
lib/prompts/
├── server.ts              # Server-only экспорты (buildChatPrompt, buildBenPrompt, buildFullManagerPrompt)
├── index.ts               # Client-safe экспорты
├── builder/
│   ├── index.ts           # buildChatPrompt, buildBenPrompt, etc.
│   ├── composer.ts        # Сборка промптов
│   ├── registry.ts        # Сканирование agents/ и skills/
│   ├── agent-loader.ts    # Загрузка агентов
│   └── skill-loader.ts    # Загрузка skills
├── agents/
│   └── ben/AGENT.md       # Конфиг Бена
├── skills/
│   └── document/          # Skills для документов
├── professors/            # Промпты профессоров (v3.14+)
│   ├── planning.md        # Профессор планирования
│   └── task-review.md     # Профессор-ревьюер задач (v3.17)
├── experts/               # Промпты экспертов (v3.16)
│   └── task-expert.md     # Эксперт по задаче
├── clerks/                # Промпты клерков (v3.13+)
│   ├── file-analyzer.md   # Клерк-анализатор файлов
│   └── task-summarizer.md # Клерк-суммаризатор задач (v3.17)
├── service-chats/         # Промпты сервисных чатов (v3.11+)
│   ├── project-creation.md # Промпт Секретаря
│   ├── project-manager.md  # Промпт Менеджера
│   ├── briefing-onboarding.md # Промпт Briefing Onboarding (v3.30)
│   └── briefing-onboarding-mode-injection.md # Справочный документ для edit mode
├── core/
│   ├── base.md            # Базовый промпт
│   ├── safety.md          # Безопасность
│   ├── formatting.md      # Форматирование
│   └── russian-market.md  # Контекст РФ
└── contexts/
    ├── project-context.ts # Контекст проекта
    ├── user-profile.ts    # Профиль пользователя
    └── chat-memory.ts     # Память чата

components/service-chat/   # ServiceChat система (v3.8)
├── service-chat-core.tsx      # Ядро (messages, streaming)
├── service-chat-floating.tsx  # Floating modal
├── service-chat-drawer.tsx    # Drawer справа
├── service-chat-trigger.tsx   # Кнопка-триггер
├── ben-intro-bubble.tsx       # Bubble онбординга
├── types.ts                   # TypeScript типы
└── configs/
    ├── ben.ts                 # Конфиг Бена
    ├── project-creation.ts    # Конфиг создания проекта
    ├── project-manager.ts     # Конфиг менеджера
    └── briefing-onboarding.ts # Конфиг Briefing Onboarding (v3.30)
```

---

## Связанная документация

- [ai-providers.md](ai-providers.md) — Детали провайдеров и цен
- [ai-agents.md](ai-agents.md) — Система промптов и помощники
- [ai-tools.md](ai-tools.md) — Инструменты (search, vision, excel)
