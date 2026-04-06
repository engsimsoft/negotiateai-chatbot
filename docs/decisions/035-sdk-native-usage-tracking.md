# ADR 035: SDK Native Usage Tracking (ТЗ-TOKENS1)

**Дата:** 2026-04-06
**Статус:** Принято

## Контекст

На протяжении ~2 месяцев (февраль-апрель 2026) проект сталкивался с расхождением между рассчитанной стоимостью AI-запросов и данными в Anthropic Console. Расхождение достигало 5-10× в user-facing UI (popover над полем ввода) и 1-5% в backend logging.

Причины:

1. **Additive-формула tokenlens:** Внешняя библиотека `tokenlens/helpers.getUsage()` использовала additive pricing — умножала `usage.inputTokens` (суммарный input: fresh + cache_read + cache_write) на fresh-rate, не вычитая cache-токены. Результат: cache-токены считались дважды.

2. **Субтракция как hotfix:** Ранний подход (ТЗ-CACHE1) вычислял `freshInput = inputTokens - cacheReadTokens - cacheWriteTokens` вручную. Это работало при точных данных, но ломалось когда AI SDK v6 возвращал `noCacheTokens` (уже disjoint), приводя к двойному вычитанию.

3. **Fake usage в pipelines:** `briefing-author`, `briefing-section-author`, `podcast/script-generator` и `briefing-filter` передавали в `logUsage` вручную собранный shape `{ inputTokens, outputTokens }`, теряя `inputTokenDetails.cacheReadTokens/cacheWriteTokens`.

## Решение

Breaking refactor на disjoint-контракт, основанный на нативных полях AI SDK v6:

```typescript
interface TokenUsageForPricing {
  noCacheInputTokens: number;   // ← usage.inputTokenDetails.noCacheTokens
  cacheReadTokens: number;      // ← usage.inputTokenDetails.cacheReadTokens
  cacheWriteTokens: number;     // ← usage.inputTokenDetails.cacheWriteTokens
  outputTokens: number;
  reasoningTokens?: number;     // ← usage.outputTokenDetails.reasoningTokens
}
```

Все поля **disjoint** — нет пересечения, нет субтракции, нет двойного счёта.

### Ключевые изменения

1. **SSOT pricing:** `calculateCostRub()` и `calculateCostBreakdownRub()` в `lib/ai/providers.ts` — единственное место расчёта стоимости. `MODEL_PRICING_RUB` содержит Anthropic rates (verified April 2026).

2. **AppUsage контракт:** `lib/usage.ts` — self-contained тип (disjoint tokens + costRub breakdown + contextWindow), без зависимости от tokenlens.

3. **MODEL_CONTEXT_WINDOW:** Sonnet 4.6 / Opus 4.6 = 1M native (no beta flag, flat pricing). Haiku 4.5 = 200K.

4. **Cumulative session tracking:** `mergeAppUsage()` суммирует tokens/cost в popover по всем сообщениям сессии.

5. **extractUsageForPricing():** Client-safe helper (перенесён из server-only `usage-utils.ts` в `providers.ts`).

## Причины

1. **Надёжность при масштабе:** Проект рассчитан на тысячи пользователей с pay-as-you-go биллингом. Любая ошибка в расчёте = финансовый риск.
2. **Стандарт SDK:** AI SDK v6 предоставляет disjoint-поля нативно — нет причин конструировать свои.
3. **Anthropic billing model:** `noCacheInput × base + cacheRead × 0.1× + cacheWrite × 1.25× + output × output_rate` — disjoint-контракт maps 1:1 на формулу биллинга.

## Последствия

**Плюсы:**
- Единый SSOT от server-side `onFinish` до client-side popover
- Расхождение <1% по всем 3 типам чатов (verified SQL + manual test)
- Устойчивость к будущим провайдерам (контракт стандартный)
- DevPanel, cost-audit dashboard и popover используют одну формулу
- Удалена зависимость от `tokenlens/helpers.getUsage()`

**Минусы:**
- Breaking internal API (все callsites переписаны в 8 этапах)
- Pipelines (briefing, podcast, meeting) пока на старом контракте — будут обновлены в отдельном ТЗ
- localStorage debug data wipe при schema mismatch (v1 → v2)

## Альтернативы

1. **Точечная правка tokenlens:** Патчить формулу в forked tokenlens. Отклонено — добавляет зависимость от внешней библиотеки для core billing logic.

2. **Продолжать субтракцию:** `freshInput = total - cache_read - cache_write`. Отклонено — хрупко при edge cases (SDK quirks, missing fields, rounding).

3. **Server-only расчёт (без client-side SSOT):** Расчёт только на сервере, клиент показывает raw. Отклонено — DevPanel и popover нуждаются в per-component breakdown на клиенте.

## Валидация

| Тип | Модель | Вызовов | DB costUsd | Расчёт Anthropic | Δ% |
|-----|--------|---------|------------|-------------------|----|
| chat | Haiku 4.5 | 7 | $0.0453 | $0.0454 | 0.16% |
| expertise | Sonnet 4.6 | 3 | $0.0521 | $0.0521 | 0.06% |
| create | Sonnet 4.6 | 2 | $0.0418 | $0.0416 | 0.40% |
