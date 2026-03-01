# Handoff ТЗ-DEV2: Pipeline Observability

**Последнее обновление:** 2026-03-01
**Текущий этап:** Этап 6 завершён ✅ — ожидает мануальный тест + перенос в архив

---

## Состояние

- [x] Фаза 1: Анализ (SPEC.md, ANALYSIS.md)
- [x] Фаза 2: Планирование (ROADMAP.md, CHANGELOG.md, HANDOFF.md)
- [x] Фаза 3: Разработка (6 этапов)
  - [x] **Этап 1:** Типы + Pricing + Trace Collector
  - [x] **Этап 2:** Инструментирование Briefing Pipeline (backend)
  - [x] **Этап 3:** Podcast + Research + Section Refresh
  - [x] **Этап 4:** Cron trace + DB metadata
  - [x] **Этап 5:** UI — Trace Footer + Drawer + persistent trace
  - [x] **Этап 6:** Финализация (CHANGELOG, SIMPLY_STATUS, CLAUDE.md, ADR 030, docs, v3.58.0)
- [ ] Фаза 4: Мануальный тест + архив

---

## Что сделано в Этапе 5

### Изменённые файлы (11 файлов, 2 новых)

**Новые компоненты:**
- `components/dev-panel/pipeline-trace-footer.tsx` — compact monospace footer: live status during generation (stages count, tokens, cost, elapsed timer), final summary after completion (status icon, tokens, cost, duration, URL verification, errors). Opens PipelineTraceDrawer on click. Gated by `IS_DEV_MODE`.
- `components/dev-panel/pipeline-trace-drawer.tsx` — Sheet (right, 440px): Summary (KV pairs), Stages (per-stage AI call details), Fetches (URL/method/duration/items), Raw JSON. Uses Radix Collapsible.

**Client-side trace parsing (hooks):**
- `hooks/use-briefing-generation.ts` — parse `{trace:...}` and `{traceSummary:...}` from NDJSON stream (dev mode gate), return `traceStages` + `traceSummary`
- `hooks/use-podcast-generation.ts` — same pattern

**Integration (component tree threading):**
- `components/dev-panel/index.ts` — +PipelineTraceFooter, +PipelineTraceDrawer exports
- `components/briefing/briefing-generation-progress.tsx` — +trace props, renders `<PipelineTraceFooter>` at bottom
- `components/briefing/podcast-progress.tsx` — +trace props, renders `<PipelineTraceFooter>` after actions
- `components/briefing/briefing-page-client.tsx` — thread trace props to all consumers: BriefingGenerationProgress, podcastProgress object. Capture `_trace` from section refresh API response, store per-section traces in state.
- `components/briefing/briefing-issue-content.tsx` — +traceStages/traceSummary in podcastProgress type, +sectionTraces prop, thread to BriefingArticleView
- `components/briefing/briefing-article-view.tsx` — +sectionTraces prop, compact trace badge after section refresh (tokens · cost · duration · errors)
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — pass generation.traceStages/traceSummary to BriefingGenerationProgress

### Ключевые решения Этапа 5
1. **IS_DEV_MODE gate on client** — `NEXT_PUBLIC_SIMPLY_DEV_MODE` checked in hooks (skip trace parsing) and components (skip rendering). Zero overhead in production.
2. **Same NDJSON transport** — trace events (`{trace:...}`, `{traceSummary:...}`) interleaved with progress events. No separate channel needed.
3. **Section refresh badge** — trace stored in `Record<string, PipelineTraceSummary>` keyed by topicId. Badge only shows after refresh and only in dev mode.
4. **Reusable footer/drawer pattern** — PipelineTraceFooter + PipelineTraceDrawer work for both briefing and podcast generation with same props interface.

### Валидация
- `npx tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- **Ожидает мануальный тест:** генерация брифинга → footer с live trace → drawer с полной информацией

---

## Контекст проекта

### Что делаем
Полная трассировка AI-pipeline: briefing, podcast, section refresh, research. Разработчик видит каждый AI-вызов, каждый fetch, каждую ошибку, верификацию URL (fabricated vs real), стоимость. Это ТОЛЬКО observability — не меняем поведение pipeline.

### Стратегия: сначала panel, потом fixes
- **ТЗ-DEV2** (текущее) — observability, zero behavior change, additive only
- **ТЗ-FIX4** (потом) — pipeline hardening: URL validation, sourceItemId checks, tierMap fix. С панелью можно чинить с видимостью.

---

## Следующий: Этап 6 — Финализация

**Перед началом:** Прочитать ROADMAP.md (Этап 6) и DOCUMENTATION_GUIDE.md

### Задачи
1. Обновить главный CHANGELOG.md
2. Обновить SIMPLY_STATUS.md
3. Обновить CLAUDE.md (новые файлы: pipeline-trace-footer/drawer)
4. Обновить package.json: 3.57.0 → 3.58.0
5. ADR: `docs/decisions/030-pipeline-observability.md`
6. Обновить docs/architecture.md, docs/ai-providers.md
7. SQL-проверка: metadata в BriefingHistory
8. Финальный мануальный тест
9. Переместить specs в `_archive/`

---

## Полный список файлов ТЗ

| Файл | Назначение |
|------|-----------|
| `specs/TZ_DEV2_DevPanelV2/SPEC.md` | Полное ТЗ (типы, требования, архитектура) |
| `specs/TZ_DEV2_DevPanelV2/ANALYSIS.md` | Code review: 12 проблем, карта AI-вызовов |
| `specs/TZ_DEV2_DevPanelV2/ROADMAP.md` | 6 этапов с задачами и валидацией |
| `specs/TZ_DEV2_DevPanelV2/CHANGELOG.md` | Лог изменений |
| `specs/TZ_DEV2_DevPanelV2/HANDOFF.md` | Этот файл |
