# Handoff ТЗ-DEV2: Pipeline Observability

**Последнее обновление:** 2026-02-28
**Текущий этап:** Этап 1 завершён ✅ → Этап 2 следующий

---

## Состояние

- [x] Фаза 1: Анализ (SPEC.md, ANALYSIS.md)
- [x] Фаза 2: Планирование (ROADMAP.md, CHANGELOG.md, HANDOFF.md)
- [ ] Фаза 3: Разработка (6 этапов)
  - [x] **Этап 1:** Типы + Pricing + Trace Collector
  - [ ] **Этап 2:** Инструментирование Briefing Pipeline (backend) ← СЛЕДУЮЩИЙ
  - [ ] Этап 3: Podcast + Research
  - [ ] Этап 4: Cron trace + DB metadata
  - [ ] Этап 5: UI — Trace Footer + Drawer
  - [ ] Этап 6: Финализация
- [ ] Фаза 4: Финализация

---

## Что сделано в Этапе 1

### Новые файлы
- `lib/ai/pipeline-trace.ts` — **основной модуль трассировки**:
  - 12 типов: `PipelineTrace`, `PipelineStageTrace`, `FetchTrace`, `AiCallTrace`, `UrlCheck`, `UrlVerificationTrace`, `PipelineTraceSummary`, `DataFlowTrace`
  - `TraceCollector` класс — аккумулятор trace data с `isSimplyDevMode` guard (no-op в production)
  - `buildAiCallTrace()` — собирает AiCallTrace из Vercel AI SDK result (usage + cost)
  - `buildTtsTrace()` — собирает trace для TTS (cost по секундам аудио)
  - `verifyArticleUrls()` — сравнивает URL в статье с Set fetched URLs, классифицирует: fetcher/filter/fabricated

### Изменённые файлы
- `lib/ai/providers.ts`:
  - +5 моделей в `MODEL_PRICING_RUB`: Gemini 2.0 Flash, Gemini 2.5 Flash, Perplexity Sonar Pro, Claude Sonnet 4.5 (fallback)
  - +`calculateTtsCostRub(durationSeconds)` — TTS pricing по секундам аудио

### Валидация
- `npx tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- **Git commit НЕ сделан** — нужно закоммитить перед Этапом 2

---

## Контекст проекта

### Что делаем
Полная трассировка AI-pipeline: briefing, podcast, section refresh, research. Разработчик видит каждый AI-вызов, каждый fetch, каждую ошибку, верификацию URL (fabricated vs real), стоимость. Это ТОЛЬКО observability — не меняем поведение pipeline.

### Стратегия: сначала panel, потом fixes
- **ТЗ-DEV2** (текущее) — observability, zero behavior change, additive only
- **ТЗ-FIX4** (потом) — pipeline hardening: URL validation, sourceItemId checks, tierMap fix. С панелью можно чинить с видимостью.

### Ключевые решения
1. **JSON Lines transport** — `{trace:...}` events в существующий NDJSON stream
2. **URL Verification** — сравнение URL в итоговой статье с Set fetched URLs. Только показываем, не блокируем
3. **Silent failures → warnings** — `catch {}` → `catch(e) { warnings.push() }` (поведение не меняется)
4. **Cron** → traceSummary в `metadata` поле `briefingHistory` (jsonb)
5. **Prompt** → preview 500 символов
6. **Dev mode gate** — `isSimplyDevMode` на server, `NEXT_PUBLIC_SIMPLY_DEV_MODE` на client

---

## Следующий: Этап 2 — Инструментирование Briefing Pipeline

**Перед началом:** Прочитать ROADMAP.md (Этап 2), затем эти файлы:

### Файлы для инструментирования (прочитать перед работой)
1. `lib/briefing/briefing-pipeline.ts` — оркестратор (trace creation, URL verification, fullTextsMap miss logging)
2. `lib/briefing/briefing-filter.ts` — фильтр (usage, timing, sourceItemId/URL/topicId validation)
3. `lib/briefing/briefing-author.ts` — автор (usage, timing, retry/fallback trace)
4. `lib/briefing/briefing-section-author.ts` — section author (usage, timing)
5. `lib/briefing/source-fetchers/rss-fetcher.ts` — RSS (FetchTrace, per-entry catch)
6. `lib/briefing/source-fetchers/telegram-fetcher.ts` — Telegram (FetchTrace, fix silent catch)
7. `lib/telegram/parser.ts` — **строка 127: `catch {}`** — заменить на `catch(e) { warnings.push() }`
8. `lib/briefing/source-fetchers/web-fetcher.ts` — Web (FetchTrace, publishedAt warning)

### Reference файлы
- `lib/ai/pipeline-trace.ts` — типы и TraceCollector (уже создан)
- `lib/ai/providers.ts` — pricing (уже расширен)
- `lib/ai/debug-events.ts` — reference паттерн (DEV1)

### Аудит архитектора (конкретные факты из БД)
- `duplicatesRemoved: -6` в одном брифинге — фильтр вернул больше items чем получил
- Все tiers = `"unknown"` — tierMap lookup failed для всех sources
- Failed briefing с пустым `briefingJson: {}` — ошибка потеряна из-за `.catch(() => {})`
- `t.me/F1NewsRu_official/32902` в inline тексте, но не в `sources[]` — рассогласование
- Stuck `"generating"` запись — pipeline упал, статус не обновился

---

## Полный список файлов ТЗ

| Файл | Назначение |
|------|-----------|
| `specs/TZ_DEV2_DevPanelV2/SPEC.md` | Полное ТЗ (типы, требования, архитектура) |
| `specs/TZ_DEV2_DevPanelV2/ANALYSIS.md` | Code review: 12 проблем, карта AI-вызовов |
| `specs/TZ_DEV2_DevPanelV2/ROADMAP.md` | 6 этапов с задачами и валидацией |
| `specs/TZ_DEV2_DevPanelV2/CHANGELOG.md` | Лог изменений |
| `specs/TZ_DEV2_DevPanelV2/HANDOFF.md` | Этот файл |
