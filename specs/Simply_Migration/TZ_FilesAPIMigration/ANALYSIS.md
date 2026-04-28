# Phase 0 Audit — Simply_Migration · Шаг 4 · Files API Migration

**Дата:** 2026-04-28
**Тип:** read-only pre-SPEC audit для архитектора. Нет рекомендаций, нет правок кода.
**Образец:** [TZ_VisionOcrCleanup/ANALYSIS.md](../TZ_VisionOcrCleanup/ANALYSIS.md).
**Контекст:** концепт расширен 2026-04-28 — трёхуровневая стратегия (inline / per-chat Files API / Library Collections) для всех типов файлов, не только PDF.

---

## Резюме фактов

1. PDF pipeline сегодня: `pdf-parse v2` извлекает текст, при `avgCharsPerPage < 30` (или `<100` для 1-страничных PDF) — fallback на native PDF в Haiku/Grok с vision capability.
2. `.docx/.xlsx/.csv/.md/.txt` — конвертируются в `text/plain` ещё на upload (mammoth / xlsx / TextDecoder), затем `convertTextFilePartsInMessage` оборачивает текст в маркер `📄 **Файл: name**\n\`\`\`\n<content>\n\`\`\`` — сохраняется в БД как text part навсегда.
3. inline-text копится в истории. На chat `3353a183` ОДНО user-сообщение `c7853a33` весит **685K токенов / 2.85 MB** (87% от всех 790K токенов чата) — большой документ, прилетевший inline-портянкой.
4. Library уже **полностью на xAI `/v1/collections`** (не pgvector). Третий уровень стратегии готов архитектурно.
5. **🚨 БЛОКЕР SDK:** `@ai-sdk/xai@3.0.83` физически не пропускает `file` parts с `mediaType !== "image/*"` — кидает `UnsupportedFunctionalityError`. Ни Chat Completions path, ни Responses path не поддерживают `input_file` content type.
6. **🚨 БЛОКЕР MODEL:** `simply-chat` default = `grok-4-1-fast-non-reasoning`. По архивному ресёрчу [TZ_ModelCatalogDocumentFlags](../../../_archive/TZ_ModelCatalogDocumentFlags/TZ_MODEL_CATALOG_DOCUMENT_FLAGS.md) Files API доступен **только agentic (reasoning)** Grok-моделям — Files требует `attachment_search`, non-reasoning не поддерживает agentic tools.
7. `model-catalog.ts` имеет SSOT-флаг `documentSupport: { method: "files-api" | "native" }`, но у всех Grok сейчас `supported: false` с reason «xAI Files API не интегрирован».

---

## Изученная документация (Правило 1)

| Источник | Дата проверки | Ключевые факты |
|---|---|---|
| `npm` show `@ai-sdk/xai` | 2026-04-28 (через package.json) | Установлено `^3.0.83`. Нужна ли свежая версия для `input_file` — **архитектор обязан проверить через WebSearch + читать changelog @ai-sdk/xai >3.0.83**. |
| [_archive/TZ_ModelCatalogDocumentFlags](../../../_archive/TZ_ModelCatalogDocumentFlags/TZ_MODEL_CATALOG_DOCUMENT_FLAGS.md) | 2026-03-XX (архив) | Files API → только agentic-модели; max 48 MB; `$5/1000 tool invocations` (не `$10`). Архитектор обязан **сверить актуальную цену** на docs.x.ai/docs/guides/files. |
| [SIMPLY_MIGRATION_CONCEPT.md §Блок 3](../SIMPLY_MIGRATION_CONCEPT.md#L144-L160) | 2026-04-28 | Цель: единый путь PDF/файлы через xAI Files API + auto attachment_search. Vercel Blob — резерв при ошибке xAI. Чек-лист удаления переходного кода готов. |
| [TZ_DocumentTruncationSilent](../../_backlog/_archive/TZ_DocumentTruncationSilent.md) | 2026-04-27 | PDF режется на 50K char (slice от начала, маркер «...обрезано»). DOCX/CSV/TXT/Excel — без лимита на upload, попадает в Compaction Edge case B (truncate top, hard cap 80K токенов). |
| [TZ_EstimatorIgnoresAttachments](../../_backlog/_archive/TZ_EstimatorIgnoresAttachments.md) | 2026-04-27 | `estimateMessageTokens` считает только text parts. PDF-скан 195K реальных токенов проходит как 16 в estimator. После Шага 4 binary не попадает в payload (только `file_id`) → проблема исчезает архитектурно. |
| [TZ_SimplyChatBillingLeak/HANDOFF.md](../../_archive/TZ_SimplyChatBillingLeak/HANDOFF.md) | 2026-04-28 | Двухслойная утечка: compaction noop substitution (Fix 1, КЕЕП) + inline-text стрипинг (Fix 2, удалить в Шаге 4). |

**Knowledge cutoff** = январь 2026. Все актуальные факты xAI обязательно через WebSearch/WebFetch (правило `feedback_official_docs_first`).

---

## Секция 1 — PDF pipeline сегодня

### 1.1 pdf-parse: единственный extractor

**Файл:** [lib/pdf/extract-pdf-text.ts](../../../lib/pdf/extract-pdf-text.ts) (44 строки).

**Call sites:** ровно один — [app/(chat)/api/files/upload/route.ts:183](../../../app/(chat)/api/files/upload/route.ts#L183) (`isPdfFile` ветка).

**Вторичный путь:** [lib/text-extraction/extract.ts](../../../lib/text-extraction/extract.ts) — используется только в [app/(chat)/api/library/documents/route.ts:185](../../../app/(chat)/api/library/documents/route.ts#L185) для `autoAnalyzeDocument`. Это Library, не chat upload.

**API:**
```ts
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
// result.text, result.total (page count)
```

**Вывод:** `{ text, pageCount, avgCharsPerPage, isLikelyScan }`.

### 1.2 Эвристика «30 символов на страницу»

`extract-pdf-text.ts:17-18`:
```ts
const SCAN_AVG_CHARS_PER_PAGE_THRESHOLD = 30;
const SCAN_SINGLE_PAGE_MIN_CHARS = 100;
```

`extract-pdf-text.ts:31-34`:
```ts
const isLikelyScan =
  pageCount === 1
    ? text.length < SCAN_SINGLE_PAGE_MIN_CHARS
    : avgCharsPerPage < SCAN_AVG_CHARS_PER_PAGE_THRESHOLD;
```

Используется на [upload/route.ts:185](../../../app/(chat)/api/files/upload/route.ts#L185) для решения «text PDF vs scan».

### 1.3 Полный поток PDF: upload → parse → message

[upload/route.ts:181-223](../../../app/(chat)/api/files/upload/route.ts#L181-L223):

1. Upload `application/pdf` ≤20 MB.
2. `extractPdfText(buffer)`.
3. **Если** `!isLikelyScan && text.length > 0`:
   - Trim до `PDF_TEXT_MAX_CHARS = 50_000` ([line 8](../../../app/(chat)/api/files/upload/route.ts#L8)) с маркером «...содержимое обрезано».
   - Сохранить в Vercel Blob как `<name>.txt` с `contentType: text/plain`.
   - Вернуть `{ ..., processed: true, fileType: "pdf-text", pageCount }`.
4. **Иначе** (скан/encrypted/extraction failed): загрузить **as-is** в Blob с original `contentType: application/pdf` → frontend прикрепляет как file part `{ type: "file", mediaType: "application/pdf", url: "<blob-url>" }`.

### 1.4 Что происходит при сканах после Шага 3

- В Simply default-flow `chat-vision` сейчас на `grok-4-1-fast-non-reasoning` (commit `bfe2446`).
- `adaptHistoryToCapabilities` в [route.ts:418-425](../../../app/(chat)/api/chat/route.ts#L418-L425) для `application/pdf` без `documentSupport.supported` → подменяет на текст-плейсхолдер «Ранее был прикреплён PDF... Если нужен анализ — прикрепи повторно».
- **Знание-ограничение R3** концепта (HANDOFF §0): между Шагом 3 и 4 сканы PDF в `chat-vision` деградируют. Шаг 4 закроет.

### 1.5 Vercel Blob paths

`@vercel/blob` `put()` без `pathname` — Blob генерит уникальный URL вида `https://{store}.public.blob.vercel-storage.com/<file>-<random>.txt`. Хранится в `originalFileUrl` для library, и в `parts[*].url` для chat messages.

**Вывод секции 1:** Текстовый PDF режется на 50K символов и инлайнится как text/plain + сохраняется в Blob. Скан → as-is в Blob → file part в payload. Эвристика 30 char/page и 50K hardcap — единственные точки.

---

## Секция 2 — Не-PDF файлы

### 2.1 Поддерживаемые форматы upload

[upload/route.ts:18-37](../../../app/(chat)/api/files/upload/route.ts#L18-L37):
- `image/jpeg`, `image/png` — image, инлайн без conversion.
- `application/pdf` — см. Секцию 1.
- `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) — **mammoth**.extractRawText → text/plain.
- `.xlsx`, `.xls`, `.xlsm` — **xlsx**.sheet_to_csv (все листы) → text/plain с разделителем `=== Лист: name ===`.
- `.csv`, `.txt`, `.md` — TextDecoder UTF-8 → text/plain.
- `application/octet-stream` + ext `.md`/`.txt` — fallback decode.

**Не лимитированы по объёму извлечённого текста** (только 20 MB на сам upload).

### 2.2 convertTextFilePartsInMessage

**Где:** [app/(chat)/api/chat/route.ts:233-274](../../../app/(chat)/api/chat/route.ts#L233-L274).

**Call sites:**
- [route.ts:283](../../../app/(chat)/api/chat/route.ts#L283) — `convertTextFilesInAllMessages` (батч).
- [route.ts:652](../../../app/(chat)/api/chat/route.ts#L652) — на новом user-сообщении ДО подсчёта `newMessageTokens` (важно для compaction estimator).
- [lib/utils.ts:370](../../../lib/utils.ts#L370) — упоминается в комментарии к estimator.

**Что делает:** для каждого `part.type === "file" && part.mediaType === "text/plain"`:
1. Fetch `part.url` (Blob URL).
2. Заменить на:
   ```ts
   { type: "text", text: `📄 **Файл: ${fileName}**\n\`\`\`\n${textContent}\n\`\`\`` }
   ```
3. На fallback при сетевой ошибке: `📄 Файл: name (не удалось загрузить)`.

**Эффект:** через эту функцию проходит ВСЁ что было сконвертировано в text/plain на upload (DOCX/XLSX/CSV/TXT/MD/PDF-text). Маркер `📄 **Файл:` стабильный, по нему детектится UI-плашка ([components/message.tsx](../../../components/message.tsx)) и стрипер истории.

### 2.3 Без поддержки

- `audio/*`, `video/*` — не разрешены в `FileSchema.refine`.
- `.pptx`, `application/zip` — отсутствуют (Library поддерживает .pptx через `MIME_BY_EXTENSION`, chat upload — нет).

**Вывод секции 2:** convertTextFilePartsInMessage — единственная точка преобразования файл→text. Все «текстовые» (включая extracted из DOCX/XLSX/CSV/PDF-text) проходят через неё. После Шага 4 функция должна стать опциональной (для inline-малышей) или удалиться полностью.

---

## Секция 3 — Inline-text накопление в истории

### 3.1 stripOldAttachmentsFromHistory

**Где:** [app/(chat)/api/chat/route.ts:322-384](../../../app/(chat)/api/chat/route.ts#L322-L384).

**Call site:** ровно один — [route.ts:1230](../../../app/(chat)/api/chat/route.ts#L1230) после compaction middleware. Это **финальный** шаг перед `convertToModelMessages`.

**Параметр:** `KEEP_ATTACHMENTS_IN_LAST_N_USER_MESSAGES = 2` ([line 320](../../../app/(chat)/api/chat/route.ts#L320)).

**Что strip'ит** в сообщениях ДО последних 2 user-msgs:
- `text` part с regex `^📄 \*\*Файл: ([^*]+)\*\*` → `[Ранее был прикреплён файл: name]`.
- `file` part с `mediaType.startsWith("image/")` → `[Ранее было прикреплено изображение: name]`.
- `file` part с `mediaType === "application/pdf"` → `[Ранее был прикреплён PDF: name]`.
- `text/plain` file parts — оставляет (но они уже были конвертированы выше).
- Legacy `image` part type → `[Ранее было прикреплено изображение]`.

**Блок text/файлов добавлен 2026-04-28** ([route.ts:343-352](../../../app/(chat)/api/chat/route.ts#L343-L352)) в рамках TZ_SimplyChatBillingLeak (Fix 2). По решению владельца+архитектора — **переходный код**, удалить в Шаге 4 (см. HANDOFF_NEXT_SESSION §«При начале Шага 4» п.3).

### 3.2 Связь с compaction noop

**Где:** [lib/ai/compaction/prepare-messages.ts:107-126](../../../lib/ai/compaction/prepare-messages.ts#L107-L126) — Fix 1 из TZ_SimplyChatBillingLeak.

**Что делает:** на noop-turn'е (когда compaction не срабатывает по threshold), middleware читает `getCompactionState`, и если есть сохранённый `summary` + `index` — подставляет `[syntheticSummary, ...messages.slice(index)]` вместо полной истории.

**Архитектурное решение:** Fix 1 — **КЕЕП** (переживёт миграцию, симметричен с compact-веткой). Fix 2 (file-text strip) — переходный, удаляется в Шаге 4.

### 3.3 Какие сообщения остаются inline после strip

В payload выходят:
- Последние 2 user-сообщения с **полными file parts** (image/PDF/text-маркер).
- Остальные user-сообщения с **placeholder text** «Ранее был прикреплён…».

После Шага 4 file parts в БД должны замениться на `file_id`-ссылки → strip больше не нужен (по `file_id` xAI делает дедуп сам, токены не накапливаются).

---

## Секция 4 — Library / Collections — текущее состояние

### 4.1 Уже полностью на xAI Collections (не pgvector)

**Доказательство:** [lib/ai/library/xai-collections.ts](../../../lib/ai/library/xai-collections.ts) — тонкий wrapper над `https://management-api.x.ai/v1` (CRUD + attach/detach) и `https://api.x.ai/v1` (files + search).

**`grep "pgvector\|embeddings\|voyage" lib/ai/library/`** = только комментарий-pattern-reference на `voyage-client.ts`. **Ноль реального использования pgvector/embeddings в Library.**

**Voyage используется отдельно** в `lib/ai/memory/` (MIND chat memory) — это отдельная подсистема, не Library.

### 4.2 librarySearch tool — call site и API

**Файл:** [lib/ai/tools/library-search.ts](../../../lib/ai/tools/library-search.ts) (265 строк).

**Регистрация:** [lib/ai/tools/chat-tools.ts:16, 93](../../../lib/ai/tools/chat-tools.ts#L93) — в `getStandardTools()` под именем `librarySearch`.

**Подключён в `experimental_activeTools` для:**
- `simply` (без think и без think) — [chat-tools.ts:248](../../../lib/ai/tools/chat-tools.ts#L248) ✅
- `expertise` ✅
- `create` ✅
- `library-document` (split-view, единственный tool) — [chat-tools.ts:235](../../../lib/ai/tools/chat-tools.ts#L235) ✅
- `project-chat` ✅ — [chat-tools.ts:228](../../../lib/ai/tools/chat-tools.ts#L228)

**Вызывает:** `searchDocuments` из xai-collections — `POST /v1/documents/search` с `collection_ids` + `file_ids` + `retrieval_mode: "hybrid"` + `max_num_results: 10`.

### 4.3 Drizzle schema для Library

[lib/db/schema.ts:898-961](../../../lib/db/schema.ts#L898-L961):
- `libraryCollection` — наша UUID + `xaiCollectionId`.
- `libraryDocument` — наша UUID + `xaiFileId` + `originalFileUrl` (Vercel Blob backup) + `status`/`autoType`/`autoTags`/`autoDescription`/`autoSummary`.
- `libraryCollectionDocument` — many-to-many link.

**Vercel Blob уже хранит резервную копию** через `originalFileUrl`. Для Шага 4 (per-chat Files API) можно использовать тот же подход — отдельная таблица `chat_attachment` с парой (`xaiFileId`, `blobUrl`) или расширить `Message_v2.attachments` JSON.

### 4.4 Два API surface

**xAI имеет ДВА разных RAG механизма:**

| API | Used by | Endpoint |
|---|---|---|
| **Collections API** | Simply Library (текущее) | `management-api.x.ai/v1/collections`, `api.x.ai/v1/documents/search` |
| **Vector Stores API** | `xaiTools.fileSearch` (SDK built-in) | `api.x.ai/v1/vector_stores` (требует Responses API) |

**Это РАЗНЫЕ surfaces.** `xaiTools.fileSearch` из @ai-sdk/xai НЕ работает с Collections — ему нужны `vectorStoreIds`. См. [Section 6 / Finding #3 в FINDINGS.md].

**Вывод секции 4:** Уровень 3 архитекторской стратегии (Library Collections) — готов и используется. Третий уровень упереть в зависимость не может. Уровень 2 (per-chat Files API) — пока ничего нет.

---

## Секция 5 — model-catalog.ts: готовность моделей

### 5.1 SSOT-флаг уже существует

[lib/ai/model-catalog.ts:46-61](../../../lib/ai/model-catalog.ts#L46-L61): `DocumentSupport` discriminated union с полями `supported: boolean`, `method: "native" | "files-api"`, `maxPages`, `maxSizeMb`, `notes`.

Введён в TZ_ModelCatalogDocumentFlags (2026-04-14). **Семантика — ФАКТИЧЕСКАЯ интеграция в Simply, не декларативная у провайдера.**

### 5.2 Текущие значения для всех Grok

`CAPS_GROK` ([model-catalog.ts:141-160](../../../lib/ai/model-catalog.ts#L141-L160)):
```ts
documentSupport: {
  supported: false,
  reason: "xAI Files API не интегрирован в Simply (требует upload + input_file content type)",
}
```

Применяется ко всем 5 Grok моделям каталога:
- `grok-4.20-0309-reasoning`
- `grok-4.20-0309-non-reasoning`
- `grok-4.20-multi-agent-0309`
- `grok-4-1-fast-reasoning`
- `grok-4-1-fast-non-reasoning`

**Архитекторскому SPEC обновить эти 5 записей:**
- Reasoning варианты (`*-reasoning`, `multi-agent`) → `{ supported: true, method: "files-api", maxSizeMb: 48, notes: "..." }`.
- Non-reasoning варианты — **ОТКРЫТЫЙ ВОПРОС:** см. Finding #2 в FINDINGS.md (архивная research говорит non-reasoning не поддерживает agentic tools, но не ясно — это по-прежнему так в 2026-04?).

### 5.3 Подтверждение payload-level (R3)

[model-catalog.ts:152-156](../../../lib/ai/model-catalog.ts#L152-L156) — комментарий зафиксировал результат побайтной проверки 2026-04-28:
> «PDF в свежем Expertise-чате (0 истории) → Grok ответил "вижу только метаданные имени", `[PAYLOAD-DEBUG]` не нашёл `"file"`/`"application/pdf"` в payload xAI. Grok физически не получает PDF-контент.»

Соответствует правилу `feedback_payload_level_verification` (см. memory).

**Вывод секции 5:** SSOT-флаг готов. Capability-routing через `adaptHistoryToCapabilities` уже учитывает `documentSupport.supported`. После Шага 4 переключение `false → true` на reasoning Grok'ах автоматически разблокирует PDF. Non-reasoning — отдельный вопрос архитектору.

---

## Секция 6 — Готовность к интеграции xAI Files API

### 6.1 В коде нет полу-реализации Files API для Chat

**Проверки:**
- `grep "input_file" lib/ app/` — 0 hits кроме комментария в model-catalog.
- `grep "/v1/files" lib/ app/` — 1 hit в [scripts/diagnose-xai-library-state.ts:118](../../../scripts/diagnose-xai-library-state.ts#L118) (read-only диагностика для Library) и Library upload.
- `grep "attachment_search" lib/ app/` — 0 hits.

**Library использует `/v1/files`** через `lib/ai/library/xai-collections.ts:147-172` (`uploadFile`, `purpose: "assistants"`) — но **только для библиотечных загрузок** через management-api collections, НЕ для chat-attachment.

**Заключение:** ноль полу-реализации. Чистый старт. STOP-условие #1 не сработало.

### 6.2 🚨 @ai-sdk/xai 3.0.83 НЕ поддерживает PDF/file parts

**Доказательство 1 — Chat Completions path:**
[`node_modules/@ai-sdk/xai/dist/index.mjs:54-67`](file://node_modules/@ai-sdk/xai/dist/index.mjs):
```ts
case "file": {
  if (part.mediaType.startsWith("image/")) {
    // ...image_url branch
  } else {
    throw new UnsupportedFunctionalityError({
      functionality: `file part media type ${part.mediaType}`
    });
  }
}
```

**Доказательство 2 — Responses API path:** идентичная логика на `index.mjs:1075-1085`. `convertToXaiResponsesInput` принимает только `input_text` + `input_image`.

**Что есть в SDK:**
- Chat Completions — только `image_url` content.
- Responses API — `input_text`, `input_image`. **НЕТ `input_file`.**
- `xaiTools.fileSearch` ([index.d.ts:275-294](file://node_modules/@ai-sdk/xai/dist/index.d.ts#L275)) — server-side tool, требует `vectorStoreIds` и Responses API. Это РАЗНЫЙ surface от Collections.

**Возможные пути для архитектора (на выбор):**
1. **Upgrade @ai-sdk/xai > 3.0.83** — если в новой версии добавили `input_file`. Архитектор обязан проверить changelog WebSearch'ем.
2. **Bypass SDK через raw fetch** — повторить паттерн `xai-collections.ts` (typed wrappers на `fetch` поверх `api.x.ai/v1/messages`). Поддерживаемое решение, но дублирует логику streamText.
3. **Custom AI SDK provider middleware** — перехватить файловые parts ДО `convertToXaiChatMessages` и вставить вручную через `body` provider option.
4. **Через server-side `xaiTools.fileSearch`** — но это требует миграции Library с Collections на Vector Stores ИЛИ параллельной поддержки двух API. Архитектурно тяжёлый путь.

**STOP-условие #3 ЧАСТИЧНО ВЫПОЛНЕНО** — `attachment_search` не невозможен, но **через стандартный путь streamText() в SDK 3.0.83 — невозможен**. Архитектору обязательно адресовать это в SPEC.

### 6.3 🚨 simply-chat default-модель не agentic

[lib/ai/task-assignments.ts:94](../../../lib/ai/task-assignments.ts#L94):
```ts
"simply-chat":              "grok-4-1-fast-non-reasoning",
"simply-chat-think":        "grok-4.20-0309-reasoning",
"chat-vision":              "grok-4-1-fast-non-reasoning",  // после Шага 3
"expertise":                "grok-4.20-0309-reasoning",
```

**По архивному ресёрчу TZ_ModelCatalogDocumentFlags:** Files API + `attachment_search` доступны **только agentic-моделям** (`*-reasoning`, `multi-agent`). Non-reasoning — НЕ agentic.

**Импликация для Шага 4:**
- `expertise` (reasoning) — PDF работает.
- `simply-chat-think` (reasoning) — PDF работает.
- `simply-chat` default + `chat-vision` (non-reasoning) — **PDF не работает**.

**Возможные решения для архитектора (на выбор):**
- (A) Capability-routing — при наличии PDF-attachment в новом сообщении автоматически переключить taskId на `simply-chat-think` (как `chat-vision` делает с image).
- (B) Сделать default `simply-chat` = reasoning (откат решения ТЗ-XAI-4 v3.88).
- (C) Новый taskId `chat-files` с reasoning-моделью, аналогично `chat-vision`.
- (D) Если xAI 2026-04+ изменил правила и non-reasoning умеет Files API — через WebSearch проверить и оставить default как есть.

### 6.4 Vercel Blob — резервный канал

[lib/ai/library/xai-collections.ts:147](../../../lib/ai/library/xai-collections.ts#L147) — `uploadFile` уже использует `purpose: "assistants"`. Готовая утилита для chat-аттачментов.

`originalFileUrl` в `libraryDocument` — паттерн «backup в Blob, primary в xAI» уже работает. Можно расшарить для chat: новая таблица `chat_attachment` либо расширение `Message_v2.attachments` JSON-полем.

**Drizzle schema ещё НЕ имеет `chat_attachment` таблицы.** Архитектору решить — отдельная таблица или JSON-поле.

---

## Секция 7 — Test data: chat 3353a183

### 7.1 Общая статистика

```sql
SELECT COUNT(*), SUM(tokenCount) FROM "Message_v2"
 WHERE "chatId" = '3353a183-37f5-498e-b461-c2e87ff65ef1';
```

| Поле | Значение |
|---|---|
| Total messages | **418** (215 user / 203 assistant) |
| Sum tokenCount | **789,937 токенов** |
| Период | 2026-04-14 17:39 — 2026-04-28 16:39 (2 недели) |

### 7.2 Распределение типов attachments

| Тип | User-сообщений |
|---|---|
| Любые file parts | 39 |
| inline file marker `📄 **Файл:**` | 19 |
| `application/pdf` mediaType | 18 |
| `image/*` mediaType | 21 |
| `text/plain` file part | **0** (все уже сконвертированы в text inline на upload) |

**Вывод:** convertTextFilePartsInMessage работает on-write — text/plain в БД нет, есть только text parts с маркером.

### 7.3 Откуда 701K токенов «на 20 сообщений»

Last 20 user messages (chat 3353a183):

| Time | id | tokenCount | parts_bytes | marker | image | pdf |
|---|---|---:|---:|---|---|---|
| 2026-04-28 12:53 | `c7853a33` | **684,986** | **2,858,952** | ✅ | — | — |
| 14:55-16:38 (10 messages) | various | 14-480 | 64-2889 | в 4 случаях | в 1 | — |
| 13:36-14:03 (5 messages) | various | 5610-8285 | 33907-43986 | ✅ во всех | — | — |
| 12:52 | `08da01d3` | 16 | 57 | — | — | — |

**Корневой контрибьютор: ОДНО сообщение `c7853a33` (2026-04-28 12:53) = 685K токенов / 2.85 MB inline-портянка.** 87% от всех 790K чата.

Структура `parts`: `[text-маркер 📄 **Файл:**, text-вопрос-владельца]`. Это огромный документ, прилетевший inline-text после конверсии на upload.

**Это эталонный test case для VERIFICATION.md Шага 4:** одна и та же история до миграции = 685K токенов в одной message → после миграции = ~50 токенов (file_id reference) + xAI server-side `attachment_search` чанками.

### 7.4 Дубли по convertTextFilePartsInMessage

Видны пары сообщений с одинаковым `tokenCount` и `parts_bytes`:
- `2b954737` (13:49) = `5610` ткн / `33954` B
- `fe0d4836` (13:43) = `5606` ткн / `33907` B

Тот же файл, перезагружен с интервалом 6 минут → две полные копии в истории. Подтверждает leak из TZ_SimplyChatBillingLeak («дубль при повторной загрузке»).

---

## STOP-условия

| # | Условие | Сработало? | Действие |
|---|---|---|---|
| 1 | Полу-реализация Files API в коде | ❌ Нет | Чистый старт. |
| 2 | librarySearch на pgvector | ❌ Нет, на xAI Collections | Третий уровень готов. |
| 3 | attachment_search невозможен с @ai-sdk/xai 3.0.83 | ⚠️ **ЧАСТИЧНО** — невозможен через стандартный streamText path в SDK 3.0.83 | **Эскалирую архитектору.** Архитектор обязан выбрать SDK upgrade / raw fetch / middleware / vector_stores migration в SPEC. |

Эскалация по STOP-3 + дополнительный архитектурный вопрос simply-chat default model — критические для дизайна Шага 4.

---

## Зависимости

- ✅ Шаги 1-3 миграции — закрыты.
- ⚠ TZ_SimplyChatBillingLeak Fix 2 — переходный код в `route.ts:343-352`, удалить в финализации Шага 4.
- ⚠ TZ_InlineFilePortyanka UI-фикс в `components/message.tsx` — TODO в коде, удалить после Шага 4 (файлы будут file parts → карточка через `attachmentsFromMessage`).

---

## Что НЕ сделано (по прямому указанию ТЗ)

- ❌ Не предлагаю архитектурные решения cleanup'a — это работа архитектора в SPEC.
- ❌ Не запускал `pnpm build` / `pnpm typecheck`.
- ❌ Не правил файлы кода.
- ❌ Не писал SPEC/ROADMAP.

---

## Решение

**Передаю архитектору** этот ANALYSIS + [FINDINGS.md](FINDINGS.md). До получения SPEC от архитектора Phase 1+ не начинаем.

**Ключевое для SPEC:**
1. Выбрать стратегию обхода SDK 3.0.83 limitation (Finding #1).
2. Решить судьбу simply-chat default-модели (Finding #2).
3. Сверить $5 vs $10 / 1k tool invocations через WebSearch актуальной docs.x.ai (Finding #3).
4. Спроектировать chat_attachment storage (отдельная таблица vs JSON в Message_v2).
