# Передача сессии ТЗ-TOKENS1

**Дата:** 2026-04-05
**Последняя сессия:** 3 (Этап 4 завершён)
**Следующая сессия:** начать **Этап 5**

---

## Статус этапов

- [x] **Фаза 1:** Анализ + Код-ревью завершены
- [x] **Фаза 2:** Планирование завершено (ROADMAP 9 этапов)
- [x] **Этап 1:** Базовый контракт — commit `dd411aa`
- [x] **Этап 2:** Обновление ядра (tokenlens + pipeline-trace) — commit `d9cdf31`
- [x] **Этап 3:** 3 chat routes (chat, service-chat, task-chat) — commit `cb04b30`
- [x] **Этап 4:** Debug events v2 + localStorage migration — commit TBD
- [ ] **Этап 5:** DevPanel UI ← **НАЧАТЬ ЗДЕСЬ**
- [ ] Этап 6: Pipelines + fake usage fix
- [ ] Этап 7: Cost Audit UI (fresh/cache/write колонки)
- [ ] Этап 8: Валидация (7 типов чатов)
- [ ] Этап 9: Финализация

---

## ⛔ Текущее состояние компиляции

**TSC (`npx tsc --noEmit`):** 17 ошибок, все ожидаемые:

```
components/dev-panel/dev-panel-footer.tsx:67                   (1 — Этап 5)
components/dev-panel/pipeline-trace-drawer.tsx:171             (2 — Этап 5)
components/dev-panel/sections/cost-breakdown-section.tsx:54,57 (2 — Этап 5)
components/dev-panel/sections/timeline-section.tsx:55          (1 — Этап 5)
components/dev-panel/sections/tokens-section.tsx:7,9           (2 — Этап 5)
lib/briefing/briefing-author.ts:231,235                        (2 — Этап 6)
lib/briefing/briefing-filter.ts:137,141                        (2 — Этап 6)
lib/briefing/briefing-section-author.ts:197,201                (2 — Этап 6)
lib/briefing/research-engine.ts:305,309                        (2 — Этап 6)
lib/podcast/script-generator.ts:162,166                        (2 — Этап 6)
```

**Все ошибки однотипные:**
- DevPanel UI: обращения к legacy полям `inputTokens`/`cachedTokens` на `DebugStepData` (теперь `noCacheInputTokens`/`cacheReadTokens`)
- pipeline-trace-drawer: legacy поля `promptTokens`/`completionTokens` на `AiCallTrace`
- pipelines: передают legacy shape в `AiCallTrace`/`TokenUsageForPricing` (Этап 6)

**Build и manual test отложены** до окончания Этапа 6.

---

## ⛔ КРИТИЧНО: читать СНАЧАЛА

**Порядок чтения в новой сессии:**

1. `specs/WORKFLOW.md` — правила работы по ТЗ
2. `specs/TZ_TOKENS1_SdkNativeUsage/SPEC.md` — само ТЗ (9 требований)
3. `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` — **рабочий чеклист** (Этап 5 и далее)
4. `specs/TZ_TOKENS1_SdkNativeUsage/CHANGELOG.md` — история сессий 1-3

---

## Что уже сделано (Этапы 1-4)

### Этап 4: Debug events schema v2
- `lib/ai/debug-events.ts`:
  - `DEBUG_EVENT_SCHEMA_VERSION = 2`
  - `DebugStepData` disjoint поля: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens` + `schemaVersion`
  - `DebugFinishData` disjoint поля: `totalNoCacheInputTokens`, `totalCacheReadTokens`, `totalCacheWriteTokens`, `totalOutputTokens`, `totalReasoningTokens` + `schemaVersion`
- `lib/ai/providers.ts`:
  - `getStepCostRub(step)` читает disjoint поля напрямую (bridge-логика убрана)
- `components/dev-panel/dev-panel-provider.tsx`:
  - localStorage payload wrapper `{ schemaVersion, entries[] }`. Mismatch → wipe + `console.warn`
- `hooks/use-onboarding-debug.ts` — то же
- 3 routes: `DebugStepData`/`DebugFinishData` заполняются новыми именами + `schemaVersion`

---

## Следующий шаг: Этап 5 — DevPanel UI

**Цель:** Обновить UI компоненты DevPanel чтобы читать новые disjoint поля.

### Задачи (по ROADMAP)

**1. `components/dev-panel/sections/tokens-section.tsx`:**
- Заменить `st.inputTokens` → `st.noCacheInputTokens`
- Заменить `st.cachedTokens` → `st.cacheReadTokens`
- Добавить отображение трёх строк input: "Input (fresh)", "Cache read", "Cache write" + Reasoning
- `totalTokens` = sum всех четырёх компонентов

**2. `components/dev-panel/sections/cost-breakdown-section.tsx`:**
- Обновить чтение полей из step (строки 54, 57)

**3. `components/dev-panel/sections/timeline-section.tsx`:**
- Обновить чтение полей (строка 55)

**4. `components/dev-panel/dev-panel-footer.tsx`:**
- Обновить чтение суммарных полей (строка 67)

**5. `components/dev-panel/pipeline-trace-drawer.tsx`:**
- `promptTokens`/`completionTokens` → `noCacheInputTokens + cacheReadTokens + cacheWriteTokens` / `outputTokens` (или раздельно)

**6. Валидация:** `npx tsc --noEmit` → 0 ошибок в компонентах DevPanel. Остаются только 10 ошибок в pipelines (Этап 6).

### Git commit сообщение

```
refactor(tz-tokens1): update DevPanel UI to new debug fields
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

# Найти callsites
grep -rn "inputTokens\|cachedTokens" components/dev-panel/
```

---

## Правила работы (НИКОГДА НЕ НАРУШАТЬ)

- ⛔ **НЕ** отмечать `[x]` без `npx tsc --noEmit` = 0 ошибок (в зоне этапа)
- ⛔ **НЕ** использовать TodoWrite — основной чеклист это ROADMAP.md
- ✅ Git commit после КАЖДОГО этапа: `refactor(tz-tokens1): описание`
- ✅ ROADMAP.md — обновляй статусы сразу после задачи
- ✅ CHANGELOG.md — добавляй секцию после каждого этапа

---

**Новая сессия:** начинай с `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` → Этап 5 → `components/dev-panel/sections/tokens-section.tsx`.
