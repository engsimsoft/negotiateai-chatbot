# ТЗ-ProfessorPlanStreaming — перевод plan/route.ts на streamText (long-term fix max_tokens timeout)

**Статус:** Хвост, Medium impact (tactical фикс уже применён, но не лечит корень)
**Создано:** 2026-04-16 (сессия ТЗ-XAI-4 Этап 4, финализация)
**Источник:** hot-fix d9d3488 в plan/route.ts — добавлен tactical `maxOutputTokens: 16000` под 21333 Anthropic streaming threshold
**Связано с:** [app/(chat)/api/projects/[id]/plan/route.ts](../../app/(chat)/api/projects/[id]/plan/route.ts), [TZ_MaxOutputTokensAudit.md](TZ_MaxOutputTokensAudit.md) (шире тема)

---

## Симптом

Route `plan/route.ts` использует `generateText()` (non-streaming) для вызова Professor Planning с `adaptive thinking`. Anthropic требует **streaming** для `max_tokens > 21333` (см. [docs.anthropic.com/en/api/errors#long-requests](https://docs.anthropic.com/en/api/errors#long-requests)). Когда `maxOutputTokens` не указан явно, `@ai-sdk/anthropic` подставляет model capability default = **128 000** для Opus 4.6 (Anthropic поднял с 32K→128K 2026-04-12, легальное значение). Non-streaming запрос с 128K не укладывается в 60s default fetch timeout → `UND_ERR_SOCKET: other side closed` → 3× retry → ~180s total fail.

**Потеряно ~9 минут дебага в ТЗ-XAI-4 сессии** до находки root cause.

**Текущий tactical фикс (hot-fix d9d3488):** явный `maxOutputTokens: 16000`. 16K < 21333 → non-streaming safe zone. Работает, но:

1. Ограничивает output для задач, которые могут легитимно требовать больше (план на 50+ задач)
2. Если Anthropic когда-нибудь снизит threshold (21333 — magic constant) — фикс молча сломается
3. Противоречит архитектурному дизайну adaptive thinking: `thinking: { type: "adaptive" }` сам решает сколько tokens надо, ограничение через `maxOutputTokens` — костыль

---

## Почему это важно

Professor Planning — **одна из 3 премиум-точек** Simply (вместе с `professor:review` и `project:expert`). На неё идут Claude Opus 4.6 и Grok 4.20 reasoning — самые дорогие и интеллектуальные модели. Стабильность этого route критична для UX `/projects/[id]` → «Создать план».

Non-streaming `generateText` + adaptive thinking — это архитектурный anti-pattern: thinking-токены могут тратиться десятками тысяч, а non-streaming means весь response накапливается в памяти сервера до финального `return`. Streaming by design требуется **и** Anthropic API, **и** AI SDK v6 patterns для long-running tasks.

---

## Корневое решение — streamText

**Текущий код:**

```ts
const result = await generateText({
  model: getModel("professor:planning"),
  system: PROFESSOR_SYSTEM_PROMPT,
  prompt: userMessage,
  temperature: 0.2,
  maxOutputTokens: 16000, // ← tactical cap
  ...(supportsThinking ? { providerOptions: { anthropic: { thinking: { type: "adaptive" }, effort: "high" } } } : {}),
});

// Parse <plan_report> and <plan_json> from result.text
```

**Целевой код:**

```ts
const stream = streamText({
  model: getModel("professor:planning"),
  system: PROFESSOR_SYSTEM_PROMPT,
  prompt: userMessage,
  temperature: 0.2,
  // maxOutputTokens не указан — берётся из catalog capability (128K Opus),
  // но теперь streaming, так что Anthropic это принимает.
  ...(supportsThinking ? { providerOptions: { anthropic: { thinking: { type: "adaptive" }, effort: "high" } } } : {}),
});

// Вариант A: аккумулировать в text (текущее поведение)
let fullText = "";
for await (const delta of stream.textStream) {
  fullText += delta;
}
const usage = await stream.usage;

// Вариант B (бонус): streaming response к клиенту для UX прогресса
// return stream.toDataStreamResponse()
```

**Преимущества:**

1. Убирает tactical `maxOutputTokens: 16000` cap — adaptive thinking сам решает
2. Anthropic streaming threshold не триггерится (streaming API)
3. Нет 60s fetch timeout — response идёт чанками
4. Готовит почву для progressive UX (показ плана по частям пользователю — бонусный хвост)

---

## Acceptance criteria

- [ ] `plan/route.ts` использует `streamText()` вместо `generateText()`
- [ ] `maxOutputTokens: 16000` tactical cap убран
- [ ] Adaptive thinking работает (`thinking: { type: "adaptive" }` + high effort)
- [ ] Parse `<plan_report>` и `<plan_json>` продолжает работать с аккумулированным text
- [ ] `logUsage()` вызывается с правильными токенами (через `await stream.usage`)
- [ ] Smoke test: генерация плана на проекте с 10+ задачами завершается за < 60s без socket errors
- [ ] SQL-проверка: `ai_usage_log` записи для `professor:planning` за последний день — все валидные, thinkingTokens > 0
- [ ] (опционально) Дифф готов для будущего streaming UX — hook на `onChunk` для будущего прогресса

---

## НЕ в scope

- Streaming response к клиенту (progressive UX для `/projects/[id]/plan`) — отдельный хвост с продуктовой дискуссией, здесь только перевод backend вызова
- Audit других `generateText` вызовов — это [TZ_MaxOutputTokensAudit.md](TZ_MaxOutputTokensAudit.md)
- Изменение модели `professor:planning` — остаётся на Opus 4.6 / Grok 4.20 reasoning, решения серии Simply_xAI не пересматриваются

---

## Связанные уже закрытые ТЗ / хвосты

- **hot-fix d9d3488** — tactical `maxOutputTokens: 16000`, живёт в коде с подробным комментарием [plan/route.ts:179-190](../../app/(chat)/api/projects/[id]/plan/route.ts#L179) ссылающимся на этот хвост
- **[TZ_MaxOutputTokensAudit.md](TZ_MaxOutputTokensAudit.md)** — шире: явный `maxOutputTokens` для всех `generateText`/`streamText` call sites под realistic task output size

---

## Оценка

**1-2 сессии:**
- Разбор существующего парсинга `<plan_report>` / `<plan_json>` (≤ 30 минут)
- Перевод на streamText + error handling (1-2 часа)
- Smoke test на реальном проекте + SQL-верификация (30 минут)
- Обновление комментария в коде + ссылка на закрытый ТЗ (15 минут)
