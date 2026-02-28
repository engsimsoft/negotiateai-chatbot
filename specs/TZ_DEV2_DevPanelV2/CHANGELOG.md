# Changelog ТЗ-DEV2: Pipeline Observability

## [Этап 1] — 2026-02-28

### Создано
- `lib/ai/pipeline-trace.ts` — 12 типов + TraceCollector + helpers (buildAiCallTrace, buildTtsTrace, verifyArticleUrls)

### Изменено
- `lib/ai/providers.ts` — +5 моделей в pricing (Gemini, Perplexity, Claude fallback), +calculateTtsCostRub()

### Валидация
- `npx tsc --noEmit` — 0 ошибок
- `npm run build` — успешен

## [Планирование] — 2026-02-28

### Создано
- SPEC.md v2.0 — полное ТЗ с фокусом на диагностику pipeline
- ANALYSIS.md — code review, 12 найденных проблем, карта AI-вызовов
- ROADMAP.md — 6 этапов (types → briefing → podcast → cron → UI → finalize)
- CHANGELOG.md
- HANDOFF.md
