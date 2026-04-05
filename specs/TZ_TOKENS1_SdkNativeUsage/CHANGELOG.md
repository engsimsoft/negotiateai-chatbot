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
