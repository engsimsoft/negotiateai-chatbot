# Handoff ТЗ-DEV2: Pipeline Observability

**Последнее обновление:** 2026-03-01
**Текущий этап:** Этап 2 завершён ✅ → Этап 3 следующий

---

## Состояние

- [x] Фаза 1: Анализ (SPEC.md, ANALYSIS.md)
- [x] Фаза 2: Планирование (ROADMAP.md, CHANGELOG.md, HANDOFF.md)
- [ ] Фаза 3: Разработка (6 этапов)
  - [x] **Этап 1:** Типы + Pricing + Trace Collector
  - [x] **Этап 2:** Инструментирование Briefing Pipeline (backend)
  - [ ] **Этап 3:** Podcast + Research ← СЛЕДУЮЩИЙ
  - [ ] Этап 4: Cron trace + DB metadata
  - [ ] Этап 5: UI — Trace Footer + Drawer
  - [ ] Этап 6: Финализация
- [ ] Фаза 4: Финализация

---

## Что сделано в Этапе 2

### Изменённые файлы (13 файлов)

**Types extended:**
- `lib/briefing/source-fetchers/types.ts` — +`trace?: FetchTrace` в FetchResult
- `lib/telegram/types.ts` — +`warnings?: string[]` в TelegramParseResult
- `lib/briefing/briefing-types.ts` — +`traceSummary?: PipelineTraceSummary` в BriefingPipelineResult
- `lib/ai/pipeline-trace.ts` — +`"semantic"` в FetchTrace.method, +`dataFlow?` в FetchTrace

**Fetchers instrumented (3):**
- `rss-fetcher.ts` — timing, per-entry try/catch, drop counters, FetchTrace+dataFlow
- `telegram-fetcher.ts` — timing, warnings from parser, dataFlow, FetchTrace
- `web-fetcher.ts` — timing, FetchPageSource tracking, publishedAt warning, FetchTrace
- `lib/telegram/parser.ts` — `catch {}` → `catch(e) { warnings.push() }`

**AI stages instrumented (3):**
- `briefing-filter.ts` — PipelineStageTrace: timing, inputTokens/outputTokens, costRub, post-gen validation (sourceItemId, URL, topicId)
- `briefing-author.ts` — PipelineStageTrace: timing, usage, retry/fallback trace, prompt preview 500 chars
- `briefing-section-author.ts` — PipelineStageTrace: timing, usage, retry/fallback trace

**Orchestrator + Route:**
- `briefing-pipeline.ts` — TraceCollector, fetch/filter/author stage collection, per-item miss warnings, URL verification, onTrace callback, traceSummary in result, .catch fix
- `app/(chat)/api/briefing/generate/route.ts` — +onTrace for dev mode NDJSON streaming

### Ключевые решения Этапа 2
1. **AI SDK v5 usage** — свойства `inputTokens`/`outputTokens` (не `promptTokens`/`completionTokens`)
2. **Trace data always collected** — timing/counts in fetchers are always populated (near-zero cost). TraceCollector gating (`isSimplyDevMode`) determines whether stages are stored/emitted
3. **FetchTrace.dataFlow** — добавлен optional field для per-fetch breakdown (RSS entries, Telegram posts)
4. **Trace return pattern** — каждая функция возвращает `trace?: PipelineStageTrace` рядом с основными данными. Pipeline собирает через `TraceCollector`

### Валидация
- `npx tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- **Ожидает мануальный тест:** генерация брифинга работает как раньше (trace не ломает pipeline)
- **Git commit НЕ сделан** — нужно после мануального теста

---

## Контекст проекта

### Что делаем
Полная трассировка AI-pipeline: briefing, podcast, section refresh, research. Разработчик видит каждый AI-вызов, каждый fetch, каждую ошибку, верификацию URL (fabricated vs real), стоимость. Это ТОЛЬКО observability — не меняем поведение pipeline.

### Стратегия: сначала panel, потом fixes
- **ТЗ-DEV2** (текущее) — observability, zero behavior change, additive only
- **ТЗ-FIX4** (потом) — pipeline hardening: URL validation, sourceItemId checks, tierMap fix. С панелью можно чинить с видимостью.

---

## Следующий: Этап 3 — Инструментирование Podcast Pipeline + Research

**Перед началом:** Прочитать ROADMAP.md (Этап 3), затем эти файлы:

### Файлы для инструментирования
1. `lib/podcast/script-generator.ts` — usage capture (сейчас полностью игнорируется!), timing, retry count + word count
2. `lib/podcast/tts-gemini.ts` — timing, audio duration, retry trace
3. `lib/podcast/podcast-pipeline.ts` — TraceCollector, per-topic trace, emit events
4. `lib/ai/tools/perplexity-client.ts` — полный usage (prompt_tokens + completion_tokens)
5. `lib/briefing/research-engine.ts` — per-topic trace: Perplexity + fetchPage
6. `app/(chat)/api/briefing/refresh-section/route.ts` — trace in JSON response

### Reference файлы
- `lib/ai/pipeline-trace.ts` — типы и TraceCollector
- `lib/briefing/briefing-pipeline.ts` — reference pattern (Этап 2)
- `lib/briefing/briefing-author.ts` — reference pattern for AI stage tracing

---

## Полный список файлов ТЗ

| Файл | Назначение |
|------|-----------|
| `specs/TZ_DEV2_DevPanelV2/SPEC.md` | Полное ТЗ (типы, требования, архитектура) |
| `specs/TZ_DEV2_DevPanelV2/ANALYSIS.md` | Code review: 12 проблем, карта AI-вызовов |
| `specs/TZ_DEV2_DevPanelV2/ROADMAP.md` | 6 этапов с задачами и валидацией |
| `specs/TZ_DEV2_DevPanelV2/CHANGELOG.md` | Лог изменений |
| `specs/TZ_DEV2_DevPanelV2/HANDOFF.md` | Этот файл |
