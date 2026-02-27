# ТЗ-TG4a: Фоновая генерация брифинга по расписанию

**Цель:** Брифинг генерируется автоматически по расписанию без участия пользователя. Это фундамент для доставки в Telegram (TG4b).

**Одно предложение:** Cron будит Inngest → Inngest генерирует брифинг в фоне → результат готов к доставке.

---

## Зачем

Сейчас брифинг генерируется только когда пользователь нажимает кнопку в браузере. Pipeline стримит прогресс прямо в browser через ReadableStream. Для доставки в Telegram нужна генерация без браузера — по расписанию, в фоне.

---

## Что нужно сделать

### 1. Извлечь pipeline в переиспользуемую функцию

Сейчас вся логика (fetch → filter → dedup → generate article) живёт inline внутри `app/(chat)/api/briefing/generate/route.ts` в callback `ReadableStream.start()`.

**Задача:** вынести core pipeline в отдельную функцию `lib/briefing/briefing-pipeline.ts`:

```typescript
export async function runBriefingPipeline(params: {
  userId: string;
  onProgress?: (event: BriefingProgressEvent) => void; // опционально — для streaming в браузер
}): Promise<BriefingPipelineResult>
```

- `onProgress` — если передан, шлёт прогресс (для browser streaming route). Если нет — работает молча (для Inngest).
- Возвращает результат: article JSON, audioStatus, количество источников, ошибки.
- Существующий `route.ts` вызывает эту функцию с `onProgress = emit`.
- Inngest вызывает без `onProgress`.

### 2. Inngest cron-функция

Новая Inngest function: `briefing/generate.scheduled`

Логика:
1. Vercel Cron (`vercel.json`) триггерит endpoint каждые 15 минут
2. Endpoint вызывает Inngest event
3. Inngest function:
   - Загружает всех пользователей с `deliveryEnabled = true` у которых `deliveryTime` попадает в текущий 15-минутный слот
   - Для каждого пользователя: проверяет есть ли свежий брифинг за сегодня (статус `ready`)
   - Если есть — пропускает генерацию (брифинг уже готов, TG4b доставит)
   - Если нет — вызывает `runBriefingPipeline({ userId })`
   - После успешной генерации: запускает podcast pipeline (если у пользователя включено аудио)
   - Помечает брифинг как готовый к доставке (`deliveryStatus: 'pending'`)

**Временные слоты:** если пользователь поставил 7:00, а cron запускается в 6:45 / 7:00 / 7:15 — генерация стартует в 6:45 (за 15 минут до), чтобы к 7:00 брифинг был готов. Точная логика окна — на усмотрение Claude Code, главное чтобы к указанному времени брифинг был готов.

### 3. Настройки доставки в БД

Расширить таблицу `BriefingSettings` (или создать отдельную таблицу — на усмотрение Claude Code):

Нужные поля:
- `deliveryEnabled` (boolean, default false)
- `deliveryTime` (string, формат "HH:MM", default "07:00")
- `deliveryFormat` ("text" | "text_audio", default "text_audio")
- `deliveryStatus` (на уровне BriefingHistory: "none" | "pending" | "sent" | "failed")

### 4. UI настроек доставки

На странице `/briefing` (или в настройках брифинга) — блок «Доставка»:
- Toggle: включить/выключить автоматическую генерацию
- Выбор времени (HH:MM)
- Формат: текст / текст + аудио
- Состояние подключения Telegram (если не подключён — ссылка на настройки)

Простой, минимальный UI. Apple-стиль: три контрола максимум.

---

## Ключевые ограничения

- **maxDuration:** Vercel function timeout. Сейчас generate route имеет `maxDuration = 90`. Inngest functions имеют свои лимиты — Claude Code должен учесть это при выборе архитектуры (возможно разбить на steps).
- **Podcast generation:** уже работает через Inngest параллельно. Background pipeline должен корректно дождаться завершения подкаста перед пометкой "ready to deliver".
- **Timezone:** `deliveryTime` хранится в таймзоне пользователя (`BriefingSettings.timezone`, по умолчанию `Europe/Moscow`). Cron конвертирует в UTC для сравнения.
- **Идемпотентность:** если cron дёрнулся дважды — не генерировать дубль. Проверка по наличию свежего брифинга за сегодня.
- **Эфемерные брифинги:** TTL и cleanup продолжают работать. Background-генерация не меняет lifecycle.

---

## Чего НЕ делать в этом ТЗ

- Отправку в Telegram (это TG4b)
- UI форматирования Telegram-сообщения
- Inline-кнопки бота
- Обработку ошибок доставки (заблокирован бот и т.п.)

---

## Критерий приёмки

1. **Background pipeline:** Вызвать `runBriefingPipeline({ userId })` из тестового скрипта/endpoint без браузера — брифинг генерируется и сохраняется в БД
2. **Cron работает:** В логах Inngest видно выполнение scheduled function по расписанию
3. **Гибрид:** Если пользователь уже сгенерировал брифинг в браузере — cron не генерирует повторно
4. **UI:** Пользователь может включить доставку, выбрать время, выбрать формат
5. **Существующий flow не сломан:** Генерация из браузера (кнопка) работает как раньше, со стримингом прогресса

---

## Контекст для Claude Code

- Текущий pipeline: `app/(chat)/api/briefing/generate/route.ts`
- Podcast pipeline: `app/(chat)/api/briefing/podcast/generate/route.ts`
- Inngest уже используется для TTS: `lib/podcast/` (параллельная генерация по темам)
- Bot инфраструктура: `lib/telegram/bot.ts` (grammY)
- Связка аккаунтов: таблица `TelegramConnection`
- Настройки брифинга: таблица `BriefingSettings`
- PE контракт `telegram-bot-messages`: уже интегрирован (v3.49.0)
