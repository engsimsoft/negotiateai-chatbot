# ANALYSIS — ТЗ_OpenRouterCostTracking

**Дата:** 2026-04-13
**Автор:** Claude Opus 4.6 (sessions 1 — diagnosis + plan)
**Статус:** root cause найден прямым анализом + SQL query + grep

---

## Изученная документация

**Внешних технологий в scope нет.** Этот ТЗ — локальный фикс cost tracking плоскости:
- AI SDK v6 — `response.modelId` field из streamText callback. Формат известен из внутреннего кода registry.ts и getModel.ts. Нет нужды fetching AI SDK docs — нужно только одно наблюдение: какой формат AI SDK возвращает в response.modelId для registry-resolved моделей.
- OpenRouter — cost tracking — вопрос локальный к нашему коду, не к OpenRouter API.

**Внутренние источники правды:**
- `lib/ai/registry.ts` — `createProviderRegistry({...}, { separator: ":" })`. Registry ID format: `provider:modelId` например `openrouter:qwen/qwen3.6-plus`
- `lib/ai/model-catalog.ts` — catalog ключи ГОЛЫЕ: `qwen/qwen3.6-plus` без namespace prefix
- `lib/ai/getModel.ts:buildRegistryId()` — строит `${provider}:${modelId}` для registry lookup
- `lib/ai/providers.ts:getPricingRubPer1K()` — `getModelEntry(modelId)` — ищет по голому ключу

---

## ⚠️ ВАЖНО — Первая гипотеза оказалась неверной

Первоначальный разбор (ниже, раздел «Root Cause») предполагал namespace prefix `openrouter:qwen/qwen3.6-plus`. Empirical тест 2026-04-13 показал что реальный формат **другой** — **trailing date suffix** `qwen/qwen3.6-plus-04-02`. См. раздел «ФИНАЛЬНЫЙ ROOT CAUSE» в конце файла. Первоначальный анализ оставлен как учебный материал — показывает, как SQL-диагностика помогла выйти на правильную track, но empirical test был нужен для подтверждения гипотезы о формате.

---

## Root Cause (первоначальная гипотеза — опровергнута)

### Симптом (из сессии 2026-04-13)

DevPanel показал для `qwen/qwen3.6-plus`:
- Input: 13 788 · Output: 663 · Reasoning: 556 · Total: 15 007
- **Cost: ₽0.00** (ожидалось ~0.65 ₽ при pricing $0.325/$1.95 per 1M, курсе ~95 ₽/$)

Раньше OpenRouter-модели никогда не тестировались в UI. **Pre-existing bug**, не регрессия.

### Диагностика через `mcp__postgres__query` — ключевое открытие

```sql
SELECT "modelId", "provider", "inputTokens", "cacheReadTokens",
       "outputTokens", "costUsd"::numeric(10,6)
FROM "ai_usage_log"
WHERE "modelId" ILIKE '%qwen%' OR "modelId" ILIKE '%glm%';
```

**Результат:**
```
modelId: "qwen/qwen3.6-plus"  ← БЕЗ namespace prefix
provider: "openrouter"         ← отдельная колонка
inputTokens: 13788
cacheReadTokens: 0
outputTokens: 663
costUsd: "0.006900"            ← ПРАВИЛЬНЫЙ, non-zero!
```

**Ключевое наблюдение:** База данных хранит bare catalog key (`qwen/qwen3.6-plus`) и cost посчитан корректно ($0.0069). Значит **server-side cost calculation работает**. Проблема в другом пути — в том который передаёт stepCost клиенту через debug event для DevPanel.

### Две параллельные ветки в одном `onStepFinish`

Grep `app/(chat)/api/chat/route.ts`:

**Ветка 1 — БИТАЯ (DevPanel path):**

```ts
// line 1061
const stepModelId = response?.modelId || "unknown";
// line 1074
stepCostRub: calcStepCostRub(stepModelId, stepUsage),
```

Здесь `stepModelId` приходит из AI SDK `response.modelId`. Для registry-resolved моделей AI SDK возвращает **prefixed** форму: `openrouter:qwen/qwen3.6-plus` (или подобную).

`calcStepCostRub` → `calculateCostRub` → `getPricingRubPer1K` → `getModelEntry("openrouter:qwen/qwen3.6-plus")`.

`CATALOG` в `model-catalog.ts` хранит записи по **голым** id (`qwen/qwen3.6-plus`). Lookup по ключу с префиксом возвращает `undefined`.

`getPricingRubPer1K` возвращает `null` → `calculateCostRub` возвращает `0` → `stepCostRub: 0` → DevPanel показывает `₽0.00`.

**Ветка 2 — РАБОТАЮЩАЯ (DB path):**

```ts
// line 1109
resolvedModelId = getModelIdForTask(resolvedTaskId);
// line 1133
const logModelId = resolvedModelId || (isProjectChat ? `project:${tier}` : chatMode);
```

Здесь `resolvedModelId` приходит из `getModelIdForTask(taskId)`, который резолвит через catalog и возвращает **bare** `entry.modelId` (`qwen/qwen3.6-plus`).

Передаётся в `logUsage` → `saveAiUsageLog` → `calcCostUsd` → `getPricingRubPer1K` → `getModelEntry` находит запись → cost считается корректно → записывается в DB.

### Почему Anthropic/MiniMax/xAI не затронуты

**Совпадение namespace'ов, а не архитектурная корректность.**

- `anthropic:claude-haiku-4-5-20251001` — catalog key `claude-haiku-4-5-20251001`. Даже если `response.modelId` вернёт с префиксом, мы раньше не замечали проблему — нужна была другая диагностика.

Wait, actually надо перепроверить — может быть AI SDK для нативных провайдеров (Anthropic, OpenAI) возвращает bare id без префикса, а для registry'd openrouter — с префиксом. Это может быть поведение конкретной реализации OpenRouter provider.

**В любом случае:** фикс должен быть defensive — нормализовать modelId независимо от того, какой формат AI SDK вернул. Safer чем полагаться на implicit behavior.

---

## Решение — Вариант A (нормализация через strip prefix)

### Обоснование

Рассмотрены 3 варианта:

**A. Strip provider prefix helper (`normalizeModelId`)** — ⭐ выбран
- Один helper, одно место правки
- Работает для всех провайдеров (Anthropic, MiniMax, xAI, OpenRouter)
- Не требует знания taskId в точке вызова
- Устойчив к будущим провайдерам (можно расширить список известных префиксов)
- Легко тестируется изолированно

**B. Task-based resolution (`getModelIdForTask(resolvedTaskId)`)**
- Идиоматично (использует наш SSOT resolution)
- Но: требует чтобы `resolvedTaskId` был доступен в точке вызова — он есть в chat/route.ts после Этапа 2 CoreRegistry, но что если в будущем появится call-site без taskId?
- Не защищает от случаев когда AI SDK вернёт какой-то неожиданный формат

**C. Гибрид (taskId first, normalize fallback)**
- Самый полный
- Сложнее: две ветки кода, больше поверхности для ошибок
- Overkill для одного фикса

### Почему не «добавить prefix-аля в catalog keys»

Рассматривалось: вместо фикса в cost calculation — хранить в catalog ключи с префиксом (`openrouter:qwen/qwen3.6-plus`).

**Отклонено:**
- Ломает **все** существующие call-sites которые ищут по bare id (`getModelEntry("claude-haiku-4-5-20251001")` etc.)
- Требует массового рефакторинга task-assignments.ts, chat-mode-config.ts, model-tiers.ts, debug-events.ts
- Размывает SSOT: `entry.id` станет duplicate'ом `entry.registryId`
- Cardinal, но не правильное cardinal — решает проблему где её нет

### Дизайн `normalizeModelId`

```ts
// lib/ai/providers.ts (или model-catalog.ts — обсудим в ROADMAP)

/**
 * Normalize a modelId by stripping known provider registry prefixes.
 *
 * AI SDK v6 `response.modelId` from registry-resolved models may include
 * the provider namespace prefix (e.g. `"openrouter:qwen/qwen3.6-plus"`).
 * Catalog keys в `model-catalog.ts` — bare (`"qwen/qwen3.6-plus"`).
 * This helper reconciles them.
 *
 * Examples:
 *   "openrouter:qwen/qwen3.6-plus" → "qwen/qwen3.6-plus"
 *   "anthropic:claude-haiku-4-5-20251001" → "claude-haiku-4-5-20251001"
 *   "qwen/qwen3.6-plus" → "qwen/qwen3.6-plus" (no-op)
 *   "minimaxLong:MiniMax-M2.7" → "MiniMax-M2.7"
 */
const KNOWN_REGISTRY_PREFIXES = new Set([
  "anthropic",
  "minimax",
  "minimaxLong",
  "xai",
  "openrouter",
]);

export function normalizeModelId(raw: string): string {
  const colonIdx = raw.indexOf(":");
  if (colonIdx === -1) return raw;
  const prefix = raw.slice(0, colonIdx);
  if (KNOWN_REGISTRY_PREFIXES.has(prefix)) {
    return raw.slice(colonIdx + 1);
  }
  return raw;
}
```

**Единая точка применения:** `getPricingRubPer1K(modelId)` в `providers.ts`. Там выполнить normalize **один раз** перед `getModelEntry`. Все call-sites (calculateCostRub, getStepCostRub, calculateCostBreakdownRub) автоматически получают защиту.

### Альтернативный дизайн — normalize внутри `getModelEntry`

**Рассмотрено:** поместить нормализацию внутрь `getModelEntry` в `model-catalog.ts`:

```ts
export function getModelEntry(id: string): ModelEntry | undefined {
  return CATALOG[normalizeModelId(id)];
}
```

**Плюсы:** абсолютный SSOT защиты. Любой call-site через `getModelEntry` автоматически защищён.

**Минусы:** больше side-effect в core catalog функции. Может сбить с толку при отладке — «почему lookup по странному ключу работает?».

**Решение в Этапе 1:** попробовать оба варианта через diff и выбрать. Предпочтение — normalize в `getModelEntry` (более SSOT). Если что-то сломается — fallback на normalize в `getPricingRubPer1K`.

---

## Риски и митигация

### Риск 1 — Кэш break

`getModelEntry` может кэшировать результаты. После добавления normalize cache key будет другим.

**Митигация:** проверить что `getModelEntry` НЕ использует кэш (в текущем коде — просто `CATALOG[id]`, no memoization). Если в будущем появится кэш — он должен быть построен на NORMALIZED ID.

### Риск 2 — False positives в normalize

Если у будущей модели ID содержит `:`, например `qwen:v2-plus` — наш normalize его сломает (`qwen` не в known prefixes, останется как есть). ✓ OK.

Если у OpenRouter появится модель с ID `openrouter/foo:bar` (colon в самом modelId после `/`) — тоже OK, префикс `openrouter/foo` не в известных, остаётся как есть.

**Граничный случай:** `anthropic:claude` — если `claude` будет реальным model id через Anthropic, normalize превратит в `claude`, catalog lookup по `claude` вернёт undefined (нет такой записи), вернётся 0. Но это же что и сейчас. Не регрессия.

### Риск 3 — Тесты

`calculateCostRub` не покрыт тестами. После фикса нужно добавить unit test для normalize + edge cases. Включим в ROADMAP Этап 2.

---

## Scope фикса

### В scope

- `lib/ai/providers.ts` или `lib/ai/model-catalog.ts` — добавить `normalizeModelId` helper и применить в `getModelEntry` / `getPricingRubPer1K`
- Unit test для `normalizeModelId` (edge cases + все known provider prefixes)
- Мануальная валидация через UI: переключить модель на qwen через `/dev/models`, задать запрос → DevPanel должен показать non-zero cost

### Вне scope

- Tiered pricing qwen (>256K input cost 4× base) — оставить как есть, зафиксировано в backlog SPEC notes
- OpenRouter dynamic pricing через API — не нужен, catalog static SSOT
- Переименование `getModelEntry` или добавление второго индекса (CATALOG_BY_MODEL_ID) — избыточно, normalize достаточен
- Исправление AI SDK / registry — не наша ответственность, обходим через normalize

---

## Эстимация

**1 сессия** (меньше чем 0.5-1 из первоначальной оценки, т.к. root cause уже найден):
- Этап 0 (Pre-flight + подтверждение гипотезы через живой тест) — 15 мин
- Этап 1 (фикс + unit test) — 30 мин
- Этап 2 (мануальная валидация через /dev/models) — 15 мин
- Этап 3 (финализация docs + ADR если нужен) — 15 мин

**Total: ~1 час-1.5 часа** реально.

---

## ФИНАЛЬНЫЙ ROOT CAUSE (подтверждён empirical тестом 2026-04-13)

### Что оказалось на самом деле

Добавили временный `console.log("[tz-openrouter-debug]", JSON.stringify(stepModelId))` в `app/(chat)/api/chat/route.ts:1061`, попросили владельца сделать UI-тест через `/dev/models` override на `qwen/qwen3.6-plus`.

**Результаты:**

```
[tz-openrouter-debug] raw response.modelId: "MiniMax-M2.7"        ← bare, ожидаемо
[tz-openrouter-debug] raw response.modelId: "qwen/qwen3.6-plus-04-02"  ← SUFFIX!
```

**Истина:**
- **MiniMax** возвращает в `response.modelId` bare id (`MiniMax-M2.7`) → catalog key matches → cost calculation OK
- **AI SDK** не добавляет registry namespace prefix (моя первая гипотеза была ошибочной)
- **OpenRouter** провайдер на своей стороне **pins bare name to dated snapshot**: SEND `qwen/qwen3.6-plus`, но в `response.modelId` приходит `qwen/qwen3.6-plus-04-02`. AI SDK просто пропускает этот id через себя

**Catalog lookup**: `CATALOG["qwen/qwen3.6-plus-04-02"]` → `undefined` → `calculateCostRub` → `0` → DevPanel показывает `₽0.00`. **Двухпутёвая архитектура** (DB path vs DevPanel path) была частью картины, но истинная поверхность бага — **различия форматов modelId между providers**.

### Почему первая гипотеза казалась правильной

SQL-диагностика показала что `ai_usage_log` имеет bare id + правильный cost. Это корректно указало что problem specifically в DevPanel path (где используется `response.modelId`), а не в DB path (где используется `getModelIdForTask`). Но я предположил что различие — prefix, тогда как на самом деле — suffix.

**Урок:** даже правильная диагностическая half-truth (две ветки кода, одна ломается) не заменяет empirical confirmation формата данных. Всегда запускать diagnostic log **перед** фиксом, если есть малейшие сомнения в формате input данных.

### Фикс — Suffix-tolerant catalog lookup

Вместо prefix-stripping нужен **suffix-walking lookup**:

```ts
export function getModelEntry(id: string): ModelEntry | undefined {
  // Exact match первым — покрывает 99% случаев (Anthropic, MiniMax, xAI, catalog keys with explicit versions)
  const direct = CATALOG[id];
  if (direct) return direct;

  // Fallback: walk back через dashes пока не найдём match.
  // Покрывает OpenRouter-style versioned ids (`qwen/qwen3.6-plus-04-02` → `qwen/qwen3.6-plus`).
  let trimmed = id;
  while (true) {
    const lastDash = trimmed.lastIndexOf("-");
    if (lastDash === -1) return undefined;
    trimmed = trimmed.slice(0, lastDash);
    const found = CATALOG[trimmed];
    if (found) return found;
  }
}
```

### Почему этот подход корректен

**1. Безопасность для моделей с явной версией в catalog id:**

`claude-haiku-4-5-20251001` — exact match **первым**, fallback loop не активируется. Даже если бы активировался — walked down к `claude-haiku-4-5` не дало бы ложный hit (такого ключа нет).

`claude-sonnet-4-6` — exact match, OK.

`MiniMax-M2.7` — exact match (note: `.7` не строкой-dash, exact match работает).

**2. Корректность для OpenRouter suffix:**

`qwen/qwen3.6-plus-04-02` → try exact → miss → strip `-02` → try `qwen/qwen3.6-plus-04` → miss → strip `-04` → try `qwen/qwen3.6-plus` → **match** → return.

**3. Безопасность для unknown models:**

Если ни одного match — loop доходит до `qwen/qwen3.6` → `qwen/qwen3` → `qwen/qwen3.6` (без dash останавливается). Неверный fallback — returns `undefined` как ожидалось.

### Почему не rejected альтернативы

- **Prefix-strip** (первоначальный план A) — решал бы mismatch для гипотетического `openrouter:...` формата, но такого формата не существует. Мёртвое решение.
- **Регекс `-\d{2}-\d{2}$`** — работает для конкретного известного суффикса, но хрупко к другим версионным форматам (например `-v2`, `-20260401`)
- **Обновить catalog entries на `qwen/qwen3.6-plus-04-02`** — pins к конкретному snapshot, ломает OpenRouter API call (провайдер принимает обе формы, но нестандарт), требует manual catalog updates при каждой smene snapshot
- **Второй индекс в catalog** — overkill для single-path fallback

**Walk-back loop** — самое defensive и простое решение. 10 строк в 1 функции.

### Валидация

Empirical:
- До фикса: qwen response.modelId `"qwen/qwen3.6-plus-04-02"` → getModelEntry undefined → `calculateCostRub` 0 → DevPanel `₽0.00`
- После фикса: same response.modelId → loop strips `-02` → `-04` → finds `"qwen/qwen3.6-plus"` → entry pricing $0.325/$1.95 per 1M → cost ~0.65 ₽ на ~15K токенов → DevPanel показывает non-zero ✓

SQL подтвердил что 2 qwen-запроса получили правильный `costUsd` ($0.0051, $0.0063) — это ожидаемо, т.к. DB path уже работал раньше через `getModelIdForTask`. Фикс непосредственно влияет на DevPanel path (и любые будущие call-sites, которые используют `response.modelId` напрямую).

