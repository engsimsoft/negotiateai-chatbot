# ТЗ-TG4b: Доставка брифинга в Telegram

**Цель:** Пользователь получает утренний брифинг прямо в Telegram от @GetSimplyBot. Текст + аудио + ссылка на полный выпуск.

**Одно предложение:** Cron сгенерировал брифинг (TG4a) → бот отправляет его в Telegram → пользователь читает/слушает не открывая браузер.

---

## Зачем

TG4a создал фундамент: брифинг генерируется в фоне и помечается `deliveryStatus: 'pending'`. Но отправка в Telegram не реализована. Это ТЗ закрывает последнюю милю — доставку готового брифинга пользователю.

---

## Что нужно сделать

### 1. Функция отправки брифинга

Новый модуль `lib/telegram/briefing-delivery.ts`:

```typescript
export async function deliverBriefingToTelegram(params: {
  userId: string;
  briefingId: string;
  deliveryFormat: "text" | "audio" | "text_audio";
}): Promise<{ success: boolean; error?: string }>
```

Логика:
1. Загрузить `TelegramConnection` по userId → получить `telegramChatId`
2. Если нет активного подключения → return `{ success: false, error: "no_connection" }`
3. Загрузить брифинг из `BriefingHistory` по briefingId → распарсить article JSON
4. Сформировать текстовое сообщение (см. раздел "Формат сообщения")
5. Отправить через grammY bot API (`bot.api.sendMessage`)
6. Если формат включает аудио и аудио готово → отправить аудиофайл (`bot.api.sendAudio` или `bot.api.sendVoice`)
7. Обновить `deliveryStatus` → `'sent'` (успех) или `'failed'` (ошибка)

### 2. Формат текстового сообщения

Сообщение в Telegram — **краткая выжимка**, не полный брифинг. Задача: заинтересовать, дать суть, пригласить читать полностью.

Структура (Telegram MarkdownV2 или HTML):

```
☀️ Доброе утро! Ваш брифинг за 27 февраля

🏎️ Формула-1
Краткое описание главного из этой секции (1-2 предложения)

🤖 Искусственный интеллект  
Краткое описание главного из этой секции (1-2 предложения)

📊 Финансы
Краткое описание главного из этой секции (1-2 предложения)

[Читать полностью →]  [Настроить →]
```

Детали формата:
- Заголовок с датой (день недели по-русски)
- По каждой секции из article: emoji + topicName + первые 1-2 предложения из content (или description если есть)
- Максимум 4096 символов (лимит Telegram). Если секций много — обрезать до основных
- Inline-кнопки внизу: "Читать полностью" (URL на `/briefing`), "Настроить" (URL на `/briefing/setup`)
- Тон и стиль — из PE-контракта `telegram-bot-messages` (уже интегрирован)

### 3. Отправка аудио

Если `deliveryFormat` включает аудио **И** подкаст уже готов (`audioStatus: 'ready'`):
- Загрузить URL первого аудиофайла из `audioUrls` (или полного выпуска если есть concatenated)
- Отправить через `bot.api.sendAudio` с URL из Vercel Blob
- Title: "Подкаст: Брифинг за [дата]"
- Если аудио ещё не готово (podcast pipeline в waitUntil) → отправить только текст. Аудио не догоняем отдельным сообщением в MVP — усложнение без ценности

### 4. Интеграция в cron

В `app/api/cron/briefing/route.ts` — после `updateBriefingDeliveryStatus(briefingId, 'pending')`:

1. Проверить есть ли `TelegramConnection` для пользователя
2. Если есть → вызвать `deliverBriefingToTelegram({ userId, briefingId, deliveryFormat })`
3. Обновить `deliveryStatus` по результату
4. Если Telegram не подключён → оставить `'pending'` (брифинг готов, просто не доставлен)

Доставка должна быть **non-blocking** — если отправка в Telegram упала, это не должно ломать cron для остальных пользователей.

### 5. Обработка ошибок

| Ошибка | Действие |
|--------|----------|
| Бот заблокирован пользователем (403) | `deliveryStatus: 'failed'`, можно деактивировать `deliveryEnabled` |
| Telegram API недоступен (5xx, timeout) | `deliveryStatus: 'failed'`, retry при следующем cron |
| Нет TelegramConnection | `deliveryStatus: 'pending'` (текст готов, доставка невозможна) |
| Сообщение слишком длинное | Обрезать текст до лимита Telegram (4096 символов) |

При ошибке 403 (бот заблокирован) — **не отключать deliveryEnabled автоматически** в MVP. Просто логировать. Автоматика отключения — усложнение, которое можно добавить позже.

---

## Чего НЕ делать в этом ТЗ

- Отложенную доставку аудио (отдельным сообщением после генерации подкаста)
- Callback-обработку нажатий на inline-кнопки (это URL-кнопки, не callback)
- Push-уведомления о новых темах в брифинге
- Настройки формата сообщения (шаблоны, кастомизация)

---

## Критерий приёмки

1. **Доставка работает:** Cron генерирует брифинг → бот отправляет сообщение в Telegram с текстом и кнопками
2. **Аудио доставляется:** Если формат `text_audio` и подкаст готов — аудиофайл приходит в Telegram
3. **Формат читаемый:** Сообщение в Telegram содержит emoji, названия тем, краткие описания, inline-кнопки
4. **Ошибки не ломают cron:** Если у одного пользователя заблокирован бот — остальные получают доставку
5. **deliveryStatus обновляется:** `pending` → `sent` (успех) или `failed` (ошибка)

---

## Контекст для Claude Code

- Cron handler: `app/api/cron/briefing/route.ts` (TG4a, v3.54.0)
- Bot: `lib/telegram/bot.ts` (grammY singleton)
- TelegramConnection: `lib/db/queries.ts` → `getTelegramConnection`, `getByTelegramId`
- BriefingHistory: содержит `briefingJson` (BriefingArticle), `audioUrls`, `audioStatus`, `deliveryStatus`
- PE контракт: `lib/prompts/telegram/telegram-bot-messages.md` (тон, стиль)
- Inline-кнопки: grammY `InlineKeyboard` с URL-кнопками (не callback)
- APP_URL: `process.env.APP_URL` (для ссылок на `/briefing`)
