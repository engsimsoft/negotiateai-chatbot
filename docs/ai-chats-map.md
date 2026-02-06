# AI Chats Map — Simply

> **SSOT:** Полная карта всех AI-чатов, моделей и их конфигураций

**Обновлено:** 2026-02-06

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
| **Создание проекта** | Gemini 2.5 Flash | ✅ Работает | Диалог для создания нового проекта |
| **Менеджер проекта** | Gemini 2.5 Flash | ✅ Работает | Консультации по организации проекта |
| **Помощники проекта** | — | 🚧 Заглушка | Кастомные помощники |
| **Preset Помощники** | Gemini 3 Pro / 2.5 Flash | ⚠️ Частично | Маркетолог, Копирайтер и др. |

---

## ✅ Работающие чаты (детали)

### Сервисные чаты (ServiceChat v3.8)

> **Архитектура:** Все сервисные чаты используют единую систему `components/service-chat/`.

#### Создание проекта
**Где:** Карточка "+ Новый проект" на dashboard, URL `/projects/new`

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 2.5 Flash |
| **Оболочка** | Full-page |
| **Инструменты** | `createProject` — создаёт проект в БД |

**Как работает:**
1. Simply задаёт уточняющие вопросы (цель, для кого, особенности)
2. Формулирует паспорт проекта (название, описание, инструкция)
3. Вызывает tool `createProject` для сохранения в БД
4. Показывает карточку с кнопкой "Открыть проект"

**Файлы:**
```
app/(dashboard)/projects/new/page.tsx               # Страница
app/(dashboard)/projects/new/project-creation-client.tsx # Клиент
components/service-chat/configs/project-creation.ts # Конфигурация
app/(chat)/api/service-chat/route.ts                # API (context: project-creation)
```

#### Менеджер проекта
**Где:** Карточка "👤 Менеджер" на странице проекта `/projects/[id]`

| Параметр | Значение |
|----------|----------|
| **Модель** | Gemini 2.5 Flash |
| **Оболочка** | Drawer (справа) |
| **Инструменты** | — (консультативный режим) |

**Quick Actions:**
- 📁 Разобрать файлы
- 📊 Подвести итог
- 📝 Обновить инструкцию
- 📋 Разбить на задачи

**Файлы:**
```
components/projects/project-actions.tsx             # Триггер
components/service-chat/service-chat-drawer.tsx     # Drawer
components/service-chat/configs/project-manager.ts  # Конфигурация
app/(chat)/api/service-chat/route.ts                # API (context: project-manager)
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
| Gemini 3 Pro | $2 | $12 | 1M | Основной чат, Проект: Эксперт, Профессор |
| Gemini 2.5 Flash | $0.075 | $0.30 | 1M | Ben, Создание проекта, Менеджер, Проект: Исполнитель |
| Gemini 2.5 Pro | $1.25 | $5 | 1M | Suggestions (внутренний) |

*Цены за 1M токенов*

> **Claude (отключён):** Haiku $1/$5, Sonnet $3/$15, Opus $5/$25 — см. [ADR 007](decisions/007-projects-claude-integration.md)

---

## Архитектура промптов

```
lib/prompts/
├── server.ts              # Server-only экспорты
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
