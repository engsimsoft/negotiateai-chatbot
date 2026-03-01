# Анализ ТЗ-DEV2: Pipeline Observability

**Дата анализа:** 2026-02-28

---

## Резюме

Инструментировать весь pipeline брифинга/подкаста — от fetch источников до итоговой статьи. Дать разработчику полную трассировку: каждый AI-вызов, каждый HTTP-запрос, каждую ошибку, верификацию URL. Устранить silent failures. Добавить pricing для всех моделей.

---

## Code Review: найденные проблемы

### Критические (влияют на качество продукта)

| # | Проблема | Файл | Строки | Как обнаружил |
|---|----------|------|--------|---------------|
| 1 | **URL fabrication (filter)** — Gemini возвращает `url: z.string()`, не сверяется с input | `briefing-filter.ts` | schema line ~55 | Нет validation после `generateObject` |
| 2 | **URL fabrication (author)** — Claude пишет inline-ссылки без ограничений | `briefing-author.ts` | Промпт говорит «inline links рядом с фактом» | Нет instruction «only from candidates» |
| 3 | **Silent catch {}** — per-post ошибки в Telegram молча проглатываются | `telegram-fetcher.ts` → `parser.ts` | `messageWraps.each` catch | Пустой catch block |
| 4 | **DB save swallowed** — `.catch(() => {})` при ошибке сохранения | `briefing-pipeline.ts` | catch block в конце | Потеря информации об ошибке |
| 5 | **sourceItemId mismatch** — filter возвращает ID, которого нет в map | `briefing-pipeline.ts` | fullTextsMap lookup | Только общий hit rate, не per-item |
| 6 | **Token data ignored** — `const { text } = generateText(...)` | `script-generator.ts` | line ~98 | `usage` не деструктурируется |

### Средние (потеря данных / неточности)

| # | Проблема | Файл | Влияние |
|---|----------|------|---------|
| 7 | **topicId hallucination** — filter может вернуть topicId не из списка | `briefing-filter.ts` | Кривая категоризация |
| 8 | **tierMap collision** — `tierMap.set(sourceName)` перезаписывает при дупликатах | `briefing-pipeline.ts` | Неверный tier |
| 9 | **publishedAt missing** — web-fetcher никогда не ставит дату | `web-fetcher.ts` | Фильтр не может проверить свежесть |
| 10 | **Fallback invisible** — author fallback на старую модель не логируется | `briefing-author.ts` | Не знаешь какая модель сгенерировала |
| 11 | **Retry invisible** — script-generator делает до 4 retry | `script-generator.ts` | `console.warn` — единственный след |
| 12 | **TTS zero metrics** — ни токены, ни длительность | `tts-gemini.ts` | Полная слепота по TTS |

### Полная карта AI-вызовов (куда ставить трассировку)

| Модуль | Функция | AI SDK | Модель | usage available | timing |
|--------|---------|--------|--------|:---:|:---:|
| `briefing-filter.ts` | `filterContent()` | `generateObject` (Vercel) | Gemini 2.0 Flash | `promptTokens` + `completionTokens` + `totalTokens` ✅ | ❌ нужен wrap |
| `briefing-author.ts` | `generateArticle()` | `generateObject` (Vercel) | Claude Sonnet 4.6 | `promptTokens` + `completionTokens` + `totalTokens` ✅ | ❌ нужен wrap |
| `briefing-section-author.ts` | `generateSection()` | `generateObject` (Vercel) | Claude Sonnet 4.6 | `promptTokens` + `completionTokens` + `totalTokens` ✅ | ❌ нужен wrap |
| `script-generator.ts` | `generateScript()` | `generateText` (Vercel) | Gemini 2.5 Flash | `promptTokens` + `completionTokens` + `totalTokens` ✅ | ❌ нужен wrap |
| `tts-gemini.ts` | `generateSpeechWithRetry()` | raw `@google/genai` | Gemini TTS | `usageMetadata?` ⚠️ (может не быть) | ❌ нужен wrap |
| `perplexity-client.ts` | `callPerplexity()` | raw `fetch` | Sonar Pro | `prompt_tokens` + `completion_tokens` ✅ (есть, не захватываются) | ❌ нужен wrap |
| `research-engine.ts` | `researchTopics()` | через `callPerplexity` | Sonar Pro | через perplexity-client | ❌ |

### Карта fetch-операций (где нужен FetchTrace)

| Fetcher | Что фетчит | Timeout | Ошибки сейчас |
|---------|-----------|---------|---------------|
| `rss-fetcher.ts` | RSS feeds | 10s | `errors[]` → `console.warn` |
| `telegram-fetcher.ts` → `parser.ts` | `t.me/s/{handle}` HTML | 10s | `catch {}` 🔴 silent |
| `web-fetcher.ts` → `fetch-page.ts` | Arbitrary URLs | 8s cascade | `console.warn` + graceful |
| `jina-reader.ts` | Jina Reader API | 10s | throw on fail |
| `perplexity-client.ts` | Perplexity API | 30s | throw on fail |

---

## Вопросы для уточнения

> Ответь на эти вопросы перед началом разработки

1. **[URL Verification]:** В рамках этого ТЗ — только **показывать** что URL fabricated, или также **блокировать/заменять** его? Рекомендация: только показывать (блокировка — отдельное ТЗ, требует изменения промптов и post-processing).

2. **[Cron trace]:** Для фонового крона — сохранять trace summary в `metadata` поле `briefingHistory` (рекомендую — поле уже есть, jsonb) или отдельная таблица?

3. **[Глубина промпта]:** Сохранять в trace полный user message для author (может быть 50-100K символов) или preview первых 500-1000 символов? Полный — больше данных для диагностики, но может раздуть трассировку.

4. **[Исправление silent failures]:** В рамках этого ТЗ — заменять `catch {}` на `catch (err) { warnings.push(...) }` (рекомендую — минимальный fix, даёт видимость), или оставить как есть и только логировать снаружи?

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| `Date.now()` overhead в hot path | Низкая | Низкое | Guard: только при dev mode |
| JSON Lines `{trace:...}` ломает парсер | Средняя | Высокое | Парсеры проверяют `event.step` — неизвестные поля игнорируются. Проверить |
| TTS не возвращает usage | Высокая | Низкое | Fallback на timing + audio buffer size |
| Trace раздувает NDJSON stream | Низкая | Среднее | Сжатый формат, только при dev mode |
| Gemini pricing изменится | Средняя | Низкое | Вынести в config, легко обновлять |

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-DEV1 завершён (v3.57.0) — паттерны dev mode gate, pricing structure
- [x] Актуальные цены Gemini/Perplexity (проверить перед реализацией)

**Затронутые компоненты (инструментирование — backend):**
- `lib/briefing/briefing-pipeline.ts` — trace orchestration, URL verification, fullTextsMap logging
- `lib/briefing/briefing-filter.ts` — full usage, timing, sourceItemId/topicId/URL validation
- `lib/briefing/briefing-author.ts` — full usage, timing, retry/fallback trace
- `lib/briefing/briefing-section-author.ts` — full usage, timing
- `lib/briefing/source-fetchers/rss-fetcher.ts` — FetchTrace per feed
- `lib/briefing/source-fetchers/telegram-fetcher.ts` + `lib/telegram/parser.ts` — FetchTrace + fix silent catch
- `lib/briefing/source-fetchers/web-fetcher.ts` — FetchTrace + publishedAt warning
- `lib/briefing/research-engine.ts` — per-topic trace
- `lib/podcast/script-generator.ts` — usage capture + retry trace
- `lib/podcast/tts-gemini.ts` — timing + audio metrics
- `lib/podcast/podcast-pipeline.ts` — trace orchestration
- `lib/ai/tools/perplexity-client.ts` — full usage capture
- `lib/ai/providers.ts` — Gemini/Perplexity/TTS pricing

**Новые файлы (backend):**
- `lib/ai/pipeline-trace.ts` — Types + TraceCollector utility

**Затронутые компоненты (UI — frontend):**
- `hooks/use-briefing-generation.ts` — parse `{trace:...}` events
- `hooks/use-podcast-generation.ts` — parse `{trace:...}` events
- `components/briefing/briefing-generation-progress.tsx` — trace footer slot
- `components/briefing/podcast-progress.tsx` — trace footer slot
- `components/briefing/briefing-article-view.tsx` — refresh trace badge

**Новые файлы (UI):**
- `components/dev-panel/pipeline-trace-footer.tsx` — Compact monospace status line
- `components/dev-panel/pipeline-trace-drawer.tsx` — Sheet с полной трассировкой
- `components/dev-panel/pipeline-trace-sections/` — Секции drawer (fetch, filter, author, urls, errors, raw)

---

## Рекомендации (Senior Dev Code Review)

| ТЗ говорит | Рекомендация | Код-обоснование |
|------------|-------------|-----------------|
| Trace events в JSON Lines | ✅ Безопасно — парсеры (`use-briefing-generation.ts`) проверяют `event.step`, `{trace:...}` будет проигнорировано | Проверил: `if (event.step)` guard |
| URL verification | ✅ Ключевая фича — собрать все URL из fetched items в Set, сравнить с URL в итоговой статье | Inline ссылки в `content` markdown можно извлечь regex `\[.*?\]\((https?://.*?)\)` |
| Fix silent catch в telegram | ✅ Минимальный fix: `catch(e) { warnings.push(String(e)) }` | Не меняет поведение, только добавляет видимость |
| Отдельные типы от DEV1 | ✅ Новый `pipeline-trace.ts` — другой домен, другой transport | DEV1 types в `debug-events.ts` заточены под DataStreamWriter |
| Pricing Gemini | ✅ Расширить `MODEL_PRICING_RUB` объект | Структура уже подходит: `{ input, output, cached }` per model |
| Cron trace в metadata | ✅ — поле `metadata jsonb` уже есть в `briefingHistory` | `mcp__postgres__query` для диагностики |

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:**
- ~13 файлов для инструментирования (механика понятная: Date.now() + usage capture + warnings)
- URL verification — новая логика, но алгоритмически простая (Set matching + regex)
- UI: 2-3 новых компонента по паттерну DEV1 (footer + drawer)
- Pricing: расширение существующей структуры
- Главная сложность: аккуратно не сломать pipeline при добавлении трассировки

---

## Ответы на вопросы

> Заполнено 2026-02-28

1. **URL Verification:** Только **показывать** что URL fabricated. Блокировка/замена — отдельное ТЗ.
2. **Cron trace:** В `metadata` поле `briefingHistory` (jsonb, уже есть).
3. **Глубина промпта:** **Preview** (500 символов). Полный промпт не нужен — можно посмотреть в коде.
4. **Silent failures fix:** **Да** — заменять `catch {}` → `catch(e) { warnings.push(...) }` в рамках этого ТЗ.
