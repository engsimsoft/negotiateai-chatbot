# Changelog ТЗ-2: Dev Switchboard UI

> Локальный лог изменений. В Фазе 4 будет перенесён в главный `CHANGELOG.md`.

---

## Сессия 1 — 2026-04-12 — Фаза 1 + 2 (Анализ + Планирование) + Этапы 0–1

### Added
- `specs/TZ_2_DevSwitchboardUI/SPEC.md` — копия ТЗ
- `specs/TZ_2_DevSwitchboardUI/ANALYSIS.md` — анализ + 6 согласованных вопросов
- `specs/TZ_2_DevSwitchboardUI/ROADMAP.md` — план по 5 этапам
- `specs/TZ_2_DevSwitchboardUI/CHANGELOG.md` — этот файл
- `specs/TZ_2_DevSwitchboardUI/HANDOFF.md` — стартовый контекст
- `lib/ai/model-overrides.ts` — SSOT для cookie-based overrides (parse/serialize/gate/cookie opts)
- Публичные хелперы в `getModel.ts`: `isTaskOverridden(taskId)`, `getCurrentOverrides()`

### Changed
- `lib/ai/getModel.ts`:
  - `lookupOverride()` — реализация через `next/headers.cookies()` с dev-gate + try/catch для background scope
  - Добавлен `readOverridesFromCookie()` helper
- `lib/ai/debug-events.ts`:
  - `DebugPromptData` расширен: `taskId?`, `overrideActive?`, `defaultModelId?`, `effectiveModelId?`
- `app/(chat)/api/chat/route.ts`:
  - Хоистинг `activeTaskId: TaskId | null` из двух мест в одно (устраняет 17 строк дублирующей логики)
  - `emitDebugPrompt` получает override info
  - onFinish переиспользует `activeTaskId` вместо повторной резолюции
- `components/dev-panel/dev-panel-footer.tsx`:
  - Жёлтый badge «⚙ OVERRIDE» + tooltip при `data.prompt.overrideActive`
- `components/dev-panel/sections/model-section.tsx`:
  - Строки «Task ID» и «Override: default → effective»

### Files
- lib/ai/model-overrides.ts
- lib/ai/getModel.ts
- lib/ai/debug-events.ts
- app/(chat)/api/chat/route.ts
- components/dev-panel/dev-panel-footer.tsx
- components/dev-panel/sections/model-section.tsx
