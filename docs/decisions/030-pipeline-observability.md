# ADR 030: Pipeline Observability

**Дата:** 2026-03-01
**Статус:** Принято
**ТЗ:** DEV2 (v3.58.0)

## Контекст

Developer Panel (ADR 029, v3.57.0) покрывает только чат — модель, токены, стоимость, Guardian, промпт. Pipeline-уровень (briefing, podcast, section refresh) оставался невидимым: каждый AI-вызов, каждый fetch, retry, fallback, URL verification — всё в тишине.

4 дня отладки вслепую показали проблемы:
1. URL fabrication (фильтр Gemini и автор Claude могут подменить/придумать URL)
2. Silent failures (`.catch(() => {})`, `catch {}` скрывают ошибки)
3. Стоимость генерации неизвестна (сколько стоит один брифинг? подкаст?)
4. Retry и fallback невидимы (до 4 retry в script-generator, fallback модели в author)

## Решение

Единая система трассировки `PipelineTrace` → `TraceCollector` → JSON Lines streaming + DB persistence.

### Архитектура

```
TraceCollector (lib/ai/pipeline-trace.ts)
├── addStage(PipelineStageTrace)     — AI call / fetch batch
├── setUrlVerification(UrlCheck[])   — URL verification results
├── getSummary() → PipelineTraceSummary (compact)
└── getFullTrace() → PipelineTrace (stages + summary + urlVerification)

Pipeline (briefing/podcast) → TraceCollector → emit NDJSON events → save to DB metadata
                                                     ↓
Client hooks (use-briefing-generation / use-podcast-generation)
  → parse {trace:...} / {traceSummary:...} events
  → PipelineTraceFooter (compact monospace line)
  → PipelineTraceDrawer (Sheet: Summary, Cost Breakdown, Stages, Fetches, Raw)

Server Component (briefing/page.tsx)
  → load from DB metadata → normalize old/new format → persistent footer
```

### Ключевые решения

1. **TraceCollector gated by isSimplyDevMode** — все методы no-op в production. Zero overhead.
2. **JSON Lines (NDJSON)** — trace events интерливятся с progress events в том же потоке. Не нужен отдельный канал.
3. **Full trace в DB** — `briefingHistory.metadata` (jsonb) хранит полный `PipelineTrace` (со stages), не только summary. Позволяет post-mortem анализ после перезагрузки.
4. **Backwards compatibility** — server component нормализует старый формат (PipelineTraceSummary без stages) в PipelineTrace shape с пустым stages.
5. **Reusable footer/drawer** — `PipelineTraceFooter` + `PipelineTraceDrawer` работают для briefing и podcast с одним props interface.
6. **URL Verification** — `verifyArticleUrls()` сверяет каждый URL из итоговой статьи с источниками на каждом этапе (fetcher → filter → author). Классификация: verified / modified / fabricated.

## Причины

1. **Observability перед fixes** — сначала видимость, потом исправления. С панелью можно чинить pipeline с полной видимостью каждого шага
2. **Additive only** — не меняем поведение pipeline, только добавляем инструментирование
3. **Dev-only** — production не затрагивается (guard на каждом уровне: server + client)

## Последствия

**Плюсы:**
- Разработчик видит каждый AI-вызов, fetch, ошибку, стоимость
- URL fabrication сразу видна
- Silent failures заменены на warnings (visible в trace)
- Стоимость генерации прозрачна (per-stage и total)

**Минусы:**
- metadata column добавляет ~5-20KB к каждой записи BriefingHistory
- Research engine (онбординг) пока не отображает trace в UI (запланировано отдельным ТЗ)

## Альтернативы

1. **OpenTelemetry / external APM** — слишком тяжело для dev-only инструмента, оверхед в production
2. **Console.log** — нет UI, нет persistence, неудобно для post-mortem
3. **Отдельный SSE канал** — лишняя сложность, NDJSON в том же потоке проще
