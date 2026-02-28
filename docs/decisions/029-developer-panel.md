# ADR 029: Developer Panel Architecture

**Дата:** 2026-02-28
**Статус:** Принято
**Версия:** 3.57.0

## Контекст

Для отладки AI-ответов использовался inline DEV mode — текстовый prefix `[DEV] chat | Haiku | Simply Chat | ничего` инжектировался в system prompt через `injectDevMode()`. Этот подход имел серьёзные проблемы:

1. **Загрязнение контекста** — debug информация отъедала токены из полезного контекста
2. **Ненадёжность** — AI мог игнорировать или искажать инструкцию по формату prefix
3. **Ограниченность** — показывал только модель и агента, без токенов, стоимости, timing
4. **Persistence в истории** — prefix сохранялся в сообщениях и отображался при перезагрузке

## Решение

Встроенная DevPanel — отдельный UI-слой поверх чата, питаемый transient data-stream events.

### Архитектура

```
Server (route.ts)                    Client (React)
─────────────────                    ──────────────
onStepFinish → emitDebugStep()  ──→  DevPanelProvider
onFinish → emitDebugFinish()    ──→    ├── collects events
guardian → emitDebugGuardian()  ──→    ├── groups per message
start → emitDebugPrompt()      ──→    └── Map<messageId, data>
                                           │
                                    DevPanelFooter (compact)
                                    DevPanelDrawer (detailed)
```

### Ключевые решения

1. **Data-stream events вместо prompt injection** — debug данные передаются через SSE data stream, не загрязняя AI-контекст
2. **NOT transient** — несмотря на первоначальный план, events НЕ помечены `transient: true`, т.к. AI SDK v5 не доставляет transient events в `onData` callback клиента. Безопасность обеспечивается server-side guard (`isSimplyDevMode`)
3. **Progressive disclosure** — Footer (1 строка) → Drawer (6 секций). Минимальный визуальный шум, полная информация по клику
4. **Dual safety gate** — сервер: `isSimplyDevMode` check в каждой emit function; клиент: `NEXT_PUBLIC_SIMPLY_DEV_MODE` early bailout в Provider
5. **Pricing в рублях** — `MODEL_PRICING_RUB` с курсом 100 ₽/$, `calculateCostRub()` показывает стоимость запроса

### Секции Drawer

| Секция | Данные |
|--------|--------|
| Model | modelId, modelName, finishReason (цветовая кодировка), steps, duration, TTFT |
| Tokens | input/output/cached/reasoning tokens, стоимость ₽, context usage % |
| Timeline | per-step карточки: тип, timing bar, tool calls, tokens |
| Guardian | clean/blocked/warning/bypassed, confidence, pattern details |
| Prompt | preview system prompt (500 chars), agent, mode, context injections |
| Raw | JSON: tool calls args + results |

## Причины

1. **Нулевое влияние на AI** — debug данные не попадают в prompt, не расходуют токены
2. **Богатая информация** — токены, стоимость, timing, Guardian статус, prompt preview — всё в одном месте
3. **Production-safe** — двойной gate (server + client), в production ни events, ни UI не существуют
4. **Extensible** — добавить новый event type = добавить emit function + секцию в drawer

## Последствия

**Плюсы:**
- Полная отладочная информация без влияния на AI-качество
- Стоимость каждого запроса видна в реальном времени
- Guardian результаты видны inline (не нужно смотреть серверные логи)

**Минусы:**
- Events не помечены transient → при `SIMPLY_DEV_MODE=true` debug данные сохраняются в dataStream (не критично — dev mode только для разработчика)

## Альтернативы

1. **Внешний дашборд (Langfuse, Helicone)** — отклонено: overhead на интеграцию, latency, не inline
2. **Browser DevTools** — отклонено: требует знания SSE формата, неудобно для non-dev пользователей
3. **Сохранение transient events** — невозможно: AI SDK v5 не доставляет transient events в onData callback
