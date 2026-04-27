# TZ_EstimatorIgnoresAttachments

**Impact:** 🟥 high
**Найдено:** 2026-04-27 при тесте PDF-скана в Simply chat (после ТЗ-FixSimplyMemory v3.100.1)
**Источник:** прямой замер DevPanel — Total 194 991 токенов на запросе, где наш estimator оценил context в 64 758

## Проблема

`estimateMessageTokens` в [lib/utils.ts](../../lib/utils.ts) считает токены **только по text-частям** `parts`. Image и file binary attachments (PDF-сканы, картинки JPG/PNG передаваемые в Claude через `image_url` / file part) **в подсчёт не входят**.

Реальный пример из логов 2026-04-27 (chat `3353a183-...`):

```
[Upload API] PDF detected as scan/empty, falling through to native PDF upload (1 pages, 16 chars)
[Token Aware] New user message has ~16 tokens (post file conversion)
[Compaction] tokens={system:4256, history:58960, new:16, mind:192, tools:1334, total:64758} action=noop
[DevPanel] Input(fresh) 307 + Cache write 194 477 + Output 207 = Total 194 991
```

- Estimator: `new:16` токенов (16 распознанных символов из PDF-скана)
- Реальный input для модели: **194 477** (Anthropic токенизирует PDF постранично как изображения)
- Расхождение: **в ~12 000 раз**

## Последствия

### 1. Compaction не срабатывает когда должен

В случае выше: total реально ~195K (выше Hard 170K → должен быть `action=truncate`), но в нашем подсчёте — 64K (ниже Soft 100K → `action=noop`). Защита от переполнения окна **отключена** для запросов с большими binary attachments.

### 2. Виджет «Контекст» показывает заниженный %

Виджет ([components/elements/context.tsx](../../components/elements/context.tsx)) использует `usage.contextWindow.used` который собирается из реального usage модели **после** ответа. Но прогресс-бар на следующий запрос с приложенным PDF снова покажет занижение в момент составления нового сообщения, до ответа модели.

### 3. Расчёт `maxTokens` для `getMessagesByChatId` неточен

В [route.ts:593](../../app/(chat)/api/chat/route.ts#L593) `maxTokens: 140000 - newMessageTokens`. Если `newMessageTokens=16` для PDF-скана 195K — token-aware sliding window зарезервирует 139 984 токенов на историю, не подозревая что 195K уже занято в `parts`. История + PDF может перевалить 200K окна модели.

## Источник занижения

`estimateMessageTokens` (нужно прочитать конкретную реализацию в утилите) проходит по `parts` и считает только `type === "text"`. Игнорируется:
- `type: "image_url"` — изображения для vision (Claude/Grok)
- `type: "file"` — PDF binary для Claude native PDF support

## Предложение решения

### A) Heuristic (быстрый фикс)

Добавить эвристику для binary parts:
- `image_url` → ~1500 токенов / image (среднее у Anthropic vision)
- `file` (PDF) → ~3000 токенов / page при наличии `pageCount` метаданных, иначе fallback ~10K
- Документировать что это **оценка**, не точное значение

### B) Точный фикс (Anthropic API token counter)

Использовать [Anthropic count tokens API](https://docs.anthropic.com/en/api/messages-count-tokens) перед запросом. Точный, но +1 round-trip к Anthropic, +latency, +rate limits.

### C) Гибрид

- A) для виджета и предварительной проверки Compaction (быстро, неточно)
- Реальный usage из ответа модели — для `AppUsage.contextWindow.used` (точно, post-hoc)

Предпочитаю A) — простое heuristic, которое возвращает ~правдоподобную оценку. Виджет будет показывать «90%» вместо «30%» когда вложен большой PDF — даже неточная оценка лучше нуля.

## Связь с другими долгами

- [TZ_DocumentTruncationSilent](TZ_DocumentTruncationSilent.md) — про обрезание документов на upload. Связано: если на upload сделать жёсткий лимит для **всех** типов (включая сканы), оба бага закроются согласованно.

## Оценка

**Время:** 0.3-0.5 сессии для варианта A.

**Файлы:**
- `lib/utils.ts` — расширить `estimateMessageTokens`
- `lib/ai/compaction/prepare-messages.ts` — пересчитать токены при включённых attachments
- `components/elements/context.tsx` — виджет автоматически починится через `usage.contextWindow.used`
