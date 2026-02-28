# Changelog ТЗ-DEV2: Pipeline Observability

## [Этап 2] — 2026-03-01

### Изменено (инструментирование)
- `lib/briefing/source-fetchers/types.ts` — +`trace?: FetchTrace` в FetchResult
- `lib/telegram/types.ts` — +`warnings?: string[]` в TelegramParseResult
- `lib/briefing/source-fetchers/rss-fetcher.ts` — timing wrap, per-entry try/catch, drop reason counters (no_title/no_url/stale/no_content/parse_error), FetchTrace с dataFlow
- `lib/briefing/source-fetchers/telegram-fetcher.ts` — timing, parser warnings collection, dataFlow (missing_text/media_only), FetchTrace
- `lib/telegram/parser.ts` — `catch {}` → `catch(e) { warnings.push(...) }` (silent failure fix)
- `lib/briefing/source-fetchers/web-fetcher.ts` — timing, FetchPageSource tracking, publishedAt warning, FetchTrace
- `lib/briefing/briefing-filter.ts` — timing, inputTokens/outputTokens, calculateCostRub, post-generation validation (sourceItemId/URL/topicId), PipelineStageTrace
- `lib/briefing/briefing-author.ts` — timing, full usage, retry/fallback trace (primaryError + fallbackUsed), prompt preview 500 chars, PipelineStageTrace
- `lib/briefing/briefing-section-author.ts` — timing, full usage, retry/fallback trace, PipelineStageTrace
- `lib/briefing/briefing-pipeline.ts` — TraceCollector orchestration, fetch/filter/author stage traces, per-item fullTexts miss warnings, URL verification (verifyArticleUrls), onTrace callback, traceSummary in result, .catch fix on error DB save
- `lib/briefing/briefing-types.ts` — +`traceSummary?: PipelineTraceSummary` в BriefingPipelineResult
- `app/(chat)/api/briefing/generate/route.ts` — +onTrace for dev mode NDJSON streaming
- `lib/ai/pipeline-trace.ts` — +`"semantic"` в FetchTrace.method, +`dataFlow?: DataFlowTrace` в FetchTrace

### Валидация
- `npx tsc --noEmit` — 0 ошибок
- `npm run build` — успешен

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
