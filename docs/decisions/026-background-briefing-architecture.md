# ADR 026: Background Briefing Architecture

**Дата:** 2026-02-27
**Статус:** Принято

---

## Контекст

Пользователи хотят получать утренний брифинг автоматически (в Telegram), без необходимости открывать браузер и нажимать кнопку. Для этого нужна инфраструктура фоновой генерации:
- Триггер по расписанию
- Генерация брифинга и подкаста без браузера
- Настройка времени, формата и toggle доставки

Ключевое ограничение: Vercel Hobby план (minimum cron = 1 hour, max duration = 300s).

---

## Решение

**Vercel Cron + API Route + waitUntil + p-limit** — минимальная инфраструктура без внешних сервисов.

```
Vercel Cron (hourly)
    → GET /api/cron/briefing (CRON_SECRET auth)
    → getUsersForDelivery(currentUtcTime)
    → p-limit(3) per-user processing
    → runBriefingPipeline({ userId })
    → waitUntil(runPodcastPipeline({ userId, briefingId }))
```

### Ключевые компоненты:
1. **`vercel.json`** — cron расписание (`0 * * * *`)
2. **`/api/cron/briefing`** — API route с CRON_SECRET авторизацией
3. **`briefing-pipeline.ts`** — вынесенная core-логика (работает с browser и background)
4. **`podcast-pipeline.ts`** — вынесенная core-логика подкаста
5. **`waitUntil()`** — non-blocking podcast (не задерживает ответ cron)
6. **DB fields** — deliveryEnabled, deliveryFormat, deliveryStatus

---

## Причины

1. **Zero infrastructure** — Vercel Cron бесплатен, не нужен Inngest/Trigger.dev/QStash
2. **Reuse existing code** — pipeline вынесен из route handlers, одна и та же логика для browser и background
3. **waitUntil pattern** — podcast генерация не блокирует cron response (важно для timeout)
4. **p-limit(3)** — контролируемая конкурентность, не перегружает DB и AI API
5. **Idempotency** — skip если ready briefing за сегодня, safe для повторных вызовов

---

## Последствия

### Плюсы

- Нет внешних зависимостей — всё на Vercel
- Pipeline переиспользуется browser и background
- Podcast не блокирует — text ready → deliveryStatus='pending' мгновенно
- Идемпотентность — safe retry при failures

### Минусы

- **Hobby план: hourly cron** — максимальная задержка доставки = 30 мин от заданного времени
- **300s timeout** — при большом количестве пользователей может не хватить
- **Нет retry** — если pipeline упал, повторится только через час (с idempotency check)
- **Нет observability** — только console.log (Vercel logs)

### Решения для масштабирования (при необходимости):
- Pro план: `*/15 * * * *` (15-min cron, WINDOW_MINUTES=7)
- Inngest/QStash для retry и observability
- Separate queue для podcast generation

---

## Альтернативы

### Альтернатива 1: Inngest

**Что это:** Event-driven background job platform с retry, observability, fan-out

**Почему отклонили:**
- Overkill для текущего масштаба (1-10 пользователей)
- Дополнительная зависимость и расходы
- Более сложный setup (SDK, dashboard, webhooks)

**Когда может быть лучше:**
- 100+ пользователей с фоновой генерацией
- Нужен надёжный retry с backoff
- Нужна observability (traces, metrics)

### Альтернатива 2: QStash (Upstash)

**Что это:** HTTP-based message queue от Upstash

**Почему отклонили:**
- Дополнительный сервис и API key
- Для текущего масштаба Vercel Cron достаточен
- Добавляет latency (double hop: QStash → API route)

**Когда может быть лучше:**
- Нужен guaranteed delivery
- Нужен delay/schedule per-message
- Vercel Cron не справляется с нагрузкой

---

## Ссылки и ресурсы

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [waitUntil](https://vercel.com/docs/functions/functions-api-reference#waituntil)
- [p-limit](https://github.com/sindresorhus/p-limit)

---

## Примечания

- Actual Telegram delivery (sending messages) — **не реализовано** в ТЗ-TG4a. Будет в ТЗ-TG4b
- deliveryStatus flow: `none` → `pending` (text ready) → `sent` (после отправки в Telegram)
- 3 формата доставки: `text` (только текст), `audio` (только подкаст), `text_audio` (текст + подкаст)

---

## История изменений

- **2026-02-27** - Документ создан (Claude Code, ТЗ-TG4a)
