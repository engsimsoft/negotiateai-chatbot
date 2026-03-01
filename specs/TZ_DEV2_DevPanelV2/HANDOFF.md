# Handoff ТЗ-DEV2: Pipeline Observability

**Последнее обновление:** 2026-03-01
**Текущий этап:** Этап 4 завершён ✅ → Этап 5 следующий

---

## Состояние

- [x] Фаза 1: Анализ (SPEC.md, ANALYSIS.md)
- [x] Фаза 2: Планирование (ROADMAP.md, CHANGELOG.md, HANDOFF.md)
- [ ] Фаза 3: Разработка (6 этапов)
  - [x] **Этап 1:** Типы + Pricing + Trace Collector
  - [x] **Этап 2:** Инструментирование Briefing Pipeline (backend)
  - [x] **Этап 3:** Podcast + Research + Section Refresh
  - [x] **Этап 4:** Cron trace + DB metadata
  - [ ] **Этап 5:** UI — Trace Footer + Drawer ← СЛЕДУЮЩИЙ
  - [ ] Этап 6: Финализация
- [ ] Фаза 4: Финализация

---

## Что сделано в Этапе 4

### Изменённые файлы (5 файлов + 1 миграция)

**Schema + Migration:**
- `lib/db/schema.ts` — +`metadata: jsonb("metadata")` column to `briefingHistory` table
- `lib/db/migrations/0043_briefing-history-metadata.sql` — **новый** ALTER TABLE ADD COLUMN

**Queries:**
- `lib/db/queries.ts` — `saveBriefingHistory()` now accepts optional `metadata: Record<string, unknown>` param, saved as jsonb. New `updateBriefingMetadata()` function for merging additional metadata (e.g. podcast trace) into existing record.

**Pipeline → DB trace flow:**
- `lib/briefing/briefing-pipeline.ts` — traceSummary computed BEFORE final `saveBriefingHistory()` call, passed as `metadata: { briefingTrace: traceSummary }`. Both success and failure paths save trace metadata.
- `app/api/cron/briefing/route.ts` — after podcast pipeline completes, calls `updateBriefingMetadata({ briefingId, metadata: { podcastTrace: traceSummary } })` to merge podcast trace into existing briefing metadata. Non-blocking `.catch()` so podcast trace failure doesn't break delivery.

### Ключевые решения Этапа 4
1. **Separate column vs briefingJson** — metadata is a separate `jsonb` column, not embedded in `briefingJson`. Clean separation: content vs diagnostics.
2. **Merge pattern** — `updateBriefingMetadata` reads existing metadata, spreads new data on top. Supports cron flow: briefing trace saved first → podcast trace merged after.
3. **Non-blocking podcast trace** — `.catch()` on `updateBriefingMetadata` in cron. Podcast trace is nice-to-have, must not block Telegram delivery.
4. **Guard: isSimplyDevMode** — TraceCollector is no-op when dev mode is off. In production, `trace.getSummary()` returns minimal data (pipeline name only), so metadata will be very small.

### Валидация
- `npx tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- SQL: `metadata` column exists, currently `null` for existing records ✅
- **Ожидает мануальный тест:** генерация брифинга → `SELECT metadata` shows trace data

---

## Контекст проекта

### Что делаем
Полная трассировка AI-pipeline: briefing, podcast, section refresh, research. Разработчик видит каждый AI-вызов, каждый fetch, каждую ошибку, верификацию URL (fabricated vs real), стоимость. Это ТОЛЬКО observability — не меняем поведение pipeline.

### Стратегия: сначала panel, потом fixes
- **ТЗ-DEV2** (текущее) — observability, zero behavior change, additive only
- **ТЗ-FIX4** (потом) — pipeline hardening: URL validation, sourceItemId checks, tierMap fix. С панелью можно чинить с видимостью.

---

## Следующий: Этап 5 — UI — Trace Footer + Drawer

**Перед началом:** Прочитать ROADMAP.md (Этап 5), затем эти файлы:

### Файлы для изменения
1. `hooks/use-briefing-generation.ts` — parse `{trace:...}` и `{traceSummary:...}` events из NDJSON
2. `hooks/use-podcast-generation.ts` — аналогично
3. `components/dev-panel/pipeline-trace-footer.tsx` — **новый** (compact monospace line)
4. `components/dev-panel/pipeline-trace-drawer.tsx` — **новый** (Sheet с полной трассировкой)
5. `components/briefing/briefing-generation-progress.tsx` — footer slot
6. `components/briefing/podcast-progress.tsx` — footer slot
7. `components/briefing/briefing-article-view.tsx` — refresh badge (dev mode)

### Reference файлы
- `lib/ai/pipeline-trace.ts` — типы PipelineTraceSummary
- `components/dev-panel/dev-panel-footer.tsx` — аналог для chat (паттерн)
- `components/dev-panel/dev-panel-drawer.tsx` — аналог для chat (паттерн)

---

## Полный список файлов ТЗ

| Файл | Назначение |
|------|-----------|
| `specs/TZ_DEV2_DevPanelV2/SPEC.md` | Полное ТЗ (типы, требования, архитектура) |
| `specs/TZ_DEV2_DevPanelV2/ANALYSIS.md` | Code review: 12 проблем, карта AI-вызовов |
| `specs/TZ_DEV2_DevPanelV2/ROADMAP.md` | 6 этапов с задачами и валидацией |
| `specs/TZ_DEV2_DevPanelV2/CHANGELOG.md` | Лог изменений |
| `specs/TZ_DEV2_DevPanelV2/HANDOFF.md` | Этот файл |
