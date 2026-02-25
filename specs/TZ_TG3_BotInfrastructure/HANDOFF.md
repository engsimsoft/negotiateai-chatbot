# Передача сессии ТЗ-TG3: Telegram Bot — инфраструктура

**Дата:** 2026-02-25
**Сессия:** 1

## Статус этапов
- [x] Этап 1: Подготовка ✅ (commit: 8ec4f1d)
- [ ] Этап 2: БД — схема и queries ← ТЕКУЩИЙ
- [ ] Этап 3: Bot + Webhook + Setup
- [ ] Этап 4: API линковки
- [ ] Этап 5: UI в настройках
- [ ] Этап 6: Финализация

## Бот
- Username: `@GetSimplyBot`
- Имя: `Simply`
- Токен: в `.env.local` как `TELEGRAM_BOT_TOKEN`
- Webhook secret: в `.env.local` как `TELEGRAM_WEBHOOK_SECRET`

## Решения (из ANALYSIS.md)
- PascalCase для таблиц (TelegramConnection, TelegramLinkToken)
- Link API в route group `(chat)`, webhook в корне `app/api/`
- bigint с mode "number" для telegramUserId
- API route для setup webhook (не скрипт)
- Тексты бота из `telegram-bot-messages.md` (секции 1 и 3)
- Inline URL-кнопки добавляем сразу в TG3
- `NEXT_PUBLIC_APP_URL` для ссылок бота (уже есть в .env.local)

## Следующая сессия: начни с
1. Прочитать ROADMAP.md → Этап 2: БД — схема и queries
2. Добавить 2 таблицы в `lib/db/schema.ts`: TelegramConnection, TelegramLinkToken
3. Добавить 8 query functions в `lib/db/queries.ts`
4. Сгенерировать и применить Drizzle миграцию
5. Валидация: tsc, build, SQL-проверка таблиц

## Контекст для Этапа 2
- `lib/db/schema.ts` — все таблицы PascalCase, паттерн: pgTable + InferSelectModel + export type
- `lib/db/queries.ts` — async functions, drizzle `eq()` для фильтров, `db.insert/select/update/delete`
- telegramUserId: `bigint("telegramUserId", { mode: "number" })` — unique
- userId: `uuid` FK → user.id — unique (один пользователь = один Telegram)
- TelegramLinkToken: token как PK (text), expiresAt = createdAt + 10 min

## Блокеры
- Нет
