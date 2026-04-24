# ROADMAP ТЗ-XAI-COL-1: Библиотека через xAI Collections API

**Статус:** 📋 Черновик, ждёт ревью владельца перед стартом A1.
**Дата:** 2026-04-21
**SSOT решений:** [ANALYSIS.md](ANALYSIS.md)
**Архитектура:** [SIMPLY_LIBRARY_ARCHITECTURE.md](SIMPLY_LIBRARY_ARCHITECTURE.md) v1.0

> **Правила (из WORKFLOW + CLAUDE.md):**
> - После КАЖДОЙ задачи — `npx tsc --noEmit` = 0 ошибок → `[x]`
> - После КАЖДОГО этапа — `npm run build` + ⚠ предупредить владельца (автоматически накатывает миграции) → мануальный тест → дождаться OK → следующий этап
> - Правило 7: **ОДИН коммит на ТЗ** в финализации B1. Поэтапно валидируем, НЕ коммитим.
> - Правило 1: Official docs FIRST — перед A2 WebSearch + WebFetch docs.x.ai/developers/files/collections/api

---

## Предпосылки

Перед стартом A1 владелец:
- [ ] Создал `XAI_MANAGEMENT_API_KEY` в xAI Console (permission `AddFileToCollection`), положил в `.env.local` и Vercel env
- [ ] Апрувил этот ROADMAP

Перед стартом A5:
- [ ] `SIMPLY_LIBRARY_PRODUCT_DESIGN.md` + 2 HTML-макета лежат в `specs/Simply_xAI/TZ_xai_col_1/`

---

## A1 — БД + env + taskId

**Цель:** Схема БД готова, новый Management API key подключён, taskId `library:auto-analyze` зарегистрирован.

**Задачи:**
- [ ] Обновить `.env.local` и `.env.example` — добавить `XAI_MANAGEMENT_API_KEY`
- [ ] Проверить: есть ли CHECK constraint на `chat.chatMode` в БД (если да — в миграцию 0059 добавить `library-document`; если нет — пропустить)
- [ ] `lib/db/schema.ts` — добавить 3 pgTable: `library_collection`, `library_document`, `library_collection_document` (поля по §3 архитектуры)
- [ ] Миграция `0059_library-collection.sql` — таблица коллекций + индекс `(userId, sortOrder)`
- [ ] Миграция `0060_library-document.sql` — таблица документов + индексы `(userId, createdAt DESC)` и `(userId, autoType)`
- [ ] Миграция `0061_library-collection-document.sql` — M:N таблица, PK `(collectionId, documentId)` + 2 индекса
- [ ] `lib/ai/task-assignments.ts` — новый taskId `library:auto-analyze` → `grok-4-1-fast-non-reasoning` + запись в `TASK_DESCRIPTIONS`
- [ ] `lib/ai/model-catalog.ts` — не трогаем (Grok 4.1 Fast уже в каталоге)

**Валидация:**
- [ ] `npx tsc --noEmit` = 0
- [ ] `npm run build` ⚠ предупредить владельца (автоматом накатывает миграции) → запуск → таблицы видны в Neon / Drizzle Studio
- [ ] Мануальный тест: dev server поднимается, schema-drift нет
- [ ] Подтверждение владельца → следующий этап

---

## A2 — xAI Collections client

**Цель:** Тонкий wrapper над xAI Management API, end-to-end smoke test работает.

**Задачи:**
- [ ] WebSearch + WebFetch docs.x.ai/developers/files/collections/api (Правило 1) — актуальная спецификация
- [ ] `lib/ai/library/types.ts` — TypeScript типы для xAI responses (Collection, File, Document, SearchResult, Citation)
- [ ] `lib/ai/library/xai-collections.ts` — wrapper:
  - `createCollection(name)`, `listCollections()`, `deleteCollection(id)`, `renameCollection(id, name)`
  - `uploadFile(buffer, filename, mimeType)`, `attachFileToCollection(fileId, collectionId)`, `detachFileFromCollection(...)`, `deleteFile(fileId)`
  - `getDocumentStatus(fileId)` — polling статуса processing
  - `searchDocuments({ query, collectionIds?, fileIds?, maxNumResults })` — hybrid retrieval
- [ ] `lib/ai/library/citations-parser.ts` — парсер `collections://` citations для UI плашки
- [ ] Dev-скрипт `scripts/test-library-e2e.ts` (не коммитим — временный): create collection → upload PDF → poll status → search → delete

**Валидация:**
- [ ] `npx tsc --noEmit` = 0
- [ ] Ручной запуск скрипта: весь flow работает, xAI возвращает осмысленные результаты
- [ ] Citations парсятся корректно на примере реального ответа
- [ ] Подтверждение владельца → следующий этап

---

## A3a — API: Collections CRUD (5 endpoints)

**Цель:** Коллекции управляются через REST API.

**Задачи:**
- [ ] `app/(chat)/api/library/collections/route.ts` — `GET` (список) + `POST` (создать)
- [ ] `app/(chat)/api/library/collections/[id]/route.ts` — `PATCH` (переименовать, emoji) + `DELETE`
- [ ] `app/(chat)/api/library/collections/reorder/route.ts` — `POST` (batch обновление `sortOrder`)
- [ ] Паттерн (по аудиту Блок 5): auth → ownership check → DB + xAI → Response.json
- [ ] DELETE — документы в только этой коллекции переходят в «без коллекции», не удаляются (требование §4.1)

**Валидация:**
- [ ] `npx tsc --noEmit` = 0
- [ ] `npm run build`
- [ ] Мануальный curl/Postman: create → rename → reorder → delete. Ownership проверка отклоняет запросы другого userId
- [ ] Подтверждение владельца → следующий этап

---

## A3b — API: Documents + upload (5 endpoints)

**Цель:** Документы загружаются, индексируются, возвращаются со статусами.

**Задачи:**
- [ ] `app/(chat)/api/library/documents/route.ts` — `GET` (с фильтрацией collectionId/autoType/tag/search/limit/offset) + `POST` (multipart upload)
- [ ] `app/(chat)/api/library/documents/[id]/route.ts` — `GET` details + `PATCH` (rename, add/remove collections) + `DELETE` (каскад xAI + БД)
- [ ] POST upload flow (по П-1):
  1. Auth + ownership + validate (≤100 MB, supported MIME)
  2. Локальное извлечение текста (переиспользовать utilities из `/api/files/upload`; если логика дублируется — вынести в `lib/text-extraction/` прямо здесь)
  3. Grok 4.1 Fast auto-analyze через `generateObject` с Zod enum для `autoType` (К-3)
  4. INSERT library_document (status='processing', autoType, autoTags, autoDescription)
  5. xAI upload + attach to collections
  6. UPDATE xaiFileId
  7. Return `{ id, status: 'processing' }` — клиент сам polling'ит
- [ ] НЕ heuristic scan detection (M-2) — raw file в xAI as-is

**Валидация:**
- [ ] `npx tsc --noEmit` = 0
- [ ] `npm run build`
- [ ] Мануальный upload PDF (текстовый) → видно `status='processing'`, autoType/autoTags/autoDescription заполнены → через время xAI делает processed → status меняется на 'ready' (через A3c endpoint)
- [ ] Upload сканированного PDF → OCR на стороне xAI → в результате search находит текст из скана
- [ ] DELETE — удаляется везде (xAI + наши обе таблицы + M:N связи)
- [ ] Подтверждение владельца → следующий этап

---

## A3c — API: Search + status polling (2 endpoints)

**Цель:** Прямой поиск на странице Библиотеки + client polling статуса.

**Задачи:**
- [ ] `app/(chat)/api/library/search/route.ts` — `POST` с body `{ query, collectionIds? }` → вызов `xai-collections.searchDocuments` (hybrid mode) → нормализация в формат для UI
- [ ] `app/(chat)/api/library/documents/[id]/status/route.ts` — `GET`: запрашивает xAI status, обновляет нашу БД если изменился, возвращает `{ status, statusError? }`
- [ ] Аудит userId на обоих endpoints (документ/коллекции должны принадлежать текущему юзеру)

**Валидация:**
- [ ] `npx tsc --noEmit` = 0
- [ ] `npm run build`
- [ ] Мануальный search на живой коллекции → осмысленные chunks + citations
- [ ] Polling в цикле → status переходит processing → ready
- [ ] Подтверждение владельца → следующий этап

---

## A4 — Tool `library_search` + подключение к chat

**Цель:** Модель вызывает Библиотеку из чата во всех 4 chat modes.

**Задачи:**
- [ ] `lib/ai/tools/library-search.ts` — AI SDK tool (паттерн `web-search.ts`):
  - inputSchema: `{ query: string, collectionIds?: string[], fileIds?: string[] }` (fileIds добавляем для split-view hardcoded фильтра)
  - execute: userId scope → `xai-collections.searchDocuments` → `{ chunks, citations }`
  - description промпта — базовая формулировка, точная — отдельная работа Prompt Engineering проекта (§6.1)
  - `wrapToolExecution` с timeout 15s + logging
- [ ] `lib/ai/tools/chat-tools.ts` — `getStandardTools()` добавить `librarySearchTool` во все 4 chat modes
- [ ] `getActiveToolNames()` — `library_search` в allowlist для всех 4 chat modes
- [ ] Project task chat route ([projects/[id]/tasks/[taskId]/chat/route.ts](../../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts)) — добавить tool (П-3)
- [ ] Service chats (ben, project-creation, project-manager, briefing-onboarding) — НЕ подключать (§12, M-1)
- [ ] Briefing pipeline — НЕ подключать (M-1)

**Валидация:**
- [ ] `npx tsc --noEmit` = 0
- [ ] `npm run build`
- [ ] Мануальный тест в Simply Chat: «найди в моей Библиотеке про Х» → Grok вызывает tool → ответ содержит citations
- [ ] Мануальный тест в Экспертизе: модель активно использует Библиотеку
- [ ] Логи `[Library] search: query=... collection_ids=...` видны в dev console
- [ ] Подтверждение владельца → следующий этап

---

## A5 — UI: страница `/library` + карточка на главной

**Цель:** Визуальный вход в Библиотеку.

**Блокер:** ждём от владельца `SIMPLY_LIBRARY_PRODUCT_DESIGN.md` + 2 HTML-макета.

**Задачи:**
- [ ] Прочитать [docs/design-system.md](../../../docs/design-system.md) — ЗАКОН для UI
- [ ] Прочитать `SIMPLY_LIBRARY_PRODUCT_DESIGN.md` и оба HTML-макета (референс компоновки, не стилей)
- [ ] Route group `app/(dashboard)/library/page.tsx` + layout
- [ ] Компоненты `components/library/` (semantic tokens, shadcn/ui примитивы):
  - `CollectionList` — drag-and-drop (см. существующие реализации в проекте: `components/projects/`)
  - `DocumentCard` — имя, autoType, autoTags, status indicator (🟡/🟢/🔴)
  - `FilterChips` — пилюли автотипов
  - `SearchBar` — строка поиска, hooks на `/api/library/search`
  - `UploadDropzone` — drag-and-drop + кнопка `+ Загрузить`
  - `TagCloud` — облако тегов
  - `RecentSection` — последние N документов
  - `EmptyState` — иллюстрация + CTA (паттерн из `components/projects/`)
- [ ] Polling hook `useDocumentStatus(ids)` — react-query или `useEffect` с `setInterval(3000)`, stops при `ready`/`error`
- [ ] `components/glavnaya/` — карточка «Библиотека» в паре с «Мой контекст» (по HTML-референсу + design-system токены)
- [ ] Навигация: добавить ссылку на `/library` в основное меню (если паттерн проекта так делает)

**Валидация:**
- [ ] `npx tsc --noEmit` = 0
- [ ] `npm run build`
- [ ] Мануально пройти все 8 сценариев из продуктового документа
- [ ] Страница работает в browser, drag-and-drop, upload, поиск
- [ ] Карточка на главной визуально в паре с «Мой контекст»
- [ ] Подтверждение владельца → следующий этап

---

## A6 — Split-view + модалка источников + плашка + «Сохранить в Библиотеку»

**Цель:** Завершающий слой UX — клик на документ, выбор источников в Экспертизе/Создании, визуализация citations.

**Задачи:**
- [ ] Split-view компонент `components/library/DocumentSplitView.tsx`:
  - **Продуктовая суть (ANALYSIS П-2):** изоляция на один документ. Ничего не подмешивается — ни MIND, ни другие коллекции, ни интернет. «Нет в учебнике» = правильный ответ.
  - Левая панель: `react-pdf` preview (Q1)
  - Правая: мини-чат + быстрые кнопки (summary, list key points, find…)
  - Создание временного chat записи с новым `chatMode='library-document'`
  - MIND НЕ подключается (П-2) — пропуск gates в chat route
  - Tools: **только `library_search` с hardcoded `fileIds: [doc.xaiFileId]`**. НЕ библиотека, НЕ коллекция, НЕ web_search / deep_research / fetch_url / x_search / create_document / read_project_file (П-2)
  - Route `app/(dashboard)/library/[docId]/page.tsx`
- [ ] `lib/ai/chat-mode-config.ts` — новый chatMode `library-document`
- [ ] `app/(chat)/api/chat/route.ts` — пропуск MIND (`isMemoryEnabled` gate) + минимальный tool set для этого mode
- [ ] Модалка `SourcePickerModal` — стартовый экран Экспертизы / Создания:
  - Выбор до 5 документов ИЛИ до 3 коллекций
  - Передача в чат через URL params или initial state
  - Hooks на `/api/library/collections` и `/api/library/documents`
- [ ] Плашка `LibrarySourcesBadge` в сообщениях ассистента (свёрнутая, вариант C):
  - Парсит `collections://` citations через `lib/ai/library/citations-parser.ts`
  - Рендерит `Из Библиотеки · N источников ↓` с раскрытием списка
- [~] **SCOPE-CUT (2026-04-24, владелец):** Кнопка «Сохранить в Библиотеку» у вложений чата — отменена. Дублирует существующий путь `Библиотека → Загрузить`, создаёт скрытый «шестой маршрут» поверх 4 явных (чат+вложение / Библиотека+Upload / Библиотека+split-view / Экспертиза+вложение). Для аудитории 40+ — лишний когнитивный налог. Решение в духе Apple-подхода (CLAUDE.md): качество важнее количества.

**Валидация:**
- [ ] `npx tsc --noEmit` = 0
- [ ] `npm run build`
- [ ] Клик на документ → split-view, мини-чат отвечает по одному документу, MIND не примешивается
- [ ] Экспертиза с выбранными источниками → Grok вызывает tool только в их рамках
- [ ] Плашка раскрывается, citations кликабельные
- [ ] «Сохранить в Библиотеку» → документ появляется в `/library`
- [ ] Подтверждение владельца → финализация

---

## B1 — Финализация

**Цель:** Один коммит, документация обновлена, ТЗ закрыт.

**Задачи:**
- [ ] Обновить [SIMPLY_LIBRARY_ARCHITECTURE.md](SIMPLY_LIBRARY_ARCHITECTURE.md) — комплексный патч v1.1 с учётом всех правок ANALYSIS (нумерация миграций, upload flow, autoType, M-1)
- [ ] Обновить [SIMPLY_ATTACHMENT_ARCHITECTURE.md](../SIMPLY_ATTACHMENT_ARCHITECTURE.md) — убрать устаревшее «единый `knowledge_search`»
- [ ] Обновить [docs/ai-chats-map.md](../../../docs/ai-chats-map.md) — новый taskId `library:auto-analyze`
- [ ] Обновить [docs/architecture.md](../../../docs/architecture.md) — новая route group `/api/library/`, новая папка `lib/ai/library/`, 3 новые таблицы в Data Layer
- [ ] Обновить [SIMPLY_STATUS.md](../../../SIMPLY_STATUS.md) — строка «Библиотека — Collections» поменять с 📋 на ✅ + модели/стек
- [ ] Обновить [SIMPLY_XAI_ROADMAP.md](../SIMPLY_XAI_ROADMAP.md) — пометить ТЗ-XAI-COL-1 как ✅ Завершён, следующий = ТЗ-XAI-MA-1
- [ ] ADR-056 `collections-as-ssot-for-library.md` в [docs/decisions/](../../../docs/decisions/) — зафиксировать решение 1 (Collections как единственное хранилище)
- [ ] Обновить `CHANGELOG.md` — запись v3.99.0 с summary изменений
- [ ] Обновить `package.json` — version `3.99.0`
- [ ] SQL-проверка БД через `mcp__postgres__query`: 3 таблицы созданы, индексы работают, sanity data consistency
- [ ] Владелец прогоняет полный e2e (create коллекция → upload → search в чате → split-view → удаление)
- [ ] Финализация FINDINGS.md (если накопится) → перенос в `specs/_backlog/`
- [~] **SCOPE-CUT (2026-04-24, B1):** Архивирование в `_archive/` отменено — серия Simply_xAI не использует архивную папку (TZ_xai_1/2/3 лежат рядом). Папка `TZ_xai_col_1/` остаётся на месте, согласовано с паттерном серии.
- [ ] **ОДИН коммит** (Правило 7): `feat(tz-xai-col-1): Библиотека через xAI Collections — v3.99.0`

**Валидация:**
- [ ] `npm run build` → 0 ошибок
- [ ] Все ссылки в докмуентах живые
- [ ] Владелец подтвердил e2e
- [ ] Запись в журнал закрытых долгов [specs/_archive/BACKLOG_CLOSED.md](../../../specs/_archive/BACKLOG_CLOSED.md) — не нужна (это ТЗ, не backlog)

---

## Сводная таблица этапов

| # | Этап | Сессий | Блокеры |
|---|------|--------|---------|
| A1 | БД + env + taskId | 0.5 | XAI_MANAGEMENT_API_KEY от владельца |
| A2 | xAI Collections client | 1 | — |
| A3a | API: Collections CRUD | 0.5 | — |
| A3b | API: Documents + upload | 1 | — |
| A3c | API: Search + status | 0.5 | — |
| A4 | Tool + chat integration | 0.5 | — |
| A5 | UI: page + card | 1.5 | `SIMPLY_LIBRARY_PRODUCT_DESIGN.md` + 2 HTML-макета от владельца |
| A6 | Split-view + модалка + плашка + save-to-library | 1.5 | — |
| B1 | Финализация + коммит | 0.5 | — |
| **Итого** | | **~7.5 сессий** | |

---

## Правила на протяжении всего ТЗ

- Каждая задача внутри этапа: `npx tsc --noEmit` = 0 → `[x]`
- Каждый этап: `npm run build` ⚠ предупреждение владельцу → мануальный тест → OK владельца → следующий
- Новые находки / хвосты → `FINDINGS.md` в этой папке (правило 8 WORKFLOW)
- Комментарии в коде — только если скрытое ограничение не видно из кода (правило 8 CLAUDE.md)
- Ответы владельцу ≤ 10 строк (правило 9 CLAUDE.md), кроме явных запросов на подробный анализ
- ОДИН коммит на ТЗ в B1 (правило 7)

---

## Changelog

| Версия | Дата | Изменение |
|---|---|---|
| 1.0 | 2026-04-21 | Черновик после утверждения ANALYSIS. 9 этапов, оценка ~7.5 сессий. Ждёт ревью владельца. |
| 1.1 | 2026-04-23 | Сессия 4: закрыт блокер DOCX/XLSX/PPTX/PDF. Корневая причина и альтернативы — [ADR 056](../../../docs/decisions/056-library-upload-collections-endpoint.md), [FINDINGS F4](FINDINGS.md). Upload-путь Library переехал с `/v1/files` + attach на прямой `management-api/v1/collections/{id}/documents` endpoint с `content_type` как полем формы. Все 4 формата прошли e2e-тест через UI. Остались этапы A6 + B1. |
| 1.2 | 2026-04-24 | Сессия 5: закрыт A6.1 — split-view `/library/[docId]` (страница + компонент `DocumentSplitView`), overview-card с `autoDescription`+теги+кнопки preview/download, изолированный мини-чат (новый chatMode `library-document`, только `librarySearch` с `lockedFileId`, MIND off). Добавлен `autoSummary` — развёрнутый обзор ≤2500 знаков после indexing через `librarySearch`+`generateObject`, покрывает документ любой длины. Два новых taskId в SSOT: `library-document-chat` (мини-чат), `library:generate-summary` (генератор обзора) — Grok 4.1 Fast non-reasoning, A/B через `/dev/models` подтверждён. Миграция 0063 (поле `autoSummary`). Race condition UI status fixed — summary-generator сам обновляет `status='ready'` при обнаружении xAI PROCESSED. Остались A6.2 (модалка+плашка), A6.3 (save-to-library), B1. |
| 1.3 | 2026-04-24 | Сессия 6: закрыт A6.2 — `SourcePickerModal` (выбор до 3 коллекций / 5 документов в Экспертизе/Создании), `LibrarySourcesBadge` с парсингом `collections://` citations (плашка «Из Библиотеки · N источников ↓» с кликом на split-view), `librarySearch` принимает `scopedSourceIds` и жёстко замыкается на выбранные источники, библиотечный context-блок переключается на «Выбранные источники» с инструкцией модели не выходить за scope. Добавлен polling `autoSummary` в split-view (SWR с авто-stop) — устраняет требование F5 после upload. Фикс кэша Grok в Экспертизе/Создании: MIND-блок раньше для не-Anthropic-протокола инжектился как trailing system message, что обрывало xAI prompt-cache на первой точке расхождения после первого user-сообщения; теперь MIND для всех провайдеров инжектится как trailing text-part в последнее user-сообщение (для Anthropic дополнительно ставится cacheControl). Подтверждён владельцем — кэш растёт вместе с историей. **A6.3 отменён** как scope-cut: дублирует `Библиотека → Загрузить`, создаёт скрытый «шестой маршрут» поверх 4 явных. Остался B1. |
