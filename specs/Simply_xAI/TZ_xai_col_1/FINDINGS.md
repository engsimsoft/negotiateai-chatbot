# FINDINGS ТЗ-XAI-COL-1

> Находки вне scope ТЗ, обнаруженные в ходе работы.
> После закрытия ТЗ значимые (medium/high) переносятся в `specs/_backlog/` (правило 8 WORKFLOW).

---

## F1 (low) — Ручные миграции требуют обновления `_journal.json`

**Дата:** 2026-04-21 (этап A1)

**Контекст:** Drizzle `migrate()` из `drizzle-orm/postgres-js/migrator` прогоняет миграции по списку в `lib/db/migrations/meta/_journal.json`. Если SQL-файл лежит в `migrations/` но его записи в journal нет — migrator файл **игнорирует молча** (без warning'а).

**Что случилось в A1:** написал 0059/0060/0061 SQL-файлы вручную (без `drizzle-kit generate`). `npm run build` прошёл, логи показали «Migrations completed» — но таблиц в БД не было. Проблему поймал через `mcp__postgres__query`.

**Фикс (уже применён):** добавил 3 записи в `_journal.json` вручную, перезапустил `npm run db:migrate`. Таблицы созданы, индексы на месте.

**Рекомендация для будущих ТЗ с ручными миграциями:**
- ROADMAP чек-лист должен включать пункт: «добавить запись в `_journal.json`» + «проверить результат через `mcp__postgres__query`» (не полагаться на exit code `npm run build`)
- Альтернатива — использовать `drizzle-kit generate` (генерирует SQL + journal + snapshot автоматически), но теряются комментарии в SQL

**Impact:** Low — фикс тривиальный, но ловушка молчаливого пропуска опасна.

**Обновление сессии 6 (2026-04-24, B1):** ✅ Добавлен пункт в [specs/WORKFLOW.md](../../WORKFLOW.md) в разделе «Ручные миграции».

---

## F2 (low) — Real xAI Search API отличается от публичной docs

**Дата:** 2026-04-21 (этап A2)

**Контекст:** публичная документация `docs.x.ai/docs/guides/using-collections/api` описывает search endpoint `POST /v1/documents/search`, но **не даёт точной response shape**. Citation format описан в `tools/collections-search-tool` как `collections://{collection_id}/files/{file_id}`.

**Что нашёл эмпирически:**

```json
{
  "matches": [
    {
      "file_id": "file_...",
      "chunk_id": "file_..._0",
      "chunk_content": "...",
      "score": 0.9997,
      "collection_ids": ["collection_..."],
      "fields": { "title": "filename.txt", "chroma:uri": "teams/.../files/..." },
      "page_number": 0
    }
  ]
}
```

Отличия от предположений архитектора / моего ANALYSIS:
- Top-level: **`matches`**, не `chunks`
- Chunk content: **`chunk_content`**, не `content`
- Коллекции: **`collection_ids`** (массив), не `collection_id`
- **Нет поля `citation`** — нужно строить самому через `formatCitation(collection_ids[0], file_id)`
- Есть `page_number` (полезно для UI — показ страницы в preview)
- Есть `fields.title` — оригинальное имя файла

**Решение:** раздельные типы `XaiSearchMatch` (raw shape) + `LibrarySearchChunk` (domain-normalized, для tools/UI). Wrapper `searchDocuments()` возвращает нормализованный тип. Upstream код не видит raw ответ.

**Impact:** Low — поймано в A2 smoke test, не попало в production. Но подтверждает важность e2e-скрипта на этапе wrapper'а (не только на уровне API endpoints).

---

## F3 (medium) — Document processing status endpoint в публичной docs отсутствует

**Дата:** 2026-04-21 (этап A2)

**Контекст:** ROADMAP A3c предполагал `GET /api/library/documents/[id]/status` с вызовом некого xAI status endpoint'а. В публичной docs такого endpoint'а нет.

**Эмпирически:** после `uploadFile + attachFileToCollection` документ становится searchable через ~5-10 секунд. То есть search сам по себе — proxy для status: если search возвращает chunks для этого file_id → документ ready.

**Варианты реализации status polling для A3c:**

1. **Search-based probe** (MVP): клиент опрашивает `GET /api/library/documents/[id]/status`, сервер делает `searchDocuments({ fileIds: [xaiFileId], query: "*", maxNumResults: 1 })`. Если matches есть → status=ready. Если пусто больше N попыток → timeout → error.
2. **Скрытый endpoint**: попробовать `GET /collections/{id}/documents/{file_id}` (по паттерну REST) в A3b — может вернуть metadata с status.
3. **Timestamp эвристика**: просто выставлять `ready` через фиксированные N секунд после attach. Ненадёжно для больших PDF.

**Решение предварительное:** (1) — самый честный вариант. В A3c уточним.

**Impact:** Medium — блокирует UI-индикатор 🟡/🟢 в A5. Митигация в A3c, не ранее.

**Обновление сессии 4 (2026-04-23):** ✅ **Закрыто.** Найден endpoint `GET /v1/collections/{cid}/documents/{file_id}` (DocumentMetadata), возвращает `status`, `content_type`, `processing_status`, `error_message`, `chunk_count`, `last_indexed_at`. Wrapper: [getDocumentMetadata](../../../lib/ai/library/xai-collections.ts) (вариант 2 из трёх предложенных).

**Обновление сессии 6 (2026-04-24, финализация B1):** ✅ **Подключено к `status/route.ts`.** Search-based probe удалён — теперь единственный вызов `getDocumentMetadata` + маппинг `DOCUMENT_STATUS_PROCESSED`/`DOCUMENT_STATUS_FAILED` на нашу БД. Дешевле (один REST вместо полного search), точнее (различает PROCESSING vs FAILED vs ошибки с error_message).

---

## F4 (high) — `/v1/files` sniffит MIME и ломает Office-форматы в Collections

**Дата:** 2026-04-22 (сессия 4, этап A5.13)

**Контекст:** Стандартный flow из публичных примеров xAI — `POST /v1/files` (purpose=assistants) → attach к коллекции через `POST management-api/v1/collections/{cid}/documents/{fid}`. Работает для text-based (TXT, MD, CSV) и частично для PDF, но **ломается для DOCX/XLSX/PPTX**.

**Симптомы (три сессии отладки):**
- DOCX/XLSX/PPTX → `DOCUMENT_STATUS_FAILED`, `content_type: application/octet-stream`, error: «File format not supported. The file does not contain readable text.»
- PDF → `PROCESSED`, но chunks бинарные (PDF-байты, fontdata), search score <0.02.
- В БД и multipart запросе MIME указывался правильный — xAI всё равно перезаписывал на octet-stream.

**Корневая причина:**
`/v1/files` применяет **MIME-сниффинг по магическим байтам** и **игнорирует client-provided Content-Type** из multipart header'а. DOCX/XLSX/PPTX — ZIP-контейнеры (PK-header), сниффер дефолтит в `octet-stream`, Collections-indexer отказывается запускать Office-конвертер. PDF распознаётся, но специальный конвертер PDF→текст пропускается — получается сырой байтовый stream.

**Опровергнутые гипотезы (важно для будущего):**
- Теория архитектора «Node.js undici FormData теряет `Blob.type` при multipart boundary» → **опровергнуто curl-тестом.** Тот же результат, значит проблема на стороне xAI, не в клиенте.
- «Формат DOCX не поддерживается» → опровергнуто WebFetch docs.x.ai/developers/files/collections — MIME явно в списке «Supported MIME Types».

**Решение:** использовать **отдельный endpoint** `POST management-api.x.ai/v1/collections/{id}/documents` с multipart полями `name`, `data`, `content_type`. `content_type` как **поле формы** (не заголовок) не подвержено сниффингу. Детали и альтернативы — [ADR 056](../../../docs/decisions/056-library-upload-collections-endpoint.md).

**Подтверждение (2026-04-22):** все 4 формата прошли e2e-тест через UI:
- DOCX (TMS_Академия_Концепт_v2.docx) → 7 chunks, semantic top=0.604
- XLSX (pressure_compression.xlsx) → 5 chunks
- PPTX (Simply_для_Григория.pptx) → 6 chunks
- PDF (M84 User Manual.pdf, 86 стр) → 32 chunks, semantic top=0.509, реальный текст ECU-мануала

**Impact:** **HIGH** — без этого фикса Library не работала бы для 3 из 5 MVP-форматов. Урок критичный: **не доверять стандартным examples даже из официальной docs, если есть альтернативный endpoint в том же API reference — проверить оба.** Защита от повторения: [ADR 056](../../../docs/decisions/056-library-upload-collections-endpoint.md) с секцией «Что не делать».
