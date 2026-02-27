# Анализ ТЗ-TG4b: Доставка брифинга в Telegram

## Резюме

Реализовать «последнюю милю» доставки: cron сгенерировал брифинг (TG4a) → бот отправляет текстовую выжимку + аудио (если готово) в Telegram → пользователь читает/слушает без открытия браузера.

Скоуп: 1 новый модуль + 2 модификации в существующем коде.

## Вопросы для уточнения

Все вопросы заданы и получены ответы (см. ниже).

## Решения (согласовано с архитектором)

| # | Вопрос | Решение |
|---|--------|---------|
| 1 | Vercel план | **Hobby**. Cron раз в сутки. Один пользователь. `getUsersForDelivery` — выбирать всех с `deliveryEnabled = true`, игнорируя время |
| 2 | Аудио из cron | **Known limitation**. В MVP текст only. Подкаст генерируется в `waitUntil` → не готов на момент доставки. Задокументировать комментарием |
| 3 | PE-контракт | Reference в архиве, не runtime-файл. Сообщения хардкодить в коде, стиль из контракта |
| 4 | MP3 или OGG | **MP3 через `sendAudio`**. Консистентно с веб-плеером, подкастный формат |
| 5 | isActive check | **Да**. `/stop` = не отправляем, даже если `deliveryEnabled = true` |
| 6 | Дата в таймзоне | **Да**, из `briefingSettings.timezone` |

## Рекомендации разработчика (Код-ревью)

> Все рекомендации согласованы с архитектором.

### Согласен с ТЗ
- Модуль `lib/telegram/briefing-delivery.ts` — ОК, логичное место
- Интеграция в cron после `updateBriefingDeliveryStatus` — ОК
- Error handling (403, 5xx) — ОК, соответствует grammY error patterns
- Inline URL-кнопки — ОК, `simplyButton` helper уже есть в bot.ts

### Принятые рекомендации
| # | Было (ТЗ) | Рекомендация | Обоснование |
|---|-----------|--------------|-------------|
| 1 | Telegram MarkdownV2 или HTML | **HTML** (`parse_mode: "HTML"`) | MarkdownV2 требует экранирования `.`, `-`, `(`, `)` — минное поле для русского текста |
| 2 | Генерация выжимки (не указан метод) | **Без AI** — `emoji + firstSentence(content)` | PE-контракт рекомендует то же. AI-вызов — overkill |
| 3 | sendAudio caption | Лимит **1024 символа** (не 4096) | Caption для аудио ограничен Telegram API. Наш `🎧 Аудио-версия · X мин` укладывается |

## Потенциальные риски

1. **Low**: grammY `bot.api.sendMessage()` вне контекста webhook — должно работать с singleton, но нужно проверить в Vercel serverless
2. **Low**: Vercel Blob URL → Telegram `sendAudio` — публичные URL, лимит 50MB, наши MP3 ~2-5MB

## Зависимости

- `lib/telegram/bot.ts` — синглтон бота (export `bot`)
- `lib/db/queries.ts` — `getTelegramConnection`, `getUsersForDelivery`, `updateBriefingDeliveryStatus`, `getBriefingHistory`
- `app/api/cron/briefing/route.ts` — точка интеграции
- `lib/briefing/briefing-types.ts` — `BriefingArticle`, `BriefingArticleSection`

## Оценка сложности

- [x] Простое (1 сессия)
