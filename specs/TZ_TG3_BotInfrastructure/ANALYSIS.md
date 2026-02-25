# Анализ ТЗ-TG3: Telegram Bot — инфраструктура

**Дата:** 2026-02-25
**Аналитик:** Claude Code (Senior Dev)

---

## Резюме

ТЗ описывает создание Telegram-бота (@SimplyBot) для привязки аккаунтов Simply ↔ Telegram. Включает: webhook-endpoint, бот-логику (grammY), 2 таблицы в БД, API линковки, UI-секцию в настройках. Это фундамент для TG4 (доставка брифингов) и TG5 (чтение закрытых групп).

Спек в целом solid. Архитектура webhook + deep link — стандартный и правильный подход для Vercel serverless. grammY — отличный выбор. Есть несколько технических рекомендаций по согласованию с существующей кодовой базой.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **grammY** — ОК, нативный TypeScript, `webhookCallback("std/http")` идеален для Next.js Route Handlers на Vercel
- **Deep link через /start {token}** — стандартный Telegram-паттерн, надёжный
- **2 таблицы (connections + link_tokens)** — ОК, разделение постоянных связок и эфемерных токенов правильное
- **TTL 10 минут для токенов** — ОК, достаточно для UX, не слишком долго для безопасности
- **Перепривязка** (отвязать старый Telegram, привязать новый) — ОК, правильный UX
- **Polling GET каждые 3сек** — ОК для MVP, адекватная нагрузка
- **`lib/telegram/bot.ts`** — ОК, `lib/telegram/` уже содержит types.ts, utils.ts, parser.ts — бот логично ложится сюда
- **QR-код (qrcode.react)** — ОК, лёгкая клиентская библиотека
- **Webhook secret validation** — ОК, обязательно для безопасности

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | Таблицы `telegram_connections`, `telegram_link_tokens` (snake_case) | `TelegramConnection`, `TelegramLinkToken` (PascalCase) | Все таблицы в `lib/db/schema.ts` используют PascalCase: `"User"`, `"Chat"`, `"BriefingSettings"`, `"ProjectTask"`, `"SavedBriefingTopics"`. Snake_case нарушит единообразие |
| 2 | API: `app/api/telegram/link/route.ts` (без route group) | `app/(chat)/api/telegram/link/route.ts` | ВСЕ authenticated API в проекте живут в `app/(chat)/api/`: chat, briefing, user, projects, service-chat, document и др. Webhook остаётся на `app/api/telegram/webhook/route.ts` — он unauthenticated, вызывается серверами Telegram |
| 3 | `telegramUserId: bigint` без уточнения mode | `bigint("telegramUserId", { mode: "number" })` | Drizzle по умолчанию возвращает bigint как string. Telegram user IDs сейчас в диапазоне миллиардов (~10^10), что укладывается в JS safe integer range (2^53 - 1 ≈ 9×10^15). Mode "number" удобнее для сравнений и типизации |
| 4 | Скрипт `scripts/setup-telegram-webhook.ts` | API route `app/api/telegram/setup/route.ts` (защищённый admin secret) | Скрипт требует локальный запуск с env-переменными. API route можно вызвать curl-ом из любого окружения, включая Vercel dashboard. Удобнее при смене домена, передеплое. Защита: `Authorization: Bearer {TELEGRAM_WEBHOOK_SECRET}` |
| 5 | Env-переменные: только `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` | Добавить `NEXT_PUBLIC_APP_URL` в зависимости (уже есть в проекте) | Бот отвечает со ссылками на Simply (`/settings`, `/dashboard`). В коде уже есть `process.env.NEXT_PUBLIC_APP_URL` (используется в `app/(chat)/api/document/[id]/share/route.ts`). Нужно убедиться что эта переменная задана |

### ❓ Требует уточнения

#### 1. Inline-кнопки: использовать или нет?

ТЗ говорит: *"Не делать inline-кнопки в боте — пока только текстовые ответы"*.

`telegram-bot-messages.md` (помечен "Для: ТЗ-TG4") описывает inline URL-кнопки (`[Открыть Simply →]`) для всех сообщений бота, включая /start, /help, /stop.

**Мой взгляд:** URL-кнопки (type: url) — это просто ссылки, не callback_query. Они не требуют обработки на стороне бота, добавляются одной строкой в grammY, и значительно улучшают UX (пользователь может сразу перейти в Simply). В grammY это:

```typescript
ctx.reply("Текст", {
  reply_markup: { inline_keyboard: [[{ text: "Открыть Simply →", url: "https://..." }]] }
});
```

**Вопрос:** Добавить URL-кнопки уже в TG3 (нулевая сложность, заметное улучшение UX) или строго текст, а кнопки в TG4?

#### 2. Тексты сообщений бота

В `telegram-bot-messages.md` тексты более проработанные и тональные, чем в ТЗ-TG3 (раздел 5 "Бот-логика"). Например:

| Сценарий | ТЗ-TG3 | telegram-bot-messages.md |
|----------|--------|------------------------|
| Успешная привязка | "✓ Аккаунт подключён! Настройте доставку брифинга в Simply." | "✅ Аккаунт Simply подключён.\n\nТеперь брифинг будет приходить сюда каждое утро." |
| Холодный /start | "Это бот Simply. Чтобы подключить — зайдите в настройки Simply → Подключения → Telegram." | "Это бот Simply — доставляет утренний брифинг в Telegram.\n\nЧтобы подключить, откройте Simply → Настройки → «Подключить Telegram»." |

**Вопрос:** Использовать тексты из `telegram-bot-messages.md` (более выверенные) или из ТЗ-TG3? Мой голос — за messages.md, они лучше продуманы тонально.

#### 3. Bot username — ручной шаг

Создание бота через @BotFather — это ручная операция (не автоматизируется кодом). Нужно:
1. Ты (архитектор) создаёшь бота через @BotFather
2. Передаёшь мне токен для `TELEGRAM_BOT_TOKEN`
3. Я добавляю в `.env.local` и деплою

**Вопрос:** Бот уже создан? Если нет — нужен токен до начала разработки (для тестирования webhook и бот-логики).

---

## Потенциальные риски

### Низкие (управляемые)

1. **Cold start на Vercel** — webhook обрабатывается serverless function. Cold start ~200-500ms. Telegram ждёт ответ до 60 секунд — запас огромный. grammY создаёт bot instance быстро (нет тяжёлой инициализации).

2. **Конкурентная линковка** — пользователь открывает ссылку, долго думает, токен истекает. Обрабатывается error message "Ссылка больше не действует". Не баг, а ожидаемое поведение.

3. **Rate limits Telegram Bot API** — для нашего масштаба (~десятки пользователей) не актуально. Telegram позволяет 30 сообщений/сек.

### Средние

4. **Polling vs SSE для статуса линковки** — polling каждые 3 сек создаёт 40 запросов за 2 минуты ожидания. Для MVP это ОК, но если пользователей станет много — стоит перейти на SSE. Пока не трогаем, просто отмечаю.

---

## Зависимости

### Внешние (нужны до начала)
- **Telegram Bot Token** — от @BotFather (ручная операция)
- **`NEXT_PUBLIC_APP_URL`** — проверить что задана в Vercel

### Пакеты (npm install)
- `grammy` — Telegram Bot Framework
- `qrcode.react` — QR-код генерация

### Затронутые файлы (существующие)
- `lib/db/schema.ts` — +2 таблицы
- `lib/db/queries.ts` — +5-7 query functions
- `app/(dashboard)/settings/settings-page.tsx` — +секция "Подключения"
- `drizzle.config.ts` — миграция

### Новые файлы
- `lib/telegram/bot.ts` — бот-логика (grammY)
- `app/api/telegram/webhook/route.ts` — webhook endpoint
- `app/(chat)/api/telegram/link/route.ts` — API линковки (GET/POST/DELETE)
- `app/api/telegram/setup/route.ts` — регистрация webhook (admin)
- Миграция Drizzle (auto-generated)

---

## Оценка сложности

- [x] Среднее (2-3 сессии)

**Разбивка:**
- Этап 1: БД + queries (~30 мин)
- Этап 2: Bot + webhook + setup (~1.5 часа)
- Этап 3: API линковки (~45 мин)
- Этап 4: UI в настройках (~1.5 часа)
- Этап 5: Финализация (~30 мин)

---

## Архитектурные решения (предварительные)

### Структура маршрутов

```
app/
├── api/
│   └── telegram/
│       ├── webhook/route.ts    ← unauthenticated (Telegram → нас)
│       └── setup/route.ts      ← admin-only (регистрация webhook)
└── (chat)/
    └── api/
        └── telegram/
            └── link/route.ts   ← authenticated (наш frontend → нас)
```

### grammY Singleton Pattern

```typescript
// lib/telegram/bot.ts
import { Bot } from "grammy";

// Bot instance created once per module load
// In serverless: created on cold start, reused in warm invocations
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// Register handlers...
bot.command("start", handleStart);
bot.command("stop", handleStop);
bot.command("help", handleHelp);
bot.on("message", handleUnknown);

export { bot };
```

### Webhook route

```typescript
// app/api/telegram/webhook/route.ts
import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram/bot";

export const POST = webhookCallback(bot, "std/http", {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
});
```

Лаконично, без лишних абстракций.
