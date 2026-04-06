# ADR 037: Total Usage Accumulation + Retry-with-Logging

**Дата:** 2026-04-06
**Статус:** Принято
**ТЗ:** PIPELINE1 (v3.69.0)

## Контекст

AI SDK v6 `onFinish` callback в `streamText`/`generateText` предоставляет два поля:
- `usage` — usage **последнего step-а** (наследуется от `StepResult`)
- `totalUsage` — агрегат **по всем steps** (сумма)

Наш код использовал `{ usage }` — при multi-step (briefing-onboarding: 6 steps) терялось 74% токенов.

Дополнительно: AI SDK default `maxRetries=2` делает до 3 попыток за кулисами. Usage возвращается только за последнюю успешную попытку. Failed retry attempts невидимы.

## Решение

### 1. totalUsage вместо usage

Во всех streaming routes `onFinish: ({ usage })` заменено на `onFinish: ({ totalUsage })`.

**Альтернатива (отклонена):** Аккумулировать usage вручную в `onStepFinish`. Отклонено — AI SDK уже предоставляет `totalUsage`, нет смысла дублировать.

### 2. maxRetries: 0 + retryWithLogging

Для pipeline AI-вызовов (`generateObject` в briefing-author, section-author):
- `maxRetries: 0` — отключаем скрытые SDK retry
- `retryWithLogging()` — свой retry с логированием каждой попытки

**Альтернатива (отклонена):** Оставить SDK retry + пытаться извлечь usage из ошибок. Отклонено — `APICallError` не содержит usage data (проверено в AI SDK v6 source).

### 3. Удаление AUTHOR_MODEL_FALLBACK

`claude-sonnet-4-5-20250929` как fallback удалён. Та же цена что Sonnet 4.6, нет бизнес-смысла. Retry делается с основной моделью.

## Результат

- Anthropic Console vs БД: дельта <1% (было 74%)
- Artifacts (5 файлов) получили logUsage (было 0)
- Pipeline retry прозрачны в DevPanel

## Файлы

- `app/(chat)/api/chat/route.ts` — totalUsage
- `app/(chat)/api/service-chat/route.ts` — totalUsage
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — totalUsage
- `app/(chat)/api/assistant/ben/route.ts` — totalUsage
- `artifacts/*/server.ts` — добавлен logUsage
- `lib/ai/retry-with-logging.ts` — новый модуль
- `lib/briefing/briefing-author.ts` — maxRetries:0 + retryWithLogging
- `lib/briefing/briefing-section-author.ts` — аналогично
- `lib/briefing/briefing-config.ts` — удалён AUTHOR_MODEL_FALLBACK
