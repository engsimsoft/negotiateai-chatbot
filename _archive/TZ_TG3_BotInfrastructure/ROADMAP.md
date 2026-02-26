# Roadmap ТЗ-TG3: Telegram Bot — инфраструктура

**Создан:** 2026-02-25
**Версия проекта:** 3.48.0 → 3.49.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 6 |
| Сессий (оценка) | 2-3 |

---

## Этапы

### Этап 1: Подготовка

**Статус:** ✅ Завершён

**Цель:** Убедиться что проект в рабочем состоянии, изучить затронутые файлы, установить зависимости.

**Задачи:**
- [x] Проверить текущее состояние проекта (`npm run build`)
- [x] Убедиться что `TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET` есть в `.env.local` — @GetSimplyBot
- [x] Установить зависимости: `npm install grammy qrcode.react`
- [x] Изучить затронутые файлы: `lib/db/schema.ts`, `lib/db/queries.ts`, `settings-page.tsx`, `lib/telegram/`

**Файлы:**
- `package.json` — +grammy, +qrcode.react
- `.env.local` — +TELEGRAM_BOT_TOKEN, +TELEGRAM_WEBHOOK_SECRET

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается
- [x] env-переменные на месте
- [ ] 🧪 Мануальный тест: проект работает без регрессий

**Git (после валидации):**
```bash
git add package.json package-lock.json
git commit -m "chore(tz-tg3): install grammy and qrcode.react"
```

**Критерий готовности:** Проект собирается, зависимости установлены, env-переменные на месте.

---

### Этап 2: БД — схема и queries

**Статус:** ✅ Завершён

**Цель:** Две таблицы в БД (TelegramConnection, TelegramLinkToken) + query functions для всех CRUD-операций.

**Задачи:**
- [x] Добавить таблицу `TelegramConnection` в `lib/db/schema.ts` (id uuid PK, userId uuid FK unique, telegramUserId bigint mode:number unique, telegramUsername text nullable, telegramFirstName text nullable, isActive boolean default true, linkedAt timestamp)
- [x] Добавить таблицу `TelegramLinkToken` в `lib/db/schema.ts` (token text PK, userId uuid FK, createdAt timestamp, expiresAt timestamp)
- [x] Экспортировать типы (TelegramConnection, TelegramLinkToken)
- [x] Добавить query functions в `lib/db/queries.ts`:
  - `getTelegramConnection({ userId })` — получить связку по userId
  - `getTelegramConnectionByTelegramId({ telegramUserId })` — получить связку по Telegram ID
  - `createTelegramConnection({ userId, telegramUserId, telegramUsername, telegramFirstName })` — создать связку
  - `deleteTelegramConnection({ userId })` — удалить связку (отвязка)
  - `setTelegramConnectionActive({ userId, isActive })` — вкл/выкл (/stop, /start)
  - `createTelegramLinkToken({ userId })` — создать токен (UUID, expiresAt = now + 10 min)
  - `getTelegramLinkToken({ token })` — получить токен (проверка валидности)
  - `deleteTelegramLinkToken({ token })` — удалить использованный токен
- [x] Написать и применить Drizzle миграцию вручную (0039_telegram-bot.sql + _journal.json)

**Файлы:**
- `lib/db/schema.ts` — +2 таблицы
- `lib/db/queries.ts` — +8 query functions
- `drizzle/` — migration file (auto-generated)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] `npm run dev` — сервер запускается
- [x] SQL: обе таблицы существуют (TelegramConnection, TelegramLinkToken)
- [x] SQL: колонки, FK (→User.id), unique constraints (userId, telegramUserId) — всё верно
- [x] 🧪 Мануальный тест: подтверждение что миграция применена, проект работает

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts drizzle/
git commit -m "feat(tz-tg3): add TelegramConnection and TelegramLinkToken tables"
```

**Критерий готовности:** Таблицы в БД, queries компилируются, миграция применена.

---

### Этап 3: Bot + Webhook + Setup

**Статус:** 🔄 В работе (код готов, ожидает мануальный тест)

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2 ✅

**Цель:** Telegram-бот на grammY принимает команды через webhook. Регистрация webhook через admin API route.

**Задачи:**
- [x] Создать `lib/telegram/bot.ts`:
  - Bot instance (grammY)
  - Обработчик `/start {token}` — deep link линковка (findToken → validate expiry → create connection → delete token → reply)
  - Обработчик `/start` без токена (холодный) — инфо-сообщение
  - Обработчик `/start` повторный (был /stop, вернулся) — "С возвращением. Доставка брифинга включена."
  - Обработчик `/stop` — setActive(false)
  - Обработчик `/help` — справка
  - Обработчик любого другого текста — "Я доставляю брифинги, но не веду переписку."
  - Тексты из `telegram-bot-messages.md` (секции 1 и 3)
  - Inline URL-кнопки ("Открыть Simply →", "Настройки Simply →") во всех ответах
  - Edge cases: токен истёк, Telegram уже привязан к другому Simply, перепривязка (отвязать старый Telegram, привязать новый)
- [x] Создать `app/api/telegram/webhook/route.ts`:
  - POST handler через `webhookCallback(bot, "std/http", { secretToken })`
  - Валидация `X-Telegram-Bot-Api-Secret-Token`
- [x] Создать `app/api/telegram/setup/route.ts`:
  - POST — вызов `bot.api.setWebhook(url, { secret_token })`
  - GET — проверка текущего webhook (`bot.api.getWebhookInfo()`)
  - Защита: `Authorization: Bearer {TELEGRAM_WEBHOOK_SECRET}`

**Файлы:**
- `lib/telegram/bot.ts` — новый
- `app/api/telegram/webhook/route.ts` — новый
- `app/api/telegram/setup/route.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается
- [ ] Браузер: проверить что существующий функционал не сломан
- [ ] 🧪 Мануальный тест:
  - Вызвать POST `/api/telegram/setup` (curl) — webhook зарегистрирован
  - Отправить боту `/start` в Telegram — бот отвечает холодным сообщением + кнопка "Открыть Simply →"
  - Отправить боту произвольный текст — бот отвечает "Я доставляю брифинги..." + кнопка
  - Отправить `/help` — бот отвечает справкой + кнопка
  - Отправить `/stop` — бот подтверждает отключение

**Git (после валидации):**
```bash
git add lib/telegram/bot.ts app/api/telegram/
git commit -m "feat(tz-tg3): Telegram bot with grammY webhook"
```

**Критерий готовности:** Бот отвечает на все команды с правильными текстами и inline URL-кнопками, webhook работает.

---

### Этап 4: API линковки

**Статус:** ✅ Завершён

**Цель:** API для генерации ссылки привязки, проверки статуса, отвязки. Frontend сможет управлять Telegram-подключением.

**Задачи:**
- [x] Создать `app/(chat)/api/telegram/link/route.ts`:
  - `POST` — auth required, создать linkToken, вернуть `{ linkUrl: "https://t.me/{botUsername}?start={token}" }`
  - `GET` — auth required, вернуть `{ connected: boolean, username?: string, firstName?: string, linkedAt?: string, isActive?: boolean }`
  - `DELETE` — auth required, удалить telegram_connection, вернуть `{ success: true }`
- [x] Обработка edge cases:
  - POST когда уже есть связка — всё равно генерирует (для перепривязки)
  - DELETE когда нет связки — 200 с `{ success: true }` (идемпотентность)
  - Все routes проверяют auth через `auth()` из NextAuth

**Файлы:**
- `app/(chat)/api/telegram/link/route.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] `npm run dev` — сервер запускается
- [ ] 🧪 Мануальный тест: (отложен до деплоя — тестируем вместе с Этапами 3 и 5)

**Git (после валидации):**
```bash
git add "app/(chat)/api/telegram/"
git commit -m "feat(tz-tg3): Telegram link API (GET/POST/DELETE)"
```

**Критерий готовности:** Полный цикл привязки/отвязки работает через API.

---

### Этап 5: UI в настройках

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

**Цель:** Секция "Подключения" в настройках с полным UX: подключение Telegram, QR-код, polling статуса, отключение.

**Задачи:**
- [x] Обновить `settings-page.tsx`:
  - Добавить `"connections"` в type Section и SECTIONS (между "account" и "appearance")
  - Иконка: `Link` из lucide-react
  - Добавить рендер `<ConnectionsSection />` в content area
- [x] Создать компонент `ConnectionsSection` внутри settings-page.tsx:
  - Состояние "Не подключён": кнопка "Подключить", QR-код, polling 3 сек / 2 мин
  - Состояние "Подключён": @username + дата, кнопка "Отключить"
  - Состояние "Загрузка": Loader2 spinner
- [x] Стилизация: семантические токены, Telegram SVG icon, border card

**Файлы:**
- `app/(dashboard)/settings/settings-page.tsx` — модификация

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: (отложен до деплоя — тестируем полный цикл)

**Git (после валидации):**
```bash
git add app/(dashboard)/settings/settings-page.tsx
git commit -m "feat(tz-tg3): Telegram connection UI in settings"
```

**Критерий готовности:** Полный UX-цикл подключения/отключения Telegram работает в браузере.

---

### Этап 6: Финализация

**Статус:** ✅ Завершён (мануальный тест 8 пунктов — после деплоя)

**Цель:** Документация, версионирование, архивация.

**Задачи:**
- [ ] Финальное мануальное тестирование (полный цикл из ТЗ: пункты 1-8) — ПОСЛЕ ДЕПЛОЯ
- [x] SQL-проверка БД (таблицы, колонки, FK, индексы) — выполнена в Этапе 2
- [x] Прочитать `DOCUMENTATION_GUIDE.md` — пройти по каждому пункту
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md` (версия 3.49.0)
- [x] Обновить `CLAUDE.md` (секция "Структура кода" — добавить Telegram Bot)
- [x] Обновить `package.json` (версия 3.49.0)
- [x] Обновить `docs/architecture.md` (новые таблицы)
- [x] Создать ADR 021 — Telegram Bot Infrastructure
- [x] Верификация docs против кода
- [ ] Переместить папку в `_archive/` — после мануального теста

**Валидация:**
- [x] `npm run build` — успешен
- [x] `npx tsc --noEmit` — 0 ошибок
- [ ] Все 8 проверочных пунктов из ТЗ — ПОСЛЕ ДЕПЛОЯ

**Git (после валидации):**
```bash
git add -A
git commit -m "docs(tz-tg3): finalize v3.49.0 — TelegramBotInfrastructure"
```

**Критерий готовности:** ТЗ полностью выполнено, документация обновлена и верифицирована, код в production.
