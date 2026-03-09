# Changelog ТЗ-CACHE3: Единый SSOT отображения стоимости

## Сессия 3 — 2026-03-06

### Changed
- `components/dev-panel/dev-panel-footer.tsx` — hydration fix (mounted state)
- `components/dev-panel/dev-panel-provider.tsx` — попытки fix batch-to-message matching (НЕ решено, WIP)

### Investigated
- DevPanel footer не появляется с первого сообщения после рестарта (pre-existing bug)
- Root cause: race condition `dataStream` (immediate) vs `messages` (throttled 100ms)
- Три подхода попробованы, ни один не решил проблему полностью
- Подробный план решения в HANDOFF.md

### Discovered
- `cache_creation_input_tokens` (Anthropic cache write) не доступен в AI SDK v5
- Это причина расхождения стоимости между DevPanel и консолью Anthropic
- Решение: ТЗ-SDK6 (миграция на AI SDK v6)

## Сессия 2 — 2026-03-06

### Added (committed)
- `991c1fa` — Этап 1: `lib/constants/pricing.ts` (RUB_PER_USD SSOT), обновлены импорты в `providers.ts` и `tokenlens-catalog.ts`
- `5a82177` — Этап 2: 11 файлов pipeline → `calcStepCostRub()` (TokenLens SSOT), catalog threading через pipeline chain

### Changed
- `lib/ai/pipeline-trace.ts` — `buildAiCallTrace()` + `TraceCollector` используют `calcStepCostRub` + `ModelCatalog`
- `lib/briefing/briefing-pipeline.ts` — fetch catalog, pass to filter + author
- `lib/briefing/briefing-filter.ts` — `catalog?: ModelCatalog` param, `calcStepCostRub`
- `lib/briefing/briefing-author.ts` — `catalog` в `AuthorInput`, `calcStepCostRub`
- `lib/briefing/briefing-section-author.ts` — `catalog` в `SectionAuthorInput`, `calcStepCostRub`
- `lib/briefing/research-engine.ts` — `catalog` через замыкание, `calcStepCostRub`
- `lib/podcast/podcast-pipeline.ts` — fetch catalog, pass to script generator
- `lib/podcast/script-generator.ts` — `catalog?: ModelCatalog`, `calcStepCostRub`
- `lib/podcast/index.ts` — thread catalog через `generatePodcastSegment`
- `app/(chat)/api/briefing/refresh-section/route.ts` — fetch catalog, pass through

## Сессия 1 — 2026-03-03

### Added
- SPEC.md — копия ТЗ
- ANALYSIS.md — анализ + код-ревью (4 вопроса, все решены)
- ROADMAP.md — план из 4 этапов
- CHANGELOG.md
- HANDOFF.md
