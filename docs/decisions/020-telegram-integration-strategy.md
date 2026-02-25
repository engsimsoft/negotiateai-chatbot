# ADR 020: Telegram Integration Strategy — Shared Parser + Фазовый подход

**Дата:** 2026-02-25
**Статус:** Принято

---

## Контекст

Telegram — основная медиа-платформа аудитории Simply (российский рынок). Интеграция с Telegram даёт доступ к контенту, который недоступен через RSS/Web (многие каналы публикуют эксклюзивно в TG). Simply уже использовал Telegram в двух местах:

1. **Briefing fetcher** (`telegram-fetcher.ts`) — inline cheerio-парсинг для новостного брифинга
2. Пользователи вручную копировали текст из каналов в чат

**Ключевые вопросы:**
- Как дать AI-агентам прямой доступ к Telegram-каналам?
- Один парсер или два (tool vs briefing)?
- Scraping (`t.me/s/`) или Telegram Bot API?
- Какие capabilities нужны сейчас, а какие позже?

---

## Решение

### 1. Shared Parser — один парсер, много потребителей

Создан `lib/telegram/` — универсальный модуль, используемый и tool'ом, и briefing fetcher'ом:

```
lib/telegram/
├── types.ts    # TelegramPost, TelegramParseResult, ParseTelegramOptions
├── utils.ts    # normalizeChannelUrl, extractChannelHandle
└── parser.ts   # parseTelegramChannel (cheerio, единая точка входа)
```

Потребители:
```
readTelegramChannel (AI tool)  ─┐
                                ├─ parseTelegramChannel()
fetchTelegram (briefing)       ─┘
```

### 2. Web Scraping (t.me/s/) для Phase 1

Парсинг публичной web-preview страницы Telegram через cheerio. Не требует Bot API, токенов, серверной инфраструктуры.

### 3. Фазовый подход к расширению

| Фаза | Scope | Подход | Статус |
|------|-------|--------|--------|
| **Phase 1** | Чтение публичных каналов | Web scraping `t.me/s/` | ✅ v3.47.0 |
| **Phase 2** | Расширенная аналитика | Web scraping + вычисляемые метрики | Планируется |
| **Phase 3** | Приватные каналы + Bot API | Telegram Bot API | Оценка |
| **Phase 4** | Мониторинг и алерты | Bot API + webhooks + БД | Долгосрочно |

---

## Причины

### Почему shared parser, а не два отдельных

1. **DRY** — одна и та же логика (cheerio, redirect detection, freshness, media detection) не дублируется
2. **Единые баг-фиксы** — исправление парсинга в одном месте фиксит оба use-case
3. **Тестируемость** — один модуль для тестирования вместо двух
4. **Расширяемость** — при переходе на Bot API (Phase 3) оба потребителя получают upgrade автоматически

### Почему web scraping, а не Bot API для Phase 1

1. **Zero setup** — не нужен бот, токен, серверная инфраструктура, webhook endpoint
2. **Публичные каналы покрывают 95% use-cases** — основные новостные и тематические каналы публичные
3. **Мгновенный деплой** — работает на Vercel serverless без дополнительных сервисов
4. **Достаточно для MVP** — последние ~20 постов на странице `t.me/s/` хватает для анализа

### Почему фазовый подход

1. **Quick win** — Phase 1 реализована за 2 сессии, сразу ценность для пользователя
2. **Валидация спроса** — прежде чем строить Bot API инфраструктуру, узнаём как часто пользователи используют tool
3. **Инкрементальная сложность** — каждая фаза добавляет capabilities без переписывания предыдущих
4. **usage_log** — с v3.46.0 логируем каждый tool call, данные покажут реальный спрос

---

## Phase 1: Web Scraping (v3.47.0) — Детали

### Capabilities

| Что умеет | Как |
|-----------|-----|
| Чтение постов (text, date, url) | cheerio парсинг `.tgme_widget_message_wrap` |
| Медиа-детекция (фото, видео, файлы) | Селекторы `.tgme_widget_message_photo`, `_video`, `_document` |
| Определение приватных каналов | HTTP 302/301 redirect detection |
| Любой формат ввода | @channel, channel, t.me/channel → нормализация |
| Freshness filter | Пропуск постов старше N часов |
| Truncation | maxContentLength для briefing (6000 chars) |

### Ограничения (известные)

| Ограничение | Влияние | Решение (Phase 2+) |
|------------|---------|---------------------|
| ~20 постов на странице | Нет глубокой истории | Bot API: `getHistory` |
| Нет пагинации | Только последняя страница | Bot API или `?before=` параметр |
| Нет метрик (подписчики, просмотры) | Модель не может оценить популярность | Парсинг view counter из HTML (Phase 2) или Bot API |
| Нет медиа-контента | Только текст + факт наличия | Bot API: `getFile` |
| Приватные каналы недоступны | Только публичные | Bot API с подпиской |
| Rate limiting t.me | Потенциально при массовом использовании | Кеширование, Bot API |

---

## Phase 2: Расширенная аналитика (планируется)

Без Bot API, только расширение web scraping:

- **View counter** — парсинг `.tgme_widget_message_views` (число просмотров на посте)
- **Forward count** — парсинг `.tgme_widget_message_forwards`
- **Reply count** — если доступно в HTML
- **Channel info** — парсинг `.tgme_channel_info` (описание, аватар, счётчик подписчиков)
- **Пагинация** — исследовать `?before=` параметр для загрузки старых постов
- **Кеширование** — `lib/telegram/cache.ts` с TTL 5-15 минут, чтобы повторные запросы к одному каналу не fetch'или заново

Расширение `TelegramPost`:
```typescript
interface TelegramPost {
  text: string;
  date: string | null;
  url: string;
  hasMedia: boolean;
  // Phase 2:
  views?: number;       // из .tgme_widget_message_views
  forwards?: number;    // из .tgme_widget_message_forwards
}
```

---

## Phase 3: Bot API (оценка)

Переход на Telegram Bot API (`node-telegram-bot-api` или `grammy`) даёт:

| Capability | Что даёт |
|-----------|----------|
| `getChat` | Точное число подписчиков, описание, тип |
| `getHistory` | Полная история постов с пагинацией |
| `getFile` | Скачивание медиа-контента |
| Приватные каналы | Если бот добавлен как admin |
| Realtime updates | Webhook/polling для мониторинга |

**Когда переходить:**
- Пользователи регулярно упираются в лимит ~20 постов
- Нужен доступ к приватным каналам
- Нужен мониторинг (алерты по ключевым словам)
- Rate limiting `t.me` становится проблемой

**Требования:**
- Создать Telegram Bot через @BotFather
- `TELEGRAM_BOT_TOKEN` в `.env.local`
- Потенциально persistent storage для webhook state
- Возможно не совместимо с Vercel serverless (long polling) → нужен отдельный сервис или edge functions

### Архитектура shared parser с Bot API

```typescript
// lib/telegram/parser.ts — будущее
export async function parseTelegramChannel(
  channel: string,
  options: ParseTelegramOptions
): Promise<TelegramParseResult> {
  // Попробовать Bot API если токен есть
  if (process.env.TELEGRAM_BOT_TOKEN && options.useBotApi !== false) {
    return parseTelegramViaBot(channel, options);
  }
  // Fallback на web scraping
  return parseTelegramViaScraping(channel, options);
}
```

Потребители (`readTelegramChannel`, `fetchTelegram`) не меняются — upgrade прозрачный.

---

## Последствия

### Плюсы

- **Мгновенная ценность** — tool работает с первого дня, без инфраструктуры
- **Один парсер** — DRY, единые баг-фиксы, прозрачный upgrade
- **Инкрементальность** — каждая фаза самодостаточна, можно остановиться на любой
- **Данные для решений** — usage_log покажет нужен ли Bot API

### Минусы

- **~20 постов** — ограничение web scraping, не хватит для глубокого анализа истории
- **Хрупкость** — Telegram может изменить HTML-структуру (ломает cheerio-парсинг)
- **Нет метрик** — без views/forwards анализ поверхностный (Phase 2 частично решает)
- **Bot API = инфраструктура** — Phase 3 требует сервис за пределами Vercel serverless

---

## Альтернативы

### Альтернатива 1: Сразу Bot API

**Что это:** Пропустить scraping, сразу интегрировать Telegram Bot API.

**Почему отклонили:**
- Требует создание бота, токена, webhook endpoint
- Vercel serverless не идеален для long polling
- Overengineering для текущего этапа
- Нет валидации спроса

**Когда может быть лучше:** Если приватные каналы — must-have с первого дня.

### Альтернатива 2: Отдельные парсеры для tool и briefing

**Что это:** Оставить inline cheerio в briefing, сделать отдельный парсер для tool.

**Почему отклонили:**
- Дублирование кода (~80 строк логики парсинга)
- Два места для баг-фиксов
- При переходе на Bot API — двойная миграция

### Альтернатива 3: MTProto (Telegram API)

**Что это:** Использовать Telegram's MTProto API напрямую (библиотеки: `telegram`, `tdlib`).

**Почему отклонили:**
- Требует авторизацию пользователя (phone number + код)
- Сложность: бинарный протокол, сессии, шифрование
- Риск бана аккаунта (Telegram запрещает неофициальные клиенты для ботов)
- Не нужен для публичных каналов

**Когда может быть лучше:** Если нужен полный доступ к функционалу (чтение любых чатов, отправка, etc.)

---

## Файловая структура (Phase 1)

```
lib/telegram/                              # Shared parser
├── types.ts                               # TelegramPost, TelegramParseResult
├── utils.ts                               # normalizeChannelUrl, extractChannelHandle
└── parser.ts                              # parseTelegramChannel (cheerio)

lib/ai/tools/read-telegram-channel.ts      # AI tool (wraps parser)
lib/ai/tool-activity-config.ts             # +readTelegramChannel UI
lib/ai/tools/chat-tools.ts                 # +registration
lib/ai/tools/load-skill.ts                 # +research/telegram-channel-reading

lib/prompts/skills/research/
└── telegram-channel-reading/SKILL.md      # Инструкции для AI

lib/briefing/source-fetchers/
└── telegram-fetcher.ts                    # Переписан на shared parser
```

---

## Метрики успеха

| Метрика | Как измерить | Цель Phase 1 |
|---------|-------------|--------------|
| Использование tool | `ai_usage_log WHERE tool='readTelegramChannel'` | >10 вызовов/неделю |
| Error rate | `isValid=false` в логах | <20% (основное — несуществующие каналы) |
| Briefing регрессия | Генерация с TG-источниками работает | 0 регрессий |
| Запросы на Phase 2 | Фидбек пользователей | Оценить через 2 недели |

---

## Ссылки

- ТЗ-TG1: `specs/TZ_TG1_PeContract/`
- Telegram Web Preview: `https://t.me/s/{channel}`
- Telegram Bot API: `https://core.telegram.org/bots/api`
- grammy (TypeScript Bot framework): `https://grammy.dev/`
- ADR 016: Briefing Backend Architecture

---

## История изменений

- **2026-02-25** — ADR создан. Phase 1 реализована (v3.47.0)
