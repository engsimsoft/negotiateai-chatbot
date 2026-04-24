# Анализ ТЗ-XAI-COL-1: Библиотека через xAI Collections API

**Дата анализа:** 2026-04-21
**Источник:** [SIMPLY_LIBRARY_ARCHITECTURE.md](SIMPLY_LIBRARY_ARCHITECTURE.md) v1.0 + ответы архитектора (Фаза ANALYSIS, 2026-04-21).
**Статус:** ✅ Все вопросы закрыты, можно переходить к ROADMAP.

> **Этот документ — SSOT решений для ROADMAP.** Архитектурный документ v1.0 остаётся как есть, все последующие правки зафиксированы здесь. Комплексный патч архитектуры — в B1 финализации.

---

## Резюме

Новое третье хранилище знаний рядом с Профилем и MIND — пользовательская Библиотека через xAI Collections API. xAI отвечает за файлы, chunking, embeddings, OCR, поиск. Наш код — userId-scoped БД (3 таблицы), 12 API endpoints, один tool `library_search` во всех 4 chat modes, страница `/library`, split-view preview + мини-чат. Серверная часть тонкая (наша БД + прокси к xAI), вся RAG-тяжесть на xAI.

---

## Ответы на вопросы

### Q1 — PDF preview библиотека
`react-pdf` в Node runtime. Проверю bundle size в A6 перед интеграцией. SSR не требуется (preview — клиентский компонент).

### Q2 + Q4 — Polling статуса / `after()` vs queue
Client polling `GET /api/library/documents/[id]/status` каждые 3s. Сервер делает только `INSERT status='processing' + upload xAI Files + attach to collection` (≤30s), ожидание processed вынесено на клиент. `after()` не используем. SSE — v2.

### Q3 — Default коллекция «Мои документы» (пересмотр 2026-04-21 в ходе A5)

**Исходное решение (устарело):** Вариант A — документ без записей в `library_collection_document` показывается в секции «Все документы» / «Без коллекции».

**Текущее решение:** Вариант B (default коллекция), подтверждён архитектором после root-cause анализа в ходе мануального теста A5.

**Root cause:** xAI Files API — только для временного chat-контекста. Persistent semantic index существует **только внутри Collections**. Файл, загруженный в `/v1/files` без `/v1/collections/{id}/documents/{file_id}` attach, выпадает из search index — status probe навсегда возвращает 0 chunks, UI вечно в «processing». Индустриальный паттерн (OpenAI Vector Stores, Anthropic Files, Pinecone) — файл всегда в store/коллекции.

**Реализация:**
- Имя: **«Мои документы»**
- **Lazy-create** при первом upload без явного `collectionIds` (одна на пользователя)
- Отображается в UI как обычная коллекция, `sortOrder=0` (первая)
- Поле `isDefault BOOLEAN` защищает от удаления (DELETE endpoint → 403 с объяснением)
- Переименование и emoji — можно (пользователю видно «Мои документы», но он может назвать как хочет)
- **Миграция 0062** — добавляет `isDefault` + partial unique index `WHERE isDefault = TRUE` (одна default на userId)
- **Скрипт `scripts/migrate-orphan-library-documents.ts`** — для существующих документов без коллекции (привязать задним числом, не удалять)

### Q5 — user.delete hook
v1.1, не MVP. У Simply нет self-delete UX сейчас.

### Вопросы владельцу — ответы
1. **Макеты и product design** — владелец положит в `specs/Simply_xAI/` до старта A5. A1-A4 не блокируются.
2. **Разбивка A3** — подтверждена: A3a/A3b/A3c.
3. **Split-view MIND** — НЕ подключать. Библиотека — источник истины, память там лишняя.
4. **`XAI_MANAGEMENT_API_KEY`** — отдельный ключ от `XAI_API_KEY`, создаётся в xAI Console → Management Keys → Create → permission `AddFileToCollection`. Подтверждено по docs.x.ai/developers/files/collections/api. Владелец создаст в момент старта A1.
5. **Версия в B1** — **v3.99.0** (не v4.0.0). v4.0.0 зарезервирован под ТЗ-BILLING-1 (ЮKassa/Тинькофф/СБП).

---

## Критические правки архитектуры (внесены в ROADMAP)

### К-1. Нумерация миграций
Архитектор предложил `0053/0054/0055` — номера заняты. **Правильно: `0059_library-collection.sql` / `0060_library-document.sql` / `0061_library-collection-document.sql`**. Последняя существующая — `0058_mind-deep-consolidated-at.sql`.

### К-2. Макеты и product design — организационный момент
`SIMPLY_LIBRARY_PRODUCT_DESIGN.md` + `simply_library_page_layout.html` + `simply_home_with_library_card.html` — владелец положит до старта A5. A1-A4 запускаются без них. **Стиль UI — строго по [docs/design-system.md](../../../docs/design-system.md)**, HTML = референс компоновки и логики, не спецификация стилей.

### К-3. autoType — Zod enum для LLM, TEXT в БД
- **LLM structured output:** Zod enum (модель возвращает одно из фиксированных значений) → качество фильтрации UI выше
- **БД:** TEXT без CHECK constraint → расширяемость списка без миграции

---

## Правки по существу

### П-1. Upload flow — client polling, не серверное ожидание
Серверная часть `POST /api/library/documents`:
```
1. Auth + ownership check
2. Validate (size ≤ 100 MB, MIME supported)
3. Локально извлечь текст для auto-analyze (extractPdfText / mammoth / xlsx — см. П-4)
4. Grok 4.1 Fast auto-analyze (autoType + autoTags + autoDescription)
5. INSERT library_document (status='processing', autoType, autoTags, autoDescription)
6. Upload в xAI Files API → fileId
7. Attach к collection_id (или никуда — §11 Q3 вариант A)
8. UPDATE library_document SET status='processing', xaiFileId=... (фиксируем xAI id)
9. Вернуть клиенту { id, status: 'processing' }
```
Клиент опрашивает `GET /api/library/documents/[id]/status` каждые 3s → когда xAI вернёт `DOCUMENT_STATUS_PROCESSED`, сервер обновит `status='ready'` → клиент видит 🟢. `after()` НЕ используем.

### П-2. `chatMode='library-document'` — продуктовое обоснование изоляции

> **Продуктовая суть (владелец 2026-04-21):** «Библиотека нужна, чтобы я мог ввести диалог по своей базе знаний, по своим любимым учебникам, по своим конкретным договорам — и чтобы ничего туда не подмешивалось».

Split-view — это **изоляция на один документ**, не техническая деталь. Если модель захочет сказать «в этом документе этого нет» — это правильный ответ. Лучше честное «нет в учебнике» чем «возьму из интернета».

**Граница режимов:**
- `library-document` (клик на документ) = **изоляция**, один источник = конкретный `fileId`
- `expertise` / `create` / `simply` / `project` = **свобода**, все подключённые источники сосуществуют (пользователь явно выбрал их в модалке)

**Список точек, куда НЕ добавлять `library-document`:**
- `isMemoryEnabled` в [chat/route.ts:582](../../../app/(chat)/api/chat/route.ts#L582)
- Вызов `retrieveMemoryContext` (пропустить для этого mode)
- MIND-расширение в `adaptHistoryToCapabilities`

**Список tools, которые НЕ регистрировать для `library-document`:**
- `web_search`, `deep_research`, `fetch_url`, `x_search` (если появится), `create_document`, `read_project_file`
- `library_search` **без filter** — тоже нет (не должна подмешиваться даже соседняя коллекция того же пользователя)
- `library_search` **с filter `collectionIds`** — тоже нет

**Единственный tool, который регистрируется:**
- `library_search` с **hardcoded filter `fileIds: [doc.xaiFileId]`** — поиск строго внутри одного документа

**Список точек, куда ДОБАВИТЬ:**
- `chat.chatMode` enum в БД (если есть CHECK constraint — проверить в A1 и мигрировать)
- `getStandardTools()` + `getActiveToolNames()` — новая ветка для `library-document`
- `lib/ai/chat-mode-config.ts` — новая запись

### П-3. Projects в MVP — подтверждено
Library tool доступен во всех 4 chat modes (simply, expertise, create, project). Toggle «использовать Библиотеку в проекте» — v1.1.

### П-4. Auto-analyze ДО upload в xAI
Используем существующие utilities из `/api/files/upload`:
- `extractPdfText` (после ТЗ-ATTACH-1)
- `mammoth.extractRawText` (DOCX)
- `xlsx.utils.sheet_to_csv` (XLSX/XLS/XLSM)
- TextDecoder (TXT/MD)
- CSV as-is

Если логика в Library и chat upload начнёт дублироваться — вынести в `lib/text-extraction/` (общий модуль). Решение принимается по факту в A3b.

### П-5. A3 разбит на 3 под-этапа
- **A3a:** Collections CRUD (5 endpoints: GET list, POST create, PATCH rename, DELETE, POST reorder)
- **A3b:** Documents + upload (5 endpoints: GET list, POST upload, GET details, PATCH update, DELETE)
- **A3c:** Search + status (2 endpoints: POST /search, GET /[id]/status)

Валидация мануально через curl/Postman после каждого под-этапа.

---

## Мелкие правки

- **M-1.** Briefing pipeline (`briefing:author/section/podcast-script`) — явно НЕ подключаем к Library. Фоновые. Добавить в §12 архитектурного документа в B1.
- **M-2.** Upload в Library — БЕЗ heuristic scan detection. xAI делает OCR сам. Наши utilities извлекают текст для auto-analyze; raw file идёт в xAI as-is.
- **M-3.** B1 обновляет дополнительно: `docs/ai-chats-map.md` (taskId `library:auto-analyze`) + `docs/architecture.md` (route group `/api/library/`).
- **M-4.** Папка `lib/ai/library/` подтверждена. Паттерн как `lib/ai/memory/` / `lib/ai/tools/`.

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| xAI Management API падает / rate limit на массовых операциях (удаление коллекции с 100 документов) | Средняя | Средняя | Batch операции через `for-of` с `p-limit(3)`. Статус ошибки показываем пользователю, не падаем |
| `after()` альтернатива понадобится для auto-analyze (большой DOCX медленно парсится) | Низкая | Низкая | Auto-analyze работает на первых N символах (архитектор §5.2) — не узкое место |
| Конфликт нового `chatMode='library-document'` с существующими route группами | Низкая | Средняя | Split-view — отдельная компонента, не route. chat запись с новым mode создаётся, но URL остаётся в `/library/[docId]` |
| xAI Collections API меняет формат `collections://` citations без backward compat | Низкая | Средняя | Парсинг citations в отдельной утилите `lib/ai/library/citations-parser.ts`, юнит-тесты |
| Клиентский polling каждые 3s грузит сервер (N документов processing одновременно) | Средняя | Низкая | Batch endpoint `GET /api/library/documents/status?ids=...` если понадобится (v1.1) |
| 100 MB файл превышает Vercel payload limit на upload | Средняя | Высокая | Direct upload в xAI через signed URL (v2) или multipart chunked. Проверить в A2 что xAI принимает |

---

## Зависимости

**Закрыто (можно стартовать):**
- ✅ ТЗ-COMPACTION-1 (v3.94.0) + UNIFY (v3.95.0) — фундамент compaction
- ✅ ТЗ-ExpertiseCreateVisionRouting (v3.98.0, ADR 055) — capability-driven routing
- ✅ ТЗ-ATTACH-1 (v3.91.0) — `extractPdfText` и text extraction utilities
- ✅ ТЗ-AISDKLayerHardening (v3.93.0, ADR 053) — контракт AI SDK + taskId pattern

**Требуется от владельца:**
- Создать `XAI_MANAGEMENT_API_KEY` в xAI Console (permission `AddFileToCollection`) — в момент старта A1
- Положить `SIMPLY_LIBRARY_PRODUCT_DESIGN.md` + 2 HTML-макета в `specs/Simply_xAI/TZ_xai_col_1/` — до старта A5

**Затронутые компоненты:**
- `lib/db/schema.ts` — 3 новые таблицы
- `lib/db/migrations/0059`, `0060`, `0061` — SQL миграции
- `lib/ai/library/` (новая папка) — xAI client + types + citations parser
- `lib/ai/tools/library-search.ts` — новый tool
- `lib/ai/tools/chat-tools.ts` — регистрация tool в 4 chat modes
- `lib/ai/task-assignments.ts` + `lib/ai/model-catalog.ts` — новый taskId `library:auto-analyze`
- `app/(chat)/api/library/` (новая route group) — 12 endpoints
- `app/(dashboard)/library/` — страница Библиотеки
- `components/library/` (новая) — React компоненты (список коллекций, карточки документов, split-view)
- `components/glavnaya/` — карточка «Библиотека» на главной
- `app/(chat)/api/chat/route.ts` — пропуск MIND для `chatMode='library-document'`
- `lib/ai/chat-mode-config.ts` — добавить новый chatMode
- `docs/ai-chats-map.md`, `docs/architecture.md`, `CHANGELOG.md`, `SIMPLY_STATUS.md`, `SIMPLY_XAI_ROADMAP.md`

---

## Оценка

- [ ] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [x] **Сложное (5+ сессий)**

**Обоснование:** 9 этапов (A1 / A2 / A3a / A3b / A3c / A4 / A5 / A6 / B1). Новая поверхность продукта (page + API group + tool + split-view + card), 3 новые таблицы БД, интеграция с внешним Management API, нетривиальная UI-работа (drag-and-drop, filter chips, split-view). Каждый этап — отдельная сессия с мануальной валидацией.

---

## Changelog решений

| Версия | Дата | Изменение |
|---|---|---|
| 1.0 | 2026-04-21 | Первая редакция ANALYSIS. Все вопросы архитектора закрыты, критические правки (К-1/К-2/К-3) внесены, правки по существу (П-1…П-5) зафиксированы, мелкие (M-1…M-4) приняты. Готов к ROADMAP. |
