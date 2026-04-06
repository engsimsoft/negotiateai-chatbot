# Анализ ТЗ-BILLING2: Pipeline Cost Coverage

## Резюме

Закрыть 2 дыры: briefing:filter (Gemini) — NULL costUsd, research-engine (Perplexity) — отсутствие logUsage. Верифицировать остальные 5 стадий.

## Рекомендации разработчика (Код-ревью)

### ✅ Согласен с ТЗ
- P1 (briefing:filter NULL costUsd) — реальный баг, подтверждён SQL (3 записи с NULL)
- P2 (research-engine не логирует) — подтверждён кодом

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование |
|---|-----------|--------------|-------------|
| 1 | Дебажить `calcCostUsd` для Gemini | **Использовать `costUsdOverride` для всех Gemini-моделей** — вычислять стоимость inline из `MODEL_PRICING_RUB` и передавать явно | calcCostUsd → extractUsageForPricing опирается на `inputTokenDetails` (Anthropic-specific). Google SDK может не возвращать это поле в том же формате. `costUsdOverride` — надёжный путь, уже проверенный для TTS и Deepgram |
| 2 | P2: добавить `logUsage` в research-engine | **Да, но userId нужно пробросить** — сейчас `researchSingleTopic()` не получает userId | `research-engine.ts` вызывается из briefing-pipeline с userId — нужно пробросить до callPerplexity |

## Детальный анализ

### P1: briefing:filter — NULL costUsd

**Записи в БД (SQL verified):**
```
briefing:filter | gemini-2.0-flash | input=11375 | output=3534 | costUsd=NULL
briefing:filter | gemini-2.0-flash | input=4494  | output=2001 | costUsd=NULL
briefing:filter | gemini-2.0-flash | input=4277  | output=2768 | costUsd=NULL
```

Токены логируются корректно (extractUsageFields работает). Cost = NULL → `calcCostUsd` возвращает null.

**Root cause:** Google @ai-sdk/google может возвращать usage object с отличающейся структурой `inputTokenDetails` от @ai-sdk/anthropic. `extractUsageForPricing` ожидает `inputTokenDetails.noCacheTokens` — для Google это поле может быть undefined или 0, что ведёт к `noCacheInputTokens = 0` через fallback, и `calculateCostRub` возвращает 0.

**Fix:** Вычислять cost inline, не через `calcCostUsd`:
```typescript
const pricingUsage = extractUsageForPricing(usage);
// Для Gemini без кэша: если noCacheInputTokens=0 но inputTokens>0 — подставить inputTokens
if (pricingUsage.noCacheInputTokens === 0 && (usage.inputTokens ?? 0) > 0) {
  pricingUsage.noCacheInputTokens = usage.inputTokens ?? 0;
}
const costRub = calculateCostRub(FILTER_MODEL, pricingUsage);
const costUsd = costRub > 0 ? Math.round((costRub / RUB_PER_USD) * 1e6) / 1e6 : null;
logUsage({ ..., costUsdOverride: costUsd });
```

Или проще: **починить `extractUsageForPricing`** чтобы fallback работал корректно для любого провайдера.

### P2: research-engine — Perplexity не логируется

**Код:** `research-engine.ts:229` — `callPerplexity()` возвращает usage, строится `AiCallTrace`, но `logUsage()` **не вызывается**.

**Fix:** Пробросить `userId` в `researchSingleTopic()` → после `callPerplexity()` вызвать `logUsage()`.

### Верификация остальных стадий

| Стадия | Статус | Комментарий |
|--------|--------|-------------|
| briefing:author (Claude) | ✅ OK | costUsd=$0.102 — корректно |
| briefing:section-author (Claude) | ✅ OK | costUsd=$0.054 — корректно |
| podcast:script (Gemini 2.5 Flash) | ⚠️ Нужна проверка | logUsage есть, но может быть тот же баг с extractUsageForPricing |
| podcast:tts (Gemini TTS) | ✅ OK | costUsdOverride (char-based) — работает |

## Оценка сложности

- [x] Простое (1 сессия)
