# Simply — Система промптов и помощники

**Версия:** 3.23.0
**Последнее обновление:** 2026-02-16
**Статус:** Skills + Agents + Experts + Professors + Clerks Architecture

---

## О документе

Этот документ — **источник правды** для системы промптов в Simply.

**Связанные документы:**
- [ai-artifacts.md](ai-artifacts.md) — система артефактов
- [ai-tools.md](ai-tools.md) — инструменты
- [ai-providers.md](ai-providers.md) — AI-провайдеры и модели

---

## Обзор архитектуры (v3.3)

Simply использует **Skills + Agents** архитектуру по стандарту Anthropic (agentskills.io).

### Концепции

| Концепция | Описание |
|-----------|----------|
| **Skills** | Атомарные навыки в формате Markdown (SKILL.md) |
| **Agents** | Персонажи-дирижёры с набором skills (AGENT.md + config.yaml) |
| **Builder** | Модульная система сборки промптов |
| **Progressive Disclosure** | Загрузка только необходимой информации |

### Преимущества

| Было (v3.0 — файловые промпты) | Стало (v3.3 — Skills + Agents) |
|--------------------------------|--------------------------------|
| Промпты в TypeScript файлах | Промпты в Markdown с frontmatter |
| Статическая конфигурация | Progressive Disclosure (metadata → full) |
| Жёсткая связь | Модульная сборка через Builder |
| Один формат | Skills (навыки) + Agents (персонажи) |

---

## Skills

Skills — атомарные навыки, которые можно переиспользовать между агентами.

### Формат SKILL.md

```markdown
---
name: skill-id
description: >
  Описание навыка на нескольких строках.
tools: [tool1, tool2]
---

# Название навыка

Инструкции для AI...
```

### Текущие Skills

| Skill | Категория | Tools | Описание |
|-------|-----------|-------|----------|
| **create-presentation** | document | createDocument | Создание презентаций (Reveal.js, PPTX) |
| **create-spreadsheet** | document | createDocument | Создание таблиц Excel с формулами |
| **create-text-document** | document | createDocument | Создание текстовых документов |
| **analyze-document** | document | readDocument, parseExcel | Анализ загруженных файлов |
| **web-research** | research | webSearch | Поиск информации в интернете |
| **prompt-helper** | utility | — | Помощь в формулировке эффективных промптов |

### Структура файлов

```
lib/prompts/skills/
├── _template/SKILL.md      # Шаблон для новых skills
├── document/               # Skills для документов
│   ├── create-presentation/SKILL.md
│   ├── create-spreadsheet/SKILL.md
│   ├── create-text-document/SKILL.md
│   └── analyze-document/SKILL.md
├── research/               # Skills для исследований
│   └── web-research/SKILL.md
└── utility/
    └── prompt-helper/
        └── SKILL.md        # Skill для улучшения промптов
```

---

## Agents

Agents — персонажи со своей личностью, моделью и набором skills.

### Формат файлов

**AGENT.md:**
```markdown
---
name: agent-id
displayName: Имя Агента
description: >
  Описание агента.
model: claude-haiku
skills: [skill1, skill2]
---

# Личность

Ты — **Имя**, описание роли...
```

**config.yaml:**
```yaml
name: agent-id
displayName: Имя Агента
description: Описание агента
model: claude-haiku
skills: []
icon: "❓"
```

### Текущие Agents

| Agent | Модель | Описание | UI |
|-------|--------|----------|-------|
| **ben** | Claude Haiku 4.5 | Гид по платформе Simply | Модальное окно (❓) |

### Структура файлов

```
lib/prompts/agents/
├── _template/              # Шаблон для новых агентов
│   ├── AGENT.md
│   └── config.yaml
└── ben/                    # Агент Бен
    ├── AGENT.md            # Личность и правила
    ├── config.yaml         # Метаданные
    ├── onboarding.md       # Приветствие для новых пользователей
    └── references/
        ├── features.md     # Описание фич платформы
        └── scenarios.md    # Сценарии помощи
```

---

## Промпты

### Основной чат (`chat`)

Универсальный AI-помощник с доступом ко всем инструментам.

| Параметр | Значение |
|----------|----------|
| ID | `chat` |
| Модель | Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) |
| Инструменты | Все (search, documents, weather и др.) |
| Сборка | `buildChatPrompt()` |

### Prompt-агент (`prompt-agent`)

Помогает сформулировать эффективный промпт для AI.

| Параметр | Значение |
|----------|----------|
| ID | `prompt-agent` |
| Тип | Skill (utility/prompt-helper) |
| Модель | Claude Sonnet 4.5 |
| Инструменты | Нет (только текст) |
| UI | Модальное окно (кнопка 📝) |
| Сборка | `buildPromptAgentPrompt()` |

**Что делает:**
1. Анализирует исходный запрос
2. Задаёт уточняющие вопросы
3. Формулирует улучшенный промпт
4. Предлагает вставить в основной чат

### Бен (`ben`)

Помощник по платформе Simply. Отвечает на вопросы о возможностях.

| Параметр | Значение |
|----------|----------|
| ID | `ben` |
| Тип | Agent (agents/ben) |
| Модель | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Инструменты | Нет (только текст) |
| UI | Модальное окно (кнопка ❓) |
| Сборка | `buildBenPrompt()` |

**Что делает:**
- Отвечает на вопросы о платформе
- Объясняет как работают инструменты
- НЕ выполняет рабочие задачи — перенаправляет в основной чат

**Онбординг:**
- Для новых пользователей показывает приветственное сообщение
- Флаг `hasSeenBenIntro` в таблице `User` предотвращает повтор

---

## Сервисные чаты (v3.8+)

> В версии 3.8.0 сервисные чаты унифицированы в систему ServiceChat.
> В версии 3.13.0 Менеджер получил живой AI-диалог с серверной персистенцией.

### Секретарь (`project-creation`)

AI-интервью для создания проектов.

| Параметр | Значение |
|----------|----------|
| ID | `project-creation` |
| Модель | Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) |
| Промпт | `lib/prompts/service-chats/project-creation.md` |
| Оболочка | Full-page (split layout: preview + chat) |
| Инструменты | `updateProjectDraft` |
| Сборка | Inline в service-chat route |

### Менеджер проекта (`project-manager`)

Живой AI-диалог для управления проектом.

| Параметр | Значение |
|----------|----------|
| ID | `project-manager` |
| Модель | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Промпт | `lib/prompts/service-chats/project-manager.md` |
| Оболочка | Push-drawer (400px desktop, bottom sheet mobile) |
| Инструменты | — (консультативный) |
| Персистенция | Серверная (Chat в БД) |
| Сборка | `buildFullManagerPrompt()` |

**Контекст промпта:**
- passport: name, description, context проекта
- manifest: агрегированные данные о файлах от Клерка
- files_status: список файлов с анализом
- mode injection: conditional по phase (first_contact / plan_presentation / navigation)

---

## Эксперты (v3.16)

> Эксперты — AI-агенты для конкретных задач проекта. Полноценный интерактивный чат с инструментами.

### Эксперт по задаче (`task-expert`)

AI-диалог по конкретной ProjectTask. Эксперт получает полный контекст задачи и проекта.

| Параметр | Значение |
|----------|----------|
| ID | `task-expert` |
| Модель | `process.env.EXPERT_MODEL \|\| 'claude-sonnet'` (`claude-sonnet-4-5-20250929`) |
| Промпт | `lib/prompts/experts/task-expert.md` |
| Prompt builder | `lib/prompts/build-task-expert-prompt.ts` |
| Endpoint | `POST /api/projects/[id]/tasks/[taskId]/chat` |
| Инструменты | Shared tools (search, documents, weather, excel, readProjectFile) |
| Артефакты | Поддерживаются |

**Контекст промпта (buildTaskExpertPrompt):**
- `project` — название, описание, контекст, инструкция проекта
- `task` — title, description, goal, input, expectedOutput, tools
- `completedTasks[]` — outputSummary завершённых задач (контекст предыдущей работы)
- `manifest` — структура файлов проекта

**Что делает:**
1. При открытии задачи auto-trigger отправляет системное сообщение
2. Эксперт анализирует задачу и предлагает план работы
3. Ведёт интерактивный диалог с пользователем
4. Использует инструменты (search, создание документов, excel, readProjectFile)
5. Результаты сохраняются в Chat, привязанном к ProjectTask

**Завершение задачи (v3.17):**
1. Кнопка «Завершить задачу» → AlertDialog подтверждения → spinner «Обработка...»
2. Суммаризатор (Клерк) → `summarizeTask()` создаёт outputSummary
3. Ревьюер (Профессор) → `reviewTask()` проверяет качество (если `needsReview`)
4. Completion card — три типа: success (зелёная), issues (жёлтая), critical (красная)
5. Кнопки: «Доработать» (reopen), «Принять» (accept), «Следующая задача», «К проекту»

**Файлы:**
```
lib/prompts/experts/task-expert.md           # Промпт Эксперта
lib/prompts/build-task-expert-prompt.ts      # Prompt builder
app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts     # Streaming endpoint
app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts # Завершение задачи (v3.17)
app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts   # Доработка (v3.17)
app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts   # Принятие (v3.17)
components/projects/task-chat.tsx             # UI чата + кнопка завершения
components/projects/task-completion-card.tsx  # Карточка результата (v3.17)
components/projects/task-sidebar.tsx          # Навигация
lib/ai/tools/chat-tools.ts                   # Shared tools
lib/ai/tools/read-project-file.ts            # Чтение файлов проекта (v3.17)
```

---

## Клерки (v3.13)

> Клерки — backend-процессы без UI. Вызываются автоматически, не интерактивные.

### Клерк-анализатор файлов (`file-analyzer`)

Автоматический анализ загруженных файлов проекта.

| Параметр | Значение |
|----------|----------|
| ID | `file-analyzer` |
| Модель | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Промпт | `lib/prompts/clerks/file-analyzer.md` |
| Триггер | Fire-and-forget после upload файла |
| Endpoint | `POST /api/projects/[id]/analyze-file` |

**Что делает:**
1. Анализирует файл: description, documentType, suggestedFolder, relevance, keyTopics, language
2. Создаёт папку если suggestedFolder не существует (auto-folder)
3. Перемещает файл в рекомендованную папку (move-to-folder)
4. Сохраняет анализ в `ProjectFile.metadata.analysis`
5. Перестраивает `Project.manifestJson` (агрегация всех анализов)

### Клерк-суммаризатор задач (`task-summarizer`) (v3.17)

Автоматическая суммаризация результатов завершённой задачи.

| Параметр | Значение |
|----------|----------|
| ID | `task-summarizer` |
| Модель | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Промпт | `lib/prompts/clerks/task-summarizer.md` |
| Триггер | Вызов `POST /api/projects/[id]/tasks/[taskId]/complete` |
| Endpoint | Внутренний вызов в complete endpoint |

**Что делает:**
1. Получает последние 40 сообщений чата (user/assistant)
2. Генерирует `outputSummary` через `generateText` + Zod-парсинг
3. Включает: title, summary, keyResults[], artifacts[], status
4. Fallback при ошибке → базовый текст "Задача завершена"

**Файлы:**
```
lib/ai/clerks/task-summarizer.ts          # Функция summarizeTask()
lib/ai/task-completion-types.ts           # Zod-схемы (taskSummarySchema)
lib/prompts/clerks/task-summarizer.md     # Промпт суммаризатора
```

---

## Профессоры (v3.14+)

> Профессоры — AI-агенты для сложных аналитических задач. Backend-процессы без интерактивного чата.

### Профессор планирования (`professor-planning`) (v3.14)

Генерация структурированного плана задач проекта.

| Параметр | Значение |
|----------|----------|
| ID | `professor-planning` |
| Модель | Claude Opus 4.6 (`claude-opus-4-6`) |
| Промпт | `lib/prompts/professors/planning.md` |
| Триггер | Кнопка «Начать планирование» |
| Endpoint | `POST /api/projects/[id]/plan` |

**Что делает:**
1. Анализирует проект (passport, manifest, files)
2. Генерирует JSON: tasks, risks, recommendations (discriminated union: complete / partial / needs_input)
3. Результат сохраняется в `Project.planJson`

### Профессор-ревьюер задач (`task-reviewer`) (v3.17)

Автоматическая проверка качества завершённой задачи.

| Параметр | Значение |
|----------|----------|
| ID | `task-reviewer` |
| Модель | Claude Opus 4.6 (`claude-opus-4-6`) |
| Промпт | `lib/prompts/professors/task-review.md` |
| Триггер | Вызов `POST /api/projects/[id]/tasks/[taskId]/complete` (если `needsReview`) |
| Endpoint | Внутренний вызов в complete endpoint |

**Что делает:**
1. Получает outputSummary от суммаризатора + описание задачи
2. Генерирует verdict через `generateText` + XML-парсинг `<review_analysis>` + `<review_json>`
3. Verdict включает: decision (approved/needs_revision), issues[], score, overallComment
4. `needs_revision` + severity=critical → статус задачи `issues` (требует доработки)
5. Fallback при ошибке → `approved` (не блокирует завершение)

**Файлы:**
```
lib/ai/professors/task-reviewer.ts        # Функция reviewTask()
lib/ai/task-completion-types.ts           # Zod-схемы (professorVerdictSchema)
lib/prompts/professors/task-review.md     # Промпт ревьюера
```

---

## Builder System

Модульная система сборки промптов с Progressive Disclosure.

### Архитектура

```
lib/prompts/builder/
├── index.ts            # Public API (buildChatPrompt, buildBenPrompt, etc.)
├── registry.ts         # Сканирование skills/agents, чтение metadata
├── skill-loader.ts     # Загрузка полного SKILL.md
├── agent-loader.ts     # Загрузка AGENT.md + config.yaml
└── composer.ts         # Сборка финального промпта
```

### Progressive Disclosure

3 уровня загрузки информации:

| Уровень | Что загружается | Когда |
|---------|-----------------|-------|
| **1. Metadata** | name, description, model | При старте приложения |
| **2. Full Content** | SKILL.md / AGENT.md | При выборе skill/agent |
| **3. References** | references/*.md | При необходимости |

### API использования

```typescript
// Server-side only!
import {
  buildChatPrompt,
  buildBenPrompt,
  buildPromptAgentPrompt
} from '@/lib/prompts/server';

// Основной чат
const chatPrompt = buildChatPrompt({
  user: { displayName: 'Владимир' },
});

// Бен (с онбордингом)
const benPrompt = buildBenPrompt({}, true);

// Prompt-агент
const promptAgentPrompt = buildPromptAgentPrompt({});
```

### Server-only vs Client-safe

```typescript
// В API routes и серверных компонентах:
import { buildChatPrompt, buildBenPrompt } from '@/lib/prompts/server';

// В клиентских компонентах (только типы и утилиты):
import type { BuildContext, BuiltPrompt } from '@/lib/prompts';
import { render, hasVariable } from '@/lib/prompts';
```

---

## Core Prompts

Переиспользуемые блоки промптов в формате Markdown.

```
lib/prompts/core/
├── index.ts            # Загрузчик .md файлов
├── base.md             # Базовые правила AI
├── safety.md           # Правила безопасности
├── formatting.md       # Правила форматирования
└── russian-market.md   # Специфика РФ рынка
```

### Пример base.md

```markdown
# Базовые правила

## Идентичность
Ты — Simply, дружелюбный AI-помощник для российских пользователей.

## Язык
- Отвечай на том языке, на котором спрашивают
- По умолчанию — русский
```

---

## Модальные помощники (UI)

### Компоненты

```
components/modal-assistants/
├── index.ts
├── types.ts
├── assistant-chat.tsx       # Общий чат-компонент
├── assistant-drawer.tsx     # Общий Drawer (Vaul)
├── prompt-agent/
│   ├── index.ts
│   ├── trigger.tsx          # Кнопка 📝
│   └── drawer.tsx           # Drawer обёртка
└── ben/
    ├── index.ts
    ├── trigger.tsx          # Кнопка ❓
    ├── drawer.tsx           # Drawer обёртка
    └── intro-bubble.tsx     # Speech bubble для онбординга
```

### API endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/assistant/prompt-agent` | POST | Чат с Prompt-агентом |
| `/api/assistant/ben` | POST | Чат с Беном |
| `/api/user/ben-intro` | PATCH | Обновление hasSeenBenIntro |

---

## AI-модели

| Промпт | Модель по умолчанию | Причина |
|--------|---------------------|---------|
| chat | Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) | Качество, инструменты |
| ben | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Быстрые ответы, экономия |
| task-expert | Claude Sonnet 4.5 (env override) | Качественный диалог по задаче |
| task-summarizer | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Быстрая суммаризация |
| task-reviewer | Claude Opus 4.6 (`claude-opus-4-6`) | Качественное ревью |
| professor-planning | Claude Opus 4.6 (`claude-opus-4-6`) | Сложные аналитические задачи |
| file-analyzer | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Быстрый анализ файлов |
| snapshot-creator | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Автоматический snapshot контекста |

> **Источник правды:** [ai-providers.md](ai-providers.md) — полная информация о моделях и ценах.

---

## Инструменты

### Основной чат (обычные чаты)

- `webSearch` — поиск в интернете
- `getWeather` — погода
- `getCurrentDate` — текущая дата
- `readDocument` — чтение из базы знаний
- `createDocument` — создание артефактов
- `updateDocument` — редактирование артефактов
- `requestSuggestions` — предложения по улучшению
- `parseExcel` — анализ Excel файлов
- `loadSkill` — загрузка инструкций из SKILL.md

### Проектные чаты (Эксперт)

Все инструменты основного чата **кроме** `readDocument`, **плюс:**
- `readProjectFile` — чтение файлов проекта по имени из manifest (v3.17)

### Модальные помощники

**Бен** не имеет доступа к инструментам — только текстовое общение.

> **Источник правды:** [ai-tools.md](ai-tools.md) — полная документация по инструментам.

---

## Ключевые файлы

| Категория | Файлы |
|-----------|-------|
| **Builder** | [lib/prompts/builder/](../lib/prompts/builder/) |
| **Server exports** | [lib/prompts/server.ts](../lib/prompts/server.ts) |
| **Skills** | [lib/prompts/skills/](../lib/prompts/skills/) |
| **Agents** | [lib/prompts/agents/](../lib/prompts/agents/) |
| **Experts** | [lib/prompts/experts/](../lib/prompts/experts/) |
| **Professors** | [lib/prompts/professors/](../lib/prompts/professors/) |
| **Clerks** | [lib/prompts/clerks/](../lib/prompts/clerks/) |
| **Core** | [lib/prompts/core/](../lib/prompts/core/) |
| **Service chats** | [lib/prompts/service-chats/](../lib/prompts/service-chats/) |
| **AI functions** | [lib/ai/clerks/](../lib/ai/clerks/), [lib/ai/professors/](../lib/ai/professors/) |
| **Shared tools** | [lib/ai/tools/chat-tools.ts](../lib/ai/tools/chat-tools.ts) |
| **API чата** | [app/(chat)/api/chat/route.ts](../app/(chat)/api/chat/route.ts) |

---

## Миграция с v3.0

В версии 3.3.0 изменено:

### Удалено
- `lib/prompts/chat/config.ts` → заменён на builder
- `lib/prompts/ben/config.ts` → заменён на agents/ben/
- `lib/prompts/assistants/` → заменён на skills/
- `lib/prompts/builder.ts` → заменён на builder/ папку
- `lib/prompts/core/*.ts` → заменены на .md файлы

### Добавлено
- `lib/prompts/builder/` — модульная система сборки
- `lib/prompts/skills/` — атомарные навыки
- `lib/prompts/agents/` — персонажи-агенты
- `lib/prompts/server.ts` — server-only экспорты
- `lib/prompts/core/*.md` — core промпты в Markdown

### Изменено
- `lib/prompts/index.ts` — теперь только client-safe экспорты
- API routes импортируют из `@/lib/prompts/server`

---

**Обновлено:** 2026-02-16
