# ТЗ-OpenRouterCostTracking (Follow-up из TZ_UnfreezePipelines session, 2026-04-13)

**Импакт:** medium · **Оценка:** 0.5–1 сессия · **Создано:** 2026-04-13

## Симптом

DevPanel показывает `Cost: ₽0.00` для моделей, подключённых через OpenRouter (например `qwen/qwen3.6-plus`, `z-ai/glm-4.6v`, `z-ai/glm-5v-turbo`), несмотря на корректно учтённые токены.

**Пример (из реальной сессии 2026-04-13):**
- Модель: `qwen/qwen3.6-plus` (override через DevPanel switchboard)
- Input (fresh): 13 788 · Output: 663 · Reasoning: 556 · Total: 15 007
- **Cost: ₽0.00** (ожидаемо: ~0.69 ₽ при pricing `$0.325/$1.95` per 1M, курсе ~100 ₽/$)

Баг обнаружен при первом же UI-тесте qwen через `/dev/models` override. Модели, подключённые **напрямую** от провайдера (Anthropic, MiniMax, xAI), cost показывают корректно — бага у них нет.

**Контекст:** OpenRouter-модели никогда раньше не тестировались в UI. Это pre-existing bug, не регрессия ТЗ-CacheAudit / ТЗ-UnfreezePipelines — код cost-расчёта не менялся.

## Что проверено

- ✅ `lib/ai/model-catalog.ts` — **entry есть**: `qwen/qwen3.6-plus` с `pricing: { input: 0.325, output: 1.95, cachedInput: 0, cacheWrite: 0 }`
- ✅ `calculateCostRub(modelId, usage)` — математика корректна для этих чисел. При ручном прогоне: `(13788/1000 * 0.0325) + (1219/1000 * 0.195) ≈ 0.69 ₽`. Значит проблема **не в формуле**
- ✅ Токены доходят до DevPanel правильно → `extractUsageForPricing()` возвращает валидный `noCacheInputTokens`. Проблема **не в usage extraction**
- ✅ Catalog lookup `getModelEntry("qwen/qwen3.6-plus")` должен находить запись (ключ совпадает с `entry.id`)

## Гипотезы root cause (для расследования в ТЗ)

### Гипотеза 1 — modelId mismatch на уровне `response.modelId` (наиболее вероятная)

В [app/(chat)/api/chat/route.ts:1061](app/(chat)/api/chat/route.ts#L1061):

```ts
const stepModelId = response?.modelId || "unknown";
// ...
stepCostRub: calcStepCostRub(stepModelId, stepUsage),
```

AI SDK v6 при работе через `createProviderRegistry` возвращает в `response.modelId` строку, которая у **провайдеров с namespace** может иметь префикс (`"openrouter:qwen/qwen3.6-plus"`, `"openrouter/qwen/qwen3.6-plus"`), а не голый `"qwen/qwen3.6-plus"`. Catalog ключи — голые. Lookup по такому ключу возвращает `undefined` → `calculateCostRub()` возвращает 0.

У Anthropic и MiniMax этого не видно потому что их `modelId` уже совпадает с catalog ключами (`claude-haiku-4-5-20251001`, `MiniMax-M2.7`) — но это случайность namespace'ов, а не гарантия архитектуры.

**Проверка:** `console.log(response?.modelId)` при запросе к qwen через OpenRouter — увидеть фактический формат строки.

### Гипотеза 2 — OpenRouter провайдер не эмитит `inputTokenDetails`

Qwen/GLM через OpenRouter может возвращать usage в базовом формате (`inputTokens` + `outputTokens` без разбивки по cache). Тогда `extractUsageForPricing()` идёт через fallback `(usage.inputTokens ?? 0) - cacheReadTokens - cacheWriteTokens`. Это должно работать, но стоит проверить что `inputTokens` действительно приходит non-zero (в скриншоте показано 13 788 — похоже что да).

**Менее вероятно** — UI показывает правильные токены, значит usage extraction работает.

### Гипотеза 3 — aliasOf не резолвится в `getModelEntry`

Если у qwen в каталоге `aliasOf` прописан, `getModelEntry()` вернёт сам entry, а `resolveModelEntry()` — целевой. Но `providers.ts:getPricingRubPer1K` использует `getModelEntry()` напрямую, не `resolveModelEntry()`. Если в каталоге качественная модель за алиасом — pricing не найдётся.

**Проверка:** просмотреть есть ли `aliasOf` в OpenRouter entries (в данный момент — по grep'у не видно, но надо проверить всю цепочку модельных ID).

## Что нужно сделать в ТЗ

### Этап 1 — Диагностика (30 минут)

1. Добавить `console.log("[cost-debug]", { rawModelId: response?.modelId, lookupResult: getModelEntry(response?.modelId) })` временно в `chat/route.ts` onStepFinish
2. Сделать 1 запрос через qwen/qwen3.6-plus через `/dev/models` override
3. Посмотреть в консоли сервера реальный формат `modelId` → подтвердить или опровергнуть Гипотезу 1
4. Убрать `console.log`

### Этап 2 — Кардинальное решение

**Вариант A — нормализация на входе в `calcStepCostRub`** (простой)

В `lib/ai/tokenlens-catalog.ts` / `providers.ts` добавить helper `normalizeModelIdForCatalog(rawId)`, который:
- Убирает провайдер-префикс (`openrouter:`, `openrouter/`, `anthropic:`, и т.д.)
- Возвращает голый catalog-ключ
- Используется во всех call-sites перед `getModelEntry()`

Проблема варианта: полагается на список известных префиксов → хрупко при добавлении новых провайдеров.

**Вариант B — catalog lookup по `entry.modelId` дополнительно к `entry.id`** (архитектурный)

`lib/ai/model-catalog.ts` строит сейчас `CATALOG: Record<string, ModelEntry>` только по `entry.id`. Добавить второй индекс `CATALOG_BY_MODEL_ID` по `entry.modelId` + fallback-поиск `getModelEntry(id)` → если не найдено по id, искать по modelId.

Это устраняет необходимость знать про префиксы. `getModelEntry()` становится устойчивым к разным вариантам input ID.

**Вариант C — SSOT резолв через `resolveModelEntry()`** (правильный)

В `providers.ts:getPricingRubPer1K` заменить `getModelEntry(modelId)` на **новый** helper `findModelEntryByAnyId(modelId)`, который:
1. Проверяет точное совпадение с `entry.id`
2. Проверяет точное совпадение с `entry.modelId`
3. Пробует strip известные префиксы и повторяет 1+2
4. Возвращает первый match, null если все неудача

Плюс: инкапсулирует всю логику в одной точке, call-sites не знают про namespace issue.

**Моя рекомендация (sr dev, до расследования):** Вариант B+C гибрид. Диагностика этапа 1 покажет сразу ли нам хватит варианта B (двойной индекс по id + modelId), или нужно реально парсить префиксы. Гипотеза 1 слишком вероятна — нужно сначала увидеть реальный формат.

### Этап 3 — Валидация

1. Запрос к qwen через DevPanel override → Cost показывает non-zero RUB
2. Запрос к z-ai/glm-4.6v → Cost non-zero
3. Запрос к z-ai/glm-5.1-air (text) → Cost non-zero
4. Запрос к z-ai/glm-5v-turbo (vision) → Cost non-zero
5. Запрос к Claude Haiku (контроль — не должен сломаться) → Cost non-zero
6. Запрос к MiniMax M2.7 (контроль) → Cost non-zero
7. SQL: `SELECT modelId, "costRub", "costUsd" FROM ai_usage_log WHERE "createdAt" > NOW() - INTERVAL '10 minutes'` — все строки имеют non-zero cost для OpenRouter моделей

## Definition of Done

- ✅ DevPanel показывает корректный cost в рублях для всех OpenRouter-моделей из каталога
- ✅ `ai_usage_log.costRub` и `costUsd` non-zero для OpenRouter usage
- ✅ `/admin/cost-audit` дашборд показывает OpenRouter-затраты вместо дыры
- ✅ Контрольный тест Anthropic/MiniMax не сломан (регрессии нет)
- ✅ Helper (или изменение `getModelEntry`) задокументирован — чтобы при добавлении новых провайдеров (Groq, Mistral direct, и т.д.) не наступить на те же грабли

## Связанные ТЗ / контекст

- **TZ_CachePipelineMetrics** (следующий основной) — fix observability в pipelines. **Не пересекается** с этим ТЗ: pipelines используют прямые провайдеры (Anthropic/MiniMax), а эта проблема специфична для OpenRouter namespace. Два ТЗ можно делать параллельно или последовательно в любом порядке
- **ТЗ-1 CoreRegistry (v3.83.0)** — ввёл `getModel(taskId)` + catalog по `entry.id`. Вопрос «что если два entry смотрят на одну модель под разными id» не обсуждался — вылез только сейчас при первом реальном тесте OpenRouter
- **ТЗ-2 DevSwitchboard (v3.84.0)** — `/dev/models` позволил override на OpenRouter, что и обнажило проблему. Без DevSwitchboard этот баг нашли бы только в production на реальной OpenRouter сессии

## Риски

- **Двойной индекс catalog** (Вариант B) требует валидации уникальности `entry.modelId` среди всех entries. Если у двух разных каталог-entries одинаковый `modelId` (например, text и vision tier одной модели) — lookup по modelId становится неоднозначным. Нужно проверить в ANALYSIS.md этого ТЗ
- **Нормализация префиксов** (Вариант A) — белый список префиксов нужно поддерживать. Всегда есть риск пропустить новый провайдер

## Не в scope

- Tiered pricing для qwen (>256K input — цена 4×). Сейчас catalog хранит только base tier, отмечено в `notes` самого entry. Отдельный долг
- OpenRouter dynamic pricing через API (`openrouter.ai/api/v1/models`) — не нужно, catalog сейчас static SSOT
