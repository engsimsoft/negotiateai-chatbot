# Changelog ТЗ-DEV2: Pipeline Observability

## [Этап 5] — 2026-03-01

### Создано
- `components/dev-panel/pipeline-trace-footer.tsx` — compact monospace footer: live status during generation, final summary (tokens, cost, duration, URL verification, errors). Opens drawer on click. Gated by `IS_DEV_MODE`
- `components/dev-panel/pipeline-trace-drawer.tsx` — Sheet (right, 440px): Summary, Stages (per-stage AI call details), Fetches (URL/method/duration/items), Raw JSON. Radix Collapsible sections

### Изменено
- `hooks/use-briefing-generation.ts` — parse `{trace:...}` and `{traceSummary:...}` from NDJSON stream (dev mode), return `traceStages` + `traceSummary`
- `hooks/use-podcast-generation.ts` — same trace parsing pattern
- `components/dev-panel/index.ts` — +exports: PipelineTraceFooter, PipelineTraceDrawer
- `components/briefing/briefing-generation-progress.tsx` — +trace props, renders PipelineTraceFooter
- `components/briefing/podcast-progress.tsx` — +trace props, renders PipelineTraceFooter
- `components/briefing/briefing-page-client.tsx` — thread traceStages/traceSummary to progress components, capture `_trace` from section refresh response, store per-section traces
- `components/briefing/briefing-issue-content.tsx` — +traceStages/traceSummary in podcastProgress type, +sectionTraces prop
- `components/briefing/briefing-article-view.tsx` — +sectionTraces prop, compact trace badge after section refresh (tokens · cost · duration)
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — pass trace props to BriefingGenerationProgress

### Валидация
- `npx tsc --noEmit` — 0 ошибок
- `npm run build` — успешен

## [Этап 4] — 2026-03-01

### Создано
- `lib/db/migrations/0043_briefing-history-metadata.sql` — ALTER TABLE ADD COLUMN metadata jsonb

### Изменено
- `lib/db/schema.ts` — +`metadata: jsonb("metadata")` в briefingHistory
- `lib/db/queries.ts` — `saveBriefingHistory()` +optional `metadata` param; new `updateBriefingMetadata()` (merge pattern for cron)
- `lib/briefing/briefing-pipeline.ts` — traceSummary computed before save, passed as `metadata: { briefingTrace }`. Both success and failure paths.
- `app/api/cron/briefing/route.ts` — +`updateBriefingMetadata({ briefingId, metadata: { podcastTrace } })` after podcast pipeline, non-blocking .catch()

### Валидация
- `npx tsc --noEmit` — 0 ошибок
- `npm run build` — успешен
- SQL: metadata column exists in BriefingHistory

## [Этап 3] — 2026-03-01

### Изменено (инструментирование)
- `lib/podcast/script-generator.ts` — usage capture, timing, retry count, word count, PipelineStageTrace
- `lib/podcast/tts-gemini.ts` — return type `Buffer` → `{ buffer, trace? }`, timing, audio duration, retry trace
- `lib/podcast/index.ts` — +`segmentTrace?: SegmentTrace` return
- `lib/podcast/podcast-pipeline.ts` — TraceCollector, per-topic trace, onTrace, traceSummary
- `app/(chat)/api/briefing/podcast/generate/route.ts` — onTrace for dev mode NDJSON
- `lib/ai/tools/perplexity-client.ts` — full usage (prompt + completion + total), timing
- `lib/briefing/research-engine.ts` — per-topic PipelineStageTrace, verification traces
- `app/(chat)/api/briefing/refresh-section/route.ts` — TraceCollector, _trace in response

### Валидация
- `npx tsc --noEmit` — 0 ошибок
- `npm run build` — успешен

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
