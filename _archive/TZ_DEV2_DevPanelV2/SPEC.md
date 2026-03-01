# ТЗ-DEV2: Pipeline Observability — полная трассировка Briefing, Podcast, Onboarding

> Инструмент диагностики для разработчика: видеть ВСЁ что происходит в pipeline — каждый AI-вызов, каждый fetch, каждую ошибку, каждую подмену URL

---

**Версия ТЗ:** 2.0
**Дата:** 2026-02-28
**Автор:** Архитектор + Claude Code
**Предшественник:** ТЗ-DEV1 (v3.57.0 — Developer Panel, ADR 029)

---

## Контекст проблемы

### Что есть сейчас

Developer Panel (DEV1, v3.57.0) покрывает **только чат** — модель, токены, стоимость, Guardian, промпт. Работает отлично.

### Что НЕ видно — и почему это критично

**4 дня отладки вслепую** показали реальные проблемы:

1. **AI пишет что вызвал инструменты, но не вызывал** (галлюцинация tool calls) — невозможно проверить
2. **URL в итоговом брифинге — битые или выдуманные** — нет валидации на всём пути (fetch → filter → author)
3. **Telegram-каналы — парсились или нет?** Silent `catch {}` в telegram-fetcher, ошибки пропадают бесследно
4. **Фильтр Gemini может подменить URL** — output URL ≠ input URL, никто не проверяет
5. **Claude-автор может придумать URL** в inline-ссылках — нет ограничения «только из кандидатов»
6. **Retry и fallback невидимы** — briefing-author делает fallback на старую модель, podcast script-generator делает до 4 retry — всё в тишине
7. **Стоимость генерации — полная загадка** — сколько стоит один брифинг? Один подкаст? Никто не знает

### Найденные дыры в pipeline (Code Review)

| Проблема | Где | Влияние |
|----------|-----|---------|
| URL fabrication at filter | `briefing-filter.ts` — Gemini возвращает `url` как string, не сверяется с input | Битые ссылки в итоге |
| URL fabrication at author | `briefing-author.ts` — Claude пишет inline-ссылки без ограничений | Выдуманные ссылки |
| Silent per-post catch | `telegram-fetcher.ts` — `catch {}` на каждый пост, ноль логов | Потеря данных без следа |
| DB save swallowed | `briefing-pipeline.ts` — `.catch(() => {})` | Ошибка сохранения неизвестна |
| sourceItemId mismatch | Pipeline: filter возвращает `src-99`, а items только до `src-47` | Автор получает пустой контент |
| topicId hallucination | Filter Gemini может вернуть topicId не из списка | Кривая категоризация |
| tierMap key collision | Pipeline: `tierMap.set(sourceName, ...)` — дупликаты перетирают | Неверный tier источника |
| publishedAt missing | `web-fetcher.ts` никогда не ставит дату | Фильтр не может проверить свежесть |
| Token data ignored | `script-generator.ts`: `const { text } = generateText(...)` — usage потерян | Нет данных о стоимости подкаста |
| TTS zero metrics | `tts-gemini.ts` — ни токены, ни длительность, ни стоимость | Полная слепота |

---

## Цель

**Дать разработчику инструмент, который отвечает на вопрос: «Почему брифинг/подкаст получился плохой?»**

Разработчик должен видеть:
1. **Каждый AI-вызов** — модель, промпт, ответ, токены, стоимость, время
2. **Каждый fetch** — URL, статус, размер, время, ошибки
3. **Трассировку данных** — что пришло от источника → что прошло фильтр → что попало в статью
4. **Верификацию URL** — какие ссылки в итоговой статье реальные, какие выдуманные
5. **Все ошибки** — включая те, что сейчас проглатываются молча (catch {}, .catch(() => {}))
6. **Retry и fallback** — сколько попыток, какая модель в итоге сработала
7. **Стоимость** — полная: по этапам и суммарная

---

## Требования

### Часть 1: Pipeline Trace — сбор данных

#### 1.1 Trace Collector

Единый механизм сбора трассировки для всего pipeline:

```typescript
interface PipelineTrace {
  traceId: string;              // уникальный ID запуска
  pipeline: "briefing" | "podcast" | "section-refresh";
  startedAt: string;            // ISO timestamp

  // Стадии pipeline (в хронологическом порядке)
  stages: PipelineStageTrace[];

  // Итоги
  summary: {
    totalDurationMs: number;
    totalTokens: number;
    totalCostRub: number;
    status: "success" | "partial" | "error";
    errorCount: number;
    warningCount: number;
  };
}
```

#### 1.2 Stage Trace — каждая стадия pipeline

```typescript
interface PipelineStageTrace {
  stage: "fetch" | "filter" | "author" | "script" | "tts" | "research";
  startedAt: string;
  durationMs: number;

  // AI-вызов (если был)
  ai?: {
    modelId: string;            // "gemini-2.0-flash", "claude-sonnet-4-6", etc.
    promptPreview: string;      // Первые 500 символов system prompt
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costRub: number;
    finishReason: string;
    retryCount: number;         // 0 = первая попытка сработала
    fallbackUsed?: string;      // modelId fallback-модели если primary failed
  };

  // Fetch-операции (для стадии fetch)
  fetches?: FetchTrace[];

  // Data flow (что вошло → что вышло)
  dataFlow?: {
    inputCount: number;         // Сколько items вошло
    outputCount: number;        // Сколько items вышло
    droppedCount: number;       // Сколько отброшено
    droppedReasons?: Record<string, number>; // { "no_title": 3, "stale": 12, "dedup": 2 }
  };

  // Ошибки и предупреждения
  errors: string[];
  warnings: string[];
}
```

#### 1.3 Fetch Trace — каждый HTTP-запрос

```typescript
interface FetchTrace {
  url: string;
  method: "rss" | "telegram" | "jina" | "readability" | "perplexity";
  statusCode?: number;
  durationMs: number;
  responseSize?: number;        // bytes
  itemsExtracted: number;       // сколько items извлечено
  error?: string;
  warnings?: string[];          // ["no publishedAt", "redirect detected", ...]
}
```

#### 1.4 URL Verification Trace — верификация ссылок

```typescript
interface UrlVerificationTrace {
  // Для каждого URL в итоговой статье
  urlsInArticle: UrlCheck[];

  summary: {
    total: number;
    verified: number;           // URL существует в исходных данных
    fabricated: number;         // URL НЕТ в исходных данных (AI выдумал)
    modified: number;           // URL похож на исходный, но изменён
  };
}

interface UrlCheck {
  url: string;                  // URL как он появился в статье
  foundInSource: boolean;       // Есть ли в оригинальных fetched items
  originalUrl?: string;         // Если modified — оригинальный URL
  sourceStage: "fetcher" | "filter" | "author" | "fabricated";
  sectionTopicId: string;       // В какой секции статьи
}
```

### Часть 2: Инструментирование модулей

#### 2.1 Briefing Pipeline (`briefing-pipeline.ts`)

- Создать `PipelineTrace` в начале запуска
- **Fetch stage:** обернуть каждый `fetchSource()` в `FetchTrace` — URL, время, items, ошибки
- **Filter stage:** обернуть `filterContent()` — модель, токены, стоимость, inputCount/outputCount
- **Author stage:** обернуть `generateArticle()` — модель, токены, стоимость, промпт
- **URL verification:** после генерации — сравнить все URL в `article.sections[].sources[].url` и inline-ссылки с `allItems[].url`. Пометить fabricated/modified
- **fullTextsMap miss:** логировать каждый случай когда `sourceItemId` не найден в map (сейчас только общий hit rate)
- Прокинуть trace через JSON Lines stream как `{trace: PipelineStageTrace}` events (при dev mode)
- Финальный `{traceSummary: ...}` event в конце

#### 2.2 Source Fetchers

**RSS (`rss-fetcher.ts`):**
- Обернуть `parser.parseURL()` в timing
- Считать: сколько items пришло, сколько отброшено (нет title, нет URL, stale), сколько с пустым content
- Ловить ошибки per-entry (сейчас одна ошибка роняет весь feed)

**Telegram (`telegram-fetcher.ts`):**
- Заменить `catch {}` на `catch (err) { warnings.push(...) }` — прекратить тихое проглатывание
- Логировать: channel parsed? posts found? posts with text? posts fresh? media-only skipped?
- Отдельно: posts с missing `data-post` (URL будет channel root, не post URL)

**Web (`web-fetcher.ts` + `fetch-page.ts`):**
- Какой метод сработал (readability / semantic / jina)?
- Warning если `publishedAt` не определён
- Redirect detection

#### 2.3 Briefing Filter (`briefing-filter.ts`)

- Захватить `promptTokens` + `completionTokens` (сейчас только totalTokens)
- Timing (`Date.now()` wrap)
- **sourceItemId validation:** после генерации — проверить что каждый `sourceItemId` из output реально существует в input items. Если нет → warning + счётчик
- **URL validation:** сравнить `FilteredItem.url` с оригинальным `RawContent.url` по `sourceItemId`. Если отличается → warning
- **topicId validation:** проверить что возвращённые topicId есть в допустимом списке

#### 2.4 Briefing Author (`briefing-author.ts`)

- Захватить полный usage (`promptTokens`, `completionTokens`)
- Timing
- Retry/fallback logging: если primary модель failed — зафиксировать ошибку + то что fallback был использован
- **Промпт:** сохранить полный user message (для диагностики — понять что именно видел Claude)

#### 2.5 Podcast Script Generator (`script-generator.ts`)

- Захватить usage (сейчас полностью игнорируется!)
- Timing
- Retry count (сейчас до 4 retry с `console.warn`)
- Word count per attempt (сейчас проверяется но не логируется)

#### 2.6 Podcast TTS (`tts-gemini.ts`)

- Timing
- Audio duration (из размера MP3 buffer)
- Retry (1 retry on failure)
- `usageMetadata` если доступно из `@google/genai` response

#### 2.7 Research Engine (`research-engine.ts`)

- Per-topic: Perplexity query time, tokens, URL verification count
- `fetchPage` calls: URL, success/fail, time
- Telegram channel parse: channel, posts found

### Часть 3: Pricing — расширение на все модели

Расширить `MODEL_PRICING_RUB` в `providers.ts`:

| Model | Input (₽/1K tok) | Output (₽/1K tok) | Cached |
|-------|---:|---:|---:|
| gemini-2.0-flash | 0.01 | 0.04 | 0.003 |
| gemini-2.5-flash | 0.015 | 0.06 | — |
| gemini-2.5-flash-tts | — | — | — (по секундам аудио) |
| sonar-pro (Perplexity) | ~0.30 | ~0.60 | — |

**TTS:** стоимость считать по длительности аудио × цена за секунду (Google TTS pricing)
**Perplexity:** фиксированная стоимость $5/1000 queries → ~₽0.50/query + token usage

### Часть 4: Transport

#### 4.1 Browser (генерация через UI)

JSON Lines events в существующий NDJSON stream:

```jsonl
{"step":"fetching","detail":"Загрузка источников..."}
{"trace":{"stage":"fetch","fetches":[{"url":"https://t.me/s/durov","method":"telegram","durationMs":2300,"itemsExtracted":5}],"durationMs":8200}}
{"step":"filtering","detail":"Фильтрация..."}
{"trace":{"stage":"filter","ai":{"modelId":"gemini-2.0-flash","totalTokens":12400,"costRub":0.02},"dataFlow":{"inputCount":47,"outputCount":12,"droppedCount":35}}}
{"step":"writing","detail":"Генерация статьи..."}
{"trace":{"stage":"author","ai":{"modelId":"claude-sonnet-4-6","totalTokens":8200,"costRub":2.46,"fallbackUsed":null}}}
{"step":"complete","done":true}
{"traceSummary":{"totalCostRub":2.48,"totalTokens":20600,"urlVerification":{"total":18,"verified":15,"fabricated":2,"modified":1},"errorCount":0,"warningCount":3}}
```

**Guard:** `trace` events emit-ятся ТОЛЬКО при `isSimplyDevMode`. Client парсит их ТОЛЬКО при `NEXT_PUBLIC_SIMPLY_DEV_MODE`.

#### 4.2 Background (cron)

Сохранять `PipelineTrace` (или сжатый `traceSummary`) в `metadata` поле `briefingHistory`. Доступно через `mcp__postgres__query` для диагностики.

### Часть 5: UI — Dev Console

**Принцип:** Минимальный, функциональный, для разработчика. Не для пользователя.

#### 5.1 Pipeline Trace Footer

Компактная monospace-строка (аналог `DevPanelFooter` из DEV1), появляется при dev mode:

- Во время генерации: `Fetching... 3/8 sources · 2.3s` → `Filtering... 47 items · Gemini Flash` → `Writing... Sonnet · 8.2K tok · ₽2.46`
- После завершения: `✓ Briefing · 20.6K tok · ₽2.48 · 34s · 3⚠️ · URLs: 15✓ 2✗`
- Красным при ошибках: `✗ Author failed · fallback Sonnet 4.5 · retry 1`

#### 5.2 Pipeline Trace Drawer

По клику на footer — Sheet справа (как в DEV1) с полной трассировкой:

**Секции:**

1. **Summary** — модели, токены, стоимость, время, статус
2. **Fetch Details** — таблица: каждый source URL, метод, статус, items, время, ошибки
3. **Filter Details** — input/output counts, dropped items + reasons, sourceItemId mismatches, URL modifications
4. **Author Details** — модель, retry/fallback, промпт preview, tokens
5. **URL Verification** — таблица: каждый URL в статье, verified/fabricated/modified статус
6. **Errors & Warnings** — все ошибки и предупреждения по стадиям (включая бывшие silent failures)
7. **Raw Trace** — полный JSON trace для копирования

#### 5.3 Для подкаста — аналогичный footer + drawer

- Per-topic: script (model, tokens, retry count, word count) + TTS (duration, size)
- Summary: total cost, total duration

#### 5.4 Для section refresh (кнопка ↻)

- После обновления: компактный бейдж `Sonnet · 2.1K tok · ₽0.84 · 3.2s`
- При ошибке: красный бейдж с текстом ошибки

---

## Архитектурные принципы

1. **Zero overhead в production** — все trace events gated за `isSimplyDevMode`. Ни один `Date.now()`, ни один `push()` в production
2. **Не ломать existing** — Chat DevPanel (DEV1) остаётся как есть. Pipeline trace — параллельная система
3. **Правда > красота** — показывать сырые данные, реальные URL, реальные ошибки. Не скрывать и не группировать
4. **Все silent failures → explicit warnings** — каждый `catch {}` и `.catch(() => {})` должен оставлять след

---

## Scope

### В scope:
- Инструментирование всех AI-вызовов (briefing, podcast, section-refresh)
- Инструментирование всех fetch-операций (RSS, Telegram, Web/Jina, Perplexity)
- URL verification (сравнение итоговых ссылок с исходными)
- Устранение silent failures (telegram catch {}, DB save catch)
- Расширение pricing на Gemini, Perplexity, TTS
- sourceItemId / topicId validation в filter output
- Trace footer + drawer UI (dev mode only)
- Cron trace → metadata в DB

### Вне scope:
- Изменение Chat DevPanel (DEV1)
- Dashboard/история/графики стоимости
- Исправление найденных проблем (fabrication, missing publishedAt, etc.) — только видимость
- Alerting/мониторинг

---

## Ограничения

1. **TTS usage:** `@google/genai` может не возвращать usage для TTS — fallback на timing + audio size
2. **Perplexity usage:** API возвращает `total_tokens` и `search_queries`, но не `cost` — считать по формуле
3. **Production zero-cost:** Все Date.now(), push(), validation — только при dev mode
4. **JSON Lines compatibility:** `{trace: ...}` events не должны ломать существующие парсеры прогресса (парсеры проверяют `event.step`, поле `trace` будет просто проигнорировано)
