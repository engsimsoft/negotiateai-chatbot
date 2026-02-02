# Simply — Система промптов и помощники

**Версия:** 3.3.1
**Последнее обновление:** 2026-02-02
**Статус:** Skills + Agents Architecture

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
model: gemini-2.5-flash
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
model: gemini-2.5-flash
skills: []
icon: "❓"
```

### Текущие Agents

| Agent | Модель | Описание | UI |
|-------|--------|----------|-------|
| **ben** | Gemini 2.5 Flash | Гид по платформе Simply | Модальное окно (❓) |

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
| Модель | Gemini 3 Pro |
| Инструменты | Все (search, documents, weather и др.) |
| Сборка | `buildChatPrompt()` |

### Prompt-агент (`prompt-agent`)

Помогает сформулировать эффективный промпт для AI.

| Параметр | Значение |
|----------|----------|
| ID | `prompt-agent` |
| Тип | Skill (utility/prompt-helper) |
| Модель | Gemini 3 Pro |
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
| Модель | Gemini 2.5 Flash |
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
| chat | Gemini 3 Pro | Качество, инструменты |
| prompt-agent | Gemini 3 Pro | Сложные рассуждения |
| ben | Gemini 2.5 Flash | Быстрые ответы, экономия |

> **Источник правды:** [ai-providers.md](ai-providers.md) — полная информация о моделях и ценах.

---

## Инструменты

### Основной чат (все инструменты)

- `webSearch` — поиск в интернете
- `getWeather` — погода
- `getCurrentDate` — текущая дата
- `readDocument` — чтение из базы знаний
- `createDocument` — создание артефактов
- `updateDocument` — редактирование артефактов
- `parseExcel` — анализ Excel файлов
- `exportDocument` — экспорт в DOCX

### Модальные помощники

**Prompt-агент и Бен** не имеют доступа к инструментам — только текстовое общение.

---

## Ключевые файлы

| Категория | Файлы |
|-----------|-------|
| **Builder** | [lib/prompts/builder/](../lib/prompts/builder/) |
| **Server exports** | [lib/prompts/server.ts](../lib/prompts/server.ts) |
| **Skills** | [lib/prompts/skills/](../lib/prompts/skills/) |
| **Agents** | [lib/prompts/agents/](../lib/prompts/agents/) |
| **Core** | [lib/prompts/core/](../lib/prompts/core/) |
| **Модальные компоненты** | [components/modal-assistants/](../components/modal-assistants/) |
| **API помощников** | [app/(chat)/api/assistant/](../app/(chat)/api/assistant/) |
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

**Обновлено:** 2026-02-02
