# Передача сессии ТЗ-TOKENS1

**Дата:** 2026-04-05
**Последняя сессия:** 2 (Этапы 1-3 завершены)
**Следующая сессия:** начать **Этап 4**

---

## Статус этапов

- [x] **Фаза 1:** Анализ + Код-ревью завершены
- [x] **Фаза 2:** Планирование завершено (ROADMAP 9 этапов)
- [x] **Этап 1:** Базовый контракт — commit `dd411aa`
- [x] **Этап 2:** Обновление ядра (tokenlens + pipeline-trace) — commit `d9cdf31`
- [x] **Этап 3:** 3 chat routes (chat, service-chat, task-chat) — commit `cb04b30`
- [ ] **Этап 4:** Debug events v2 + localStorage migration ← **НАЧАТЬ ЗДЕСЬ**
- [ ] Этап 5: DevPanel UI
- [ ] Этап 6: Pipelines + fake usage fix
- [ ] Этап 7: Cost Audit UI (fresh/cache/write колонки)
- [ ] Этап 8: Валидация (7 типов чатов)
- [ ] Этап 9: Финализация

---

## ⛔ Текущее состояние компиляции

**TSC (`npx tsc --noEmit`):** 12 ошибок, все ожидаемые:

```
components/dev-panel/pipeline-trace-drawer.tsx:171  (2 ошибки — Этап 5)
lib/briefing/briefing-author.ts:231,235             (2 — Этап 6)
lib/briefing/briefing-filter.ts:137,141             (2 — Этап 6)
lib/briefing/briefing-section-author.ts:197,201     (2 — Этап 6)
lib/briefing/research-engine.ts:305,309             (2 — Этап 6)
lib/podcast/script-generator.ts:162,166             (2 — Этап 6)
```

**Все ошибки однотипные:**
- `'promptTokens'/'completionTokens' does not exist in type 'AiCallTrace'` (AiCallTrace был обновлён в Этапе 2)
- `'inputTokens' does not exist in type 'TokenUsageForPricing'` (контракт обновлён в Этапе 1)

**Build и manual test отложены** до окончания Этапа 6 (нельзя собрать с битыми pipelines).

---

## ⛔ КРИТИЧНО: читать СНАЧАЛА

**Порядок чтения в новой сессии:**

1. `specs/WORKFLOW.md` — правила работы по ТЗ
2. `specs/TZ_TOKENS1_SdkNativeUsage/SPEC.md` — само ТЗ (9 требований)
3. `specs/TZ_TOKENS1_SdkNativeUsage/ANALYSIS.md` — код-ревью, риски
4. `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` — **рабочий чеклист** (Этап 4 и далее)
5. `specs/TZ_TOKENS1_SdkNativeUsage/CHANGELOG.md` — история сессий 1-2

---

## Что уже сделано (Этапы 1-3)

### Этап 1: Базовый контракт
- `lib/ai/providers.ts`:
  - `TokenUsageForPricing` — disjoint поля: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens?`
  - `calculateCostRub()` — без ручной субтракции, reasoning билится по output rate
  - `getStepCostRub()` — временный bridge до Этапа 4
- `lib/ai/usage-utils.ts`:
  - Новый helper `extractUsageForPricing(usage)` → `TokenUsageForPricing`
  - Читает `inputTokenDetails.{noCacheTokens, cacheReadTokens, cacheWriteTokens}` + `outputTokenDetails.reasoningTokens`

### Этап 2: Ядро (lib/ai/)
- `lib/ai/tokenlens-catalog.ts`:
  - `calcCostUsd()` — использует `extractUsageForPricing`
  - `calcStepCostRub()` — signature: `(modelId, usage: TokenUsageForPricing, providers?)`
- `lib/ai/pipeline-trace.ts`:
  - `AiCallTrace` — legacy `promptTokens/completionTokens` убраны, добавлены disjoint поля (`noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens`), `totalTokens` — derived
  - `AiResultForTrace.usage` — тип `LanguageModelUsage` (SDK v6 native)
  - `buildAiCallTrace`, `buildTtsTrace` обновлены

### Этап 3: 3 chat routes
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

Во всех: `onStepFinish` и `onFinish` используют `extractUsageForPricing(usage)` для построения `TokenUsageForPricing` перед вызовом `calcStepCostRub`/`calculateCostRub`.

⚠️ **Важно:** `DebugStepData` в этих routes пока заполняется **legacy-именами** (`inputTokens` = total, `cachedTokens` = cacheRead). Это намеренно — переименование схемы в Этапе 4.

---

## Следующий шаг: Этап 4

**Цель:** Переписать типы debug events + мягкая миграция localStorage.

### Задачи (по ROADMAP)

**1. `lib/ai/debug-events.ts`:**
- `DebugStepData` — заменить `inputTokens`, `cachedTokens` на `noCacheInputTokens`, `cacheReadTokens` (`cacheWriteTokens` уже есть, `reasoningTokens` уже есть)
- `DebugFinishData` — заменить `totalInputTokens`, `totalCachedTokens` на `totalNoCacheInputTokens`, `totalCacheReadTokens`, `totalCacheWriteTokens`
- Добавить константу `DEBUG_EVENT_SCHEMA_VERSION = 2`
- Добавить поле `schemaVersion: number` в `DebugStepData` и `DebugFinishData`

**2. `components/dev-panel/dev-panel-provider.tsx`:**
- При инициализации — если localStorage содержит старую версию схемы → очистить (console.warn)
- Обновить тип `DevPanelMessageData` если нужно

**3. `hooks/use-onboarding-debug.ts`:**
- Аналогичная миграция localStorage

**4. `lib/ai/providers.ts` → `getStepCostRub(step)`:**
- Обновить чтение: `step.noCacheInputTokens`, `step.cacheReadTokens`, `step.cacheWriteTokens` (убрать bridge-логику `inputTokens - cacheRead - cacheWrite`)

**5. Обновить 3 routes** (где заполняется `DebugStepData` и `DebugFinishData`):
- `app/(chat)/api/chat/route.ts` — onStepFinish (replace `inputTokens: usage?.inputTokens ?? 0` → `noCacheInputTokens: stepUsage.noCacheInputTokens` и т.д.), onFinish → `emitDebugFinish` (новые totalNoCacheInputTokens и т.д.)
- `app/(chat)/api/service-chat/route.ts` — аналогично
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично

**6. Валидация:** `npx tsc --noEmit` — ожидаем новые ошибки в DevPanel UI секциях (tokens-section, cost-breakdown-section, footer, timeline). Будут исправлены в Этапе 5.

### Git commit сообщение

```
refactor(tz-tokens1): debug events schema v2 + localStorage migration
```

---

## Пользователь подтвердил

- ✅ План 9 этапов
- ✅ localStorage migration — dev-режим, старые данные не важны, очищаются автоматически
- ✅ Build + manual test перенесены до окончания Этапа 6

---

## Полезные команды

```bash
# Проверка компиляции
npx tsc --noEmit

# Сборка (пока не работает — ожидается после Этапа 6)
npm run build

# Найти все callsites
grep -rn "calcStepCostRub\(" lib/ app/
grep -rn "DebugStepData\|DebugFinishData" lib/ app/ components/
```

---

## Правила работы (НИКОГДА НЕ НАРУШАТЬ)

- ⛔ **НЕ** отмечать `[x]` без `npx tsc --noEmit` = 0 ошибок (в зоне этапа)
- ⛔ **НЕ** использовать TodoWrite — основной чеклист это ROADMAP.md
- ✅ Git commit после КАЖДОГО этапа: `refactor(tz-tokens1): описание`
- ✅ ROADMAP.md — обновляй статусы сразу после задачи
- ✅ CHANGELOG.md — добавляй секцию после каждого этапа

---

**Новая сессия:** начинай с `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` → Этап 4 → `lib/ai/debug-events.ts`.
