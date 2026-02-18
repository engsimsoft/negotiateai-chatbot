# ТЗ-BR1: Утренний брифинг — Backend

**Версия:** 1.0 | **Дата:** 2026-02-19
**Зависимости:** Нет блокирующих. Всё новое.
**Результат:** API endpoint `POST /api/briefing/generate` — вызываешь, получаешь готовый брифинг в БД.

---

## Суть

Simply каждое утро собирает новости из источников пользователя (RSS, сайты, Telegram-каналы), анализирует через Gemini Flash, выдаёт структурированный JSON. Это ТЗ — только backend. UI — следующее ТЗ.

---

## 1. База данных (Drizzle миграция)

Три новые таблицы. Добавить в `lib/db/schema.ts`:

### briefing_settings (одна запись на пользователя)

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| userId | uuid FK → User | UNIQUE |
| isActive | boolean, default false | Включен ли брифинг |
| timezone | varchar(50), default 'Europe/Moscow' | |
| generationTime | varchar(5), default '06:00' | Время генерации (HH:MM) |
| language | varchar(10), default 'ru' | Язык выходных данных |
| maxItems | integer, default 15 | Максимум новостей в брифинге |
| createdAt, updatedAt | timestamp | |

### briefing_sources (источники пользователя)

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| userId | uuid FK → User | |
| topicId | varchar(50) | Ключ из каталога тем ('ai', 'f1', 'finance') |
| sourceUrl | text NOT NULL | URL сайта или @username Telegram |
| sourceName | varchar(200) NOT NULL | Человекочитаемое имя |
| sourceLanguage | varchar(10), default 'ru' | |
| tier | varchar(20), default 'unknown' | original / analytics / derivative / unknown |
| rssUrl | text | Отдельный RSS URL если отличается |
| fetchMethod | varchar(20) | rss / jina / telegram_parse |
| isActive | boolean, default true | |
| priority | integer, default 5 | |
| createdAt | timestamp | |

### briefing_history (сгенерированные брифинги)

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid PK | |
| userId | uuid FK → User | |
| briefingJson | jsonb NOT NULL | Полный structured JSON (формат ниже) |
| sourcesChecked | integer | Сколько источников проверили |
| itemsIncluded | integer | Сколько новостей вошло |
| duplicatesRemoved | integer | Сколько дубликатов убрали |
| tokensUsed | integer | Токены Gemini Flash |
| status | varchar(20) NOT NULL | generating / ready / failed |
| generatedAt | timestamp NOT NULL | |
| createdAt | timestamp | |

Добавить queries в `lib/db/queries.ts`: CRUD для всех трёх таблиц.
Индексы: userId для всех, (userId, generatedAt DESC) для history.

---

## 2. Конфигурация

### `lib/briefing/briefing-config.ts`

Константы: лимиты токенов, таймауты фетчинга (10 сек), максимум источников (20), максимум новостей (15), модель для анализа.

### `lib/briefing/topics-catalog.ts`

Каталог тем с рекомендуемыми источниками. Формат:

```typescript
interface TopicsCatalog {
  [topicId: string]: {
    name: string;           // "Формула-1"
    emoji: string;          // "🏎️"
    keywords: string[];
    sources: RecommendedSource[];
  }
}

interface RecommendedSource {
  name: string;
  url: string;
  rss?: string;
  language: string;
  tier: 'original' | 'analytics' | 'derivative';
  fetchMethod: 'rss' | 'jina' | 'telegram_parse';
}
```

Стартовый набор — **10 тем, 3-5 источников каждая:**
- AI / Технологии / Стартапы / Финансы / Маркетинг / E-commerce / Управление / Криптовалюты / F1 / Разное

Источники подобрать реальные, с рабочими RSS где возможно. Приоритет — русскоязычные (vc.ru, habr, rbc.ru и т.д.) + ключевые англоязычные (The Verge, TechCrunch, OpenAI blog).

---

## 3. Фетчеры источников

Общий интерфейс в `lib/briefing/source-fetchers/types.ts`:

```typescript
interface RawContent {
  title: string;
  url: string;
  content: string;      // текст статьи (первые 1000 символов)
  publishedAt?: Date;
  sourceName: string;
  sourceLanguage: string;
}

type FetchResult = {
  items: RawContent[];
  errors: string[];
}
```

### `rss-fetcher.ts`
npm-пакет `rss-parser`. Получает RSS/Atom фид, парсит, возвращает RawContent[]. Фильтр: только за последние 24 часа.

### `telegram-fetcher.ts`
Парсинг публичной веб-версии `t.me/s/{channel}` через cheerio. Извлекает посты за последние 24ч. Это бесплатно и не требует Bot API.

### `web-fetcher.ts`
Для сайтов без RSS. Используем простой fetch + cheerio для извлечения текста. Если в будущем подключим Jina Reader — заменим реализацию, интерфейс тот же.

**Важно:** Фетчеры работают параллельно (Promise.allSettled). Ошибка одного источника не блокирует остальные.

---

## 4. Двухэтапный AI-пайплайн

Принцип Simply: «дешёвый фильтрует — умный анализирует». Gemini уже в стеке (@ai-sdk/google) — используется для summary чатов и зрения (клерк). Расширяем на брифинг.

### Этап 1: Фильтрация — `lib/briefing/briefing-filter.ts`

**Модель: Gemini 2.0 Flash** (~$0.007 за вызов)

**Вход:** массив RawContent[] от всех фетчеров (может быть 50-100 статей).

**Задача:** убрать мусор, дедуплицировать, оставить 25-30 кандидатов.

**Выход:** массив FilteredItem[] — title, url, sourceName, topicId, oneLinerSummary (1 строка).

Промпт фильтра:
1. Убрать дубликаты (одна новость из 3 источников → оставить лучший)
2. Убрать рекламные/промо статьи
3. Убрать устаревшее (>48 часов если не важное)
4. Для каждого кандидата — одна строка описания (для передачи на Этап 2)

### Этап 2: Анализ и редакция — `lib/briefing/briefing-analyzer.ts`

**Модель: Gemini 3 Pro** (~$0.09 за вызов)

Это редактор-аналитик, не фильтр. Определяет качество конечного продукта. Gemini 3 Pro выбран за отличное качество текстов на русском, мощный анализ и разумную стоимость ($2/12 за 1M токенов — в 2.5 раза дешевле Sonnet).

**Вход:** 25-30 FilteredItem[] + полные тексты кандидатов + настройки пользователя (язык, maxItems, интересы).

**Выход:** structured JSON (через generateObject или JSON-промпт):

```typescript
interface BriefingJSON {
  date: string;                    // "2026-02-19"
  totalSourcesChecked: number;
  totalCandidates: number;         // сколько прошло фильтр
  blocks: BriefingBlock[];
}

interface BriefingBlock {
  topicId: string;                 // "ai"
  topicName: string;               // "Искусственный интеллект"
  emoji: string;                   // "🤖"
  items: BriefingItem[];
}

interface BriefingItem {
  title: string;                   // Заголовок на языке пользователя
  summary: string;                 // 1-2 предложения анализа — НЕ пересказ, а ПОЧЕМУ это важно
  importance: 'high' | 'medium' | 'low';
  sourceUrl: string;
  sourceName: string;
  sourceLanguage: string;          // 'en' → пометка перевода в UI
  publishedAt?: string;
}
```

Промпт аналитика должен:
1. Из 25-30 кандидатов выбрать 10-15 самых важных и интересных
2. Писать summary как умный коллега, не как робот — «почему это важно», не «что произошло»
3. Группировать по темам
4. Переводить на язык пользователя (встроено в промпт, не отдельный шаг)
5. Блок «Главное» (importance: high) — первым

### Стоимость полного пайплайна

| Этап | Модель | Стоимость |
|------|--------|-----------|
| Фетчинг | Код (RSS, cheerio) | $0.00 |
| Фильтрация | Gemini 2.0 Flash | ~$0.007 |
| Анализ | Gemini 3 Pro | ~$0.090 |
| **ИТОГО** | | **~$0.10** |
| **В месяц (30 дней)** | | **~$3.00** |

---

## 5. API Endpoint

### `POST /api/briefing/generate`

Ручной триггер генерации (позже заменится на cron через Inngest).

**Логика:**
1. Авторизация (auth)
2. Получить briefing_settings и briefing_sources пользователя
3. Если нет источников — использовать дефолтный набор из каталога тем
4. Запустить фетчеры параллельно (Promise.allSettled)
5. **Этап 1:** Отправить все результаты в briefing-filter (Gemini 2.0 Flash) → 25-30 кандидатов
6. **Этап 2:** Отправить кандидатов в briefing-analyzer (Gemini 3 Pro) → готовый JSON
7. Сохранить результат в briefing_history (status: 'ready')
8. Вернуть briefingJson

**Таймаут:** 60 сек (maxDuration = 60).

---

## 6. Seed для тестирования

Скрипт или API endpoint для быстрой настройки тестового пользователя:
- Создать briefing_settings (isActive: true)
- Добавить 10-15 источников из каталога тем (mix русских и английских)

Темы для seed: AI (3 источника), Технологии (3), Финансы (2), F1 (2), Разное (2).

---

## 7. Файловая структура

```
lib/briefing/
├── briefing-config.ts
├── topics-catalog.ts
├── briefing-filter.ts              ← Этап 1: Gemini 2.0 Flash
├── briefing-analyzer.ts            ← Этап 2: Gemini 3 Pro
└── source-fetchers/
    ├── types.ts
    ├── rss-fetcher.ts
    ├── telegram-fetcher.ts
    └── web-fetcher.ts

app/api/briefing/
└── generate/route.ts

lib/db/schema.ts          ← добавить 3 таблицы
lib/db/queries.ts         ← добавить queries
```

---

## 8. Что НЕ делать

- UI (следующее ТЗ)
- ServiceChat онбординг (отдельное ТЗ)
- Cron/расписание через Inngest (отдельное ТЗ)
- Telegram/SvoyChat доставку (отдельное ТЗ)
- TTS/аудио (отдельное ТЗ)
- YouTube-фетчер (добавим позже, когда будет YouTube API)

---

## 9. Проверка готовности

После реализации вызвать:

```bash
curl -X POST http://localhost:3000/api/briefing/generate \
  -H "Cookie: ..." \
  -H "Content-Type: application/json"
```

Ответ должен содержать briefingJson с реальными новостями, сгруппированными по темам, на русском языке.

---

**Версия релиза:** 3.26.0
