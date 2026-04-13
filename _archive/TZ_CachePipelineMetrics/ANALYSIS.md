# ANALYSIS — ТЗ_CachePipelineMetrics v2.0

**Дата:** 2026-04-13
**Автор:** Claude Opus 4.6 (сессия 1 — аудит + план)
**Статус:** актуализирован после grep-а всех `getModel()` call-sites

---

## Изученная документация

### Внешние технологии в scope ТЗ

Все внешние технологии (Anthropic prompt caching API, AI SDK v6 `inputTokenDetails`, `vercel-minimax-ai-provider` Anthropic-compat режим) уже исследованы и зафиксированы в предыдущих ТЗ цикла. Повторный fetch дублировал бы работу и не добавил бы нового контекста.

**Внутренние source-of-truth:**
- [docs/decisions/049-minimax-anthropic-compat-mode.md](../../docs/decisions/049-minimax-anthropic-compat-mode.md) — MiniMax через `createMinimax()` эмитит `inputTokenDetails.cacheReadTokens/cacheWriteTokens` в нативном формате AI SDK v6 (тот же класс `AnthropicMessagesLanguageModel` что и Claude). Валидировано 4-тестовой независимой проверкой 2026-04-13.
- [docs/decisions/050-cache-breakpoints-strategy.md](../../docs/decisions/050-cache-breakpoints-strategy.md) — 3-breakpoint паттерн (static system + tools + last user text-part) + MIND transplant. Валидирован UI-тестами: 54% экономии MiniMax Simply, 58% Claude Haiku «Думать», 74% Claude Haiku task-expert. Pattern работает идентично для pipelines — внутри тот же `streamText({ model, messages, providerOptions })`.
- `lib/ai/tools/chat-tools.ts:withCacheControlOnLastTool<T>()` — готовый helper для Breakpoint 2 (tools). Переиспользуем.
- `lib/ai/usage-utils.ts:extractUsageFields()` + `logUsage()` — SSOT для усреднённого usage logging. Уже принимает `inputTokenDetails` и корректно извлекает cache fields.

### Отличие от предыдущих ТЗ

Этот ТЗ **не вводит новых паттернов** — он применяет существующие ADR 049/050 к pipeline-файлам. Поэтому fetch новой документации не требуется.

Если в ходе реализации обнаружится, что pipeline-вызов использует `generateText` или `generateObject` вместо `streamText` — проверим совместимость cache breakpoint паттерна с этими методами (в AI SDK v6 `providerOptions.anthropic.cacheControl` работает одинаково для всех трёх методов — это задокументированное поведение, но подтвердим на месте).

---

## Baseline: полный аудит `getModel()` call-sites (38 мест + 3 в professor-pipeline)

Grep `model: getModel(...)` по проекту дал **38 uses в production-коде** (+ 1 в dev-скрипте `debug-orphan-tool-use.ts`, исключён). `professor-pipeline.ts` дополнительно резолвит 3 модели через module-scope const и использует их в своих streamText/generateText — +3.

### Матрица покрытия `ai_usage_log`

| Call-site | Task | Метод | logUsage? | Bug |
|---|---|---|---|---|
| `artifacts/text/server.ts:18,80` | `artifact:text` | streamText | ✅ via logUsage() | — |
| `artifacts/markdown/server.ts:18,77` | `artifact:markdown` | streamText | ✅ | — |
| `artifacts/excel/server.ts:180,275` | `artifact:excel` | streamObject+streamText | ✅ | — |
| `artifacts/presentation-pptx/server.ts:135,263` | `artifact:pptx` | streamText | ✅ | — |
| `artifacts/presentation-reveal/server.ts:117,191` | `artifact:reveal` | streamText | ✅ | — |
| `app/(chat)/api/chat/route.ts:136` | `util:title` | generateText (auto-naming) | ✅ line 173 | — |
| `app/(chat)/actions.ts:34` | `util:title` | generateText (generateTitleFromUserMessage) | ✅ line 45 | — |
| `app/(chat)/api/chat/[id]/generate-title/route.ts:88` | `util:title` | generateText | ✅ line 115 | — |
| `app/(chat)/api/projects/[id]/plan/route.ts:173` | `professor:planning` | streamObject | ✅ line 191 | — |
| `app/(chat)/api/projects/[id]/generate-summary/route.ts:80` | `util:project-summary` | generateText | ✅ line 98 | — |
| `app/(chat)/api/projects/[id]/analyze-file/route.ts:131` | `clerk:file-analyzer` | generateObject | ✅ line 138 | — |
| `app/(chat)/api/service-chat/route.ts:783` | `service-chat:*` | streamText | ✅ line 845 | — |
| `app/(chat)/api/assistant/ben/route.ts:37` | `service-chat:ben` | streamText | ✅ line 45 | — |
| `lib/ai/memory/extract.ts:135,312,461` | `memory:extract*` / `memory:dedup-verify` | generateObject ×3 | ✅ 146, 338, 519 | — |
| `lib/ai/memory/consolidate.ts:148` | `memory:consolidate` | generateObject | ✅ line 173 | — |
| `lib/ai/memory/profile.ts:117` | `memory:profile` | generateText | ✅ line 133 | — |
| `lib/ai/clerks/snapshot-creator.ts:179` | `clerk:snapshot` | generateText | ✅ line 187 | — |
| `lib/ai/clerks/task-summarizer.ts:155` | `clerk:task-summary` | generateObject | ✅ line 163 | — |
| `lib/ai/professors/task-reviewer.ts:137` | `professor:review` | generateObject | ✅ line 155 | — |
| `lib/ai/vision-ocr.ts:60,113` | `vision:ocr` | generateText ×2 | ✅ 77, 134 | — |
| `lib/meeting/meeting-pipeline.ts:93` | `meeting:summary` | streamText | ✅ line 104 | — |
| `lib/briefing/briefing-author.ts:207,552` | `briefing:author` / `briefing:intro-outro` | streamText inside retryWithLogging | ✅ via `retryWithLogging` → `logUsage` | ⚠️ fallback trace line 762 — hardcode (только на error path) |
| `lib/briefing/briefing-section-author.ts:183` | `briefing:section` | streamText inside retryWithLogging | ✅ | — |
| `lib/briefing/briefing-filter.ts:119` | `briefing:filter` | streamText inside retryWithLogging | ✅ | — |
| `lib/podcast/script-generator.ts:113` | `podcast:script` | **generateText** in retry loop | ⚠️ logUsage line 171 но с `cacheReadTokens: 0` хардкодом + `as any` cast | **🔴 см. ниже** |
| `lib/ai/tools/request-suggestions.ts:49` | `util:artifact-suggestions` | streamObject | 🔴 **НЕТ** logUsage | **GAP #1** |
| `lib/ai/professor-pipeline.ts` (module-scope `analyzeModel`/`executeModel`/`synthesizeModel`) | `professor:pipeline-*` | ? | ⚠️ uses `saveAiUsageLog` напрямую (не через `logUsage`) — нужен audit | **GAP #2** |
| `lib/ai/model-tiers.ts:99` | (wrapped in task-expert) | — | wrapper для task-expert route — логирование в route | — |

### Итог покрытия

| Статус | Количество |
|---|---|
| ✅ Полностью покрыто | **36** из 38 |
| 🔴 GAP — не логируется | **1** (`request-suggestions.ts`) |
| ⚠️ Под вопросом — нужен audit | **1** (`professor-pipeline.ts`) |
| 🟡 Логируется, но с хардкодом cache fields | **2** (`script-generator.ts`, `briefing-author.ts` fallback) |

**Вывод по Подходу A vs B (из SPEC):** покрытие уже **95%** через ручную инструментацию. Остался 1 явный GAP + 1 audit. Подход B (middleware wrapper через provider registry) — **overkill** для такого объёма. **Выбираем Подход A** (ручная инструментация) как финальное решение.

---

## Детали bugs

### Bug #1 — `lib/podcast/script-generator.ts` hardcode

**Место:** [lib/podcast/script-generator.ts:171-188](../../lib/podcast/script-generator.ts#L171-L188)

```ts
waitUntil(logUsage({
  userId,
  usage: {
    inputTokens: totalPromptTokens,
    outputTokens: totalCompletionTokens,
    totalTokens,
    inputTokenDetails: {
      noCacheTokens: totalPromptTokens,
      cacheReadTokens: 0,    // 🔴 hardcode
      cacheWriteTokens: 0,   // 🔴 hardcode
    },
  } as any,                  // 🔴 bypass типизации
  modelId: SCRIPT_MODEL,
  provider: getProviderForTask(PODCAST_SCRIPT_TASK),
  chatMode: "podcast:script",
  durationMs,
}));
```

**И второй раз в trace block** ([script-generator.ts:190-217](../../lib/podcast/script-generator.ts#L190-L217)):

```ts
const trace: PipelineStageTrace = {
  ...
  ai: {
    ...
    cacheReadTokens: 0,   // 🔴 hardcode
    cacheWriteTokens: 0,  // 🔴 hardcode
    costRub: calcStepCostRub(SCRIPT_MODEL, {
      noCacheInputTokens: totalPromptTokens,
      cacheReadTokens: 0,   // 🔴 hardcode
      cacheWriteTokens: 0,  // 🔴 hardcode
      ...
    }),
```

**Причина существования:** podcast script generator использует `generateText()` в цикле ретраев с ручной аккумуляцией. Первоначальная реализация не знала про `inputTokenDetails` от MiniMax — просто брала `result.usage.inputTokens` и `outputTokens`. Когда добавляли cache-aware usage_log, аккумулятор не трогали.

**Fix:** внедрить `extractUsageForPricing(result.usage)` в цикле, накапливать все 4 поля (noCacheInputTokens, cacheReadTokens, cacheWriteTokens, outputTokens), передавать их в `logUsage` через нормальный `LanguageModelUsage` объект без `as any`.

### Bug #2 — `lib/briefing/briefing-author.ts` fallback trace

**Место:** [lib/briefing/briefing-author.ts:762-766](../../lib/briefing/briefing-author.ts#L762-L766)

```ts
const trace: PipelineStageTrace = {
  ...
  ai: {
    ...
    promptPreview: "(map-reduce)",
    noCacheInputTokens: 0,   // 🔴 always 0
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    ...
  }
};
```

**Контекст:** нужно прочитать полный fallback путь — это, судя по `promptPreview: "(map-reduce)"`, деактивированный код от отклонённого `TZ_MapReduceBriefing` (см. memory: `project_map_reduce_rejected.md` — Map-Reduce был rejected из-за несовместимости MiniMax streaming). Возможно, этот fallback вообще мёртвый.

**Действие:** в ходе реализации — прочитать контекст (500 строк до line 762), определить живой ли этот код-path. Если мёртвый — **удалить целиком** (кардинальное решение, не костыль). Если живой — починить аккумулятор как в Bug #1.

### GAP #1 — `lib/ai/tools/request-suggestions.ts`

**Место:** [lib/ai/tools/request-suggestions.ts:47-79](../../lib/ai/tools/request-suggestions.ts#L47-L79)

```ts
const { elementStream } = streamObject({
  model: getModel("util:artifact-suggestions"),
  system: "...",
  prompt: document.content,
  output: "array",
  schema: z.object({...}),
});

for await (const element of elementStream) {
  // обработка элементов
}
// ← функция заканчивается без logUsage
```

**Причина:** `streamObject` возвращает `elementStream`, но usage доступен через `result.usage` promise. Автор не добавил extraction + logUsage.

**Fix:** обернуть `streamObject` в object, забрать `.usage`, вызвать `logUsage` через `waitUntil`. Модель: `util:artifact-suggestions` (нужно проверить её в task-assignments).

### GAP #2 — `lib/ai/professor-pipeline.ts`

**Место:** [lib/ai/professor-pipeline.ts](../../lib/ai/professor-pipeline.ts)

Использует:
- `saveAiUsageLog` напрямую из `@/lib/db/queries` (line 20)
- `calcCostUsd` из `tokenlens-catalog`
- `extractUsageFields` из `usage-utils`

**Это не `logUsage()`** — отдельная ручная имплементация. Нужно проверить:
1. Пишет ли `saveAiUsageLog` все cache fields корректно?
2. Совпадает ли formula расчёта costUsd с `logUsage`?
3. Возможно ли заменить на `logUsage` для единого паттерна?

Audit ограничен ~200 строк кода, быстро.

---

## Cache breakpoints — Phase 1

### Где расставлять

**briefing-author.ts `generateArticle`** (streamText, line 206-213):
- **Breakpoint 1 (static system):** текущий код передаёт `system: SYSTEM_PROMPT + JSON_INSTRUCTION` как одну строку. Нужно разделить на `[{role: "system", content: [{type: "text", text: SYSTEM_PROMPT, providerOptions: {anthropic: {cacheControl: {type: "ephemeral"}}}}]}]` через конвертацию в messages array. Или использовать `providerOptions.anthropic.cacheControl` на уровне всего system — проверить в AI SDK docs.
- **Breakpoint 2 (tools):** pipeline **не использует tools** — пропускаем.
- **Breakpoint 3 (last user):** `prompt: userMessage` заменить на `messages: [..., {role: "user", content: [{type: "text", text: userMessage, providerOptions: ...}]}]`.

**briefing-section-author.ts** (line 182-189): идентично briefing-author.

**briefing-filter.ts** (line 119-...): оценить выгоду. Filter вызывается **один раз** на весь выпуск brief'а (не в цикле), cache между вызовами не переиспользуется. **Вероятно, Breakpoint 1 не даёт выгоды** — отложить или пропустить. Решим эмпирически после реализации для briefing-author.

**podcast/script-generator.ts `generateScript`** (line 112-119, **`generateText` не streamText**):
- Вызывается в цикле по topics (multi-section podcast) с одинаковым `system` → Breakpoint 1 имеет большой profit
- Проверить что cacheControl работает с `generateText` (должен, но подтвердить)
- Breakpoint 3: `prompt` меняется per topic — не кэшируется, но это норма

### Ожидаемый profit

По аналогии с TZ-CacheAudit (74% экономии task-expert — тоже multi-tool/multi-step scenario):

- **Briefing per-section refresh** (5 секций подряд): ~70% экономии на Breakpoint 1 после cold start
- **Podcast multi-topic** (3-5 тем): ~60% экономии (scriptwriter system ~3K tokens переиспользуется)
- **Briefing author** (1 раз на выпуск): **0% экономии на одиночных вызовах**, но MIND transplant + static system всё равно настраиваются, готовя систему к возможным повторам (например, user нажимает «Regenerate» на весь брифинг)

---

## Решения, принятые в этой фазе

### 1. Approach A (manual instrumentation), не B (middleware)

**Причина:** 95% call-sites уже покрыты. Middleware добавит абстракцию ради 2 файлов.

### 2. briefing-filter Breakpoint — отложить

**Причина:** one-shot вызов. Добавление в Фазу 1 увеличит risk без профита. Если окажется, что filter вызывается в циклах в каких-то сценариях (например при регенерации) — добавим в отдельном sub-stage.

### 3. briefing-author fallback trace — **удалить, не чинить**

**Причина:** судя по preview `"(map-reduce)"`, это код от rejected `TZ_MapReduceBriefing`. Мёртвый код должен быть удалён, не залатан. **Подтвердить в Этапе 1 через чтение контекста и `git log -p`**, и если подтверждается — удалить весь fallback блок.

### 4. Perplexity `research-engine.ts` хардкоды — **оставить**

`cacheReadTokens: 0` для Perplexity **математически корректно** — у sonar-pro нет prompt caching. Это не bug, а правда. Комментарий-пояснение добавим в Фазу 4 (чтобы в будущем не принять за bug).

### 5. Gemini TTS хардкоды — **оставить**

`usage: { inputTokens: 0, outputTokens: 0 } as any` в `tts-gemini.ts` — это легитимный паттерн для non-token pricing модели (cost передаётся через `costUsdOverride`). Не bug.

### 6. `professor-pipeline.ts` audit — в отдельной задаче Этапа 3

Не трогаем логику, только проверяем покрытие. Если `saveAiUsageLog` пишет все поля — оставляем как есть. Если не все — меняем на `logUsage` (2 строки).

---

## Оценка effort после аудита

Первоначальный SPEC: **3-4 сессии**. После аудита:

| Фаза | Было | Стало | Причина |
|---|---|---|---|
| 1. Cache breakpoints | 1 сессия | 1 сессия | без изменений (4 файла) |
| 2. Hardcode fix | 0.5 сессии | 0.3 сессии | 2 места вместо «проверить в 5 файлах» |
| 3. Full coverage | 1 сессия | 0.3 сессии | 2 файла вместо ~10 (95% уже покрыто) |
| 4. JSDoc `inputTokens` | 5 мин | 5 мин | — |
| 5. Валидация E2E | 1 сессия | 0.5 сессии | одна проверка briefing + podcast + контрольный simply |

**Новая оценка: 2-3 сессии** (вместо 3-4). Аудит сэкономил 1 сессию.

---

## Открытые вопросы

1. **`generateText` + cacheControl совместимость**. Проверить в AI SDK docs / empirically в реализации. Если generateText не поддерживает `providerOptions.anthropic.cacheControl` — podcast script generator придётся переписать на streamText (с `res.text` + `res.usage`). Не большое изменение, но уточнить заранее.

2. **Живой ли fallback в briefing-author.ts?** Перед удалением — проверить `git log -p` + grep на трип trigger условий fallback.

3. **`professor-pipeline.ts` — тот же `saveAiUsageLog` контракт что и `logUsage`?** Audit даст ответ. Если контракт совпадает — оставляем. Если нет — унифицируем.

4. **Формат `inputTokens` в schema.ts — gross?** Требует подтверждения через `extractUsageFields()` — он складывает noCache + cacheRead + cacheWrite или нет. Проверим в этапе 4.

---

## Риски

- **Ошибка в cache breakpoint pattern** — может привести к 0% кэша вместо 60-70%. Митигация: валидация через UI-тест с SQL-проверкой `cacheWriteTokens > 0` на cold start и `cacheReadTokens > 0` на повтор в той же сессии. **Без SQL-подтверждения этап не закрывается.**
- **`as any` fix может поломать сериализацию usage** в специфичных эксотических edge-cases (например, если MiniMax возвращает нестандартный `inputTokenDetails` объект). Митигация: TypeScript strict check + manual reading result.usage в console.log во время первого теста.
- **Удаление мёртвого fallback может сломать hidden error path** (если fallback реально триггерится в каком-то редком сценарии). Митигация: перед удалением добавить `console.error("[briefing-author] fallback triggered — this path should be unreachable")` → прогнать несколько briefing-сессий → убедиться что не стреляет → удалить.

---

## Структура следующих этапов (детально в ROADMAP.md)

- **Этап 0** — Pre-flight + audit briefing-author fallback + audit professor-pipeline
- **Этап 1** — Phase 1: Cache breakpoints в briefing-author + briefing-section-author + podcast/script-generator (generateText compatibility check первым делом)
- **Этап 2** — Phase 2: Hardcode fix в script-generator + удаление/фикс briefing-author fallback
- **Этап 3** — Phase 3: logUsage в request-suggestions + (если нужно) унификация professor-pipeline
- **Этап 4** — Phase 4: JSDoc `inputTokens` + Perplexity/Gemini TTS комментарии
- **Этап 5** — Phase 5: Manual E2E + SQL validation + `/admin/cost-audit` comparison
- **Этап 6** — Финализация: ADR 051 + CHANGELOG + перенос в `_archive/`
