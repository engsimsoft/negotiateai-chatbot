# Анализ ТЗ-CACHE3: Единый SSOT отображения стоимости

**Дата:** 2026-03-03
**Сессия:** 1

---

## Резюме

ТЗ предлагает унифицировать три независимые системы расчёта стоимости в одну. Спек компактный и чёткий. После глубокого аудита кодовой базы — есть одно критическое расхождение с реальным состоянием кода и несколько уточнений.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Часть 1 (Shared constant)** — ОК. `RUB_PER_USD = 100` сейчас в `providers.ts:66`, вынести в `lib/constants/pricing.ts` — чистое решение. Импорт в `tokenlens-catalog.ts:58` уже существует, просто сменит source.
- **Часть 3 (Context → RUB)** — ОК. `context.tsx` чётко показывает USD (`$0.003420` с 6 знаками). Переход на `₽0.34` технически прост: `parseFloat(costText) * RUB_PER_USD` → `toFixed(2)`.
- **Часть 4 (P5: TimelineSection reasoning)** — ОК. Строка 55 `timeline-section.tsx`: `step.inputTokens + step.outputTokens`. Нужно добавить `+ (step.reasoningTokens ?? 0)`.
- **Часть 4 (P2/P6: Fallback маркер ~)** — ОК. Паттерн идентичен в `dev-panel-footer.tsx:68-72` и `tokens-section.tsx:16-21`. Добавить тильду при `steps.length === 0`.
- **Решение не трогать БД и `saveAiUsageLog()`** — ОК, правильное решение.
- **Решение оставить `calculateCostRub()` как fallback** — ОК, уже реализовано в `calcStepCostRub()`.

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | «Обновить `buildAiCallTrace()` — использует `calcStepCostRub()` вместо `calculateCostRub()`» | **`buildAiCallTrace()` экспортируется, но НЕ вызывается нигде.** Все pipeline-файлы строят `AiCallTrace` объекты inline. Нужно обновить и `buildAiCallTrace()`, и все inline-сайты (4 файла). | `buildAiCallTrace()` определена в `pipeline-trace.ts:249`, экспортируется, но grep по `buildAiCallTrace(` показывает 0 вызовов за пределами определения. Inline trace creation: `briefing-author.ts`, `briefing-section-author.ts`, `briefing-filter.ts`, `script-generator.ts` — все вызывают `calculateCostRub()` напрямую. |
| 2 | «Все вызовы `new TraceCollector()` — передать `await getTokenlensCatalog()`» + список из 3 точек | **Список точек верный (3 штуки), но catalog нужно пробросить ГЛУБЖЕ — в каждую функцию стадии pipeline.** TraceCollector хранит stages, но cost считается не в нём, а в каждой pipeline-функции при создании inline AiCallTrace. | `briefing-pipeline.ts:51` создаёт TraceCollector, но `briefing-author.ts`, `briefing-filter.ts` — отдельные функции, которые возвращают trace-данные. Catalog нужно передать именно туда. |
| 3 | «Убедиться что `calculateTtsCostRub()` использует общий `RUB_PER_USD`» | **`calculateTtsCostRub()` НЕ использует `RUB_PER_USD` вообще.** Это duration-based расчёт: `durationSeconds * 0.006`. TokenLens тоже не поможет — TTS не считается по токенам. Можно вынести `TTS_COST_RUB_PER_SECOND` в `pricing.ts` для консистентности, но `RUB_PER_USD` здесь не участвует. | `providers.ts:149`: `const TTS_COST_RUB_PER_SECOND = 0.006;` — это ₽/сек, уже в рублях, не конвертируется из USD. |

### ❓ Требует уточнения → РЕШЕНО

**Q1: Scope inline trace sites** → **Точечная замена.** `calculateCostRub()` → `calcStepCostRub()` в 4+1 файлах. Рефакторинг на `buildAiCallTrace()` — отдельная задача.

**Q2: `buildTtsTrace()`** → **Не трогаем.** TTS billing по секундам, TokenLens не покрывает.

**Q3: `research-engine.ts` (Perplexity)** → **В scope.** Заменить `calculateCostRub()` → `calcStepCostRub()` по тому же паттерну. Итого: 5 inline-сайтов.

**Q4: Context dropdown** → **Всё в рублях.** Per-category breakdown и total — единая валюта везде.

---

## Потенциальные риски

1. **Пробрасывание catalog через pipeline** — catalog нужно передать из route.ts → pipeline function → каждую stage function (author, filter, script). Цепочка: 3-4 уровня вложенности. Риск: забыть одно звено → silent fallback к hardcoded (не ошибка, но не SSOT).

2. **Perplexity модели в TokenLens** — `sonar-pro` может отсутствовать в TokenLens catalog. Fallback к hardcoded сработает, но нужно убедиться что модель есть в `MODEL_PRICING_RUB`.

3. **TTS `buildTtsTrace` не участвует** — cost pipeline traces будут частично на TokenLens (AI stages), частично hardcoded (TTS). Это ожидаемо, но стоит задокументировать.

---

## Зависимости

- **Нет внешних зависимостей** — всё в рамках существующих пакетов
- **TokenLens уже интегрирован** — `getTokenlensCatalog()` уже вызывается в 3 route.ts файлах
- **`calcStepCostRub()` уже готова** — принимает `catalog?: ModelCatalog`, fallback к hardcoded

---

## Затронутые файлы (полный список из кода)

### Изменяемые
| Файл | Что менять |
|------|-----------|
| `lib/constants/pricing.ts` | **НОВЫЙ** — `RUB_PER_USD = 100` |
| `lib/ai/providers.ts` | Убрать локальный `RUB_PER_USD`, импортировать из `constants/pricing` |
| `lib/ai/tokenlens-catalog.ts` | Сменить импорт `RUB_PER_USD` на `constants/pricing` |
| `lib/ai/pipeline-trace.ts` | `buildAiCallTrace()` + `TraceCollector` — добавить `catalog` |
| `lib/briefing/briefing-pipeline.ts` | Fetch catalog, передать в stage functions |
| `lib/briefing/briefing-author.ts` | `calculateCostRub()` → `calcStepCostRub(…, catalog)` |
| `lib/briefing/briefing-section-author.ts` | `calculateCostRub()` → `calcStepCostRub(…, catalog)` |
| `lib/briefing/briefing-filter.ts` | `calculateCostRub()` → `calcStepCostRub(…, catalog)` |
| `lib/briefing/research-engine.ts` | `calculateCostRub()` → `calcStepCostRub(…, catalog)` (Perplexity) |
| `lib/podcast/podcast-pipeline.ts` | Fetch catalog, передать в stage functions |
| `lib/podcast/script-generator.ts` | `calculateCostRub()` → `calcStepCostRub(…, catalog)` |
| `app/(chat)/api/briefing/refresh-section/route.ts` | Fetch catalog, передать в TraceCollector + stage functions |
| `components/elements/context.tsx` | USD → RUB conversion + format |
| `components/dev-panel/sections/timeline-section.tsx` | + reasoning tokens |
| `components/dev-panel/sections/tokens-section.tsx` | + fallback marker `~` |
| `components/dev-panel/dev-panel-footer.tsx` | + fallback marker `~` |

### Не изменяемые (подтверждение из кода)
- `lib/db/schema.ts` — `costUsd` остаётся
- `lib/ai/usage-utils.ts` — `logUsage()` без изменений
- `data-debug-step` events — уже содержат `stepCostRub`

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

Основная работа — пробрасывание `catalog` через pipeline functions (механическая, но аккуратная). UI-изменения тривиальны.
