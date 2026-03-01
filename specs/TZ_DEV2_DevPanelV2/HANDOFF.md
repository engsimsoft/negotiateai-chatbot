# Handoff ТЗ-DEV2: Pipeline Observability

**Последнее обновление:** 2026-03-01
**Текущий этап:** Этап 3 завершён ✅ → Этап 4 следующий

---

## Состояние

- [x] Фаза 1: Анализ (SPEC.md, ANALYSIS.md)
- [x] Фаза 2: Планирование (ROADMAP.md, CHANGELOG.md, HANDOFF.md)
- [ ] Фаза 3: Разработка (6 этапов)
  - [x] **Этап 1:** Типы + Pricing + Trace Collector
  - [x] **Этап 2:** Инструментирование Briefing Pipeline (backend)
  - [x] **Этап 3:** Podcast + Research + Section Refresh
  - [ ] **Этап 4:** Cron trace + DB metadata ← СЛЕДУЮЩИЙ
  - [ ] Этап 5: UI — Trace Footer + Drawer
  - [ ] Этап 6: Финализация
- [ ] Фаза 4: Финализация

---

## Что сделано в Этапе 3

### Изменённые файлы (8 файлов)

**Podcast instrumented (3 + 1 route):**
- `lib/podcast/script-generator.ts` — usage capture (AI SDK v5: inputTokens/outputTokens), timing wrap, retry count accumulation across attempts, word count, PipelineStageTrace return
- `lib/podcast/tts-gemini.ts` — `generateSpeechWithRetry` return changed: `Buffer` → `{ buffer, trace? }`, timing, PCM→audio duration (24kHz 16-bit mono = 48000 bytes/sec), retry trace via `buildTtsTrace()`
- `lib/podcast/index.ts` — `generatePodcastSegment` returns `segmentTrace?: SegmentTrace` (scriptTrace + ttsTrace), updated for new `generateSpeechWithRetry` return type
- `lib/podcast/podcast-pipeline.ts` — TraceCollector("podcast"), per-topic script+TTS trace collection, `onTrace` callback, `emitTrace()` pattern, `traceSummary` in PodcastPipelineResult
- `app/(chat)/api/briefing/podcast/generate/route.ts` — `onTrace` for dev mode NDJSON streaming (gated by isSimplyDevMode)

**Research instrumented (2):**
- `lib/ai/tools/perplexity-client.ts` — full usage (promptTokens + completionTokens + totalTokens), `durationMs` timing in result
- `lib/briefing/research-engine.ts` — per-topic PipelineStageTrace with Perplexity AI call trace (model, tokens, cost), FetchTrace per verification (web + telegram), `verifySourceWithTrace` + `verifyTelegramChannelWithTrace` wrappers, traces[] in ResearchResult

**Section refresh instrumented (1):**
- `app/(chat)/api/briefing/refresh-section/route.ts` — TraceCollector("section-refresh"), filter + author trace collection, `_trace` field in JSON response (dev mode only via isSimplyDevMode)

### Ключевые решения Этапа 3
1. **generateSpeechWithRetry return type changed** — `Buffer` → `{ buffer, trace? }`. Breaking for callers, but only `index.ts` calls it (updated simultaneously)
2. **SegmentTrace type** — new interface in `lib/podcast/index.ts` grouping scriptTrace + ttsTrace. Pipeline collects both via `trace.addStage()`
3. **PCM audio duration** — `buffer.length / 48000` (24kHz, 16-bit, mono = 48000 bytes/sec)
4. **Research trace wrappers** — `verifySourceWithTrace` / `verifyTelegramChannelWithTrace` wrap originals to record FetchTrace without modifying logic
5. **Perplexity usage expanded** — was `{ totalTokens }`, now `{ promptTokens, completionTokens, totalTokens }`. Backward compatible
6. **Section refresh _trace** — underscore prefix = dev metadata, only when `isSimplyDevMode`

### Валидация
- `npx tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- **Ожидает мануальный тест:** подкаст генерируется как раньше, refresh секции работает
- **Git commit НЕ сделан** — нужно после мануального теста

---

## Контекст проекта

### Что делаем
Полная трассировка AI-pipeline: briefing, podcast, section refresh, research. Разработчик видит каждый AI-вызов, каждый fetch, каждую ошибку, верификацию URL (fabricated vs real), стоимость. Это ТОЛЬКО observability — не меняем поведение pipeline.

### Стратегия: сначала panel, потом fixes
- **ТЗ-DEV2** (текущее) — observability, zero behavior change, additive only
- **ТЗ-FIX4** (потом) — pipeline hardening: URL validation, sourceItemId checks, tierMap fix. С панелью можно чинить с видимостью.

---

## Следующий: Этап 4 — Cron trace + Briefing History metadata

**Перед началом:** Прочитать ROADMAP.md (Этап 4), затем эти файлы:

### Файлы для изменения
1. `lib/briefing/briefing-pipeline.ts` — проверить что traceSummary возвращается в background mode (уже делает)
2. `lib/podcast/podcast-pipeline.ts` — traceSummary уже в результате (добавлен в Этапе 3)
3. `app/api/cron/briefing/route.ts` — передать traceSummary в saveBriefingHistory metadata
4. `lib/db/queries.ts` — убедиться что saveBriefingHistory принимает metadata (jsonb)

### Reference файлы
- `lib/ai/pipeline-trace.ts` — типы и TraceCollector
- `lib/briefing/briefing-pipeline.ts` — уже возвращает traceSummary
- `lib/podcast/podcast-pipeline.ts` — уже возвращает traceSummary

---

## Полный список файлов ТЗ

| Файл | Назначение |
|------|-----------|
| `specs/TZ_DEV2_DevPanelV2/SPEC.md` | Полное ТЗ (типы, требования, архитектура) |
| `specs/TZ_DEV2_DevPanelV2/ANALYSIS.md` | Code review: 12 проблем, карта AI-вызовов |
| `specs/TZ_DEV2_DevPanelV2/ROADMAP.md` | 6 этапов с задачами и валидацией |
| `specs/TZ_DEV2_DevPanelV2/CHANGELOG.md` | Лог изменений |
| `specs/TZ_DEV2_DevPanelV2/HANDOFF.md` | Этот файл |
