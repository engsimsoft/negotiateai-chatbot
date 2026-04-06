# Анализ ТЗ-PIPELINE1: Reliable Pipeline Observability

## Резюме

Pipeline брифинга теряет 78% расхода из-за скрытых retry AI SDK + отсутствия логирования failed attempts. Нужна retry-инфраструктура с полным логированием + DevPanel для видимости pipeline.

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе аудита кодовой базы и документации AI SDK v6.

### Согласен с подходом

- `maxRetries: 0` + своя retry-обёртка — единственный способ получить usage за каждую попытку
- Убрать fallback Sonnet 4.5 — та же цена, нет смысла в другой модели как fallback
- Perplexity logUsage — очевидный пропуск
- URL verification уже есть — нужно только визуализировать

### Нюансы реализации

| # | Вопрос | Решение | Обоснование из кода |
|---|--------|---------|-------------------|
| 1 | Failed requests — Anthropic не отдаёт usage | Для failed attempts: оценивать input tokens по длине prompt (приблизительно) | `APICallError` не содержит usage. Server errors (500/529) не списываются Anthropic, но client disconnects — списываются. Точную сумму за failed request узнать нельзя |
| 2 | `script-generator.ts` — свой retry (5 попыток) × SDK retry (3) | Добавить `maxRetries: 0`, оставить свой retry (он нужен для content validation — проверка длины скрипта) | Строки 106-133: retry по бизнес-логике (wordCount < 120), не по ошибкам API. Нужно аккумулировать usage за ВСЕ попытки — уже частично сделано (totalPromptTokens), но logUsage один раз в конце |
| 3 | `briefing-filter.ts` — нет retry | Добавить `maxRetries: 0` без обёртки (Gemini Flash дёшев, одна попытка достаточно) | Стоимость filter ~$0.001, retry не оправдан |
| 4 | Trace attempts — как хранить | Добавить `attempts?: Array<{ usage?, error?, durationMs }>` в `AiCallTrace`, не ломая существующий формат | Backward compatible — старые traces без attempts работают |
| 5 | Controller crash — root cause | В `generate/route.ts:39`: если pipeline throws после первого emit(), следующий emit() внутри catch в pipeline (`briefing-pipeline.ts:375`) пишет в уже закрытый controller | Нужен `safeEmit` wrapper + try/catch вокруг `controller.close()` |

### Scope ограничения

- **Podcast pipeline** (`tts-gemini.ts`) — уже имеет свой retry (1 попытка), logUsage уже вызывается. Нужно только `maxRetries: 0` если Gemini TTS использует AI SDK (проверка: использует `@google/genai`, НЕ AI SDK — `maxRetries` не применимо)
- **Meeting pipeline** — не в scope (отдельная pipeline, другие проблемы)

## Потенциальные риски

1. **Оценка cost за failed requests неточна** — Anthropic не отдаёт usage для failed calls. Мы можем логировать факт попытки, но точную сумму нет. Допуск <5% может быть недостижим для pipeline с частыми failures.
2. **Gemini TTS** использует `@google/genai` (не AI SDK) — у него свой retry, не контролируемый `maxRetries`.

## Зависимости

- Существующая trace-инфраструктура (TraceCollector, PipelineTraceFooter/Drawer) — работает
- DevPanel для chat — reference implementation для расширения
- `isSimplyDevMode` gate — уже настроен

## Оценка сложности

- [x] Среднее (3-5 сессий)
