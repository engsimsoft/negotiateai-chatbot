# AI-агенты

**Версия:** 2.7.0
**Последнее обновление:** 2026-01-29
**Статус:** 9 специализированных агентов

---

## О документе

Этот документ — **источник правды** для системы AI-агентов в Simply.

**Связанные документы:**
- [ai-artifacts.md](ai-artifacts.md) — система артефактов
- [ai-tools.md](ai-tools.md) — инструменты агентов
- [decisions/004-agent-system.md](decisions/004-agent-system.md) — ADR: почему 9 агентов

---

## Список агентов

| Агент | Иконка | Модель | Назначение |
|-------|--------|--------|------------|
| **Маркетолог** | 📊 | Gemini 3 Pro | Маркетинговый консультант: стратегия, аналитика, ЦА |
| **Копирайтер** | ✍️ | Gemini 3 Pro | Продающие тексты: посты, реклама, заголовки |
| **Переводчик** | 🌐 | Gemini 3 Pro | Точный перевод с учетом контекста |
| **Кулинар** | 🍳 | Gemini 2.5 Flash | Рецепты и советы по готовке |
| **Астролог** | ⭐ | Gemini 2.5 Flash | Нумерология и гороскопы |
| **Наставник** | 📚 | Gemini 3 Pro | Личностный рост по методике Кови |
| **Универсальный** | 💬 | Gemini 2.5 Flash | Общий ассистент для любых задач |
| **Одессит** | 😄 | Gemini 2.5 Flash | Одесский юмор и байки |
| **Презентатор** | 🎯 | Gemini 3 Pro | Создание презентаций (PPTX, Reveal.js) |

---

## AI-модели

### Автоматический выбор (режим "auto")

Система автоматически выбирает оптимальную модель для каждого агента:

| Модель | ID | Агенты | Характеристики |
|--------|-----|--------|----------------|
| **Gemini 3 Pro** | `gemini-3-pro` | Маркетолог, Копирайтер, Переводчик, Наставник, Презентатор | 1M контекст, dynamic thinking, $2/$12 за 1M |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | Кулинар, Астролог, Универсальный, Одессит | Быстрый, дешевый |
| **Gemini 2.5 Pro** | `gemini-2.5-pro` | (suggestions) | Для генерации suggestions |

### Настройки моделей

**Gemini 3 Pro:**
- Temperature: 1.0
- Thinking budget: 1024 токенов
- Step limit: 5 шагов
- Context window: 1M токенов
- Max output: 64K токенов

**Gemini 2.5 Flash:**
- Temperature: 1.0
- Context window: 200K токенов

### Ручное переключение

Пользователь может переключить модель через селектор в UI:
- **Авто (рекомендуется)** — автовыбор на основе агента
- **Gemini 3 Pro** — ручной выбор
- **Gemini 2.5 Flash** — ручной выбор

---

## Системные промпты

### Структура промптов

Каждый агент имеет уникальный промпт в markdown файле:

| Агент | Файл промпта |
|-------|--------------|
| Маркетолог | [lib/ai/agents/marketer.md](../lib/ai/agents/marketer.md) |
| Копирайтер | [lib/ai/agents/copywriter.md](../lib/ai/agents/copywriter.md) |
| Переводчик | [lib/ai/agents/translator.md](../lib/ai/agents/translator.md) |
| Кулинар | [lib/ai/agents/cook.md](../lib/ai/agents/cook.md) |
| Астролог | [lib/ai/agents/astrologer.md](../lib/ai/agents/astrologer.md) |
| Наставник | [lib/ai/agents/mentor.md](../lib/ai/agents/mentor.md) |
| Универсальный | [lib/ai/agents/universal.md](../lib/ai/agents/universal.md) |
| Одессит | [lib/ai/agents/odessit.md](../lib/ai/agents/odessit.md) |
| Презентатор | [lib/ai/agents/presentator.md](../lib/ai/agents/presentator.md) |

### Загрузка промптов

```typescript
// lib/ai/prompts.ts
loadAgentPrompt(agentId: string): Promise<string>
```

- Кеширование промптов в памяти (Map cache)
- Fallback на `system-prompt.md` если агент не найден

### Контекст пользователя

```typescript
// lib/ai/prompts.ts
buildUserContext(user: User): string
```

Добавляет в промпт информацию о пользователе:
- Имя
- Роль
- Предпочтения из профиля

### Кастомизация агента

```typescript
// lib/ai/prompts.ts
buildAgentCustomizations(userAgent: UserAgent): string
```

Добавляет персональные настройки агента (если есть):
- Кастомное имя
- Стиль общения
- Специальные инструкции

---

## Доступ к инструментам

### Базовые инструменты (все агенты)

Все агенты имеют доступ к:
- `webSearch` — поиск в интернете
- `getWeather` — погода
- `getCurrentDate` — текущая дата
- `readDocument` — чтение из knowledge/
- `createDocument` — создание text артефактов
- `updateDocument` — обновление артефактов

### Эксклюзивные инструменты

**Презентатор** имеет эксклюзивный доступ к:
- `createDocument` с `kind: "presentation-reveal"`
- `createDocument` с `kind: "presentation-pptx"`

Другие агенты при запросе на презентацию направляют пользователя к Презентатору.

---

## Выбор агента в UI

### Главный экран

1. Пользователь видит карточки доступных агентов
2. При клике создается новый чат с `agentId`
3. Редирект на `/chat/{id}?agentId={agentId}`

### @-mentions (гостевой вызов)

Пользователь может вызвать агента в середине чата через `@Агент`:
- Не меняет `Chat.agentId`
- Сообщение визуально выделено (отступ + фон + метка)
- Агент отвечает один раз, затем возвращается основной агент

---

## Ключевые файлы

| Категория | Файлы |
|-----------|-------|
| **Конфигурация агентов** | [lib/db/seed-agents.ts](../lib/db/seed-agents.ts) |
| **Загрузка промптов** | [lib/ai/prompts.ts](../lib/ai/prompts.ts) |
| **Выбор модели** | [lib/ai/models.ts](../lib/ai/models.ts) |
| **Провайдеры AI** | [lib/ai/providers.ts](../lib/ai/providers.ts) |
| **API чата** | [app/(chat)/api/chat/route.ts](../app/(chat)/api/chat/route.ts) |
| **UI каталога** | [app/(chat)/agents/page.tsx](../app/(chat)/agents/page.tsx) |
| **UI страницы агента** | [app/(chat)/agents/[slug]/page.tsx](../app/(chat)/agents/[slug]/page.tsx) |
| **Sidebar агентов** | [components/sidebar-agents.tsx](../components/sidebar-agents.tsx) |

---

## Схема БД

### Таблица `Agent`

```sql
CREATE TABLE "Agent" (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,           -- "Маркетолог"
  slug VARCHAR UNIQUE NOT NULL,    -- "marketer"
  description TEXT,
  icon VARCHAR,                    -- "📊"
  defaultModel VARCHAR,            -- "gemini-3-pro"
  capabilities JSONB,              -- { exampleTasks: [...] }
  createdAt TIMESTAMP
);
```

### Таблица `UserAgent` (персонализация)

```sql
CREATE TABLE "UserAgent" (
  id UUID PRIMARY KEY,
  userId UUID REFERENCES "User"(id),
  agentId UUID REFERENCES "Agent"(id),
  customName VARCHAR,              -- Кастомное имя
  customInstructions TEXT,         -- Доп. инструкции
  createdAt TIMESTAMP
);
```

---

**Обновлено:** 2026-01-29
