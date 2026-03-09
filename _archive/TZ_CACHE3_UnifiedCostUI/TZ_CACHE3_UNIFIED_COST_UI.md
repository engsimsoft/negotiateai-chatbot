# ТЗ-CACHE3: Единый SSOT отображения стоимости

**Дата:** 2026-03-03  
**Цель:** Одна система расчёта, одна валюта, одна правда — убрать расхождения между тремя параллельными цепочками

---

## Контекст

Аудит выявил 3 независимые системы расчёта стоимости:

1. **Chat DevPanel** — TokenLens SSOT (live цены) → RUB
2. **Pipeline Trace** — hardcoded `MODEL_PRICING_RUB` → RUB  
3. **Production Context dropdown** — TokenLens → USD

Проблемы: один и тот же вызов Claude показывает разную стоимость в DevPanel и Pipeline Trace. Пользователь видит USD, разработчик RUB. Нет единого источника правды.

---

## Решения

### Решение 1: Единая валюта — RUB

**SSOT валюта для UI = рубли.** Аудитория 40-60+, российский бизнес. Доллары в интерфейсе — лишний когнитивный барьер.

- **БД (`ai_usage_log.costUsd`)** — оставить USD. Это точное значение от API, основа для будущего биллинга. Не трогать.
- **Весь UI** — показывать RUB. Конверсия через `RUB_PER_USD` (сейчас = 100).
- `RUB_PER_USD` — оставить hardcoded 100 сейчас. Когда понадобится динамический курс — это отдельная задача. Для внутренней аналитики погрешность ±10% допустима.

### Решение 2: Pipeline Trace → TokenLens

Перевести `buildAiCallTrace()` на TokenLens вместо hardcoded `calculateCostRub()`.

**Сейчас:**
```
buildAiCallTrace(result) → calculateCostRub(modelId, usage)  // hardcoded MODEL_PRICING_RUB
```

**Станет:**
```
buildAiCallTrace(result, catalog?) → calcStepCostRub(modelId, usage, catalog)  // TokenLens SSOT → fallback hardcoded
```

`TraceCollector` уже создаётся в pipeline-фукнциях. Добавить опциональный `catalog?: ModelCatalog` в конструктор или в `startStage()` / `completeAiCall()`. Каталог получать через `getTokenlensCatalog()` один раз при старте pipeline.

**Важно:** `calculateCostRub()` и `MODEL_PRICING_RUB` НЕ удалять — они остаются как fallback когда TokenLens catalog недоступен. Это уже реализовано в `calcStepCostRub()`.

### Решение 3: Context dropdown → RUB

**Сейчас:** Context dropdown (файл `context.tsx`) показывает TokenLens `costUSD` per category (input, output, cached) в долларах.

**Станет:** Конвертировать в RUB перед отображением. Формат: `₽0.34` вместо `$0.003420`.

Реализация — на клиенте: `costUSD.totalUSD * RUB_PER_USD`. Экспортировать `RUB_PER_USD` из `lib/ai/providers.ts` (или создать shared constant доступный и на сервере и на клиенте).

**Клиентская константа:** Создать `lib/constants/pricing.ts`:
```typescript
export const RUB_PER_USD = 100;
```
Импортировать и в `providers.ts` (сервер) и в `context.tsx` (клиент). Один источник правды для курса.

---

## Что сделать

### Часть 1 — Shared pricing constant

| Действие | Файл |
|----------|------|
| Создать | `lib/constants/pricing.ts` — `export const RUB_PER_USD = 100` |
| Обновить | `lib/ai/providers.ts` — импортировать `RUB_PER_USD` из нового файла вместо локальной константы |
| Убедиться | Что `calcStepCostRub()`, `calculateCostRub()`, `calculateTtsCostRub()` используют общий `RUB_PER_USD` |

### Часть 2 — Pipeline Trace → TokenLens

| Действие | Файл |
|----------|------|
| Обновить | `lib/ai/pipeline-trace.ts` — `buildAiCallTrace()` принимает опциональный `catalog?: ModelCatalog`, использует `calcStepCostRub()` вместо `calculateCostRub()` |
| Обновить | `lib/ai/pipeline-trace.ts` — `TraceCollector` принимает `catalog` в конструкторе, передаёт в `buildAiCallTrace()` |
| Обновить | Все вызовы `new TraceCollector()` — передать `await getTokenlensCatalog()` |

Точки вызова `TraceCollector` (проверить актуальный список в коде):
- `app/(chat)/api/briefing/generate/route.ts`
- `app/(chat)/api/briefing/refresh-section/route.ts`
- `lib/podcast/podcast-pipeline.ts` (или аналогичный)

### Часть 3 — Context dropdown → RUB

| Действие | Файл |
|----------|------|
| Обновить | `context.tsx` (или аналогичный компонент Context dropdown) — отображать `costUSD * RUB_PER_USD` с префиксом `₽` вместо `$` |
| Формат | `₽0.34` — без лишних знаков после запятой. Для значений < ₽0.01 показывать `< ₽0.01` |

### Часть 4 — Мелкие исправления

| Проблема | Файл | Исправление |
|----------|------|-------------|
| P5: TimelineSection не включает reasoning | `timeline-section.tsx` | Добавить `+ (step.reasoningTokens ?? 0)` к сумме токенов |
| P2/P6: estimatedCostRub fallback misleading | `tokens-section.tsx`, `dev-panel-footer.tsx` | Добавить визуальный маркер `~` (тильда) когда используется fallback вместо per-step sum. Показывать `~₽0.34` вместо `₽0.34` |

---

## НЕ менять

- **Схему БД** — `costUsd` остаётся в USD (точность для биллинга)
- **`saveAiUsageLog()`** — уже работает после CACHE2
- **`calcStepCostRub()`** — уже корректная, TokenLens → fallback hardcoded
- **`data-debug-step` events** — уже содержат `stepCostRub` от сервера
- **DevPanel Footer/Drawer** — только мелкие фиксы (P5, P6), архитектура не меняется
- **`RUB_PER_USD = 100`** — динамический курс = отдельная задача

---

## Проверка после реализации

1. **Pipeline Trace vs DevPanel** — сгенерировать брифинг в dev mode, сравнить стоимость briefing:author в Pipeline Trace Footer с аналогичным вызовом Sonnet в DevPanel Footer. Должны совпадать (или расходиться только на сумму TTS, не на модели).

2. **Context dropdown** — отправить сообщение в чате, открыть Context dropdown. Должно показывать `₽X.XX` вместо `$0.00XXXX`.

3. **TimelineSection** — отправить сообщение с briefing-onboarding (thinking enabled), открыть DevPanel Drawer → Timeline. Токены per step должны включать reasoning.

4. **Fallback маркер** — если steps=0 (редкий случай in-flight), стоимость в Footer должна показывать `~₽X.XX`.

---

## Результат

После CACHE3 в Simply останется **одна система расчёта стоимости**:

```
TokenLens catalog (SSOT, live цены)
    → calcStepCostRub() [fallback → MODEL_PRICING_RUB]
        → DevPanel (Chat)        ₽
        → Pipeline Trace          ₽  
        → Context dropdown        ₽
        → ai_usage_log            $ (backend, для биллинга)
```

Три параллельные цепочки → одна. Две валюты в UI → одна (₽).
