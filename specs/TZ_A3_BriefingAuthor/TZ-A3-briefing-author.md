# ТЗ-А3: Генератор статьи брифинга

**Цель:** Заменить этап «Анализатор» (JSON-карточки) на этап «Автор» (связная статья + структурированные источники). Один вызов Gemini Pro — два уровня контента.

**Версия:** 3.30.0 → 3.31.0

---

## Суть изменения

В пайплайне `POST /api/briefing/generate` **Этап 2** меняется полностью:

```
БЫЛО:  Fetch → Filter (Flash) → Analyzer (Pro) → JSON-карточки
СТАЛО: Fetch → Filter (Flash) → Author (Pro)   → Статья + источники
```

Модуль `briefing-analyzer.ts` удаляется. Заменяется на `briefing-author.ts`.

### Почему статья + источники в одном вызове

Автор отбирает кандидатов, группирует по темам, пишет текст — он уже знает какие источники использовал. Просим вернуть их структурированно рядом с текстом секции. Один вызов Pro вместо двух.

UI получает два уровня:
- **Статья** — основной контент, аналитика, wow-фактор
- **Источники** — привычные карточки «зацепился → кликнул → почитал оригинал»

---

## Что сделать

### 1. Новый модуль `lib/briefing/briefing-author.ts`

**Вход функции `generateArticle()`:**

```typescript
{
  candidates: FilteredItem[],          // ~25-30 от фильтра
  fullTexts: Map<string, RawContent>,  // полные тексты
  tierMap: Map<string, string>,        // tier источников
  userTopics: BriefingTopic[],         // из таблицы BriefingTopics
  language: string,                    // из settings
  maxItems: number,                    // из settings
  date: string,                        // ISO дата выпуска
}
```

**Выход:** `{ article: BriefingArticle, tokensUsed: number }`

**Модель:** Gemini 3 Pro (`gemini-3-pro-preview`).

**Метод:** `generateObject()` с Zod-схемой. Промпт из `lib/prompts/briefing/briefing-author.md`.

### 2. Промпт

Положить `briefing-author.md` в `lib/prompts/briefing/briefing-author.md`.

В промпт уже встроен формат JSON-выхода. Единственное дополнение к промпту — поле `sources` в каждой секции (см. обновлённый JSON ниже). Добавить в секцию «Формат выхода» промпта.

Плейсхолдеры заполняются программно (паттерн briefing-analyst):
- candidates с tier, url, summary, fullText
- userTopics с emoji
- language, maxItems, date

### 3. Типы `lib/briefing/briefing-types.ts`

Добавить новые типы. Старые (`BriefingJSON`, `BriefingBlock`, `BriefingItem`) удалить — UI карточек удалён в v3.28.0, ничего их не использует.

```typescript
// === Источник в секции (карточка для ленты) ===
interface BriefingArticleSource {
  title: string;           // Заголовок оригинала (своими словами, не копия)
  url: string;             // Ссылка на оригинал
  sourceName: string;      // "Reuters", "Хабр"
  tier: string;            // "flagship" | "respected" | "niche" | "community"
  summary: string;         // 1-2 предложения о чём статья
}

// === Секция статьи ===
interface BriefingArticleSection {
  topicId: string;         // из userTopics или "top"
  topicName: string;       // "Формула-1", "Главное"
  emoji: string;           // "🏎️", "⚡"
  content: string;         // Markdown-текст (200-500 слов, inline-ссылки)
  newsCount: number;       // сколько кандидатов использовано
  sources: BriefingArticleSource[];  // структурированные источники секции
}

// === Мета ===
interface BriefingArticleMeta {
  totalNews: number;
  topicsCount: number;
  readingTimeMinutes: number;
}

// === Статья (весь выпуск) ===
interface BriefingArticle {
  title: string;           // "Утренний брифинг · 21 февраля"
  intro: string;           // Вступление (50-80 слов)
  sections: BriefingArticleSection[];
  outro: string;           // Заключение (20-40 слов)
  meta: BriefingArticleMeta;
}
```

Zod-схема строго по этой структуре.

### 4. Обновить JSON-выход в промпте

В файле `briefing-author.md` секция «Формат выхода» — добавить `sources` в каждую section:

```json
{
  "title": "Утренний брифинг · 21 февраля",
  "intro": "...",
  "sections": [
    {
      "topicId": "f1",
      "topicName": "Формула-1",
      "emoji": "🏎️",
      "content": "Связный текст секции с [inline-ссылками](url)...",
      "newsCount": 4,
      "sources": [
        {
          "title": "Ferrari обновила обвес к тестам в Бахрейне",
          "url": "https://motorsport.com/...",
          "sourceName": "Motorsport.com",
          "tier": "flagship",
          "summary": "Подробный разбор аэродинамических изменений Ferrari к предсезонным тестам"
        },
        {
          "title": "Проблемы Red Bull с гидравликой на тестах",
          "url": "https://the-race.com/...",
          "sourceName": "The Race",
          "tier": "respected",
          "summary": "Ферстаппен проехал только 42 круга из-за технических проблем"
        }
      ]
    }
  ],
  "outro": "...",
  "meta": { "totalNews": 14, "topicsCount": 4, "readingTimeMinutes": 7 }
}
```

Правила для sources:
- `title` — своими словами, не копия заголовка оригинала
- Только источники реально использованные в content секции
- Порядок — по значимости (flagship первый)

### 5. Изменения в `route.ts`

**Загрузка тем.** Добавить `getBriefingTopics({ userId })` в начальный `Promise.all`.

**Фильтр — topicIds.** Заменить `getTopicIds()` на `userTopics.map(t => t.topicId)`. Fallback на `getTopicIds()` если пользовательских тем нет.

**Замена вызова.** `analyzeContent(...)` → `generateArticle(...)`.

**Подсчёт items.** `briefing.blocks.reduce(...)` → `article.meta.totalNews`.

**maxDuration.** `60` → `90`.

**Сохранение.** `briefingJson` хранит `BriefingArticle`. Поле jsonb — формат свободный.

### 6. Удалить

- `lib/briefing/briefing-analyzer.ts`
- `lib/prompts/briefing/briefing-analyst.md`
- Старые типы в `briefing-types.ts` (`BriefingJSON`, `BriefingBlock`, `BriefingItem`)

Перед удалением проверить что ничего в проекте их не импортирует (UI карточек удалён в v3.28.0).

---

## Формирование данных для промпта

**candidates** — для каждого:
```
- Заголовок: {title}
- URL: {url}
- Источник: {sourceName} (tier: {tier})
- Тема: {topicId}
- Краткое содержание: {summary}
- [если есть fullText]: Полный текст: {первые ~2000 слов}
```

**userSettings:**
```
- Темы: {topics.map(t => `${t.emoji} ${t.topicName} (id: ${t.topicId})`)}
- Язык: {language}
- Целевое количество: {maxItems}
```

**date:** ISO + день недели на русском.

---

## Ожидаемый результат

- `POST /api/briefing/generate` возвращает `BriefingArticle` со связным текстом + источниками
- Один вызов Gemini Pro вместо старого аналитика
- Фильтр использует персональные темы из BriefingTopics
- UI пока не рендерит (это ТЗ-А4)
- Мёртвый код аналитика удалён

---

## Ключевые файлы

| Файл | Действие |
|------|----------|
| `lib/briefing/briefing-author.ts` | **НОВЫЙ** |
| `lib/prompts/briefing/briefing-author.md` | **НОВЫЙ** |
| `lib/briefing/briefing-types.ts` | **ИЗМЕНИТЬ** — новые типы, удалить старые |
| `app/(chat)/api/briefing/generate/route.ts` | **ИЗМЕНИТЬ** — author вместо analyzer, загрузка тем |
| `lib/briefing/briefing-analyzer.ts` | **УДАЛИТЬ** |
| `lib/prompts/briefing/briefing-analyst.md` | **УДАЛИТЬ** |
