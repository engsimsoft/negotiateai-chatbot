# Roadmap ТЗ-DEV2: Pipeline Observability

**Создан:** 2026-02-28
**Версия проекта:** 3.57.0 → 3.58.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 1 |
| Сессий (оценка) | 3-5 |

---

## Этап 1: Типы + Pricing + Trace Collector

**Статус:** ✅ Завершён

**Цель:** Фундамент — типы трассировки, расширенный pricing, утилита сбора trace. Проверить что build проходит.

**Задачи:**
- [x] Создать `lib/ai/pipeline-trace.ts` — все типы: `PipelineTrace`, `PipelineStageTrace`, `FetchTrace`, `UrlVerificationTrace`, `UrlCheck`
- [x] Создать `TraceCollector` класс — accumulator: `addStage()`, `addFetch()`, `setUrlVerification()`, `getSummary()`, `getFullTrace()`. Guard: `isSimplyDevMode` — если false, все методы no-op
- [x] Расширить `MODEL_PRICING_RUB` в `lib/ai/providers.ts` — добавить Gemini 2.0 Flash, Gemini 2.5 Flash, Perplexity Sonar Pro, Claude Sonnet 4.5 (fallback)
- [x] Добавить `calculateCostRub()` support для новых моделей (Gemini, Perplexity)
- [x] Добавить TTS pricing utility: `calculateTtsCostRub(durationSeconds)` — по секундам аудио
- [x] Helper: `buildAiCallTrace()` — собирает AiCallTrace из Vercel AI SDK result
- [x] Helper: `buildTtsTrace()` — собирает AiCallTrace для TTS
- [x] Helper: `verifyArticleUrls()` — URL verification с классификацией (fetcher/filter/fabricated)

**Файлы:**
- `lib/ai/pipeline-trace.ts` — **новый** (типы + TraceCollector + helpers)
- `lib/ai/providers.ts` — расширение pricing (+5 моделей, +calculateTtsCostRub)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен

**Git (после валидации):**
```bash
git add lib/ai/pipeline-trace.ts lib/ai/providers.ts
git commit -m "feat(tz-dev2): pipeline trace types + pricing for Gemini/Perplexity"
```

**Критерий готовности:** Типы компилируются, pricing для всех моделей на месте, TraceCollector готов к использованию.

---

## Этап 2: Инструментирование Briefing Pipeline (backend)

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Статус:** ⬜ Не начат

**Цель:** Каждый AI-вызов и каждый fetch в briefing pipeline генерирует trace data. Silent failures заменены на warnings.

**Задачи:**

**Fetchers — добавить FetchTrace:**
- [ ] `rss-fetcher.ts` — timing wrap, item counts (total/dropped по причинам: no_title, no_url, stale, no_content), per-entry catch (сейчас одна ошибка роняет весь feed)
- [ ] `telegram-fetcher.ts` + `lib/telegram/parser.ts` — timing, заменить `catch {}` → `catch(e) { warnings.push(String(e)) }`, считать: posts found / text / fresh / media_skipped / missing_data_post
- [ ] `web-fetcher.ts` — timing, warning если `publishedAt` не определён, какой метод сработал (readability/semantic/jina)

**Filter — полный usage + validation:**
- [ ] `briefing-filter.ts` — `Date.now()` wrap, деструктурировать `promptTokens` + `completionTokens`, `calculateCostRub()`. После генерации: validate sourceItemId (каждый существует в input), validate URL (сравнить output URL vs input URL по sourceItemId), validate topicId (в допустимом списке)

**Author — полный usage + retry trace:**
- [ ] `briefing-author.ts` — `Date.now()` wrap, полный usage (`promptTokens`, `completionTokens`), costRub. Retry/fallback: если primary модель failed — зафиксировать error + fallbackUsed model. Prompt preview (первые 500 символов user message)

**Section author:**
- [ ] `briefing-section-author.ts` — timing, полный usage, costRub, retry/fallback

**Pipeline orchestrator — trace aggregation + URL verification:**
- [ ] `briefing-pipeline.ts` — создать `TraceCollector` в начале, передавать в каждую стадию, собирать trace. fullTextsMap miss → per-item warning (не только общий hit rate). URL verification: после генерации article — собрать все URL из `sections[].sources[].url` + inline markdown links из `sections[].content` (regex `\[.*?\]\((https?://.*?)\)`), сравнить с Set всех `allItems[].url`. Пометить verified/fabricated/modified. Emit `{trace:...}` events в NDJSON stream (при dev mode). Финальный `{traceSummary:...}` event
- [ ] Fix `.catch(() => {})` на DB save → `.catch((e) => { trace.addWarning("db_save_failed", e) })`

**Файлы:**
- `lib/briefing/briefing-pipeline.ts` — trace orchestration, URL verification, DB save fix
- `lib/briefing/briefing-filter.ts` — usage, timing, validation
- `lib/briefing/briefing-author.ts` — usage, timing, retry trace
- `lib/briefing/briefing-section-author.ts` — usage, timing
- `lib/briefing/source-fetchers/rss-fetcher.ts` — FetchTrace, per-entry catch
- `lib/briefing/source-fetchers/telegram-fetcher.ts` — FetchTrace, fix silent catch
- `lib/telegram/parser.ts` — fix silent catch (per-post)
- `lib/briefing/source-fetchers/web-fetcher.ts` — FetchTrace, publishedAt warning

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Dev mode: запустить генерацию брифинга → в console видны trace events с реальными данными (модель, токены, стоимость, fetch details)
- [ ] 🧪 Мануальный тест: генерация брифинга работает как раньше (trace не ломает pipeline)

**Git (после валидации):**
```bash
git add lib/briefing/ lib/telegram/parser.ts
git commit -m "feat(tz-dev2): briefing pipeline instrumentation — trace, usage, URL verification"
```

**Критерий готовности:** При генерации брифинга в dev mode — полная трассировка: каждый fetch, filter/author AI calls с usage/cost, URL verification results, все бывшие silent failures → warnings.

---

## Этап 3: Инструментирование Podcast Pipeline + Research (backend)

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

**Статус:** ⬜ Не начат

**Цель:** Podcast pipeline и research engine генерируют trace data.

**Задачи:**

**Podcast:**
- [ ] `script-generator.ts` — деструктурировать `usage` из `generateText()` (сейчас полностью игнорируется!), timing, retry count + word count per attempt, costRub
- [ ] `tts-gemini.ts` — timing, audio duration (из buffer size: MP3 bitrate → seconds), `usageMetadata` если доступно, retry trace
- [ ] `podcast-pipeline.ts` — создать TraceCollector, per-topic trace (script + tts), emit `{trace:...}` events в NDJSON stream (dev mode), финальный `{traceSummary:...}`

**Research:**
- [ ] `perplexity-client.ts` — захватить `prompt_tokens` + `completion_tokens` (сейчас только total), timing
- [ ] `research-engine.ts` — per-topic trace: Perplexity query time/tokens, fetchPage calls (url, success/fail, time), Telegram parse (channel, posts found)

**Section refresh:**
- [ ] `app/(chat)/api/briefing/refresh-section/route.ts` — добавить trace в JSON response (dev mode): filter + author usage/timing/cost

**Файлы:**
- `lib/podcast/script-generator.ts` — usage capture, timing, retry trace
- `lib/podcast/tts-gemini.ts` — timing, audio metrics
- `lib/podcast/podcast-pipeline.ts` — trace orchestration
- `lib/ai/tools/perplexity-client.ts` — full usage capture
- `lib/briefing/research-engine.ts` — per-topic trace
- `app/(chat)/api/briefing/refresh-section/route.ts` — trace in response

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Dev mode: генерация подкаста → trace events с per-topic script/tts данными
- [ ] 🧪 Мануальный тест: подкаст генерируется как раньше, refresh секции работает

**Git (после валидации):**
```bash
git add lib/podcast/ lib/ai/tools/perplexity-client.ts lib/briefing/research-engine.ts app/\(chat\)/api/briefing/refresh-section/route.ts
git commit -m "feat(tz-dev2): podcast + research instrumentation — trace, usage, retry"
```

**Критерий готовности:** Podcast pipeline: per-topic script usage + TTS timing. Research: per-topic Perplexity tokens. Section refresh: filter + author cost в response.

---

## Этап 4: Cron trace + Briefing History metadata

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Статус:** ⬜ Не начат

**Цель:** Background cron сохраняет trace summary в DB для post-mortem диагностики.

**Задачи:**
- [ ] `briefing-pipeline.ts` — при background mode (`onProgress` отсутствует): собрать `traceSummary` и вернуть вместе с результатом
- [ ] `podcast-pipeline.ts` — аналогично: `traceSummary` в результате
- [ ] `app/api/cron/briefing/route.ts` — передать `traceSummary` в `saveBriefingHistory()` через `metadata` поле
- [ ] `lib/db/queries.ts` — убедиться что `saveBriefingHistory` принимает и сохраняет `metadata` (jsonb)
- [ ] Проверить через `mcp__postgres__query`: `SELECT metadata FROM "BriefingHistory" ORDER BY "createdAt" DESC LIMIT 1` — данные на месте

**Файлы:**
- `lib/briefing/briefing-pipeline.ts` — return traceSummary
- `lib/podcast/podcast-pipeline.ts` — return traceSummary
- `app/api/cron/briefing/route.ts` — pass metadata
- `lib/db/queries.ts` — metadata support (если не поддерживает)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: `SELECT metadata FROM "BriefingHistory"` после генерации → видны trace данные
- [ ] 🧪 Мануальный тест: cron endpoint вызывается вручную → metadata сохраняется

**Git (после валидации):**
```bash
git add lib/briefing/briefing-pipeline.ts lib/podcast/podcast-pipeline.ts app/api/cron/ lib/db/queries.ts
git commit -m "feat(tz-dev2): cron trace summary → briefingHistory metadata"
```

**Критерий готовности:** После background генерации `SELECT metadata` показывает полную сводку: модели, токены, стоимость, URL verification, ошибки.

---

## Этап 5: UI — Trace Footer + Drawer

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

**Статус:** ⬜ Не начат

**Цель:** Разработчик видит трассировку в UI при генерации брифинга и подкаста.

**Задачи:**

**Client-side trace parsing:**
- [ ] `hooks/use-briefing-generation.ts` — при dev mode: парсить `{trace:...}` и `{traceSummary:...}` events из NDJSON stream, накапливать в state
- [ ] `hooks/use-podcast-generation.ts` — аналогично

**Trace Footer (compact monospace line):**
- [ ] Создать `components/dev-panel/pipeline-trace-footer.tsx` — аналог DevPanelFooter: live status при генерации (`Fetching... 3/8 · 2.3s`), итог после завершения (`✓ 20.6K tok · ₽2.48 · 34s · URLs: 15✓ 2✗`), красный при ошибках
- [ ] Интегрировать в `components/briefing/briefing-generation-progress.tsx` — slot под прогрессом
- [ ] Интегрировать в `components/briefing/podcast-progress.tsx` — slot под прогрессом

**Trace Drawer (Sheet с полной трассировкой):**
- [ ] Создать `components/dev-panel/pipeline-trace-drawer.tsx` — Sheet справа (как DevPanelDrawer), секции: Summary, Fetch Details, Filter Details, Author Details, URL Verification, Errors & Warnings, Raw JSON
- [ ] Открывается по клику на trace footer

**Section refresh badge:**
- [ ] `components/briefing/briefing-article-view.tsx` — после refresh: компактный бейдж `Sonnet · 2.1K tok · ₽0.84 · 3.2s` (при dev mode)

**Файлы:**
- `hooks/use-briefing-generation.ts` — trace parsing
- `hooks/use-podcast-generation.ts` — trace parsing
- `components/dev-panel/pipeline-trace-footer.tsx` — **новый**
- `components/dev-panel/pipeline-trace-drawer.tsx` — **новый**
- `components/briefing/briefing-generation-progress.tsx` — footer slot
- `components/briefing/podcast-progress.tsx` — footer slot
- `components/briefing/briefing-article-view.tsx` — refresh badge

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Dev mode: генерация брифинга → footer обновляется в реальном времени, по клику drawer с полной информацией
- [ ] Dev mode: URL verification таблица показывает verified/fabricated ссылки
- [ ] Production mode: footer и drawer не рендерятся, trace events не парсятся
- [ ] 🧪 Мануальный тест: полный flow — генерация → footer → drawer → все секции с данными

**Git (после валидации):**
```bash
git add hooks/ components/dev-panel/ components/briefing/
git commit -m "feat(tz-dev2): pipeline trace UI — footer, drawer, URL verification"
```

**Критерий готовности:** Разработчик видит в реальном времени: каждый fetch, каждый AI-вызов, стоимость, URL verification — при генерации брифинга и подкаста.

---

## Этап 6: Финализация

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 5

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (новые файлы: pipeline-trace.ts, pipeline-trace-footer/drawer, расширенный pricing)
- [ ] Обновить package.json: 3.57.0 → 3.58.0

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → **Да:** `docs/decisions/030-pipeline-observability.md` — архитектура трассировки, выбор JSON Lines vs SSE, URL verification подход
- [ ] `docs/architecture.md` → обновить (pipeline-trace модуль)
- [ ] `docs/ai-providers.md` → обновить (Gemini/Perplexity pricing добавлен)
- [ ] `docs/ai-chats-map.md` → оценить (не меняются routes, только инструментирование)
- [ ] `docs/design-system.md` → оценить (pipeline-trace-footer/drawer — dev-only, вряд ли нужно)

**SQL-проверка:**
- [ ] `SELECT metadata FROM "BriefingHistory" ORDER BY "createdAt" DESC LIMIT 3` — trace данные есть

**Завершение:**
- [ ] Финальное мануальное тестирование (полный flow: briefing + podcast + section refresh)
- [ ] Переместить папку в `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Production URL работает
- [ ] Dev mode: трассировка видна
- [ ] Production mode: zero overhead (trace не собирается, UI не рендерится)
- [ ] Документация актуальна (проверено по чеклисту)

**Git (после валидации):**
```bash
git add .
git commit -m "feat(tz-dev2): finalize pipeline observability — v3.58.0"
```
