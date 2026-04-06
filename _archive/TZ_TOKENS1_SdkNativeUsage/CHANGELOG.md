# Changelog ТЗ-TOKENS1

## Сессия 1 — 2026-04-05

### Планирование
- Создана папка `specs/TZ_TOKENS1_SdkNativeUsage/`
- Написан `SPEC.md` (senior-dev spec, 9 требований R1-R9)
- Разведана кодовая база: 8 ядерных файлов + 28 callsites `logUsage` + 4 файла DevPanel UI + pipelines
- Написан `ANALYSIS.md` (код-ревью, риски, рекомендации)
- Написан `ROADMAP.md` (8 этапов, валидация на каждом)
- Архивирован TZ_AUDIT1 (заменён на TZ_TOKENS1)

### Files created
- `specs/TZ_TOKENS1_SdkNativeUsage/SPEC.md`
- `specs/TZ_TOKENS1_SdkNativeUsage/ANALYSIS.md`
- `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md`
- `specs/TZ_TOKENS1_SdkNativeUsage/CHANGELOG.md`
- `specs/TZ_TOKENS1_SdkNativeUsage/HANDOFF.md`

### Files moved
- `specs/TZ_AUDIT1_TokenCostValidation/` → `_archive/TZ_AUDIT1_TokenCostValidation/`

### Scope updates
- Добавлен **Этап 7: Cost Audit UI** — разделение токенов на fresh/cache_read/cache_write + Cache hit rate card + legacy data warning. Роадмап расширен с 8 до 9 этапов.

---

## Сессия 2 — 2026-04-05

### Этап 1: Базовый контракт ✅

**Files modified:**
- `lib/ai/providers.ts`:
  - `TokenUsageForPricing` переписан с disjoint-полями: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens?`
  - `calculateCostRub()` — убрана ручная субтракция, reasoning билится по output rate
  - `getStepCostRub()` — bridge: derives `noCacheInputTokens = inputTokens - cacheRead - cacheWrite` (до DebugStepData v2 в Этапе 4)
- `lib/ai/usage-utils.ts`:
  - Новый helper `extractUsageForPricing(usage)` → `TokenUsageForPricing`
  - Читает `inputTokenDetails.{noCacheTokens,cacheReadTokens,cacheWriteTokens}` + `outputTokenDetails.reasoningTokens`
  - Fallback для `noCacheInputTokens`: `inputTokens - cacheRead - cacheWrite` если SDK не прислал

**TSC errors (5, ожидаемо, фиксятся в Этапах 2-3):**
```
app/(chat)/api/chat/route.ts:775 — { inputTokens } → TokenUsageForPricing
app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:405 — same
app/(chat)/api/service-chat/route.ts:858 — same
lib/ai/tokenlens-catalog.ts:46 — same
lib/ai/tokenlens-catalog.ts:91 — same
```

Все ошибки одного типа: "property 'inputTokens' does not exist in type 'TokenUsageForPricing'" — callsites всё ещё передают старый shape. Фикс: в Этапе 2 (tokenlens-catalog) и Этапе 3 (3 routes).

### Этап 2: Обновление ядра ✅

**Files modified:**
- `lib/ai/tokenlens-catalog.ts`:
  - `calcCostUsd()` — использует `extractUsageForPricing(usage)` → `calculateCostRub`
  - `calcStepCostRub()` — signature изменён: принимает `TokenUsageForPricing` напрямую (было custom shape с `inputTokens` как total)
  - Imports вынесены в топ файла
- `lib/ai/pipeline-trace.ts`:
  - `AiCallTrace` — legacy `promptTokens`/`completionTokens` убраны, добавлены disjoint поля: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens`. `totalTokens` остался как derived-поле.
  - `AiResultForTrace.usage` — тип изменён на `LanguageModelUsage` (SDK v6 native)
  - `buildAiCallTrace()` — использует `extractUsageForPricing(result.usage)`
  - `buildTtsTrace()` — обновлён под новый `AiCallTrace`

**TSC state:** `lib/ai/` — 0 ошибок ✅. Остальных 18 ошибок:
- 6 в routes (Этап 3): `app/(chat)/api/{chat,service-chat,projects/.../chat}/route.ts`
- 10 в pipelines (Этап 6): `lib/briefing/*.ts`, `lib/podcast/script-generator.ts`
- 2 в UI (Этап 5): `components/dev-panel/pipeline-trace-drawer.tsx`

### Этап 3: Обновление 3 routes ✅

**Files modified:**
- `app/(chat)/api/chat/route.ts`:
  - `onStepFinish` — `stepUsage` построен через `extractUsageForPricing(usage)`, передан в `calcStepCostRub`
  - DebugStepData заполняется legacy-полями (`inputTokens` = total, `cachedTokens` = cacheRead) — переименование в Этапе 4
  - `onFinish` → `calculateCostRub(..., extractUsageForPricing(usage))`
- `app/(chat)/api/service-chat/route.ts` — аналогично
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично

**TSC state:** 3 routes — 0 ошибок ✅. Остаётся 12 ошибок (pipelines Этап 6, UI Этап 5).

**Решение:** `npm run build` + мануальный тест перенесены на конец Этапа 6 (нельзя собрать с битыми pipelines).

---

## Сессия 3 — 2026-04-05

### Этап 4: Debug events schema v2 + localStorage migration ✅

**Files modified:**
- `lib/ai/debug-events.ts`:
  - Экспорт `DEBUG_EVENT_SCHEMA_VERSION = 2`
  - `DebugStepData` — disjoint поля: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens` + `schemaVersion`
  - `DebugFinishData` — disjoint поля: `totalNoCacheInputTokens`, `totalCacheReadTokens`, `totalCacheWriteTokens`, `totalOutputTokens`, `totalReasoningTokens` + `schemaVersion`
- `lib/ai/providers.ts`:
  - `getStepCostRub(step)` — читает disjoint поля напрямую (убрана bridge-логика с субтракцией)
- `components/dev-panel/dev-panel-provider.tsx`:
  - `StoredPayload` = `{ schemaVersion, entries[] }`. При mismatch → wipe + `console.warn("[DevPanel] Clearing legacy debug cache...")`
- `hooks/use-onboarding-debug.ts`:
  - Аналогичный StoredPayload с version check + warn
- `app/(chat)/api/chat/route.ts`, `service-chat/route.ts`, `projects/[id]/tasks/[taskId]/chat/route.ts`:
  - `DebugStepData`/`DebugFinishData` заполняются новыми именами полей + `schemaVersion`
  - `emitDebugFinish` — `finishUsage = extractUsageForPricing(usage)` вызывается один раз, переиспользуется

**TSC state:** 17 ошибок, все ожидаемые для Этапов 5-6:
- 5 в DevPanel UI секциях (tokens-section, cost-breakdown-section, timeline-section, dev-panel-footer) — Этап 5
- 2 в pipeline-trace-drawer — Этап 5
- 10 в pipelines (briefing/*, podcast/script-generator) — Этап 6

Все ошибки в зоне Этапа 4 (lib/ai/, dev-panel-provider.tsx, 3 routes) устранены.

### Этап 5: DevPanel UI ✅

**Files modified:**
- `components/dev-panel/sections/tokens-section.tsx`:
  - disjoint суммы по steps: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens`
  - UI: "Input (fresh)" всегда, остальные строки — условно (> 0)
  - `totalTokens` = sum пяти компонентов
- `components/dev-panel/sections/cost-breakdown-section.tsx`:
  - `StepCost` + `computePerStepCosts` — disjoint поля
- `components/dev-panel/sections/timeline-section.tsx`:
  - `step.inputTokens + outputTokens + reasoningTokens` → полная сумма disjoint полей
- `components/dev-panel/dev-panel-footer.tsx`:
  - `totalTokens` = sum disjoint полей per step
- `components/dev-panel/pipeline-trace-drawer.tsx`:
  - `stage.ai.promptTokens/completionTokens` → `noCacheInputTokens+cacheReadTokens+cacheWriteTokens` / `outputTokens`

**TSC state:** 0 ошибок в DevPanel UI. Остаются 10 ошибок в pipelines (Этап 6).

### Этап 6: Pipelines + fake usage fix ✅

**Files modified:**
- `lib/briefing/briefing-filter.ts`:
  - `buildAiCallTrace({ modelId, usage, ... }, catalog)` вместо ручного конструирования
  - `logUsage({ usage })` — передаётся real `LanguageModelUsage` (было `usage ?? fakeShape`)
- `lib/briefing/briefing-author.ts`:
  - `usage: LanguageModelUsage | undefined` сохраняется из `result.usage` (было ручное извлечение promptTokens/completionTokens)
  - `logUsage` получает real usage (не fake `{inputTokens, outputTokens, totalTokens} as any`)
  - `buildAiCallTrace(...)` + post-set `ai.error = primaryError`
- `lib/briefing/briefing-section-author.ts` — аналогично briefing-author
- `lib/briefing/research-engine.ts`:
  - AiCallTrace конструируется вручную с disjoint-полями: `noCacheInputTokens = promptTokens`, `cacheRead/Write = 0` (Perplexity без prompt caching)
- `lib/podcast/script-generator.ts`:
  - Synthetic `LanguageModelUsage` для logUsage с `inputTokenDetails.{noCacheTokens, cacheReadTokens, cacheWriteTokens}` (Gemini без prompt caching, retry accumulator)
  - AiCallTrace с disjoint-полями вручную

**TSC state:** 0 ошибок ✅
**Build state:** `npm run build` успешен ✅

**Key fix:** briefing-author и briefing-section-author передавали в `logUsage` вручную собранный shape `{inputTokens, outputTokens, totalTokens} as any`, теряя `inputTokenDetails.*`. Теперь передаётся оригинальный `LanguageModelUsage` от AI SDK — `extractUsageFields` внутри `logUsage` корректно извлекает cache_read/cache_write.

**Ожидается мануальный тест** перед переходом к Этапу 7 (Cost Audit UI).
