# ТЗ-UsageLoggingCoverage (Follow-up из TZ_LegacyChatCleanup, Findings #2 #3)

**Импакт:** medium · **Оценка:** 1 сессия · **Создано:** 2026-04-13

## Цель

Покрыть `ai_usage_log` всеми вызовами `getModel(taskId)`, чтобы дашборд `/admin/cost-audit` показывал реальные цифры, совпадающие с Anthropic / xAI / MiniMax Console. Сейчас в `ai_usage_log` пишутся только основные пользовательские диалоги через chat API; вспомогательные вызовы (автонейминг, OCR, клерки, сервисные чаты, briefing pipelines) расходуют деньги в provider API, но не логируются.

## Контекст находки

В рамках TZ_LegacyChatCleanup пользователь сравнил Anthropic Console с нашим `ai_usage_log`:
- **Anthropic Console** показал: 141 127 input + 996 output для Haiku за тестовую сессию
- **Наш `ai_usage_log`**: 129 146 input + 535 output (5 строк, только из chat/route.ts)
- **Расхождение**: ~12K input + ~461 output (≈ 10%) — это «скрытые» вызовы Haiku из `util:title` (автонейминг чата), `vision:ocr`, `clerk:*`, `service-chat:*`

При росте нагрузки расхождение станет ощутимым и финансовая прозрачность сломается.

## Что нужно

### Часть 1 — Полное покрытие logging

**Подход**: вместо того чтобы инструментировать каждый call-site (десятки мест), сделать единый wrapper над `getModel(taskId)` который автоматически логирует usage в `ai_usage_log` через коллбэки `streamText` / `generateObject`.

Вариант реализации:
- Создать `lib/ai/getModel-with-logging.ts` exportеющий `getModelInstrumented(taskId, { chatId?, userId?, chatMode? })`. Возвращает обычную модель, но при первом вызове через `streamText`/`generateObject` подключает middleware который пишет в `ai_usage_log` при `onFinish`/после результата
- Заменить `getModel(...)` → `getModelInstrumented(...)` во всех call-sites вспомогательных задач (util, clerks, service-chat, briefing/podcast pipelines, vision OCR)
- Альтернатива: middleware на уровне Vercel AI SDK Provider Registry (chained provider который перехватывает все вызовы — более чистая архитектура, но требует разобраться в API SDK)

### Часть 2 — Переименование/документирование `inputTokens` (Finding #3)

**Проблема:** Поле `inputTokens` в `ai_usage_log` хранит **gross input** (всю сумму, включая `cacheReadTokens` и `cacheWriteTokens`), а соседние `cacheReadTokens` / `cacheWriteTokens` — это **разбивка того же значения**. Из имени поля невозможно догадаться, и SQL-агрегации легко делают double counting.

**Два варианта**:
- (а) **Минимальный**: добавить чёткий jsdoc-комментарий к колонке в `lib/db/schema.ts` — «WARNING: inputTokens — это GROSS input, включая cacheRead/cacheWrite. НЕ складывать с cacheReadTokens/cacheWriteTokens». Без миграции БД
- (б) **Полный**: переименовать `inputTokens` → `inputTokensTotal` через миграцию + обновить все call-sites + дашборд `/admin/cost-audit`. Чище, но больше работы

**Рекомендация**: вариант (а) сейчас + (б) позже отдельно если будут дополнительные путаницы.

## Definition of Done

- Все вызовы `getModel(taskId)` пишут в `ai_usage_log`, либо через единый wrapper, либо явно
- Сравнительный тест: за тестовую сессию `SELECT SUM(inputTokens) FROM ai_usage_log WHERE modelId = 'claude-haiku-4-5-20251001'` = `Anthropic Console "Total tokens in"` (с погрешностью <2%)
- jsdoc-комментарий к колонке `inputTokens` в schema.ts с предупреждением о gross input
- Дашборд `/admin/cost-audit` показывает корректные цифры

## Риски

- **Производительность**: каждый вызов AI добавляет 1 INSERT в `ai_usage_log`. Сейчас это уже работает для chat-route, не должно стать проблемой. Но если pipelines (briefing) делают сотни вызовов — батчить
- **Race condition**: писать через `Promise.allSettled` или fire-and-forget с `void`/`waitUntil`, чтобы не блокировать ответ пользователю
