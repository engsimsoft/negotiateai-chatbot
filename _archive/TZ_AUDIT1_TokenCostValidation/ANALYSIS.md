# Анализ ТЗ-AUDIT1: Валидация токенов и стоимости

**Дата:** 2026-04-05

---

## Резюме

Задача: сквозная проверка "приложение → консоль провайдера" для всех типов AI-вызовов.
Два артефакта: **таблица расхождений** + **исправления** (если найдены).

---

## Архитектура системы учёта стоимости

### Уровни расчёта

```
AI SDK (usage object)
  ↓
extractUsageFields()  — lib/ai/usage-utils.ts
  ↓
calcCostUsd()         — lib/ai/tokenlens-catalog.ts
  │  ├─ 1. TokenLens API (live prices, 24h cache)
  │  └─ 2. MODEL_PRICING_RUB fallback (lib/ai/providers.ts)
  ↓
saveAiUsageLog()      — lib/db/queries.ts → ai_usage_log table (costUsd)
  ↓
Cost Audit Dashboard  — /admin/cost-audit (costUsd → ×RUB_PER_USD → показывает ₽)
```

### Dev Panel (отдельная цепочка)
```
AI SDK debug events → DebugStepData (stepCostRub server-calculated)
  ↓
calcStepCostRub()    — lib/ai/tokenlens-catalog.ts (TokenLens → fallback)
  ↓
dev-panel-footer.tsx — показывает сумму stepCostRub по шагам
```

### Ключевые константы (2026-04-05)
- `RUB_PER_USD = 100` (lib/constants/pricing.ts)
- Claude Sonnet 4.6: input $3/1M → 0.30 ₽/1K, output $15/1M → 1.50 ₽/1K, cached $0.30/1M → 0.030 ₽/1K
- Claude Haiku: input $1/1M → 0.10 ₽/1K, output $5/1M → 0.50 ₽/1K
- Claude Opus 4.6: input $5/1M → 0.50 ₽/1K, output $25/1M → 2.50 ₽/1K

---

## Потенциальные проблемы (выявлены до тестирования)

### ⚠️ 1. Cache write tokens — не участвуют в стоимости
В `calculateCostRub()` (providers.ts:119) только:
- `inputTokens - cachedInputTokens` (fresh input)
- `outputTokens`
- `cachedInputTokens` (cache read)

**Cache write (cacheWriteTokens)** — отдельная категория billing у Anthropic (25% надбавка к input price). Если не учитывается → стоимость занижена при первом запросе с cache.

### ⚠️ 2. Reasoning tokens у Opus
Opus 4.6 может иметь reasoning tokens (outputTokenDetails.reasoningTokens). В `calculateCostRub()` они добавляются к outputTokens в `getStepCostRub()` (providers.ts:137) — нужно проверить что в `extractUsageFields` они правильно извлекаются и логируются.

### ⚠️ 3. TokenLens vs hardcoded — какой источник реально используется?
Есть два пути расчёта стоимости для Dev Panel и для DB:
- Dev Panel: `calcStepCostRub()` → TokenLens (если доступен) или hardcoded
- DB: `calcCostUsd()` → TokenLens (если доступен) или hardcoded → конвертация через `RUB_PER_USD`

Если TokenLens недоступен (API error) → silently fallback. Нужно проверить что fallback даёт правильные цифры.

### ⚠️ 4. Не все сервисы пишут в UsageLog
Проверить каждый сервис: briefing pipeline, podcast pipeline, meeting pipeline — используют ли `logUsage()`?

---

## Вопросы для уточнения

*Нет блокирующих вопросов. Можно начинать с Шага 1.*

---

## Оценка сложности

- [x] Простое (1-3 сессии: тестирование + потенциальные фиксы)

---

## Зависимости

- Dev mode должен быть включён: `SIMPLY_DEV_MODE=true` в `.env.local`
- Доступ к Anthropic Console для сравнения
- Тестовые запросы в каждый тип чата
