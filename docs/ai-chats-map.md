# AI Chats Map — Simply

> **SSOT:** Полная карта всех AI-чатов, моделей и их конфигураций

**Обновлено:** 2026-02-10

---

## Быстрый обзор

> **⚠️ ВРЕМЕННО (v3.7.1):** Проекты переведены на Gemini для тестирования. См. [ADR 011](decisions/011-temporary-gemini-for-projects.md).
>
> **v3.8.0:** Сервисные чаты унифицированы в систему ServiceChat. Prompt-агент удалён.

| Чат | Модель | Статус | Назначение |
|-----|--------|--------|-----------|
| **Основной чат** | Gemini 3 Pro / 2.5 Flash | ✅ Работает | Универсальный AI-чат с инструментами |
| **Проект: Исполнитель** | Gemini 2.5 Flash | ✅ Работает | Быстрые простые задачи |
| **Проект: Эксперт** | Gemini 3 Pro | ✅ Работает | Баланс качества и скорости (DEFAULT) |
| **Проект: Профессор** | Gemini 3 Pro | ✅ Работает | Сложные задачи |
| **Бен** | Gemini 2.5 Flash | ✅ Работает | Помощник по платформе |
| **Создание проекта** | Gemini 3 Pro | ✅ Работает | Секретарь — AI-интервью для создания проекта |
| **Менеджер проекта** | Gemini 2.5 Flash | ✅ Работает | Живой AI-диалог, управление проектом |
| **Профессор планирования** | Gemini 3 Pro | ✅ Работает | Генерация плана задач проекта (v3.14) |
| **Эксперт по задаче** | Gemini 3 Pro (env) | ✅ Работает | AI-диалог по конкретной задаче проекта (v3.16) |
| **Клерк-анализатор** | Gemini 2.5 Flash | ✅ Работает | Автоматический анализ файлов проекта |
| **Помощники проекта** | — | 🚧 Заглушка | Кастомные помощники |
| **Preset Помощники** | Gemini 3 Pro / 2.5 Flash | ⚠️ Частично | Маркетолог, Копирайтер и др. |

---

## ✅ Работающие чаты (детали)

### Сервисные чаты (ServiceChat v3.8)

> **Архитектура:** Все сервисные чаты используют единую систему `components/service-chat/`.

#### Создание проекта (Секретарь)
**Где:** Карточка "+ Новый проект" на dashboard, URL `/projects/new`

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 3 Pro |
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
| **Модель** | Gemini 2.5 Flash |
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
| **Модель** | Gemini 3 Pro |
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
| **Модель** | `process.env.EXPERT_MODEL \|\| 'gemini-3-pro'` |
| **Оболочка** | Отдельная route group `app/(task)/` — полноэкранный layout без AppSidebar |
| **Промпт** | `lib/prompts/experts/task-expert.md` + `buildTaskExpertPrompt()` |
| **Инструменты** | Shared tools (search, documents, excel) — `getStandardTools()` |
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

**UI компоненты:**
- **TaskChat** — полноценный чат: Messages, Artifact, MultimodalInput, DataStreamHandler
- **TaskSidebar** — навигация: список задач с иконками статусов, сворачивание, «← К проекту»

**Файлы:**
```
app/(task)/layout.tsx                                    # Layout (SWRProvider + DataStreamProvider + SidebarProvider)
app/(task)/projects/[id]/tasks/[taskId]/page.tsx          # Server Component (auth + guards + startTask)
app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts # Streaming endpoint
app/(chat)/api/projects/[id]/tasks/[taskId]/unlock/route.ts # Unlock locked → pending
components/projects/task-chat.tsx                         # Клиент чата
components/projects/task-sidebar.tsx                      # Навигация по задачам
lib/ai/tools/chat-tools.ts                               # Shared tools (getStandardTools)
lib/prompts/experts/task-expert.md                        # Промпт Эксперта
lib/prompts/build-task-expert-prompt.ts                   # Prompt builder
```

#### Клерк-анализатор файлов (v3.13)
**Где:** Автоматически вызывается после upload файла в проект

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 2.5 Flash |
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

---

## ⚠️ Частично реализовано

### Preset Помощники (Маркетолог, Копирайтер, и др.)
**Где:** Секция "ПОМОЩНИКИ" на dashboard, URL `/helpers/[id]/chat`

| Помощник | ID | Описание |
|----------|-----|----------|
| 📈 Маркетолог | `marketer` | Стратегии продвижения, анализ рынка |
| ✍️ Копирайтер | `copywriter` | Тексты для сайтов, рекламы, соцсетей |
| 🌍 Переводчик | `translator` | Перевод EN↔RU |
| 📊 Аналитик | `analyst` | Анализ данных, отчёты |
| 🎯 Наставник | `mentor` | Карьерные советы, мотивация |

**Модель:** Gemini 3 Pro / 2.5 Flash (как основной чат)

**⚠️ ПРОБЛЕМА:** Инструкции помощников определены в коде, но **НЕ применяются**!
- `helperId` не передаётся в API при отправке сообщений
- Чат работает как обычный, без кастомного системного промпта

**Файлы:**
```
lib/helpers/presets.ts              # Определение помощников с инструкциями
lib/helpers/types.ts                # Типы
app/(chat)/helpers/[id]/chat/       # Страницы чата
components/chat.tsx:182-183         # ← helperId НЕ передаётся
```

**TODO:** Добавить передачу `helperId` в API и применение инструкции в системном промпте.

---

## 🚧 Заглушки (не подключены к AI)

### Конструктор помощников
**Где:** Карточка "🔧 Конструктор" в секции "Помощники", ведёт на `/helpers/new`
**Статус:** Страница не существует (404)

**Файл:** [components/glavnaya/helpers-section.tsx](../components/glavnaya/helpers-section.tsx) (строка 46)

### Помощники проекта
**Где:** Кнопка "+ добавить" в паспорте проекта
**Статус:** Статичный текст, не кликается

**Файл:** [components/projects/project-passport.tsx](../components/projects/project-passport.tsx) (строка 84)

### Новая задача
**Где:** Кнопка "➕ Новая задача" на странице проекта
**Статус:** ✅ Работает — просто ссылка на `/projects/[id]/chat`

Это не отдельный чат, а создание нового чата в проекте с моделями Claude.

---

## 1. Основной чат (Main Chat)

**Где:** Главная страница, `/chat/[id]`

**Модели:**
- `gemini-3-pro` — Gemini 3 Pro Preview ($2/$12 за 1M токенов)
- `gemini-2.5-flash` — Gemini 2.5 Flash ($0.075/$0.30 за 1M токенов)

**Особенности:**
- Полная поддержка инструментов (search, documents, excel)
- Skills-based routing
- Персонализация (профиль + память)
- Стриминг ответов

**Файлы:**
```
app/(chat)/api/chat/route.ts          # API endpoint
lib/ai/providers.ts                   # Конфигурация Gemini
lib/prompts/builder/index.ts          # buildChatPrompt()
```

---

## 2. Чаты в проектах (Project Chats)

**Где:** `/projects/[id]/chat`

**Провайдер:** Google Gemini (напрямую)

> **⚠️ ВРЕМЕННО (v3.7.1):** Переведены на Gemini. См. [ADR 011](decisions/011-temporary-gemini-for-projects.md).
>
> **Ранее:** Claude через OpenRouter (см. [ADR 007](decisions/007-projects-claude-integration.md)).

### 2.1 Исполнитель (Executor)

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 2.5 Flash |
| **Input** | $0.075 / 1M токенов |
| **Output** | $0.30 / 1M токенов |
| **Контекст** | 1M |
| **Когда использовать** | Простые задачи, черновики, быстрые ответы |

### 2.2 Эксперт (Expert) — DEFAULT

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 3 Pro |
| **Input** | $2 / 1M токенов |
| **Output** | $12 / 1M токенов |
| **Контекст** | 1M |
| **Когда использовать** | Большинство задач, баланс качества и цены |

### 2.3 Профессор (Professor)

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 3 Pro |
| **Input** | $2 / 1M токенов |
| **Output** | $12 / 1M токенов |
| **Контекст** | 1M |
| **Когда использовать** | Сложные задачи, анализ, стратегия |

> **⚠️ Pipeline отключён:** Professor = Expert (оба Gemini 3 Pro). Код pipeline сохранён для будущего.

**Файлы:**
```
lib/ai/model-tiers.ts                 # Конфигурация уровней
lib/ai/providers.ts                   # geminiFlash, geminiPro
lib/ai/professor-pipeline.ts          # Multi-step pipeline (отключён)
```

---

## 3. Бен (Ben) — Помощник по платформе

**Где:** Кнопка ❓ в интерфейсе (header)

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 2.5 Flash |
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

### Google Gemini (активный)

```typescript
// lib/ai/providers.ts
import { google } from "@ai-sdk/google";

export const geminiFlash = google("gemini-2.5-flash");
export const geminiPro = google("gemini-3-pro-preview");
```

**API Key:** `GOOGLE_GENERATIVE_AI_API_KEY`

### Claude через OpenRouter (⏸️ временно отключён)

> **⚠️ ВРЕМЕННО ОТКЛЮЧЁН (v3.7.1):** См. [ADR 011](decisions/011-temporary-gemini-for-projects.md).

```typescript
// lib/ai/providers.ts (закомментировано)
// import { createOpenRouter } from "@openrouter/ai-sdk-provider";
// const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
// export const claudeHaiku = openrouter("anthropic/claude-haiku-4.5");
```

**API Key:** `OPENROUTER_API_KEY` (не требуется временно)

---

## Таблица цен

| Модель | Input | Output | Контекст | Используется в |
|--------|-------|--------|----------|---------------|
| Gemini 3 Pro | $2 | $12 | 1M | Основной чат, Создание проекта (Секретарь), Проект: Эксперт, Профессор |
| Gemini 2.5 Flash | $0.075 | $0.30 | 1M | Ben, Менеджер, Проект: Исполнитель |
| Gemini 2.5 Pro | $1.25 | $5 | 1M | Suggestions (внутренний) |

*Цены за 1M токенов*

> **Claude (отключён):** Haiku $1/$5, Sonnet $3/$15, Opus $5/$25 — см. [ADR 007](decisions/007-projects-claude-integration.md)

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
├── professors/            # Промпты профессоров (v3.14)
│   └── planning.md        # Профессор планирования
├── experts/               # Промпты экспертов (v3.16)
│   └── task-expert.md     # Эксперт по задаче
├── clerks/                # Промпты клерков (v3.13)
│   └── file-analyzer.md   # Клерк-анализатор файлов
├── service-chats/         # Промпты сервисных чатов (v3.11+)
│   ├── project-creation.md # Промпт Секретаря
│   └── project-manager.md  # Промпт Менеджера
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
    └── project-manager.ts     # Конфиг менеджера
```

---

## Связанная документация

- [ai-providers.md](ai-providers.md) — Детали провайдеров и цен
- [ai-agents.md](ai-agents.md) — Система промптов и помощники
- [ai-tools.md](ai-tools.md) — Инструменты (search, vision, excel)
