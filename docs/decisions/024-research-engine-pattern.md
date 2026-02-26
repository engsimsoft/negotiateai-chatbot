# ADR 024: Research Engine Pattern — серверная оркестрация исследования источников

**Дата:** 2026-02-26
**Статус:** Принято
**Версия:** 3.52.0 (ТЗ-FIX2)

## Контекст

При онбординге брифинга AI-модель должна найти и верифицировать реальные источники по темам пользователя. Ранее это делалось полностью через LLM (deepResearch + fetchUrl + readTelegramChannel), что было медленно, ненадёжно и не давало progress feedback.

## Решение

### 1. Research Engine — серверная оркестрация

Создан `lib/briefing/research-engine.ts` — серверный модуль, который оркестрирует поиск без участия LLM:

```
researchTopics(topics[]) → per-topic:
  1. Perplexity API (shared perplexity-client.ts) → citations
  2. extractCitations() → URL list
  3. verifySource(url) → fetchPage + RSS discovery
  4. classifySource() → tier, fetchMethod, language
```

**Ключевые решения:**
- **p-limit(3)** для параллельного исследования тем
- **Verified URL Set** — server-side `Set<string>` вместо флага в данных
- **Классификация эвристикой** — tier по домену, fetchMethod по URL/RSS, language по Cyrillic ratio

### 2. Progress Streaming через Closure Ref

Service-chat route использует `createUIMessageStream` (не `DataStreamWriter` как в chat route). Для streaming progress events из tool execute:

```typescript
const progressRef = { write: null };
// Внутри execute:
progressRef.write = (event) => dataStream.write(event);
// В tool callback:
progressRef.write?.({ type: "data-research-progress", data: event, transient: true });
```

**AI SDK v5 требования:**
- `type` must start with `data-` prefix
- `transient: true` prevents saving events in message history
- `consumeStream()` must be called INSIDE `createUIMessageStream execute`

### 3. DEV Mode Extraction

Extracted `injectDevMode()` из inline кода в `composer.ts` для переиспользования в service-chat route. Один utility, два контекста.

## Альтернативы

| Вариант | Причина отказа |
|---------|---------------|
| LLM-only (deepResearch per topic) | Медленно (3-5 мин), нет progress, модель может пропустить источники |
| WebSocket для progress | Overkill, AI SDK v5 `data-*` events достаточно |
| Client-side research | Невозможно — Perplexity API server-only |

## Последствия

- **Положительные:** Быстрый research (~30-60s), live progress UI, verified sources only
- **Отрицательные:** Perplexity API cost per topic, URL verification adds latency
- **Технический долг:** Guardian text buffering вызывает "all-at-once" text flush после tool call (by design, не критично)
