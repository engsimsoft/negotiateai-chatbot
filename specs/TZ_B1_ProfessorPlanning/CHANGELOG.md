# Changelog ТЗ-B1: Профессор (планирование)

## Сессия 3 — 2026-02-09

### Added
- `app/(chat)/api/projects/[id]/plan/route.ts` — POST endpoint Профессора (generateText + XML-парсинг + Zod)
- `components/projects/phase-states/planning-state.tsx` — полная переработка: 3 состояния (прогресс, вопросы, план)
- Слушатель события "open-manager-drawer" в `project-page-layout.tsx`

### Changed
- `components/projects/project-work-area.tsx` — добавлены props planJson, planReport
- `app/(dashboard)/projects/[id]/page.tsx` — передача planJson/planReport из БД в WorkArea

### Git
- `338e13c feat(tz-b1): professor planning endpoint`
- `815387f feat(tz-b1): planning state UI with progress animation`

### Files
- app/(chat)/api/projects/[id]/plan/route.ts
- components/projects/phase-states/planning-state.tsx
- components/projects/project-work-area.tsx
- components/projects/project-page-layout.tsx
- app/(dashboard)/projects/[id]/page.tsx

---

## Сессия 2 — 2026-02-09

### Added
- `lib/db/schema.ts` — поля planJson (jsonb) + planReport (text) в таблицу Project
- `lib/db/migrations/0025_add-project-plan-fields.sql` — миграция (применена)
- `lib/db/queries.ts` — функция `updateProjectPlan()`
- `lib/prompts/professors/planning.md` — промпт Профессора (PE)
- `lib/ai/professor-types.ts` — типы + Zod-схемы (3 варианта: needs_input, complete, partial)
- `CLAUDE.md` — правило "ROADMAP — основной чеклист, не TodoWrite"

### Files
- lib/db/schema.ts
- lib/db/queries.ts
- lib/db/migrations/0025_add-project-plan-fields.sql
- lib/prompts/professors/planning.md
- lib/ai/professor-types.ts
- CLAUDE.md

---

## Сессия 1 — 2026-02-09

### Added
- SPEC.md — копия ТЗ
- ANALYSIS.md — анализ, 6 вопросов, 5 рисков
- ROADMAP.md — план из 5 этапов
- CHANGELOG.md — этот файл
- HANDOFF.md — передача между сессиями

### Files
- specs/TZ_B1_ProfessorPlanning/SPEC.md
- specs/TZ_B1_ProfessorPlanning/ANALYSIS.md
- specs/TZ_B1_ProfessorPlanning/ROADMAP.md
- specs/TZ_B1_ProfessorPlanning/CHANGELOG.md
- specs/TZ_B1_ProfessorPlanning/HANDOFF.md
