# ADR 016: Архитектура Briefing Backend — Gemini для AI-пайплайна

**Дата:** 2026-02-19
**Статус:** Принято

---

## Контекст

Simply добавляет функцию "Утренний брифинг" — персонализированную новостную сводку. Backend должен:

1. Собирать контент из множества источников (RSS, Telegram, Web)
2. Фильтровать и дедуплицировать (~200 статей → ~30 кандидатов)
3. Анализировать и группировать по темам (~30 → ~15 финальных)
4. Возвращать структурированный JSON (BriefingJSON)

**Ключевые вопросы:**
- Какую модель использовать для пайплайна?
- Один этап AI или несколько?
- Как обрабатывать разнородные источники (RSS/Telegram/Web)?

---

## Решение

### 1. Gemini (не Claude) для AI-пайплайна

Briefing использует **Google Gemini** через `@ai-sdk/google`, а не Anthropic Claude:

- **Фильтрация:** Gemini 2.0 Flash — дедупликация, оценка релевантности
- **Анализ:** Gemini 3 Pro — глубокий анализ, группировка по темам, генерация BriefingJSON

### 2. Двухэтапный AI-пайплайн

```
200 статей → [Gemini Flash: фильтр] → 30 кандидатов → [Gemini Pro: анализ] → 15 новостей (BriefingJSON)
```

### 3. Три фетчера с единым интерфейсом

```
RSS  → rss-parser → RawContent[]
Telegram → cheerio (t.me/s/) → RawContent[]
Web  → @mozilla/readability + jsdom → RawContent[]
         ↓
    fetchSource() dispatcher по fetchMethod
```

### 4. Три таблицы БД (изолированные от основной схемы чатов)

- `BriefingSettings` — настройки пользователя (timezone, language, maxItems)
- `BriefingSources` — источники (topicId, sourceUrl, fetchMethod, tier)
- `BriefingHistory` — история генераций (briefingJson, stats, status)

---

## Причины

### Почему Gemini, а не Claude

1. **Разделение нагрузки** — Claude обрабатывает основной чат, проекты, сервисные чаты. Briefing — отдельный pipeline, не конкурирует за rate limits
2. **Экономия** — Gemini Flash значительно дешевле для этапа фильтрации (~200 статей × batch). Claude Haiku дороже для bulk-обработки
3. **Контекстное окно** — Gemini 3 Pro имеет 1M токенов контекста, удобно для анализа большого объёма текста за один вызов
4. **Structured Output** — `generateObject` с Zod-схемами работает одинаково хорошо с обоими провайдерами через Vercel AI SDK
5. **Стратегия** — Simply уже использует Gemini для vision-ocr. Briefing — ещё один use-case, где Gemini оптимальнее

### Почему два этапа, а не один

1. **Экономия токенов** — Flash дёшев и быстр для фильтрации. Pro получает только отфильтрованные данные
2. **Качество** — Flash хорошо справляется с бинарными решениями (релевантно/нет). Pro нужен для анализа и группировки
3. **Отказоустойчивость** — если Pro упадёт, фильтрованные данные можно переобработать
4. **Масштабируемость** — при росте источников Flash этап масштабируется линейно, Pro всегда получает ~30 кандидатов

### Почему три отдельные таблицы

1. **Изоляция** — briefing-данные не смешиваются с Chat/Message/Project
2. **Независимое масштабирование** — history может расти быстро (ежедневная генерация)
3. **Простота** — каждая таблица имеет чёткую ответственность
4. **Будущее** — настройки и источники можно редактировать через UI независимо

---

## Последствия

### Плюсы

- Разгрузка основного AI-провайдера (Claude) — briefing не влияет на производительность чатов
- Экономия: ~$0.10 за полный briefing (~56K токенов Flash + Pro) vs ~$0.30-0.50 на Claude
- 1M контекст Gemini Pro позволяет обработать все источники за один вызов
- Чёткое разделение: Claude = интерактивные чаты, Gemini = batch-обработка + vision
- Единый интерфейс фетчеров (RawContent[]) — легко добавить новые типы источников

### Минусы

- Два AI-провайдера в проекте (уже было из-за vision-ocr, не новая проблема)
- Два API ключа (`ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`)
- Gemini structured output иногда требует workaround'ов (thinkingBudget несовместим с generateObject)

---

## Альтернативы

### Альтернатива 1: Claude для всего пайплайна

**Что это:** Использовать Claude Haiku для фильтрации, Claude Sonnet для анализа.

**Почему отклонили:**
- Дороже для bulk-обработки (200 статей)
- Конкуренция за rate limits с основным чатом
- Нет преимущества в качестве для задачи фильтрации
- Контекстное окно Claude (200K) достаточно, но 1M у Gemini Pro даёт запас

### Альтернатива 2: Один этап AI

**Что это:** Отправить все 200 статей в одну модель, получить финальный результат.

**Почему отклонили:**
- Слишком большой промпт (200 статей × ~500 слов = ~100K слов)
- Дорого — Pro-модель обрабатывает весь объём
- Ниже качество — модель отвлекается на нерелевантный контент
- Нет возможности оптимизировать этапы независимо

### Альтернатива 3: Внешний агрегатор (Feedly API, NewsAPI)

**Что это:** Использовать готовый API для агрегации новостей.

**Почему отклонили:**
- Ограниченный контроль над источниками (особенно русскоязычными)
- Telegram-каналы не поддерживаются
- Дополнительная зависимость и стоимость
- Меньше гибкости в фильтрации

---

## Файловая структура

```
lib/briefing/
├── briefing-config.ts          # Константы (лимиты, таймауты, модели)
├── topics-catalog.ts           # 10 тем × 3-4 источника
├── briefing-filter.ts          # Gemini Flash: фильтрация
├── briefing-analyzer.ts        # Gemini Pro: анализ
└── source-fetchers/
    ├── types.ts                # RawContent, FetchResult
    ├── rss-fetcher.ts          # rss-parser
    ├── telegram-fetcher.ts     # cheerio (t.me/s/)
    ├── web-fetcher.ts          # @mozilla/readability + jsdom
    └── index.ts                # fetchSource() dispatcher

app/(chat)/api/briefing/
└── generate/route.ts           # POST endpoint

lib/db/
├── schema.ts                   # +3 таблицы
├── queries.ts                  # +7 CRUD queries
└── seed-briefing.ts            # Seed-скрипт
```

---

## Ссылки

- Vercel AI SDK Google: [@ai-sdk/google](https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai)
- rss-parser: [npm](https://www.npmjs.com/package/rss-parser)
- @mozilla/readability: [npm](https://www.npmjs.com/package/@mozilla/readability)
- Файл: `lib/briefing/briefing-config.ts`

---

## История изменений

- **2026-02-19** — ADR создан. Briefing Backend v3.26.0
