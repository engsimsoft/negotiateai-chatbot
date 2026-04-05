# ТЗ-TOKENS1: SDK Native Usage Tracking

**Автор:** Senior Dev Review (на основе TZ_AUDIT1 findings + официальная документация AI SDK v6)
**Дата:** 2026-04-05
**Версия проекта:** 3.66.0 → 3.67.0
**Приоритет:** Высокий (блокирует биллинг)

---

## Контекст

Два месяца проект борется с расхождением между отображаемой стоимостью запросов (Dev Panel, Cost Audit, DB `ai_usage_log.costUsd`) и реальной стоимостью в Anthropic Console. Каждая попытка "залатать" формулу приводила к новому рассинхрону.

**Корень проблемы:** использовался самопальный расчёт через ручную субтракцию `inputTokens - cacheRead - cacheWrite`, хотя AI SDK v6 Anthropic provider уже предоставляет готовые раздельные поля в стандартной структуре `inputTokenDetails`.

**Подтверждение из исходников (`node_modules/@ai-sdk/anthropic/dist/internal/index.js`):**

```javascript
return {
  inputTokens: {
    total:      inputTokens + cacheCreationTokens + cacheReadTokens,  // total billable
    noCache:    inputTokens,                                          // fresh
    cacheRead:  cacheReadTokens,                                      // cache_read_input_tokens
    cacheWrite: cacheCreationTokens                                   // cache_creation_input_tokens
  },
  outputTokens: { total: outputTokens, text: undefined, reasoning: undefined },
  raw: rawUsage
}
```

## Цель

Привести расчёт токенов и стоимости к production-grade стандарту:

1. **SSOT = AI SDK v6 `inputTokenDetails`** — никаких ручных вычислений
2. **Единая точка расчёта стоимости** (`calculateCostRub`) принимает уже разделённые поля
3. **Anthropic billing multipliers зафиксированы** (5m cache write = 1.25×, cache read = 0.10×)
4. **100% совпадение с Anthropic Console** (допуск: округление ±0.001 ₽)
5. **Масштабируемость** — при появлении новых Anthropic фич (1h cache TTL, extended thinking) код не сломается, SDK сам обновит маппинг

## Требования

### R1. Новая структура `TokenUsageForPricing`

```typescript
export interface TokenUsageForPricing {
  noCacheInputTokens: number;     // свежий input (из inputTokenDetails.noCacheTokens)
  cacheReadTokens: number;        // из inputTokenDetails.cacheReadTokens
  cacheWriteTokens: number;       // из inputTokenDetails.cacheWriteTokens
  outputTokens: number;           // usage.outputTokens
  reasoningTokens?: number;       // usage.outputTokenDetails.reasoningTokens
}
```

**Принципиально:** больше нет поля `inputTokens` как "сборной солянки". Только явно раздельные токены.

### R2. `calculateCostRub` без субтракции

```typescript
export function calculateCostRub(
  modelId: string,
  usage: TokenUsageForPricing,
): number {
  const p = MODEL_PRICING_RUB[modelId];
  if (!p) return 0;

  // Reasoning billed at output rate (Anthropic extended thinking, DeepSeek R1)
  const effectiveOutput = usage.outputTokens + (usage.reasoningTokens ?? 0);

  const cost =
    (usage.noCacheInputTokens / 1000) * p.input +
    (usage.cacheReadTokens    / 1000) * p.cached +
    (usage.cacheWriteTokens   / 1000) * p.cacheWrite +
    (effectiveOutput          / 1000) * p.output;

  return Math.round(cost * 100) / 100;
}
```

### R3. Единый extractor `extractUsageForPricing`

Все вызывающие места получают готовую структуру `TokenUsageForPricing` через один helper:

```typescript
// lib/ai/usage-utils.ts
export function extractUsageForPricing(
  usage: LanguageModelUsage | undefined | null,
): TokenUsageForPricing {
  const details = usage?.inputTokenDetails;
  return {
    noCacheInputTokens: details?.noCacheTokens ?? usage?.inputTokens ?? 0,
    cacheReadTokens:    details?.cacheReadTokens ?? 0,
    cacheWriteTokens:   details?.cacheWriteTokens ?? 0,
    outputTokens:       usage?.outputTokens ?? 0,
    reasoningTokens:    usage?.outputTokenDetails?.reasoningTokens ?? 0,
  };
}
```

### R4. Все callsites `calculateCostRub`/`calcStepCostRub` обновлены

Список (из grep):
- `lib/ai/tokenlens-catalog.ts` (2 места: `calcCostUsd`, `calcStepCostRub`)
- `lib/ai/providers.ts` (`getStepCostRub` client-side fallback)
- `lib/ai/pipeline-trace.ts` (`buildAiCallTrace`)
- `lib/briefing/briefing-filter.ts`
- `lib/briefing/briefing-author.ts`
- `lib/briefing/briefing-section-author.ts`
- `lib/briefing/research-engine.ts`
- `lib/podcast/script-generator.ts`
- `app/(chat)/api/chat/route.ts` (estimatedCostRub)
- `app/(chat)/api/service-chat/route.ts` (estimatedCostRub)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (estimatedCostRub)

### R5. `DebugStepData` хранит раздельные токены

```typescript
export interface DebugStepData {
  stepIndex: number;
  stepType: string;
  modelId: string;
  noCacheInputTokens: number;     // было: inputTokens (сборное)
  cacheReadTokens: number;        // было: cachedTokens
  cacheWriteTokens: number;       // уже есть
  outputTokens: number;
  reasoningTokens: number;
  finishReason: string;
  stepCostRub?: number;
  toolCalls: ...;
  toolResults: ...;
  timestamp: number;
}
```

UI в `tokens-section.tsx` читает раздельные поля, не делает никаких вычислений.

### R6. `DebugFinishData` аналогично раздельные поля

```typescript
export interface DebugFinishData {
  totalNoCacheInputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalSteps: number;
  totalDurationMs: number;
  timeToFirstTokenMs: number;
  estimatedCostRub: number;
  modelId: string;
  finishReason: string;
}
```

### R7. DB layer — единая схема логирования

Колонка `inputTokens` в `ai_usage_log` переименовывается семантически: теперь хранит **total billable input** (noCache + cacheRead + cacheWrite). Либо добавить колонку `noCacheInputTokens` для корректной агрегации. Решение — в ANALYSIS.md.

### R8. Валидация через TZ_AUDIT1

После рефакторинга прогнать полный тест-кейс из `TZ_AUDIT1` (7 типов чатов × 3 запроса) и сверить с Anthropic Console. Допуск расхождения: **< 1%**.

### R9. ADR — обоснование решения

Создать `docs/decisions/030-sdk-native-usage-tracking.md` с полным контекстом: проблема, альтернативы, выбор, trade-offs. Чтобы через 6 месяцев никто не "улучшал обратно".

## Принципы реализации

1. **Никаких patches.** Полный рефакторинг через типы — компилятор найдёт всех callers.
2. **Breaking change — OK.** Это внутреннее API, переписываем атомарно.
3. **Тесты в процессе.** На каждом этапе — `npx tsc --noEmit` = 0.
4. **Mandatory git commits** после каждого этапа.
5. **Manual validation** после каждого этапа через реальный чат + Anthropic Console.

## Не входит в scope

- Рефакторинг TokenLens pricing (оставляем как backup, basic SSOT = hardcoded MODEL_PRICING_RUB + AI SDK native usage)
- UI redesign Cost Audit Dashboard (отдельное TZ)
- Миграция на другие провайдеры (OpenAI, Gemini) — только подготовка интерфейсов
- Биллинг пользователей в продакшене

## Критерий успеха

```
✅ Dev Panel cost === Cost Audit Dashboard cost === Anthropic Console cost (допуск <1%)
✅ 0 ручных вычитаний токенов в кодовой базе (grep "- cacheRead" = пусто)
✅ Все 7 типов чатов из TZ_AUDIT1 провалидированы (3 запроса каждый)
✅ ADR 030 зафиксировал решение и trade-offs
✅ npm run build успешен, npx tsc --noEmit = 0
```

## Версионирование

**3.66.0 → 3.67.0** — minor (breaking internal API, но пользовательского контракта не меняет)
