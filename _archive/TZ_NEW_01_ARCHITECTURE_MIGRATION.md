# ТЗ-NEW-01: Новая архитектура промптов + Чистка UI + Модальные помощники

**Версия:** 1.0  
**Дата:** 2026-02-01  
**Статус:** К разработке  
**Приоритет:** Критический — фундамент для всех последующих изменений

---

## Содержание

1. [Контекст и цели](#1-контекст-и-цели)
2. [Архитектурные решения](#2-архитектурные-решения)
3. [Часть A: Удаление старой системы агентов](#3-часть-a-удаление-старой-системы-агентов)
4. [Часть B: Инфраструктура промптов](#4-часть-b-инфраструктура-промптов)
5. [Часть C: Изменения UI](#5-часть-c-изменения-ui)
6. [Часть D: Модальные помощники](#6-часть-d-модальные-помощники)
7. [Часть E: Бен — справка по приложению](#7-часть-e-бен--справка-по-приложению)
8. [Часть F: Подключение Anthropic](#8-часть-f-подключение-anthropic)
9. [Порядок выполнения](#9-порядок-выполнения)
10. [Критерии готовности](#10-критерии-готовности)

---

## 1. Контекст и цели

### 1.1. Что меняем

Simply переходит от концепции "много агентов в чате" к новой архитектуре:

| Было | Станет |
|------|--------|
| 8 агентов в БД | Промпты в файловой системе |
| @-mentions для вызова агентов | Модальные помощники |
| Dropdown смены агента в header | Чистый header без выбора |
| Промпты hardcoded в коде | Builder API собирает из файлов |
| Один тип чата | Чат + Проекты (разные провайдеры) |

### 1.2. Почему меняем

| Проблема | Решение |
|----------|---------|
| Пользователь не понимает кого из 8 агентов выбрать | Один умный чат + специализированные модалки |
| @-mentions путают, "гостевые" сообщения непонятны | Убираем концепцию, заменяем на модальных помощников |
| Промпты в коде сложно поддерживать | Файловая система + builder API |
| Нет разделения простых вопросов и глубокой работы | Чат (Gemini) vs Проекты (Anthropic) |

### 1.3. Цели этого ТЗ

1. ✅ Удалить концепцию агентов из кода и БД полностью
2. ✅ Создать файловую инфраструктуру промптов с builder API
3. ✅ Упростить интерфейс (header, sidebar, чат)
4. ✅ Внедрить паттерн модальных помощников (первый — Prompt-агент)
5. ✅ Добавить Бена — справку по приложению
6. ✅ Подключить Anthropic SDK (для следующего ТЗ с проектами)

### 1.4. Что НЕ входит в это ТЗ

- Dashboard (следующее ТЗ)
- Проекты и режим Профессор (следующее ТЗ)
- RAG и Chat Memory (отдельное ТЗ)
- Биллинг

---

## 2. Архитектурные решения

### 2.1. Распределение моделей

| Контекст | Провайдер | Модель | Причина |
|----------|-----------|--------|---------|
| **Обычный чат** | Google | Gemini 3 Pro | 1M контекст для длинных бесед |
| **Prompt-агент (модалка)** | Google | Gemini 2.5 Flash | Быстро, дёшево, простая задача |
| **Бен (справка)** | Google | Gemini 2.5 Flash | Простые ответы про интерфейс |
| **Проект (обычный)** | Anthropic | Sonnet 4.5 | *Следующее ТЗ* |
| **Проект + Профессор** | Anthropic | Opus 4.5 → Haiku 4.5 | *Следующее ТЗ* |

**Ключевой принцип:** Провайдеры НЕ пересекаются в одном контексте. Пользователь в чате — всегда Gemini. Пользователь в проекте — всегда Anthropic.

### 2.2. Онбординг

Существующий 3-шаговый онбординг (`components/onboarding-dialog.tsx`) **сохраняется**:
1. Имя пользователя → `displayName`
2. Форма обращения (ты/вы) → `pronouns`
3. Сфера деятельности → `occupation`

**Бен появляется ПОСЛЕ онбординга** — как знакомство с продуктом, не как замена сбора профиля.

### 2.3. Паттерн модальных помощников

```
Основной чат (стабильный, Gemini Pro)
    │
    ├── [📝] Prompt-агент → структурирует мысли → результат в чат
    ├── [❓] Бен → справка по интерфейсу
    │
    └── (будущее)
        ├── [🔍] Исследователь → Deep Research
        └── [🖼️] Дизайнер → генерация изображений
```

**Преимущества:**
- Модалка на Flash (дёшево), основной чат на Pro (качественно)
- Чат не засоряется служебными сообщениями
- Понятная ментальная модель: модалка = отдельная задача

---

## 3. Часть A: Удаление старой системы агентов

### A1. Удаление таблиц из БД

**Файл:** `lib/db/schema.ts`

Удалить полностью:

```typescript
// УДАЛИТЬ: таблица agents
export const agents = pgTable('agents', { ... });

// УДАЛИТЬ: таблица userAgents  
export const userAgents = pgTable('user_agents', { ... });

// УДАЛИТЬ: relations для agents
export const agentsRelations = relations(agents, ({ many }) => ({ ... }));

// УДАЛИТЬ: relations для userAgents
export const userAgentsRelations = relations(userAgents, ({ one }) => ({ ... }));
```

### A2. Удаление agentId из связанных таблиц

**Файл:** `lib/db/schema.ts`

| Таблица | Поле | Строка (примерно) | Действие |
|---------|------|-------------------|----------|
| `chats` | `agentId` | ~136 | Удалить поле |
| `messages_v2` | `agentId` | ~167 | Удалить поле |

**Пример изменения в chats:**

```typescript
// БЫЛО:
export const chats = pgTable('chats', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  agentId: text('agent_id'),  // ← УДАЛИТЬ
  title: text('title'),
  // ...
});

// СТАЛО:
export const chats = pgTable('chats', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  title: text('title'),
  // ...
});
```

### A3. SQL миграция

Создать миграцию для очистки данных и удаления таблиц:

```sql
-- Очистка данных (тестовые, не жалко)
TRUNCATE TABLE messages_v2 CASCADE;
TRUNCATE TABLE chats CASCADE;

-- Удаление полей agentId
ALTER TABLE chats DROP COLUMN IF EXISTS agent_id;
ALTER TABLE messages_v2 DROP COLUMN IF EXISTS agent_id;

-- Удаление таблиц агентов
DROP TABLE IF EXISTS user_agents CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
```

### A4. Удаление серверного кода

**API routes — удалить:**
- `app/(chat)/api/agents/` — весь каталог
- `app/(chat)/api/user-agents/` — весь каталог
- Любые другие endpoints связанные с агентами

**Queries — удалить из `lib/db/queries/`:**
- Функции `getAgents`, `getAgentBySlug`, `getAgentById`
- Функции `getUserAgents`, `createUserAgent`, `updateUserAgent`, `deleteUserAgent`
- Любые другие функции работы с агентами

**Очистить импорты:**
- Убрать импорты `agents`, `userAgents` из schema везде где используются

### A5. Удаление клиентского кода

**Страницы — удалить:**
- `app/(chat)/agents/` — весь каталог (каталог агентов, страницы агентов)

**Компоненты — удалить:**
- Компоненты выбора агента (dropdown в header)
- Компоненты отображения агента (badge, avatar агента)
- Автокомплит @-mentions
- Парсинг @-упоминаний в input
- Визуальное выделение "гостевых" сообщений (отступ, фон, метка "↩️ гость")

**Хуки — удалить:**
- Хуки для работы с агентами (useAgents, useUserAgents и т.п.)

**Sidebar:**
- Убрать секцию "Мои агенты" (если есть)
- Убрать ссылки на /agents/*

### A6. Удаление промптов агентов

Найти и удалить все hardcoded промпты агентов в коде. Они будут заменены новой файловой системой.

Места где искать:
- `lib/ai/` — если там есть промпты
- `app/(chat)/api/chat/route.ts` — логика выбора промпта по агенту
- Константы с промптами агентов

---

## 4. Часть B: Инфраструктура промптов

### B1. Структура папок

Создать следующую структуру:

```
lib/prompts/
│
├── core/                              # Базовые блоки (для всех)
│   ├── base.md                        # Общие правила поведения
│   ├── formatting.md                  # Форматирование ответов
│   ├── safety.md                      # Ограничения и безопасность
│   └── russian-market.md              # Специфика РФ рынка
│
├── chat/                              # Универсальный чат
│   ├── config.yaml                    # Метаданные и настройки
│   └── system.md                      # Основной промпт чата
│
├── ben/                               # Бен — справка
│   ├── config.yaml                    # Метаданные
│   ├── system.md                      # Основной промпт
│   ├── personality.md                 # Характер, стиль общения
│   └── onboarding.md                  # Знакомство с продуктом
│
├── assistants/                        # Модальные помощники
│   └── prompt-agent/
│       ├── config.yaml
│       └── system.md
│
├── contexts/                          # Шаблоны динамических контекстов
│   ├── user-profile.md                # {{user.displayName}}, {{user.pronouns}}
│   └── chat-memory.md                 # {{memory.facts}} — для будущего
│
└── builder/                           # Сборщик промптов
    ├── index.ts                       # Главный API
    ├── types.ts                       # TypeScript типы
    ├── loader.ts                      # Загрузка .md и .yaml файлов
    ├── template.ts                    # Шаблонизация {{переменных}}
    └── composer.ts                    # Сборка финального промпта
```

### B2. Формат config.yaml

**Пример: `lib/prompts/chat/config.yaml`**

```yaml
slug: chat
name: Универсальный чат
model: gemini-3-pro
provider: google

# Какие файлы включать в промпт
includes:
  - system.md

# Какие core блоки использовать
core:
  - base.md
  - formatting.md
  - russian-market.md

# Какие контексты подключать
contexts:
  - user-profile.md

# Доступные tools (для будущего)
tools: []

# Метаданные для UI
description: "Универсальный AI-ассистент для любых вопросов"
```

**Пример: `lib/prompts/ben/config.yaml`**

```yaml
slug: ben
name: Бен
model: gemini-2.5-flash
provider: google

includes:
  - system.md
  - personality.md

core:
  - base.md

contexts:
  - user-profile.md

tools: []

description: "Справка по приложению Simply"
```

**Пример: `lib/prompts/assistants/prompt-agent/config.yaml`**

```yaml
slug: prompt-agent
name: Помощник с промптом
model: gemini-2.5-flash
provider: google

includes:
  - system.md

core:
  - base.md
  - formatting.md

contexts:
  - user-profile.md

tools: []

description: "Помогает сформулировать запрос"
```

### B3. Содержимое промптов

#### `lib/prompts/core/base.md`

```markdown
# Базовые правила

Ты — AI-ассистент платформы Simply.

## Принципы работы

1. **Полезность** — твоя главная цель помочь пользователю решить его задачу
2. **Честность** — если не знаешь ответ, скажи об этом
3. **Краткость** — не лей воду, отвечай по существу
4. **Уважение** — относись к пользователю с уважением

## Ограничения

- Не выдумывай факты
- Не давай медицинских, юридических или финансовых советов как профессионал
- Не генерируй вредоносный контент
```

#### `lib/prompts/core/formatting.md`

```markdown
# Форматирование ответов

## Общие правила

- Используй Markdown для структурирования
- Разбивай длинные ответы на секции с заголовками
- Используй списки для перечислений
- Выделяй важное **жирным**
- Код оформляй в блоки с указанием языка

## Длина ответов

- На простой вопрос — короткий ответ
- На сложный вопрос — структурированный ответ с разделами
- Не растягивай искусственно
```

#### `lib/prompts/core/russian-market.md`

```markdown
# Специфика российского рынка

## Язык

- Основной язык общения — русский
- Используй "ты" или "вы" согласно предпочтениям пользователя
- Избегай англицизмов где есть русский эквивалент

## Контекст

- Учитывай специфику российского бизнеса
- Цены в рублях где применимо
- Российские реалии (законодательство, практики, сервисы)
```

#### `lib/prompts/core/safety.md`

```markdown
# Безопасность

## Запрещено

- Генерация вредоносного кода
- Инструкции по созданию оружия, наркотиков
- Контент сексуального характера с несовершеннолетними
- Персональные данные реальных людей без их согласия
- Дискриминация по любым признакам

## При сомнениях

Если запрос в серой зоне — уточни намерения пользователя.
```

#### `lib/prompts/chat/system.md`

```markdown
# Универсальный ассистент Simply

Ты — умный AI-ассистент. Помогаешь пользователям решать любые задачи.

## Твои возможности

- Отвечать на вопросы
- Помогать с текстами
- Анализировать информацию
- Генерировать идеи
- Объяснять сложное простым языком

## Как работаешь

1. Внимательно читаешь запрос
2. Если нужны уточнения — спрашиваешь
3. Даёшь полезный, структурированный ответ
4. Предлагаешь следующие шаги если уместно

## Специализированные задачи

Для некоторых задач есть специальные помощники:
- **[📝]** — поможет сформулировать сложный запрос
- **[❓]** — справка по приложению Simply

Если пользователь спрашивает как пользоваться Simply — направь к Бену (кнопка ❓).
```

#### `lib/prompts/ben/system.md`

```markdown
# Бен — справка по Simply

Ты — Бен, помощник по приложению Simply.

## Твоя роль

Ты объясняешь КАК ПОЛЬЗОВАТЬСЯ приложением. Ты НЕ отвечаешь на рабочие вопросы пользователя.

## Что ты делаешь

- Объясняешь интерфейс Simply
- Подсказываешь какой инструмент для какой задачи
- Помогаешь когда пользователь застрял
- Проводишь знакомство с продуктом для новичков

## Что ты НЕ делаешь

- Не пишешь тексты
- Не анализируешь документы
- Не отвечаешь на вопросы не связанные с Simply
- Не заменяешь основной чат

## Когда перенаправлять

Если пользователь спрашивает что-то не про интерфейс:
> "Это лучше спросить в основном чате — я специализируюсь на помощи с интерфейсом Simply."

## Структура Simply

**Чат** — для быстрых вопросов и задач любого типа.

**Модальные помощники:**
- [📝] Prompt-агент — поможет сформулировать сложный запрос
- [❓] Я (Бен) — справка по приложению

**Проекты** — для глубокой работы с контекстом (база знаний, документы). *Скоро.*
```

#### `lib/prompts/ben/personality.md`

```markdown
# Характер Бена

## Культурный код

"Бен, help" — отсылка к фильму "Брат 2".

Данила приехал в Америку, не знает языка и как всё работает. Но есть Бен — местный, который поможет.

Так и здесь: пользователь 40+ пришёл в мир AI, не понимает промпты и модели. Есть Бен — справка, которая объяснит человеческим языком.

## Тон общения

- Дружелюбный, но не панибратский
- Терпеливый — пользователь может не понимать очевидных вещей
- Конкретный — не лей воду, показывай куда нажать
- С юмором — можно пошутить, но не переборщить

## Примеры фраз

✅ "Понял! Смотри, для этого есть кнопка [📝] справа вверху..."
✅ "Если хочешь поработать с документами — это будет в Проектах. Пока они в разработке."
✅ "Бен, help? 😄 Чем могу?"

❌ "Данный функционал располагается в верхней панели навигации..."
❌ "К сожалению, я не могу помочь с этим вопросом..."
```

#### `lib/prompts/ben/onboarding.md`

```markdown
# Знакомство с Simply

Этот промпт используется когда пользователь ВПЕРВЫЕ видит Бена (после заполнения профиля).

## Сценарий

1. Поприветствовать
2. Кратко объяснить что такое Simply
3. Показать основные возможности
4. Предложить начать с простого

## Пример диалога

**Бен:** 
Привет, {{user.displayName}}! Я Бен — помогу разобраться в Simply.

Simply — это твой AI-помощник. Можешь спрашивать что угодно в чате, а я подскажу если запутаешься.

**Что уже работает:**
- 💬 **Чат** — задавай любые вопросы
- 📝 **[📝]** — поможет сформулировать сложный запрос
- ❓ **Я** — справка (кнопка вверху справа)

**Скоро появится:**
- 📁 **Проекты** — для глубокой работы с твоими документами

Попробуй написать что-нибудь в чат! Если что — я рядом.
```

#### `lib/prompts/assistants/prompt-agent/system.md`

```markdown
# Prompt-агент

Ты помогаешь пользователю сформулировать запрос для AI.

## Твоя задача

Взять сырую идею пользователя и превратить в чёткий, структурированный промпт.

## Как работаешь

1. Слушаешь что хочет пользователь
2. Задаёшь уточняющие вопросы если нужно:
   - Для кого это? (аудитория)
   - В каком формате? (пост, статья, список)
   - Какой тон? (официальный, дружеский)
   - Есть ограничения? (длина, стиль)
3. Формируешь готовый промпт
4. Предлагаешь скопировать или отправить в чат

## Формат готового промпта

```
**Задача:** [что нужно сделать]

**Контекст:** [для чего, для кого]

**Формат:** [как должен выглядеть результат]

**Требования:**
- [требование 1]
- [требование 2]

**Примечания:** [если есть]
```

## Примеры

**Пользователь:** "хочу пост про кофе"

**Ты:** "Для какой соцсети пост? И какой посыл — продать, рассказать интересный факт, поделиться эмоциями?"

**Пользователь:** "для инсты, продаю кофе в зёрнах"

**Ты:** "Понял! Вот готовый промпт:

**Задача:** Написать продающий пост для Instagram

**Контекст:** Продажа кофе в зёрнах, B2C

**Формат:** Текст поста до 2200 знаков + предложения для хештегов

**Требования:**
- Цепляющее начало (первые 125 знаков видны в ленте)
- Эмоциональный, но не навязчивый тон
- Призыв к действию в конце

[📋 Копировать] [➡️ В чат]"
```

#### `lib/prompts/contexts/user-profile.md`

```markdown
## Контекст пользователя

{{#if user.displayName}}
- Имя: {{user.displayName}}
{{/if}}
{{#if user.pronouns}}
- Обращение: на "{{user.pronouns}}"
{{/if}}
{{#if user.occupation}}
- Сфера: {{user.occupation}}
{{/if}}

{{#if user.displayName}}
Используй имя пользователя когда уместно. Обращайся согласно предпочтениям.
{{/if}}
```

#### `lib/prompts/contexts/chat-memory.md`

```markdown
## Известно о пользователе (из прошлых разговоров)

{{#if memory.facts}}
{{#each memory.facts}}
- {{this}}
{{/each}}

Используй эту информацию для персонализации. Не упоминай явно что "помнишь" — просто учитывай контекст.
{{else}}
Пока нет информации из прошлых разговоров.
{{/if}}
```

### B4. Builder API

#### `lib/prompts/builder/types.ts`

```typescript
export interface PromptConfig {
  slug: string;
  name: string;
  model: string;
  provider: 'google' | 'anthropic';
  includes: string[];
  core: string[];
  contexts: string[];
  tools: string[];
  description: string;
}

export interface BuildContext {
  user?: {
    displayName?: string;
    pronouns?: string;
    occupation?: string;
  };
  memory?: {
    facts?: string[];
  };
  project?: {
    instruction?: string;
    ragContext?: string;
  };
}

export interface BuiltPrompt {
  systemPrompt: string;
  model: string;
  provider: 'google' | 'anthropic';
  config: PromptConfig;
}
```

#### `lib/prompts/builder/loader.ts`

```typescript
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { PromptConfig } from './types';

const PROMPTS_DIR = path.join(process.cwd(), 'lib', 'prompts');

export async function loadConfig(promptPath: string): Promise<PromptConfig> {
  const configPath = path.join(PROMPTS_DIR, promptPath, 'config.yaml');
  const content = await fs.readFile(configPath, 'utf-8');
  return yaml.load(content) as PromptConfig;
}

export async function loadMarkdown(filePath: string): Promise<string> {
  const fullPath = path.join(PROMPTS_DIR, filePath);
  return fs.readFile(fullPath, 'utf-8');
}

export async function loadCoreBlocks(blocks: string[]): Promise<string[]> {
  return Promise.all(
    blocks.map(block => loadMarkdown(path.join('core', block)))
  );
}

export async function loadIncludes(promptPath: string, includes: string[]): Promise<string[]> {
  return Promise.all(
    includes.map(file => loadMarkdown(path.join(promptPath, file)))
  );
}

export async function loadContexts(contexts: string[]): Promise<string[]> {
  return Promise.all(
    contexts.map(ctx => loadMarkdown(path.join('contexts', ctx)))
  );
}
```

#### `lib/prompts/builder/template.ts`

```typescript
import Handlebars from 'handlebars';
import { BuildContext } from './types';

// Регистрируем хелперы
Handlebars.registerHelper('if', function(this: any, conditional, options) {
  if (conditional) {
    return options.fn(this);
  }
  return options.inverse(this);
});

export function renderTemplate(template: string, context: BuildContext): string {
  const compiled = Handlebars.compile(template, { noEscape: true });
  return compiled(context);
}
```

#### `lib/prompts/builder/composer.ts`

```typescript
import { PromptConfig, BuildContext, BuiltPrompt } from './types';
import { loadConfig, loadCoreBlocks, loadIncludes, loadContexts } from './loader';
import { renderTemplate } from './template';

export async function composePrompt(
  promptPath: string,
  context: BuildContext
): Promise<BuiltPrompt> {
  // 1. Загружаем конфиг
  const config = await loadConfig(promptPath);
  
  // 2. Загружаем все части
  const [coreBlocks, includes, contexts] = await Promise.all([
    loadCoreBlocks(config.core),
    loadIncludes(promptPath, config.includes),
    loadContexts(config.contexts),
  ]);
  
  // 3. Собираем промпт
  const parts: string[] = [];
  
  // Core blocks
  parts.push(...coreBlocks);
  
  // Main includes
  parts.push(...includes);
  
  // Contexts (с шаблонизацией)
  for (const ctx of contexts) {
    const rendered = renderTemplate(ctx, context);
    if (rendered.trim()) {
      parts.push(rendered);
    }
  }
  
  // 4. Объединяем
  const systemPrompt = parts.join('\n\n---\n\n');
  
  return {
    systemPrompt,
    model: config.model,
    provider: config.provider,
    config,
  };
}
```

#### `lib/prompts/builder/index.ts`

```typescript
import { BuildContext, BuiltPrompt } from './types';
import { composePrompt } from './composer';

export type { PromptConfig, BuildContext, BuiltPrompt } from './types';

/**
 * Собирает промпт из файловой системы
 * 
 * @param type - тип промпта ('chat', 'ben', 'assistants/prompt-agent')
 * @param context - контекст для шаблонизации
 * @returns собранный промпт с метаданными
 * 
 * @example
 * const { systemPrompt, model, provider } = await buildPrompt('chat', {
 *   user: { displayName: 'Владимир', pronouns: 'ты' }
 * });
 */
export async function buildPrompt(
  type: string,
  context: BuildContext = {}
): Promise<BuiltPrompt> {
  return composePrompt(type, context);
}

/**
 * Список доступных типов промптов
 */
export const PROMPT_TYPES = {
  CHAT: 'chat',
  BEN: 'ben',
  PROMPT_AGENT: 'assistants/prompt-agent',
} as const;
```

### B5. Зависимости

Добавить в `package.json`:

```json
{
  "dependencies": {
    "handlebars": "^4.7.8",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9"
  }
}
```

---

## 5. Часть C: Изменения UI

### C1. Header

**Было:**
```
[🤝 Помощник ▼] [Gemini 3 Pro]         [🔒 Private ▼] [👤]
```

**Стало:**
```
[Simply]  [+ Новый чат]                    [📝] [❓] [👤]
```

| Элемент | Описание | Действие |
|---------|----------|----------|
| Simply | Логотип | Клик → на главную (пока /chat, потом /dashboard) |
| + Новый чат | Кнопка | Создать новый чат |
| [📝] | Prompt-агент | Открыть модальный помощник |
| [❓] | Бен | Открыть справку |
| [👤] | Профиль | Меню пользователя (как было) |

**Удалить:**
- Dropdown смены агента
- Badge модели
- Private/Public toggle

### C2. Sidebar

**Убрать:**
- Секцию "Мои агенты" (если есть)
- Ссылки на /agents/*

**Оставить:**
- История чатов
- Кнопка нового чата
- Остальное как было

### C3. Чат

**Убрать:**
- Парсинг @-упоминаний в input
- Автокомплит агентов при вводе @
- Визуальное выделение "гостевых" сообщений (отступ, фон, метка)
- Иконку агента на сообщениях

**Оставить:**
- Обычный ввод сообщений
- Голосовой ввод 🎤
- Загрузку файлов
- Артефакты (документы в холсте)

### C4. Роутинг

| Путь | Статус | Действие |
|------|--------|----------|
| `/` | Оставить | Пока ведёт на /chat (потом /dashboard) |
| `/chat` | Оставить | Основной чат |
| `/chat/[id]` | Оставить | Конкретный чат |
| `/agents` | Удалить | Редирект на /chat или 404 |
| `/agents/[slug]` | Удалить | Редирект на /chat или 404 |
| `/settings` | Оставить | Настройки |

---

## 6. Часть D: Модальные помощники

### D1. Компонентная структура

```
components/
└── modal-assistants/
    ├── index.ts                        # Экспорты
    ├── assistant-sheet.tsx             # Базовый Sheet для помощников
    ├── prompt-agent/
    │   ├── trigger.tsx                 # Кнопка [📝]
    │   ├── sheet.tsx                   # Sheet обёртка
    │   └── chat.tsx                    # Мини-чат внутри
    └── ben/
        ├── trigger.tsx                 # Кнопка [❓]
        ├── sheet.tsx                   # Sheet обёртка
        └── chat.tsx                    # Мини-чат внутри
```

### D2. Prompt-агент

#### Компонент кнопки: `trigger.tsx`

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { PenLine } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PromptAgentTriggerProps {
  onClick: () => void;
}

export function PromptAgentTrigger({ onClick }: PromptAgentTriggerProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className="h-9 w-9"
        >
          <PenLine className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Помощник с промптом
      </TooltipContent>
    </Tooltip>
  );
}
```

#### Компонент Sheet: `sheet.tsx`

```tsx
'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PromptAgentChat } from './chat';

interface PromptAgentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertToChat: (text: string) => void;
}

export function PromptAgentSheet({ 
  open, 
  onOpenChange,
  onInsertToChat 
}: PromptAgentSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            📝 Помощник с промптом
          </SheetTitle>
        </SheetHeader>
        <PromptAgentChat 
          onInsertToChat={(text) => {
            onInsertToChat(text);
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
```

#### Компонент чата: `chat.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, ArrowRight, Send } from 'lucide-react';
import { toast } from 'sonner';

interface PromptAgentChatProps {
  onInsertToChat: (text: string) => void;
}

export function PromptAgentChat({ onInsertToChat }: PromptAgentChatProps) {
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/assistant/prompt-agent',
    onFinish: (message) => {
      // Извлекаем промпт из ответа (между ``` или после "Вот готовый промпт:")
      const promptMatch = message.content.match(/```([\s\S]*?)```/) 
        || message.content.match(/готовый промпт[:\s]*([\s\S]*?)(\[📋|$)/i);
      if (promptMatch) {
        setLastPrompt(promptMatch[1].trim());
      }
    },
  });

  const handleCopy = () => {
    if (lastPrompt) {
      navigator.clipboard.writeText(lastPrompt);
      toast.success('Промпт скопирован');
    }
  };

  const handleInsert = () => {
    if (lastPrompt) {
      onInsertToChat(lastPrompt);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-muted-foreground text-sm">
            Опиши что хочешь сделать — я помогу сформулировать запрос.
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground ml-8'
                : 'bg-muted mr-8'
            }`}
          >
            <div className="whitespace-pre-wrap text-sm">
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="bg-muted p-3 rounded-lg mr-8">
            <div className="animate-pulse">Думаю...</div>
          </div>
        )}
      </div>

      {/* Кнопки действий */}
      {lastPrompt && (
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Копировать
          </Button>
          <Button size="sm" onClick={handleInsert}>
            <ArrowRight className="h-4 w-4 mr-2" />
            В чат
          </Button>
        </div>
      )}

      {/* Ввод */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Опиши задачу..."
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### D3. API endpoint для Prompt-агента

**Файл:** `app/(chat)/api/assistant/prompt-agent/route.ts`

```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { auth } from '@/lib/auth';
import { buildPrompt } from '@/lib/prompts/builder';
import { getUserProfile } from '@/lib/db/queries';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages } = await req.json();
  
  // Получаем профиль пользователя
  const user = await getUserProfile(session.user.id);
  
  // Собираем промпт
  const { systemPrompt, model } = await buildPrompt('assistants/prompt-agent', {
    user: {
      displayName: user?.displayName ?? undefined,
      pronouns: user?.pronouns ?? undefined,
      occupation: user?.occupation ?? undefined,
    },
  });

  const result = streamText({
    model: google('gemini-2.5-flash-preview-05-20'),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
```

---

## 7. Часть E: Бен — справка по приложению

### E1. Компоненты

Аналогично Prompt-агенту, но с другим промптом и стилем.

#### `components/modal-assistants/ben/trigger.tsx`

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BenTriggerProps {
  onClick: () => void;
}

export function BenTrigger({ onClick }: BenTriggerProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className="h-9 w-9"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Бен, help
      </TooltipContent>
    </Tooltip>
  );
}
```

#### `components/modal-assistants/ben/sheet.tsx`

```tsx
'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { BenChat } from './chat';

interface BenSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFirstTime?: boolean;
}

export function BenSheet({ open, onOpenChange, isFirstTime }: BenSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            ❓ Бен
          </SheetTitle>
        </SheetHeader>
        <BenChat isFirstTime={isFirstTime} />
      </SheetContent>
    </Sheet>
  );
}
```

#### `components/modal-assistants/ben/chat.tsx`

```tsx
'use client';

import { useEffect } from 'react';
import { useChat } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface BenChatProps {
  isFirstTime?: boolean;
}

export function BenChat({ isFirstTime }: BenChatProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/assistant/ben',
    initialMessages: isFirstTime ? [] : undefined,
  });

  // При первом визите Бен начинает разговор сам
  useEffect(() => {
    if (isFirstTime && messages.length === 0) {
      append({
        role: 'user',
        content: '__ONBOARDING__', // Специальный маркер для бэкенда
      });
    }
  }, [isFirstTime, messages.length, append]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages
          .filter(m => m.content !== '__ONBOARDING__') // Скрываем служебное сообщение
          .map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-8'
                  : 'bg-muted mr-8'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">
                {message.content}
              </div>
            </div>
          ))}
        {isLoading && (
          <div className="bg-muted p-3 rounded-lg mr-8">
            <div className="animate-pulse">Бен печатает...</div>
          </div>
        )}
      </div>

      {/* Ввод */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Спроси про Simply..."
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### E2. API endpoint для Бена

**Файл:** `app/(chat)/api/assistant/ben/route.ts`

```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { auth } from '@/lib/auth';
import { buildPrompt } from '@/lib/prompts/builder';
import { getUserProfile } from '@/lib/db/queries';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages } = await req.json();
  
  const user = await getUserProfile(session.user.id);
  
  // Определяем это онбординг или обычный вопрос
  const isOnboarding = messages.some(
    (m: any) => m.role === 'user' && m.content === '__ONBOARDING__'
  );
  
  // Выбираем тип промпта
  const promptType = isOnboarding ? 'ben' : 'ben'; // Можно добавить отдельный онбординг
  
  const { systemPrompt } = await buildPrompt(promptType, {
    user: {
      displayName: user?.displayName ?? undefined,
      pronouns: user?.pronouns ?? undefined,
      occupation: user?.occupation ?? undefined,
    },
  });

  // Для онбординга меняем первое сообщение
  const processedMessages = messages.map((m: any) => {
    if (m.content === '__ONBOARDING__') {
      return {
        ...m,
        content: 'Привет! Я только что зарегистрировался, расскажи про Simply.',
      };
    }
    return m;
  });

  const result = streamText({
    model: google('gemini-2.5-flash-preview-05-20'),
    system: systemPrompt,
    messages: processedMessages,
  });

  return result.toDataStreamResponse();
}
```

### E3. Интеграция с онбордингом

После завершения существующего онбординга (3 шага профиля) — показать Бена:

**Изменить:** `components/onboarding-dialog.tsx`

Добавить колбэк `onComplete` который откроет BenSheet с `isFirstTime={true}`.

---

## 8. Часть F: Подключение Anthropic

### F1. Установка SDK

```bash
npm install @ai-sdk/anthropic
```

### F2. Переменные окружения

Добавить в `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Добавить в `.env.example`:

```env
ANTHROPIC_API_KEY=
```

### F3. Конфигурация провайдера

**Файл:** `lib/ai/providers.ts` (создать если нет)

```typescript
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';

export const models = {
  // Google
  'gemini-3-pro': google('gemini-3-pro'),
  'gemini-2.5-flash': google('gemini-2.5-flash-preview-05-20'),
  
  // Anthropic (для следующего ТЗ)
  'claude-opus-4.5': anthropic('claude-opus-4-5-20251101'),
  'claude-sonnet-4.5': anthropic('claude-sonnet-4-5-20250929'),
  'claude-haiku-4.5': anthropic('claude-haiku-4-5-20251001'),
} as const;

export type ModelId = keyof typeof models;

export function getModel(id: ModelId) {
  return models[id];
}
```

### F4. Тестовый endpoint (опционально)

Для проверки что Anthropic работает:

**Файл:** `app/(chat)/api/test-anthropic/route.ts`

```typescript
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';

export async function GET() {
  try {
    const result = await generateText({
      model: getModel('claude-haiku-4.5'),
      prompt: 'Скажи "Привет, я Claude!" на русском.',
    });
    
    return Response.json({ 
      success: true, 
      response: result.text 
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
```

---

## 9. Порядок выполнения

### Фаза 1: Подготовка (не ломает текущее)

1. **[1.1]** Установить зависимости: `handlebars`, `js-yaml`, `@ai-sdk/anthropic`
2. **[1.2]** Создать структуру `lib/prompts/` со всеми файлами
3. **[1.3]** Создать builder API
4. **[1.4]** Создать `lib/ai/providers.ts`
5. **[1.5]** Добавить `ANTHROPIC_API_KEY` в env

**Тест:** Builder собирает промпт, Anthropic отвечает на тестовом endpoint.

### Фаза 2: Модальные помощники (добавляем новое)

6. **[2.1]** Создать компоненты Prompt-агента
7. **[2.2]** Создать API `/api/assistant/prompt-agent`
8. **[2.3]** Создать компоненты Бена
9. **[2.4]** Создать API `/api/assistant/ben`
10. **[2.5]** Добавить кнопки [📝] и [❓] в header

**Тест:** Модалки открываются, чаты работают, "В чат" вставляет текст.

### Фаза 3: Чистка UI (убираем старое)

11. **[3.1]** Убрать dropdown агента из header
12. **[3.2]** Убрать badge модели из header
13. **[3.3]** Убрать Private/Public toggle
14. **[3.4]** Убрать @-mentions из чата
15. **[3.5]** Убрать визуальные отличия гостевых сообщений
16. **[3.6]** Убрать секцию "Мои агенты" из sidebar
17. **[3.7]** Удалить страницы `/agents/*`

**Тест:** Интерфейс чистый, старый функционал не доступен.

### Фаза 4: Чистка кода и БД (финализация)

18. **[4.1]** Удалить API routes агентов
19. **[4.2]** Удалить функции queries агентов
20. **[4.3]** Удалить компоненты агентов
21. **[4.4]** Удалить хуки агентов
22. **[4.5]** Обновить схему БД (удалить таблицы и поля)
23. **[4.6]** Создать и выполнить миграцию БД
24. **[4.7]** Очистить импорты

**Тест:** Нет ошибок в консоли, приложение работает, БД чистая.

### Фаза 5: Интеграция (связываем всё вместе)

25. **[5.1]** Chat route использует builder вместо hardcoded промптов
26. **[5.2]** Онбординг открывает Бена после завершения
27. **[5.3]** Финальное тестирование всех сценариев

**Тест:** Полный user flow работает.

---

## 10. Критерии готовности

### Must have (обязательно)

- [ ] Таблицы `agents` и `user_agents` удалены из БД
- [ ] Поля `agentId` удалены из `chats` и `messages_v2`
- [ ] Структура `lib/prompts/` создана со всеми файлами
- [ ] Builder API работает и собирает промпты
- [ ] Header содержит только: логотип, новый чат, [📝], [❓], профиль
- [ ] @-mentions не работают (просто текст)
- [ ] Нет визуального различия "гостевых" сообщений
- [ ] Страницы /agents/* недоступны
- [ ] Prompt-агент работает в модалке
- [ ] Бен работает в модалке
- [ ] Кнопка "В чат" вставляет текст в основной чат
- [ ] Anthropic SDK установлен и настроен
- [ ] Нет ошибок TypeScript
- [ ] Production build успешен

### Nice to have (желательно)

- [ ] Бен появляется после онбординга для новых пользователей
- [ ] Тестовый endpoint проверяет Anthropic
- [ ] Метрики: время сборки промпта < 100ms

### Не делаем в этом ТЗ

- Dashboard
- Проекты
- Режим Профессор
- RAG
- Chat Memory
- Биллинг

---

## Приложение A: Список файлов для создания

```
lib/prompts/
├── core/
│   ├── base.md
│   ├── formatting.md
│   ├── safety.md
│   └── russian-market.md
├── chat/
│   ├── config.yaml
│   └── system.md
├── ben/
│   ├── config.yaml
│   ├── system.md
│   ├── personality.md
│   └── onboarding.md
├── assistants/
│   └── prompt-agent/
│       ├── config.yaml
│       └── system.md
├── contexts/
│   ├── user-profile.md
│   └── chat-memory.md
└── builder/
    ├── index.ts
    ├── types.ts
    ├── loader.ts
    ├── template.ts
    └── composer.ts

lib/ai/
└── providers.ts

components/modal-assistants/
├── index.ts
├── prompt-agent/
│   ├── trigger.tsx
│   ├── sheet.tsx
│   └── chat.tsx
└── ben/
    ├── trigger.tsx
    ├── sheet.tsx
    └── chat.tsx

app/(chat)/api/assistant/
├── prompt-agent/
│   └── route.ts
└── ben/
    └── route.ts
```

## Приложение B: Список файлов для удаления/изменения

**Удалить полностью:**
- `app/(chat)/agents/` — весь каталог
- `app/(chat)/api/agents/` — весь каталог  
- `app/(chat)/api/user-agents/` — весь каталог
- Компоненты выбора/отображения агентов
- Старые промпты агентов

**Изменить:**
- `lib/db/schema.ts` — удалить таблицы и поля
- Header — новая структура
- Sidebar — убрать агентов
- Chat input — убрать @-mentions
- Message компонент — убрать гостевой стиль
- `components/onboarding-dialog.tsx` — добавить вызов Бена

---

## Приложение C: Связанные документы

Для полного контекста архитектуры изучить:

1. **SIMPLY_ARCHITECTURE_DECISIONS_2026-02-01.md** — все архитектурные решения
2. **SIMPLY_PROMPTS_ARCHITECTURE.md** — структура промптов (v3.0)
3. **SIMPLY_INTERFACE_CONCEPT_V2.md** — целевой интерфейс
4. **SIMPLY_STATUS.md** — текущее состояние проекта (v2.13.0)
5. **SIMPLY_PRODUCT_VISION.md** — видение продукта

---

**Документ создан:** 2026-02-01  
**Автор:** Claude (Opus 4.5)  
**Для:** Claude Code  
**Статус:** Готово к разработке
