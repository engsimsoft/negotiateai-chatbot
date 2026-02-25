# ТЗ-TG3: Telegram Bot — инфраструктура

**Цель:** Пользователь может привязать свой Telegram к аккаунту Simply через бота @SimplyBot. Фундамент для доставки брифинга (TG4) и чтения закрытых групп (TG5).

**Зависимости:** нет (можно делать параллельно с TG2)

---

## Что сделать

### 1. Создать бота в Telegram

Через @BotFather:
- Имя: **Simply** (или Simply AI если занято)
- Username: **@SimplyAIBot** (или ближайший доступный вариант с Simply)
- Описание: "Ваш AI-помощник Simply. Доставка брифингов и уведомления."
- Команды: /start, /stop, /help

Токен бота → env-переменная `TELEGRAM_BOT_TOKEN`.

### 2. Библиотека: grammY

Установить `grammy`. Причины выбора:
- Нативный TypeScript
- Встроенный `webhookCallback()` для serverless
- Легковесный, без магии
- Лучшая поддержка webhook-режима (наш кейс — Vercel)

### 3. Webhook endpoint

**Файл:** `app/api/telegram/webhook/route.ts`

```
POST /api/telegram/webhook
```

- Принимает все обновления от Telegram Bot API
- Валидирует secret token через заголовок `X-Telegram-Bot-Api-Secret-Token`
- Передаёт в grammY обработчик через `webhookCallback("std/http")`
- Env-переменная: `TELEGRAM_WEBHOOK_SECRET` (случайная строка, задаётся при регистрации webhook)

**Регистрация webhook** — скрипт или API route:
```
POST https://api.telegram.org/bot{token}/setWebhook
  url: https://{domain}/api/telegram/webhook
  secret_token: {TELEGRAM_WEBHOOK_SECRET}
```

Можно сделать утилиту `scripts/setup-telegram-webhook.ts` для удобства, или одноразовый API route `/api/telegram/setup` (защищённый, только для админа).

### 4. Таблицы БД (Drizzle)

**telegram_connections** — связка Simply ↔ Telegram:

| Поле | Тип | Описание |
|------|-----|----------|
| id | uuid | PK, default random |
| userId | uuid | FK → user.id, unique |
| telegramUserId | bigint | ID пользователя в Telegram, unique |
| telegramUsername | text, nullable | @username (может отсутствовать) |
| telegramFirstName | text, nullable | Имя в Telegram |
| isActive | boolean | default true |
| linkedAt | timestamp | когда привязали |

Индексы: unique по userId, unique по telegramUserId. Один пользователь = один Telegram.

**telegram_link_tokens** — эфемерные токены линковки:

| Поле | Тип | Описание |
|------|-----|----------|
| token | text | PK, crypto.randomUUID() |
| userId | uuid | FK → user.id |
| createdAt | timestamp | default now |
| expiresAt | timestamp | createdAt + 10 минут |

TTL 10 минут. После успешной линковки — токен удаляется. Старые токены можно чистить периодически (или не чистить, они безвредные).

### 5. Бот-логика (grammY)

**Файл:** `lib/telegram/bot.ts` — создание экземпляра бота и обработчики.

**Команда /start с параметром (deep link):**
```
/start {token}
```

Логика:
1. Извлечь token из `ctx.match`
2. Найти token в `telegram_link_tokens`, проверить не истёк
3. Если валидный — создать запись в `telegram_connections` (userId из токена, telegramUserId из ctx.from.id)
4. Удалить использованный токен
5. Ответить: "✓ Аккаунт подключён! Настройте доставку брифинга в Simply."

**Ошибки:**
- Токен не найден / истёк → "Ссылка больше не активна. Создайте новую в настройках Simply."
- Аккаунт уже привязан к этому Telegram → "Этот Telegram уже подключён к Simply."
- Другой Telegram уже привязан к этому Simply-аккаунту → отвязать старый, привязать новый (перепривязка)

**Холодный /start (без токена):**
- "Это бот Simply. Чтобы подключить — зайдите в настройки Simply → Подключения → Telegram."

**Команда /stop:**
- Ставим `isActive: false` в telegram_connections
- "Доставка отключена. Чтобы включить снова — /start или настройки Simply."

**Команда /help:**
- Краткая справка: что умеет бот, как подключить, как отключить.

**Любой другой текст:**
- "Я бот для доставки уведомлений. Для общения с AI — зайдите в Simply." (+ inline-кнопка "Открыть Simply" с URL)

### 6. API для генерации ссылки

**Файл:** `app/api/telegram/link/route.ts`

```
POST /api/telegram/link
→ { linkUrl: "https://t.me/SimplyAIBot?start={token}" }
```

- Требует auth (session)
- Создаёт запись в telegram_link_tokens
- Возвращает deep link URL
- Если у пользователя уже есть активная связка — всё равно генерирует (для перепривязки)

```
DELETE /api/telegram/link
→ { success: true }
```

- Удаляет telegram_connection для текущего пользователя (отвязка)

```
GET /api/telegram/link
→ { connected: boolean, username?: string, firstName?: string, linkedAt?: string }
```

- Статус подключения для UI

### 7. UI в настройках Simply

В `settings-page.tsx` добавить секцию **"Подключения"** (между "Аккаунт" и "Внешний вид"):

**Иконка:** `Link` или `MessageCircle` из lucide-react

**Состояние "Не подключён":**
- Текст: "Подключите Telegram для доставки брифингов и уведомлений"
- Кнопка: "Подключить Telegram"
- По нажатию → вызов POST /api/telegram/link → открытие linkUrl в новом окне
- Под кнопкой — QR-код со ссылкой (для пользователей на десктопе). Библиотека: `qrcode.react`

**Состояние "Подключён":**
- "✓ Telegram подключён" + @username (или имя, если username нет) + дата
- Кнопка "Отключить" → DELETE /api/telegram/link → обновление UI

**Polling статуса:** После открытия ссылки — poll GET /api/telegram/link каждые 3 секунды (макс 2 минуты). Когда connected: true → остановить poll, показать успех. Это нужно потому что линковка происходит в Telegram, а UI в Simply — нужно узнать когда она завершилась.

---

## Что НЕ делать

- **Не делать доставку брифинга** — это TG4
- **Не делать чтение групп** — это TG5
- **Не делать inline-кнопки в боте** — пока только текстовые ответы
- **Не локализовать бота** — только русский язык
- **Не делать виджет в настройках брифинга** — в TG4 добавим "Доставка в Telegram" со ссылкой на подключение

---

## Env-переменные

```
TELEGRAM_BOT_TOKEN=       # от @BotFather
TELEGRAM_WEBHOOK_SECRET=  # случайная строка для валидации webhook
```

Добавить в `.env.local`.

---

## Проверка

1. Зайти в Настройки → Подключения → нажать "Подключить Telegram"
2. Открывается бот в Telegram → нажать /start → "Аккаунт подключён!"
3. В Simply статус меняется на "✓ Подключён"
4. Нажать "Отключить" → статус возвращается к "Не подключён"
5. Повторная привязка работает
6. Ссылка с истёкшим токеном → бот говорит "Ссылка больше не активна"
7. /stop в боте → бот подтверждает отключение
8. Произвольный текст боту → перенаправление в Simply

---

## Объём

Средний. Новые файлы:
- Миграция БД (2 таблицы)
- `lib/telegram/bot.ts` (бот-логика)
- `app/api/telegram/webhook/route.ts`
- `app/api/telegram/link/route.ts`
- Секция "Подключения" в settings-page.tsx
- `scripts/setup-telegram-webhook.ts` (утилита)

Зависимости: `grammy`, `qrcode.react`
