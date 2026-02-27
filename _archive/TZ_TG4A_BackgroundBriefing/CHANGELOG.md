# Changelog ТЗ-TG4a: BackgroundBriefing

## Сессия 2 — 2026-02-27

### Added
- `lib/briefing/briefing-pipeline.ts` — reusable pipeline (`runBriefingPipeline`)
- `BriefingPipelineResult` тип в `briefing-types.ts`
- DB: `deliveryEnabled`, `deliveryFormat` в BriefingSettings
- DB: `deliveryStatus` в BriefingHistory
- Queries: `updateBriefingDeliveryStatus()`, `getUsersForDelivery()`

### Changed
- `app/(chat)/api/briefing/generate/route.ts` — рефакторинг в тонкую обёртку
- `upsertBriefingSettings()` — поддержка deliveryEnabled, deliveryFormat

### Files
- lib/briefing/briefing-pipeline.ts
- lib/briefing/briefing-types.ts
- app/(chat)/api/briefing/generate/route.ts
- lib/db/schema.ts
- lib/db/queries.ts

## Сессия 1 — 2026-02-26

### Added
- SPEC.md — копия ТЗ
- ANALYSIS.md — анализ + согласованные решения
- ROADMAP.md — план внедрения
- HANDOFF.md — начальный статус
