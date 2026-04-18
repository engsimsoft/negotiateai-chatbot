# AI Chats Map — Simply

> **SSOT:** Полная карта всех AI-чатов, моделей и их конфигураций

**Обновлено:** 2026-04-18

---

## Быстрый обзор

Все AI-точки приложения резолвят модель через единый `getModel(taskId)` и лимит output через `getMaxOutputTokensForTask(taskId)`. SSOT — [task-assignments.ts](../lib/ai/task-assignments.ts) (`DEFAULT_TASK_MODELS` — taskId → catalogId, `DEFAULT_MAX_OUTPUT_TOKENS` — taskId → maxOutputTokens), [model-catalog.ts](../lib/ai/model-catalog.ts) (pricing + capabilities), [getModel.ts](../lib/ai/getModel.ts) (resolver + safety-net: `Math.min(requested, capability)` + warnOnce при Anthropic cap > 21333). Смена модели или output cap для любой задачи = одна строка в task-assignments.ts. Детали — [ai-providers.md](ai-providers.md#core-registry), [ADR 047](decisions/047-core-model-registry.md), [ADR 053](decisions/053-aisdk-invocation-contract.md).

**Активные AI-провайдеры:** Anthropic Claude (Haiku 4.5 / Sonnet 4.6 / Opus 4.6), xAI Grok (4.1 Fast / 4.20 / 4.20 Multi-Agent), MiniMax M2.7, Google Gemini (vision-ocr, Podcast TTS), Deepgram Nova-3 (voice input + meeting transcription), Perplexity Sonar (deepResearch tool).

> **⚠️ Важно для разработчиков:** Этот документ описывает **чаты и UI**, а не является реестром моделей. Единственный источник правды по моделям — [`task-assignments.ts`](../lib/ai/task-assignments.ts). Если таблицы в этом документе расходятся с `task-assignments.ts` — **правда в коде**, а документ устарел и требует обновления.

| Чат / Точка | Модель | Статус | Назначение |
|---|---|---|---|
| **Simply Chat** (default text) | Grok 4.1 Fast (`simply-chat`) | ✅ Работает | Дворецкий KITT — быстрый дешёвый основной чат |
| **Simply Chat** — кнопка «Думать» | Grok 4.20 reasoning (`simply-chat-think`) | ✅ Работает | Tier upgrade на сильную модель |
| **Simply Chat** — vision (image/PDF) | Claude Haiku 4.5 (`simply-chat-vision`) | ✅ Работает | Маршрутизация вложений — Haiku поддерживает native PDF |
| **Экспертиза** (chatMode=expertise) | Grok 4.20 reasoning (`expertise`) | ✅ Работает | Точные ответы, разовые экспертные запросы |
| **Экспертиза Premium** (toggle «Команда агентов») | Grok 4.20 Multi-Agent (`expertise-multi-agent`) | 🔒 Reserved (ТЗ-XAI-MA-1) | Premium-режим рядом с обычной expertise через Responses API + MCP. Placeholder taskId зарезервирован, реализация в отдельном ТЗ |
| **Создание** (chatMode=create) | Grok 4.20 reasoning (`create`) | ✅ Работает | Презентации, отчёты, длинные тексты |
| **Проект: Исполнитель** | Claude Haiku 4.5 (`project:expert:haiku`) | ✅ Работает | Быстрые простые задачи |
| **Проект: Эксперт** (DEFAULT) | Claude Sonnet 4.6 (`project:expert:sonnet`) | ✅ Работает | Баланс качества и скорости |
| **Проект: Профессор** | Claude Opus 4.6 (`project:expert:opus`) | ✅ Работает | Сложные задачи |
| **Бен** (помощник по платформе) | Claude Haiku 4.5 (`service-chat:ben`) | ✅ Работает | Service chat · Floating modal, онбординг |
| **Секретарь** (создание проекта) | Claude Sonnet 4.6 (`service-chat:project-creation`) | ✅ Работает | Service chat · AI-интервью для создания проекта |
| **Менеджер проекта** | Claude Haiku 4.5 (`service-chat:project-manager`) | ✅ Работает | Service chat · Живой AI-диалог, управление проектом |
| **Briefing: Онбординг** | Claude Sonnet 4.6 (`service-chat:briefing-onboarding`) | ✅ Работает | **Service chat** · AI-интервью для настройки профиля брифинга. Архитектурно независим от briefing pipeline ниже — пользователь может его переключить через `/dev/models` override |
| **Профессор планирования** | Claude Opus 4.6 (`professor:planning`) | ✅ Работает | Автор · Mission-critical план проекта — остаётся на Opus |
| **Ревьюер задач** | Grok 4.20 reasoning (`professor:review`) | ✅ Работает | Зал · Ревью завершённой задачи (v3.92.2: Opus → Grok 4.20 reasoning) |
| **Профессор pipeline: analyze** | Grok 4.20 reasoning (`professor:pipeline-analyze`) | ✅ Работает | Зал · Разбивка задачи на subtask'и (v3.92.2: Opus → Grok 4.20 reasoning) |
| **Профессор pipeline: execute** | Grok 4.1 Fast (`professor:pipeline-execute`) | ✅ Работает | Подсобка · Исполнитель subtask'ов (v3.92.2: Haiku → Grok 4.1 Fast) |
| **Профессор pipeline: synthesize** | Grok 4.20 reasoning (`professor:pipeline-synthesize`) | ✅ Работает | Зал · Финальная сборка результата (v3.92.2: Opus → Grok 4.20 reasoning) |
| **Суммаризатор задач** (Клерк) | Grok 4.1 Fast (`clerk:task-summary`) | ✅ Работает | Суммаризация результатов задачи |
| **Клерк-анализатор** файлов | Grok 4.1 Fast (`clerk:file-analyzer`) | ✅ Работает | Автоматический анализ загруженных файлов |
| **Briefing: Фильтр** | Grok 4.1 Fast (`briefing:filter`) | ✅ Работает | **Backend pipeline (кухня)** · Фильтрация и дедупликация новостей. Запускается cron'ом или refresh-кнопкой, пользователь не видит процесс |
| **Briefing: Автор** | MiniMax M2.7 long (`briefing:author`) | ✅ Работает | **Backend pipeline (кухня)** · Генерация статьи из отфильтрованных новостей. MiniMax на этой роли by design (длинный output + экономика фоновых задач) |
| **Briefing: Refresh секции** | MiniMax M2.7 long (`briefing:section`) | ✅ Работает | **Backend pipeline (кухня)** · Per-section refresh одной темы |
| **Podcast: Скрипт** | MiniMax M2.7 (`briefing:podcast-script`) | ✅ Работает | **Backend pipeline (кухня)** · Генерация диалогового сценария для TTS |
| **Podcast: TTS** | Gemini 2.5 Flash TTS (native `@google/genai`) | ✅ Работает | Озвучка (multi-speaker: Host=Kore + Expert=Iapetus) |
| **Meeting: Транскрипция** | Deepgram Nova-3 (native SDK) | ✅ Работает | Batch transcription аудио (русский, diarize) |
| **Meeting: Суммаризация** | Grok 4.20 reasoning (`meeting:summary`) | ✅ Работает | Структурированное резюме встречи |
| **Artifact handlers** | Claude Sonnet 4.6 (`artifact:text\|markdown\|excel\|pptx\|reveal`) | ✅ Работает | Генерация/обновление артефактов в холсте |
| **MIND Memory: extract** | Grok 4.20 reasoning (`memory:extract`) | ✅ Работает | Mission-critical извлечение фактов из диалогов |
| **MIND Memory: batch/consolidate/profile/dedup** | Grok 4.1 Fast (`memory:*`) | ✅ Работает | Механические задачи MIND pipeline |
| **Vision OCR** | Claude Haiku 4.5 (`vision:ocr`) | ✅ Работает | OCR-экстракция текста из изображений |
| **Title** | Grok 4.1 Fast (`util:title`) | ✅ Работает | Автонейминг чатов |
| **Помощники проекта** | — | 🚧 Заглушка | Кастомные помощники (не подключены) |

---

## ✅ Работающие чаты (детали)

### Сервисные чаты (ServiceChat)

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

#### Менеджер проекта — живой AI-диалог
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
- `plan_presentation` (phase: approved) — taskStatuses XML в system prompt
- `navigation` (phase: execution) — taskStatuses XML в system prompt

**Файлы:**
```
components/projects/manager-drawer.tsx              # Push-drawer с ServiceChatCore
components/service-chat/service-chat-core.tsx        # Ядро (loadedMessages)
components/service-chat/configs/project-manager.ts   # Конфигурация
lib/prompts/service-chats/project-manager.md         # Промпт Менеджера
app/(chat)/api/service-chat/route.ts                 # API (context: project-manager)
lib/db/queries.ts                                    # getOrCreateManagerChat, findManagerChat
```

#### Профессор планирования
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

#### Эксперт по задаче (ExpertTaskChat)
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

**Context Management:**
1. Для проектных задач активирован **Anthropic Compaction API** (`providerOptions.anthropic.contextManagement`) — сжимает старые сообщения на стороне провайдера прозрачно для нас
2. Sliding window safety cap (180K токенов) — жёсткий потолок
3. `createSnapshot` tool, `SnapshotCard` UI, `ContextIndicator`, `snapshot-creator` клерк сняты. Подробности — [ADR 052](decisions/052-context-management-strategy-per-provider.md)

**Завершение задачи:**
1. Кнопка «Завершить задачу» в header → AlertDialog подтверждения → spinner
2. `POST .../complete` → суммаризатор (Flash) → ревьюер (Pro, если needsReview) → сохранение
3. Completion card: success (зелёная), issues (жёлтая), critical (красная)
4. «Доработать» → `POST .../reopen`, «Принять» → `POST .../accept`
5. Разблокировка зависимых задач, проверка project completion

**UI компоненты:**
- **TaskChat** — полноценный чат: Messages, Artifact, MultimodalInput, DataStreamHandler, кнопка завершения
- **TaskCompletionCard** — карточка результата с кнопками навигации- **TaskSidebar** — навигация: список задач с иконками статусов, сворачивание, «← К проекту»

**Файлы:**
```
app/(task)/layout.tsx                                    # Layout (SWRProvider + DataStreamProvider + SidebarProvider)
app/(task)/projects/[id]/tasks/[taskId]/page.tsx          # Server Component (auth + guards + startTask)
app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts # Streaming endpoint
app/(chat)/api/projects/[id]/tasks/[taskId]/unlock/route.ts # Unlock locked → pending
app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts # Завершение задачиapp/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts  # Доработкаapp/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts  # Принятиеcomponents/projects/task-chat.tsx                         # Клиент чата + кнопка завершения
components/projects/task-completion-card.tsx              # Карточка результатаcomponents/projects/task-sidebar.tsx                      # Навигация по задачам
lib/ai/tools/chat-tools.ts                               # Shared tools (getStandardTools)
lib/ai/tools/read-project-file.ts                        # Чтение файлов проектаlib/prompts/experts/task-expert.md                        # Промпт Эксперта
lib/prompts/build-task-expert-prompt.ts                   # Prompt builder
```

#### Клерк-анализатор файлов
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

#### Суммаризатор задач (Клерк)
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

#### Ревьюер задач (Профессор)
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

#### Briefing Onboarding (service chat, независим от pipeline ниже)

> **Важно:** Briefing Onboarding — это **сервисный чат** (UI-диалог, пользователь видит), **архитектурно независимый** от Briefing AI-пайплайна (backend-only, кухня) в следующем разделе. Они связаны только продуктово (обе фичи живут в `/briefing`), но переключаются через разные taskIds. Модель onboarding'а можно переключить через `/dev/models` override на `service-chat:briefing-onboarding` — это затронет только интерактивный диалог настройки профиля, pipeline останется на своих моделях.

**Где:** `/briefing/setup` (split layout: preview + chat)

| Параметр | Значение |
|----------|----------|
| **Модель** | Claude Sonnet 4.6 (task `service-chat:briefing-onboarding` → registry `anthropic:claude-sonnet-4-6`) |
| **Оболочка** | Full-page (split layout: aside 400px preview + main chat) |
| **Промпт** | `lib/prompts/service-chats/briefing-onboarding.md` (v11) + mode injection |
| **Инструменты** | `updateBriefingPreview`, `deepResearch`, `fetchUrl`, `readTelegramChannel` |
| **Guardian** | Bypass mode — текст проходит без буферизации, Guardian только логирует ([ADR 025](decisions/025-guardian-bypass-pattern.md)) |
| **Dev override** | ✅ Поддерживается (commit `<briefing-cleanup>`, 2026-04-16): `/dev/models` → selector `service-chat:briefing-onboarding` → переключение применяется через side-effect import `@/lib/ai/model-overrides-node` в `service-chat/route.ts` |

**Как работает:**
1. Server Component определяет mode (create/edit), загружает userProfile + topics/sources
2. AI проводит интервью: узнаёт интересы, ищет источники через deepResearch
3. `updateBriefingPreview` обновляет live preview в реальном времени
4. Пользователь нажимает «Сохранить» → `POST /api/briefing/save-profile`
5. Success card с кнопкой "Сгенерировать первый брифинг"
6. Edit mode: загружает сохранённый профиль, greeting адаптирован
7. Unsaved changes guard: AlertDialog при попытке уйти без сохранения
**Файлы:**
```
app/(dashboard)/briefing/setup/page.tsx                    # Server Component (auth, mode, profile)
app/(dashboard)/briefing/setup/briefing-setup-client.tsx    # Client (split layout, useChat)
app/(dashboard)/briefing/setup/components/                  # Preview + chat panel
components/service-chat/configs/briefing-onboarding.ts      # Reference config
lib/prompts/service-chats/briefing-onboarding.md            # Промпт
app/(chat)/api/service-chat/route.ts                        # API (context: briefing-onboarding, Guardian bypass)
app/(chat)/api/briefing/save-profile/route.ts               # POST API сохранения профиляlib/briefing/save-briefing-profile.ts                       # Логика сохранения```

#### Briefing: AI-пайплайн
**Где:** `POST /api/briefing/generate` (backend-only, без интерактивного UI)

**Этап 1 — Фильтр:**

| Параметр | Значение |
|----------|----------|
| **Модель** | Grok 4.1 Fast (task `briefing:filter` → registry `xai:grok-4-1-fast-non-reasoning`, ТЗ-XAI-4 2026-04-16) |
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

#### Podcast Engine
**Где:** `POST /api/briefing/podcast/generate` (backend-only, streaming)

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

## 1. Чаты по режимам (chatMode)

**Где:** `/simply` (Simply Chat — основной persistent чат), `/expertise` (разовые экспертные запросы), `/create` (разовые задания на создание)

> Модель определяется на сервере по chatMode + route. Нет UI-селектора модели. Детали резолва — через `getModel(taskId)`, где taskId вычисляется в API-роутах по chatMode.

### chatMode routing

| chatMode | taskId | Модель | Страница | Описание |
|---|---|---|---|---|
| `simply` (text) | `simply-chat` | Grok 4.1 Fast | `/simply` | Дворецкий KITT — persistent чат |
| `simply` (think) | `simply-chat-think` | Grok 4.20 reasoning | `/simply` (кнопка «Думать») | Tier upgrade на сильную модель |
| `simply` (vision) | `simply-chat-vision` | Claude Haiku 4.5 | `/simply` (при загрузке image/PDF) | Vision/native PDF |
| `expertise` | `expertise` | Grok 4.20 reasoning | `/expertise/[id]` | Точные ответы с проверкой фактов |
| `expertise` (Premium toggle) | `expertise-multi-agent` 🔒 | Grok 4.20 Multi-Agent | `/expertise/[id]` (toggle «Команда агентов», ТЗ-XAI-MA-1) | Premium-режим, пока reserved |
| `create` | `create` | Grok 4.20 reasoning | `/create/[id]` | Презентации, отчёты, длинные тексты |

**Особенности:**
- Полная поддержка инструментов (search, deepResearch, fetchUrl, documents, excel, readTelegramChannel)
- Skills-based routing через prompt builder
- Персонализация (профиль + MIND memory retrieve)
- Стриминг ответов

**Файлы:**
```
app/(chat)/simply/page.tsx             # Simply Chat (Server Component)
app/(chat)/api/chat/route.ts           # API endpoint (chatMode routing, taskId resolve)
lib/ai/chat-mode-config.ts             # Тонкая обёртка chatMode → taskId
lib/ai/getModel.ts                     # SSOT резолва модели по taskId
lib/ai/task-assignments.ts             # taskId → catalogId (SSOT default модели)
lib/prompts/builder/index.ts           # buildChatPrompt, buildExpertisePrompt, buildCreatePrompt
```

---

## 2. Чаты в проектах (Project Chats)

**Где:** `/projects/[id]/chat`

**Провайдер:** Anthropic Claude через `@ai-sdk/anthropic`

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

**Файлы:**
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

### Core Registry

Модели резолвятся через единую функцию `getModel(taskId)`. Все провайдеры подключены через `createProviderRegistry` из AI SDK v6.

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
  // 1. test mocks → 2. dev overrides → 3. task-assignments → 4. catalog → 5. registry
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

## Таблица моделей и где используются

> **SSOT pricing:** [lib/ai/model-catalog.ts](../lib/ai/model-catalog.ts). Этот документ ссылается на catalogId, но не дублирует цены — они могут меняться. Для актуальных чисел — [model-catalog-ops.md](model-catalog-ops.md) или сам каталог.

| Модель | catalogId | Input / Output (USD/1M) | Контекст | Где используется |
|---|---|---|---|---|
| **Grok 4.1 Fast** (non-reasoning) | `grok-4-1-fast-non-reasoning` | $0.20 / $0.50 | 128K | Simply Chat (default text), MIND memory (extract-batch, consolidate, profile, dedup-verify), Briefing filter, Clerks (task-summary, file-analyzer), util (title) |
| **Grok 4.20** (reasoning) | `grok-4.20-0309-reasoning` | $2 / $6 | 256K | Simply Chat (кнопка «Думать»), Экспертиза (chatMode=expertise), Создание (chatMode=create), Meeting summary, MIND memory (extract — mission-critical) |
| **Grok 4.20 Multi-Agent** | `grok-4.20-multi-agent-0309` | $2 / $6 | 256K | 🔒 Reserved для taskId `expertise-multi-agent` (placeholder, не вызывать). Реализация Premium «Команда агентов» через Responses API + MCP — отдельная ветка ТЗ-XAI-MA-1. Архитектура: [BRAINSTORM_GrokMultiAgent.md](../specs/Simply_xAI/BRAINSTORM_GrokMultiAgent.md) |
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | $3 / $15 | 200K (1M beta) | project:expert:sonnet (DEFAULT), Секретарь, Briefing Onboarding, Artifact handlers (5 типов) |
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | $1 / $5 | 200K | Simply Chat vision, project:expert:haiku, Бен, Менеджер, vision:ocr |
| **Claude Opus 4.6** | `claude-opus-4-6` | $5 / $25 | 200K (1M beta) | project:expert:opus, Профессор (planning, review, pipeline-analyze, pipeline-synthesize) |
| **MiniMax M2.7** | `MiniMax-M2.7` | $0.30 / $1.20 | 200K | Podcast: Script |
| **MiniMax M2.7** (long timeout) | `MiniMax-M2.7-long` | $0.30 / $1.20 | 200K | Briefing pipeline (author, section refresh) — alias с 180s fetch timeout |
| **Gemini 2.5 Flash TTS** | `gemini-2.5-flash-preview-tts` | — | — | Podcast: TTS озвучка (multi-speaker Host + Expert), через native `@google/genai` SDK |
| **Deepgram Nova-3** | — (raw API) | $0.0043 / минута | — | Voice input (Simply Chat диктовка), Meeting transcription (batch, diarize, русский) |
| **Perplexity Sonar Pro / Deep** | — (raw API) | варьируется | — | `deepResearch` tool — вызывается из expertise / create / project chats |

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
├── professors/            # Промпты профессоров│   ├── planning.md        # Профессор планирования
│   └── task-review.md     # Профессор-ревьюер задач├── experts/               # Промпты экспертов│   └── task-expert.md     # Эксперт по задаче
├── clerks/                # Промпты клерков│   ├── file-analyzer.md   # Клерк-анализатор файлов
│   └── task-summarizer.md # Клерк-суммаризатор задач├── service-chats/         # Промпты сервисных чатов│   ├── project-creation.md # Промпт Секретаря
│   ├── project-manager.md  # Промпт Менеджера
│   ├── briefing-onboarding.md # Промпт Briefing Onboarding│   └── briefing-onboarding-mode-injection.md # Справочный документ для edit mode
├── core/
│   ├── base.md            # Базовый промпт
│   ├── safety.md          # Безопасность
│   ├── formatting.md      # Форматирование
│   └── russian-market.md  # Контекст РФ
└── contexts/
    ├── project-context.ts # Контекст проекта
    ├── user-profile.ts    # Профиль пользователя
    └── chat-memory.ts     # Память чата

components/service-chat/   # ServiceChat система
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
    └── briefing-onboarding.ts # Конфиг Briefing Onboarding```

---

## Связанная документация

- [ai-providers.md](ai-providers.md) — Детали провайдеров и цен
- [ai-agents.md](ai-agents.md) — Система промптов и помощники
- [ai-tools.md](ai-tools.md) — Инструменты (search, vision, excel)
