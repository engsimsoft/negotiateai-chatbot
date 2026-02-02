# Simply — Система промптов и помощники

**Версия:** 3.0.0
**Последнее обновление:** 2026-02-02
**Статус:** Новая архитектура (файловая система промптов)

---

## О документе

Этот документ — **источник правды** для системы промптов в Simply.

**Связанные документы:**
- [ai-artifacts.md](ai-artifacts.md) — система артефактов
- [ai-tools.md](ai-tools.md) — инструменты
- [ai-providers.md](ai-providers.md) — AI-провайдеры и модели

---

## Обзор архитектуры

Simply использует **файловую систему промптов** с TypeScript конфигами. Это заменяет предыдущую систему агентов в БД.

### Преимущества новой архитектуры

| Было (агенты в БД) | Стало (файловые промпты) |
|-------------------|--------------------------|
| 8 агентов с отдельными промптами | 1 универсальный чат + 2 модальных помощника |
| Промпты в БД (seed-agents.ts) | Промпты в TypeScript файлах |
| Сложный UI выбора агента | Чистый интерфейс |
| @-mentions для смены агента | Нет @-mentions — просто пиши |

---

## Промпты

### Основной чат (`chat`)

Универсальный AI-помощник с доступом ко всем инструментам.

| Параметр | Значение |
|----------|----------|
| ID | `chat` |
| Модель | Gemini 3 Pro |
| Инструменты | Все (search, documents, weather и др.) |
| Файл | [lib/prompts/chat/config.ts](../lib/prompts/chat/config.ts) |

### Prompt-агент (`prompt-agent`)

Помогает сформулировать эффективный промпт для AI.

| Параметр | Значение |
|----------|----------|
| ID | `prompt-agent` |
| Модель | Gemini 3 Pro |
| Инструменты | Нет (только текст) |
| UI | Модальное окно (кнопка 📝) |
| Файл | [lib/prompts/assistants/prompt-agent/config.ts](../lib/prompts/assistants/prompt-agent/config.ts) |

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
| Модель | Gemini 2.5 Flash |
| Инструменты | Нет (только текст) |
| UI | Модальное окно (кнопка ❓) |
| Файл | [lib/prompts/ben/config.ts](../lib/prompts/ben/config.ts) |

**Что делает:**
- Отвечает на вопросы о платформе
- Объясняет как работают инструменты
- НЕ выполняет рабочие задачи — перенаправляет в основной чат

**Онбординг:**
- Для новых пользователей показывает приветственное сообщение
- Флаг `hasSeenBenIntro` в таблице `User` предотвращает повтор

---

## Структура файлов

```
lib/prompts/
├── index.ts                 # Экспорты (buildPrompt, типы)
├── types.ts                 # TypeScript типы
├── builder.ts               # Логика сборки промптов
├── template.ts              # Template engine ({{variables}})
├── core/                    # Переиспользуемые блоки
│   ├── index.ts
│   ├── base.ts              # Базовые правила
│   ├── formatting.ts        # Форматирование
│   ├── safety.ts            # Безопасность
│   └── russian-market.ts    # Специфика РФ рынка
├── chat/
│   └── config.ts            # Конфиг основного чата
├── ben/
│   └── config.ts            # Конфиг Бена
├── assistants/
│   └── prompt-agent/
│       └── config.ts        # Конфиг Prompt-агента
└── contexts/
    ├── index.ts
    ├── user-profile.ts      # Контекст профиля
    └── chat-memory.ts       # Контекст памяти (план)
```

---

## API использования

### Сборка промпта

```typescript
import { buildPrompt } from '@/lib/prompts';

// Основной чат
const chatPrompt = buildPrompt('chat', {
  user: { displayName: 'Владимир' },
});

console.log(chatPrompt.systemPrompt); // Содержит "Владимир"
console.log(chatPrompt.model);        // 'gemini-3-pro'

// Бен
const benPrompt = buildPrompt('ben');

// Prompt-агент
const promptAgentPrompt = buildPrompt('prompt-agent');
```

### Специализированные билдеры

```typescript
import { buildChatPrompt, buildBenPrompt, buildPromptAgentPrompt } from '@/lib/prompts';

// С типизированным контекстом
const result = buildChatPrompt({
  user: {
    displayName: 'Анна',
    occupation: 'Маркетолог',
    pronouns: 'ты',
  },
});
```

### Получение конфигов

```typescript
import { getConfig, getAvailablePrompts } from '@/lib/prompts';

// Конфиг по ID
const benConfig = getConfig('ben');

// Список доступных промптов
const prompts = getAvailablePrompts();
// ['chat', 'ben', 'prompt-agent']
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
    └── drawer.tsx           # Drawer обёртка
```

### API endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/assistant/prompt-agent` | POST | Чат с Prompt-агентом |
| `/api/assistant/ben` | POST | Чат с Беном |
| `/api/user/ben-intro` | PATCH | Обновление hasSeenBenIntro |

---

## Контекст пользователя

### Профиль

```typescript
import { buildUserProfileContext } from '@/lib/prompts';

const context = buildUserProfileContext({
  displayName: 'Владимир',
  pronouns: 'ты',
  occupation: 'Предприниматель',
  bio: 'Владелец интернет-магазина',
});
// "Пользователя зовут: Владимир\nОбращаться на: ты\n..."
```

### Template variables

Промпты поддерживают переменные `{{variable}}`:

```typescript
import { render } from '@/lib/prompts';

const template = 'Привет, {{userName}}! Ты работаешь в {{industry}}.';
const result = render(template, {
  userName: 'Анна',
  industry: 'маркетинг',
});
// "Привет, Анна! Ты работаешь в маркетинг."
```

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
| **Система промптов** | [lib/prompts/](../lib/prompts/) |
| **Билдер** | [lib/prompts/builder.ts](../lib/prompts/builder.ts) |
| **Конфиг чата** | [lib/prompts/chat/config.ts](../lib/prompts/chat/config.ts) |
| **Конфиг Бена** | [lib/prompts/ben/config.ts](../lib/prompts/ben/config.ts) |
| **Конфиг Prompt-агента** | [lib/prompts/assistants/prompt-agent/config.ts](../lib/prompts/assistants/prompt-agent/config.ts) |
| **Модальные компоненты** | [components/modal-assistants/](../components/modal-assistants/) |
| **API помощников** | [app/(chat)/api/assistant/](../app/(chat)/api/assistant/) |
| **API чата** | [app/(chat)/api/chat/route.ts](../app/(chat)/api/chat/route.ts) |

---

## Миграция с v2.x

В версии 3.0.0 удалены:

- Таблицы `Agent` и `UserAgent` из БД
- Поля `agentId` из таблиц `Chat` и `Message`
- UI выбора агента в header
- @-mentions для смены агента
- Каталог агентов `/agents`
- Файл `lib/db/seed-agents.ts`

Добавлено:

- Файловая система промптов `lib/prompts/`
- Модальные помощники (Prompt-агент, Бен)
- Поле `hasSeenBenIntro` в таблице `User`

---

**Обновлено:** 2026-02-02
