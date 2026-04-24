# ADR 056: Library Upload via Collections Management API (content_type preservation)

**Дата:** 2026-04-23
**Статус:** Принято
**Связанный ТЗ:** [ТЗ-XAI-COL-1](../../specs/Simply_xAI/TZ_xai_col_1/) — «Библиотека через xAI Collections»

---

## Контекст

Simply Library загружает в xAI Collections четыре формата: **PDF, DOCX, XLSX, PPTX**. Официальная документация xAI (`docs.x.ai/developers/files/collections`, раздел «Supported MIME Types») явно перечисляет все четыре как поддерживаемые — xAI обещает «special file conversion and chunking techniques» на стороне сервера.

Первая реализация wrapper'а [lib/ai/library/xai-collections.ts](../../lib/ai/library/xai-collections.ts) использовала стандартный двухэтапный flow, описанный в официальных примерах:

```
1. POST  https://api.x.ai/v1/files                           (purpose=assistants)  → file_id
2. POST  https://management-api.x.ai/v1/collections/{cid}/documents/{file_id}      → attach
```

**Симптом (3 сессии отладки):**

- **PDF** индексировался, но search возвращал бинарный мусор (PDF-байты, fontdata), score < 0.02. Приняли за проблему `purpose`, пробовали Tesla 10-K control — мимо.
- **DOCX/XLSX/PPTX** индексировались в `DOCUMENT_STATUS_FAILED` с error_message = «File format not supported. The file does not contain readable text.»
- `GET /v1/collections/{cid}/documents/{file_id}` (`DocumentMetadata`) показывал `content_type: "application/octet-stream"` — **хотя в multipart запросе мы указывали правильный MIME**, и в нашей БД MIME корректный.

**Гипотезы и их опровержение (сессии 2–4):**

| Гипотеза | Как проверили | Результат |
|---|---|---|
| Формат DOCX не поддерживается | WebFetch docs.x.ai | Опровергнуто — MIME есть в официальном списке |
| Browser не ставит MIME | Добавили `MIME_BY_EXTENSION` resolver по имени файла | В БД MIME корректный, xAI всё равно octet-stream |
| Node.js undici FormData теряет `Blob.type` | curl с `-F "file=@...;type=..."` напрямую | **Опровергнуто** — curl тоже получил octet-stream. Теория архитектора про `Blob → File` была неверна |
| xAI sniffит MIME по магическим байтам и игнорирует client-provided | Консилиум с Grok через консоль xAI | **Подтверждено** — `/v1/files` применяет свою эвристику MIME |

**Корневая причина:**
`/v1/files` не сохраняет client-supplied `Content-Type` из multipart header. xAI определяет тип по сигнатуре байтов. DOCX/XLSX/PPTX — это ZIP-контейнеры (PK-header), сниффер дефолтит их в `application/octet-stream`, после чего Collections-indexer отказывается применять Office-конвертер и возвращает `FAILED`. PDF тоже страдает — сниффер распознаёт байты, но специальный конвертер PDF → текст пропускается, потому что content_type не соответствует ожидаемому.

В официальной документации xAI **есть третий, отдельный endpoint**, который мы не использовали:

```
POST https://management-api.x.ai/v1/collections/{collection_id}/documents
  -F "name=<filename>"
  -F "data=@<file>"
  -F "content_type=<mime>"
```

Здесь `content_type` — **отдельное поле формы**, не заголовок multipart. Оно не подвержено MIME-сниффингу и сохраняется как переданное. Далее Collections-indexer применяет корректный конвертер: для DOCX/XLSX/PPTX/PDF получается осмысленный текст + chunks.

---

## Решение

Основной upload-путь Library идёт через **прямой endpoint `POST management-api.x.ai/v1/collections/{id}/documents`** с `content_type` как полем формы.

**Новая функция:** `uploadDocumentToCollection({ collectionId, buffer, filename, mimeType })` в [lib/ai/library/xai-collections.ts](../../lib/ai/library/xai-collections.ts).

**Возврат:** `XaiDocumentMetadata` (содержит `file_metadata.file_id`, `status`, `chunk_count`). Вызывающий код извлекает `file_id` для последующего attach'а к дополнительным коллекциям.

**Поведение при нескольких коллекциях:** файл загружается через прямой endpoint в **первую** коллекцию (получаем правильный `content_type` и индексацию). Для остальных коллекций вызывается `attachFileToCollection` с этим же `file_id` — xAI переиспользует уже правильно сохранённый `content_type`.

**Старые функции `uploadFile` и `attachFileToCollection` оставлены:**
- `attachFileToCollection` используется в PATCH-реаттаче ([app/(chat)/api/library/documents/[id]/route.ts](../../app/(chat)/api/library/documents/%5Bid%5D/route.ts)) и в `scripts/migrate-orphan-library-documents.ts` для legacy-файлов. Файл уже в xAI — нужно только привязать.
- `uploadFile` (POST `/v1/files`) **НЕ использовать для Library-документов.** Остаётся как универсальный wrapper на случай, если в будущем понадобится загружать файлы в `/v1/files` для других целей (например, чат-вложения или будущие API xAI).

---

## Причины

1. **Единственный способ корректно загрузить Office-форматы в Collections.** Подтверждено эмпирически и официальной документацией — раздел «Supported MIME Types» явно говорит про DOCX/XLSX/PPTX/ODT, но только через этот endpoint.

2. **`content_type` как поле формы — защита от MIME-сниффинга.** Multipart-заголовок переписывается эвристикой xAI; поле формы нет.

3. **Нет регрессии по PDF.** Проверено в сессии 4: `M84 User Manual.pdf` (86 стр, 662 KB) → 32 chunks, semantic top-score 0.509, реальный текст («MoTeC M84 User's Manual. Contents. Introduction 1...»). В сессии 2 через `/v1/files` тот же PDF выдавал мусорные чанки со score <0.02.

4. **Не требует локального pre-extract.** Владелец явно отклонил вариант «DOCX→text на нашей стороне» как костыль (HANDOFF сессии 3). Прямой endpoint xAI сам делает конвертацию — архитектурно чисто.

5. **Минимальная правка кода.** Одна новая функция в wrapper'е + одна правка в handler upload'а. PATCH-реаттач, миграция orphans и DELETE не трогались.

6. **Nullable `file_metadata`.** Ответ endpoint'а возвращает `file_metadata.file_id` опциональным — код проверяет и бросает понятную ошибку, если xAI вернул пустой объект.

---

## Последствия

### Плюсы

- **DOCX/XLSX/PPTX/PDF работают end-to-end** (сессия 4 — все четыре формата подтверждены: `status=PROCESSED`, корректный `content_type`, search возвращает осмысленный текст).
- `content_type` в `DocumentMetadata` соответствует реальному типу файла → диагностика через `scripts/diagnose-xai-library-state.ts` теперь надёжна.
- Если завтра xAI добавит поддержку нового MIME (например `application/vnd.apple.pages`) — достаточно добавить его в [app/(chat)/api/library/documents/route.ts](../../app/(chat)/api/library/documents/route.ts) в `SUPPORTED_MIME` и `MIME_BY_EXTENSION`. Сам upload-path не меняется.

### Минусы

- **Два endpoint'а xAI вместо одного** в нашем wrapper'е: `uploadDocumentToCollection` (primary) + `attachFileToCollection` (reattach/orphan). Усложнение API, но обосновано разными сценариями.
- Если Library-документ должен сразу быть в N коллекциях (N>1) — первый вызов делает загрузку+индексацию, потом N-1 attach'ей. В текущем UI юзер выбирает одну коллекцию по умолчанию, кейс N>1 редкий — оптимизировать не стоит.
- **Orphan-файлы при ошибке.** Если `uploadDocumentToCollection` зашёл в xAI, но дальнейший `createLibraryDocument` упал — файл останется в xAI без записи в нашей БД. Cleanup через `xaiDeleteFile` в catch-блоке (best-effort). `DELETE /v1/files` иногда возвращает HTTP 500 — orphans чистятся скриптом `scripts/migrate-orphan-library-documents.ts`.

### Trade-offs

- Прямой endpoint находится на **management-api** (требует `XAI_MANAGEMENT_API_KEY`), а не обычный `XAI_API_KEY`. В production это уже настроено (ключ добавлен в A1).
- `chunks_processed_count` может быть меньше `chunk_count` в первые ~60 секунд после upload — xAI возвращает `DOCUMENT_STATUS_WRITING` (промежуточный). UI polling должен это учитывать (MVP — через search-probe, см. F3 в [FINDINGS.md](../../specs/Simply_xAI/TZ_xai_col_1/FINDINGS.md)).

---

## Альтернативы

### Альтернатива 1: `POST /v1/files` + `POST /collections/{cid}/documents/{fid}` (старый flow)

**Что это:** Стандартный двухэтапный upload из публичных примеров xAI.

**Почему отклонили:**
- `/v1/files` применяет MIME-сниффинг и перезаписывает client-supplied `Content-Type`.
- DOCX/XLSX/PPTX после этого получают `application/octet-stream` и Collections-indexer отказывается их обрабатывать.
- PDF индексируется, но качество chunks ухудшается — конвертер PDF→текст пропускается.

**Когда может быть лучше:**
- Для text-based файлов без специальной конвертации (TXT, MD, CSV) этот путь работает корректно.
- Если будущий API xAI потребует использовать именно `/v1/files` (например, attach-as-context в chat-completions) — функция `uploadFile` в wrapper'е сохранена именно для таких случаев.

### Альтернатива 2: Python SDK `client.collections.upload_document(...)`

**Что это:** Высокоуровневый метод официального Python SDK (через gRPC `UploadFile` + `AddDocumentToCollection`).

**Почему отклонили:**
- Проект на TypeScript/Next.js — вводить Python-mostly SDK только ради upload'а нерационально.
- SDK под капотом делает тот же вызов к gRPC-эквиваленту multipart-endpoint'а — никакой магии нет.
- REST-путь прямой, без дополнительных зависимостей.

### Альтернатива 3: Локальный pre-extract DOCX/XLSX → text

**Что это:** Распаковать DOCX/XLSX/PPTX на нашей стороне (например `mammoth`, `xlsx`, `pptx2json`), извлечь plain text, залить в xAI как `text/plain`.

**Почему отклонили:**
- Владелец прямо отказался от этого подхода как «костыля» (HANDOFF сессии 3, раздел «Что не делать»).
- Теряется семантика документа: таблицы XLSX → перенос строк, слайды PPTX → просто параграфы, изображения в DOCX полностью пропадают. xAI Collections-конвертер сохраняет гораздо больше структуры (видно в chunks M84 PDF: CSV-таблицы распознаны, image placeholders с координатами сохранены).
- Нам не нужно тащить 4 тяжёлых парсера в зависимости проекта, если xAI уже делает эту работу на своей стороне.

**Когда может быть лучше:**
- Если бы xAI вообще не поддерживал Office-форматы (но он поддерживает — ADR отменяется вместе с контекстом).
- Если нужно OCR картинок внутри PDF/DOCX (xAI этого не делает — см. раздел «Примечания»).

### Альтернатива 4: Blob Storage + собственный индекс

**Что это:** Хранить файлы в Vercel Blob, делать embeddings через Voyage AI, чанки в pgvector (как MIND).

**Почему отклонили:**
- Удваивает инфраструктуру (MIND уже живёт на pgvector, но MIND — это короткие факты, не документы). Документы требуют конвертации Office-форматов, OCR, table-aware chunking — всё что xAI Collections делает из коробки.
- Стоимость: Collections включают индексацию + retrieval за фиксированную цену в xAI-плане. Свой pipeline = CPU на конвертацию, storage, API-latency.
- Отдельное решение принято в ADR-056 scope: **Collections — единственное хранилище Library-документов**. Параллельный Blob-индекс нарушает SSOT.

---

## Проверка решения

**Curl-тест (сессия 4, 2026-04-22):**

```bash
# 1. Упасть через старый путь — подтверждение корневой причины
curl -X POST https://api.x.ai/v1/files \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -F "file=@file.docx;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document" \
  -F "purpose=assistants"
# → file_id

curl -X POST "https://management-api.x.ai/v1/collections/$CID/documents/$FID" \
  -H "Authorization: Bearer $XAI_MANAGEMENT_API_KEY"
# → status=DOCUMENT_STATUS_FAILED, content_type=application/octet-stream

# 2. Правильный путь — подтверждение решения
curl -X POST "https://management-api.x.ai/v1/collections/$CID/documents" \
  -H "Authorization: Bearer $XAI_MANAGEMENT_API_KEY" \
  -F "name=file.docx" \
  -F "data=@file.docx" \
  -F "content_type=application/vnd.openxmlformats-officedocument.wordprocessingml.document"
# → status=DOCUMENT_STATUS_PROCESSED, content_type=application/vnd.openxmlformats-...docx, chunk_count=2
```

**UI-тест (сессия 4):** 4 формата (DOCX, XLSX, PPTX, PDF) загружены через `/library`, все перешли в `status=PROCESSED`, search возвращает осмысленный текст со score > 0.3 (не бинарный мусор, который был в сессии 2 для PDF).

---

## Ссылки и ресурсы

- **Официальная docs xAI Collections:** https://docs.x.ai/developers/files/collections (раздел «Supported MIME Types»)
- **Collections API reference:** https://docs.x.ai/developers/files/collections/api
- **HANDOFF ТЗ-XAI-COL-1:** [specs/Simply_xAI/TZ_xai_col_1/HANDOFF.md](../../specs/Simply_xAI/TZ_xai_col_1/HANDOFF.md) — session-by-session диагностика
- **Архитектура Library:** [specs/Simply_xAI/TZ_xai_col_1/SIMPLY_LIBRARY_ARCHITECTURE.md](../../specs/Simply_xAI/TZ_xai_col_1/SIMPLY_LIBRARY_ARCHITECTURE.md)
- **Связанные ADR:**
  - [ADR 039 — pgvector+Voyage RAG](039-pgvector-voyage-ai-rag-infrastructure.md) — другой RAG-pipeline (MIND), не документы
  - [ADR 055 — Capability-driven attachment routing](055-capability-driven-attachment-routing.md) — routing вложений в чате, смежная тема

---

## Примечания

### Что xAI Collections НЕ делает

- **OCR картинок внутри документов.** В PDF и DOCX изображения помечаются placeholder'ом `<!-- Image (x, y, w, h) -->` в chunks, но их содержимое не распознаётся. Если важная инфа только на схеме/скриншоте — search её не найдёт. Для OCR нужен отдельный pipeline (Vision API → дописать текст в chunk). Кандидат на отдельное ТЗ.
- **Сканированные PDF** (фото страниц без текстового слоя) — извлечь нечего, Collections вернёт почти пустые chunks.

### Диагностика состояния Library

Один скрипт покрывает всё: [scripts/diagnose-xai-library-state.ts](../../scripts/diagnose-xai-library-state.ts) — выводит список коллекций, документов с полным `DocumentMetadata` (`status`, `content_type`, `chunk_count`, `error_message`), orphan-файлы в `/v1/files`. При любой жалобе «поиск пустой» — начинать отсюда.

---

## История изменений

- **2026-04-23** — ADR принят. Закрытие блокера A5.13 (сессия 4 ТЗ-XAI-COL-1). Автор: Claude (Opus 4.7) + владелец (Vladimir Sharandin).
