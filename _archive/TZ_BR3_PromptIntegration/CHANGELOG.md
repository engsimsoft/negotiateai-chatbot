# Changelog ТЗ-BR3: Интеграция промпта аналитика

## Сессия 1 — 2026-02-19

### Added
- `lib/prompts/briefing/briefing-analyst.md` — промпт аналитика от PE

### Changed
- `lib/briefing/briefing-analyzer.ts` — загрузка промпта из .md файла, tierMap в AnalyzerInput, tier в candidatesText
- `app/(chat)/api/briefing/generate/route.ts` — сборка tierMap из userSources и defaults
- `components/briefing/briefing-content.tsx` — поддержка topicId "top" с fallback для старых брифингов

### Files
- lib/prompts/briefing/briefing-analyst.md
- lib/briefing/briefing-analyzer.ts
- app/(chat)/api/briefing/generate/route.ts
- components/briefing/briefing-content.tsx
