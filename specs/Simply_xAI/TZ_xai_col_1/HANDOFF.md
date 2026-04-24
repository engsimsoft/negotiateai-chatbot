# Передача сессии ТЗ-XAI-COL-1

**Последнее обновление:** 2026-04-24 (сессия 5, завершена)
**Передача:** ПОСЛЕ закрытия A6.1 (split-view + overview-card + auto-summary + library-document-chat taskId). Осталось: **A6.2** (модалка источников + плашка citations в Экспертизе/Создании), **A6.3** (кнопка «Сохранить в Библиотеку» у вложений чата), **B1** (финализация + один коммит v3.99.0).

---

## Что закрылось в сессии 5 (2026-04-24)

**A6.1 — Split-view страницы Библиотеки полностью закрыт.** Три подэтапа:

### A6.1a — базовый split-view
Страница `/library/[docId]` ([app/(dashboard)/library/[docId]/page.tsx](../../../app/%28dashboard%29/library/%5BdocId%5D/page.tsx)) + компонент [components/library/document-split-view.tsx](../../../components/library/document-split-view.tsx). Слева — preview документа, справа — изолированный мини-чат. Навигация: клик по ready-документу в [library-page.tsx](../../../components/library/library-page.tsx) → `router.push("/library/${doc.id}")`.

### A6.1b — левая панель как «карточка-обзор»
Изначально iframe с полным текстом (проблематично для 300-страничной книги). Переделано на overview-card: иконка+имя+метаданные, `autoDescription`, теги, кнопки «Открыть полный текст» (только для browser-previewable форматов: PDF/text/image) + «Скачать». Для DOCX/XLSX/PPTX — только «Скачать» (браузер бинарные Office не рендерит).

Proxy-endpoint для preview файла: [app/(chat)/api/library/documents/[id]/content/route.ts](../../../app/%28chat%29/api/library/documents/%5Bid%5D/content/route.ts) стримит байты из xAI `GET /v1/files/{id}/content`. Нюанс: xAI всегда возвращает `content-type: application/octet-stream` — берём правильный тип из `doc.mimeType` нашей БД. Для `text/*` форсим `text/plain; charset=utf-8` (иначе Chrome пытается скачать markdown).

### A6.1c — развёрнутый `autoSummary` для левой панели
Миграция [0063_library-document-auto-summary.sql](../../../lib/db/migrations/0063_library-document-auto-summary.sql) — поле `autoSummary text` в `library_document`. Генератор [lib/ai/library/summary-generator.ts](../../../lib/ai/library/summary-generator.ts): polling `getDocumentMetadata` до `DOCUMENT_STATUS_PROCESSED` (20 попыток × 30 сек = 10 мин окно для больших PDF), затем 3 запроса `librarySearch` (тема / структура / выводы) + объединение chunks + `generateObject` через новый taskId `library:generate-summary` → `autoSummary` ≤2500 символов. Fire-and-forget через `after()` в POST upload handler.

**Почему полный обзор ≠ auto-analyze:** `auto-analyze` работает до upload на первых 4000 символов локально извлечённого текста (Zod ≤200 знаков, «подпись для карточки в списке»). `autoSummary` работает **после** indexing на всех chunks xAI — охватывает весь документ любой длины, хоть 425 страниц. Оба живут рядом в БД, split-view предпочитает `autoSummary`, fallback на `autoDescription`.

**Race condition фикс:** если xAI indexing занимает >N секунд, UI search-probe polling может прекратиться, оставив `status='processing'` навсегда. Summary-generator при обнаружении `PROCESSED` у xAI сразу проставляет `status='ready'` в БД — защита от стагнации виджета «обработка».

### A6.1d — отдельный taskId для мини-чата документа
Раньше `getTaskIdForChatMode("library-document")` возвращал `simply-chat` (заимствовал модель у Simply). Теперь отдельный **`library-document-chat`** → Grok 4.1 Fast non-reasoning. Изменение модели Simply не затрагивает Library. Подтверждено e2e: первый запрос — дефолт Grok, после override в `/dev/models` — MiniMax-M2.7. SSOT-маршрут через три Record'а в [task-assignments.ts](../../../lib/ai/task-assignments.ts) работает корректно.

### Новые taskId в SSOT
Два новых в [task-assignments.ts](../../../lib/ai/task-assignments.ts) (DEFAULT_TASK_MODELS + DEFAULT_MAX_OUTPUT_TOKENS + TASK_DESCRIPTIONS):
- **`library-document-chat`** → `grok-4-1-fast-non-reasoning`, cap 4096 — изолированный мини-чат split-view, tool set = только `librarySearch` с `lockedFileId`, MIND off, без user-context в промпте.
- **`library:generate-summary`** → `grok-4-1-fast-non-reasoning`, cap 2048 — генератор autoSummary после indexing.

Оба в `/dev/models` видны, A/B override работает.

### Правки за сессию 5 (всё в working tree, не коммичено)
- [lib/db/schema.ts](../../../lib/db/schema.ts) — `autoSummary` колонка.
- [lib/db/migrations/0063_library-document-auto-summary.sql](../../../lib/db/migrations/0063_library-document-auto-summary.sql) + journal entry.
- [lib/ai/task-assignments.ts](../../../lib/ai/task-assignments.ts) — два новых taskId в трёх SSOT-Record'ах.
- [lib/ai/chat-mode-config.ts](../../../lib/ai/chat-mode-config.ts) — новый chatMode `library-document` + taskId-mapping + `displayName`.
- [lib/ai/routing.ts](../../../lib/ai/routing.ts) — работает автоматически (`getTaskIdForChatMode` покрыт).
- [lib/ai/tools/chat-tools.ts](../../../lib/ai/tools/chat-tools.ts) — `getStandardTools` принимает `lockedFileId`; `getActiveToolNames` для library-document возвращает только `["librarySearch"]`.
- [lib/ai/tools/library-search.ts](../../../lib/ai/tools/library-search.ts) — в ветке `lockedFileId` добавлен fallback-резолв `xaiCollectionIds` через `getDocumentCollectionIds` (xAI требует `collection_ids` непустым даже когда задан `file_ids`).
- [lib/ai/library/xai-collections.ts](../../../lib/ai/library/xai-collections.ts) — новая `getFileContent(fileId)` для proxy-роута.
- [lib/ai/library/summary-generator.ts](../../../lib/ai/library/summary-generator.ts) — новый файл.
- [lib/ai/library/types.ts](../../../lib/ai/library/types.ts) — `XaiDocumentMetadata` расширен `chunk_count`/`chunks_processed_count`.
- [lib/ai/library/db.ts](../../../lib/ai/library/db.ts) — `updateLibraryDocumentPatch` принимает `autoSummary`.
- [lib/prompts/builder/composer.ts](../../../lib/prompts/builder/composer.ts) + [index.ts](../../../lib/prompts/builder/index.ts) + [server.ts](../../../lib/prompts/server.ts) — `composeLibraryDocumentPrompt` + `buildLibraryDocumentPrompt`, изолированный промпт («отвечай только по документу, не дополняй из общих знаний»).
- [app/(chat)/api/chat/route.ts](../../../app/%28chat%29/api/chat/route.ts) — деструктурирует `lockedDocumentId`, загружает документ + ownership check, case `library-document` в switch, передаёт `lockedFileId` в `getStandardTools`, `compactionSourceType` для library-document мапится на `"simply"` (compaction модуль не знает про новый chatMode, мапим чтобы TS не падал — MIND всё равно off).
- [app/(chat)/api/chat/schema.ts](../../../app/%28chat%29/api/chat/schema.ts) — поле `lockedDocumentId`.
- [app/(chat)/api/library/documents/route.ts](../../../app/%28chat%29/api/library/documents/route.ts) — `after(() => generateAndSaveSummary(...))`, fire-and-forget.
- [app/(chat)/api/library/documents/[id]/route.ts](../../../app/%28chat%29/api/library/documents/%5Bid%5D/route.ts) — возвращает `autoSummary`.
- [app/(chat)/api/library/documents/[id]/content/route.ts](../../../app/%28chat%29/api/library/documents/%5Bid%5D/content/route.ts) — новый proxy-роут.
- [app/(dashboard)/library/[docId]/page.tsx](../../../app/%28dashboard%29/library/%5BdocId%5D/page.tsx) — новая страница split-view.
- [components/library/document-split-view.tsx](../../../components/library/document-split-view.tsx) — новый компонент overview-card + мини-чат.
- [components/library/library-page.tsx](../../../components/library/library-page.tsx) — `onOpen` handler → navigate в split-view.
- [docs/ai-chats-map.md](../../../docs/ai-chats-map.md) — добавлены 2 строки (library-document-chat + library:generate-summary), `library:auto-analyze` переведён из «в разработке» в ✅ «работает».

### E2E подтверждения сессии 5
- DOCX (договор) + MD (LSU) + PDF (engineering_fundamentals 425 стр) — split-view открывается, чат отвечает строго по документу, citations корректны.
- `autoSummary` для 425-страничного PDF сгенерирован за ~90 секунд после upload, 1676 символов, структурный обзор на 3 абзаца.
- `/dev/models` override: default `grok-4-1-fast-non-reasoning` → MiniMax-M2.7 — подтверждено по `[Chat API] Model selection:` логу.
- HMR/server-side restart паттерн использован минимум 3 раза без деградации.

### Параллельные правки в конце сессии (внешние, уже в working tree)

Отмечены автоуведомлением линтера/другого агента, tsc 0 ошибок:

- **Backend scope для A6.2 частично готов.** [schema.ts](../../../app/%28chat%29/api/chat/schema.ts) принимает `librarySources: { collectionIds?: string[3], documentIds?: string[5] }`. [chat-tools.ts](../../../lib/ai/tools/chat-tools.ts) пробрасывает в `librarySearch` как `scopedSourceIds`. [library-search.ts](../../../lib/ai/tools/library-search.ts) имеет третью ветку: при заданном `scopedSourceIds` игнорирует `collectionIds`/`fileIds` модели, резолвит owner-scoped xAI-идентификаторы. Также library-search теперь строит `xaiToDocumentId` map (xaiFileId → наш UUID) — пригодится UI-плашке citations чтобы открывать `/library/{docId}`. [composer.ts](../../../lib/prompts/builder/composer.ts) передаёт `context.librarySourcesScope` в `buildLibraryContext`. **Что осталось для A6.2:** UI-компонент `SourcePickerModal` (Dialog shadcn/ui, выбор до 5 docs / 3 коллекций), wiring в Экспертизу/Создание, компонент `LibrarySourcesBadge` в сообщениях ассистента.
- **SWR-polling автосаммари в split-view.** [document-split-view.tsx](../../../components/library/document-split-view.tsx) на клиенте теперь polling'ит `/api/library/documents/{id}` каждые 5 сек пока `autoSummary === null`, останавливается как только появится. Решает кейс «юзер открыл split-view сразу после upload, обзор ещё не готов» — больше не нужен ручной Cmd+R.

### Известные ограничения (приняты как есть)
- PDF с CID-шрифтами без ToUnicode маппинга — в браузерном viewer показывают «кракозябры» (не-Unicode глифы). Пример: `engineering_fundamentals_of_the_internal_combustion_engine.pdf`. Решение — для таких скачивать и открывать в Preview.app / Adobe Reader. Мини-чат и `librarySearch` работают корректно (xAI извлекает текст независимо от шрифтов). Fallback «Читать как текст» через серверный `extractPdfText` отклонён владельцем: «оставляем как есть».
- Legacy-документы (загруженные до A6.1c) имеют `autoSummary=null` и показывают `autoDescription` с пометкой «готовится обзор…». Backfill-скрипт не написан — если понадобится, можно добавить в B1.

---

## Что закрылось в сессии 4 (2026-04-23)

---

## Что закрылось в сессии 4 (2026-04-23)

**Блокер A5.13 закрыт.** Корневая причина — `/v1/files` сниффит MIME по байтам и перезаписывает client-supplied `Content-Type` в `application/octet-stream`, после чего Collections-indexer отказывается запускать Office-конвертер. Решение — использовать отдельный endpoint `POST management-api.x.ai/v1/collections/{id}/documents` с `content_type` как полем формы (не multipart-заголовком).

Протокол диагностики (важно для будущих подобных проблем):
1. Прямой curl с `-F "file=@...;type=<mime>"` на `/v1/files` → получили тот же `octet-stream`. Это **опровергло** гипотезу «Node.js undici FormData теряет Blob.type» (теория архитектора) и доказало, что проблема на стороне xAI, а не клиента.
2. WebFetch 5 страниц docs.x.ai — на `/developers/files/collections` в разделе «Supported MIME Types» явно перечислены DOCX/XLSX/PPTX/PDF + упомянут **отдельный endpoint** для прямого upload в коллекцию с полем `content_type`.
3. curl на новый endpoint → DOCX (1.6 MB) получил `status=PROCESSED`, `content_type=...wordprocessingml.document`, `chunk_count=2`.

**Подробности и «что не делать в будущем»:** [ADR 056](../../../docs/decisions/056-library-upload-collections-endpoint.md). Урок в [FINDINGS.md F4](FINDINGS.md).

---

## Финальный e2e тест 4 форматов (2026-04-22 вечер)

Все через UI `/library` на production-коде (фикс в [xai-collections.ts](../../../lib/ai/library/xai-collections.ts) + [documents/route.ts](../../../app/(chat)/api/library/documents/route.ts)):

| Формат | Файл | Размер | status | content_type | chunks | Semantic top-score |
|---|---|---|---|---|---|---|
| DOCX | TMS_Академия_Концепт_v2.docx | 18 KB | PROCESSED ✅ | …wordprocessingml.document | 7/7 | 0.604 |
| XLSX | pressure_compression.xlsx | 31 KB | PROCESSED ✅ | …spreadsheetml.sheet | 5/5 | — |
| PPTX | Simply_для_Григория.pptx | 285 KB | PROCESSED ✅ | …presentationml.presentation | 6/6 | — |
| PDF | M84 User Manual.pdf (86 стр) | 662 KB | PROCESSED ✅ | application/pdf | 32/32 | 0.509 |

PDF регрессия сессии 2 не повторилась — chunks содержат осмысленный текст ECU-мануала, не бинарный мусор.

---

## Статус этапов

- [x] Фаза 0, Фаза 1 (ANALYSIS.md), **A1–A4**, **A5.1–A5.22**, UI extras — см. ниже историю сессий 1–2.
- [x] **Library-context в системном промпте** (сессия 3).
- [x] **MIME resolver по расширению файла** (сессия 3).
- [x] **A5.13 — блокер форматов закрыт** (сессия 4). DOCX/XLSX/PPTX/PDF работают. Код: [lib/ai/library/xai-collections.ts](../../../lib/ai/library/xai-collections.ts) + [app/(chat)/api/library/documents/route.ts](../../../app/(chat)/api/library/documents/route.ts). Документация: [ADR 056](../../../docs/decisions/056-library-upload-collections-endpoint.md), [FINDINGS F4](FINDINGS.md).
- [x] **A6.1 — Split-view страница Библиотеки** (сессия 5). Overview-card + изолированный мини-чат + autoSummary + отдельный taskId. `docs/ai-chats-map.md` обновлён.
- [ ] **A6.2** — Модалка `SourcePickerModal` (выбор до 5 документов / 3 коллекций в Экспертизе/Создании) + плашка `LibrarySourcesBadge` с парсингом `collections://` citations в сообщениях ассистента.
- [ ] **A6.3** — Кнопка «Сохранить в Библиотеку» у вложений чата.
- [ ] **B1** — Финализация: обновить `docs/architecture.md`, `SIMPLY_LIBRARY_ARCHITECTURE.md` v1.1, `SIMPLY_STATUS.md`, `CHANGELOG.md`, bump `package.json` → 3.99.0, **один коммит** по Правилу 7.

---

## Первая команда следующей сессии

1. Прочитать этот HANDOFF целиком.
2. `git status` — всё должно быть в working tree, коммитов нет (напоминание Правила 7).
3. Прочитать [ROADMAP.md](ROADMAP.md) секции A6 и B1 — задачи детализированы.
4. Спросить владельца: «Продолжаем A6.2 (модалка источников + плашка citations) или сразу B1 (финализация)?»
5. Не трогать ничего без ответа.

---

## Текущие команды разработки

```bash
# Мониторинг dev-сервера
tail -f /tmp/simply-dev.log

# Clean restart при правке lib/* или route.ts (HMR ненадёжен)
rm -rf .next/cache && npm run dev

# Валидация
npx tsc --noEmit              # 0 ошибок на момент передачи

# Диагностика xAI Library состояния
npx tsx scripts/diagnose-xai-library-state.ts

# Поиск в Library (локально, без UI)
npx tsx scripts/search-library.ts "фраза"
```

---

---

## ✅ [ЗАКРЫТО в сессии 4] Блокер — xAI Collections не обрабатывает .docx

> **Ниже — история блокера на момент начала сессии 4.** Все формулировки «активный», «не делать» относятся к состоянию сессии 3 и сохранены ради контекста того, что проверялось. Закрытие — см. секцию «Что закрылось в сессии 4» в начале этого файла.

### Воспроизведение (сессия 3)

1. Владелец удалил ВСЕ документы в UI → подтверждён clean-state (БД: 0 докyментов, 0 связей, 2 коллекции пустые; xAI: `documents_count: 0`, orphan files нет).
2. Загружен 1 MD-файл → **✅ работает end-to-end** (status=PROCESSED, content_type=text/markdown, search score 0.9957, модель цитирует дословно).
3. Загружен 1 DOCX-файл (`Hot hatch without rear_seats_with_photos (1).docx`, 1.6 MB).
4. Диагностика через `scripts/diagnose-xai-library-state.ts`:
   - `status: DOCUMENT_STATUS_FAILED`
   - `error_message: "File format not supported. The file does not contain readable text."`
   - `content_type: application/octet-stream` (хотя в нашей БД `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
   - `chunk_count: 0`, `last_indexed_at: null`, `upload_status: Complete`

### Что проверено в официальных источниках (сессия 3)

- **[docs.x.ai/docs/guides/files](https://docs.x.ai/docs/guides/files)** — список поддерживаемых форматов: `.txt, .md, .py, .js, .java, .csv, .json, .pdf, And many other text-based formats`. **DOCX/XLSX/PPTX в списке нет.**
- **[docs.x.ai/developers/files/managing-files](https://docs.x.ai/developers/files/managing-files)** — та же формулировка.
- **[docs.x.ai/docs/guides/using-collections/api](https://docs.x.ai/docs/guides/using-collections/api)** и **[/files/collections/api](https://docs.x.ai/developers/files/collections/api)** — список форматов вообще не указан.
- **Python SDK** (session 2): upload_document идёт через gRPC `UploadFile` + `AddDocumentToCollection`, параметров purpose/content_type нет в API.

### Позиция владельца

Владелец **категорически против** объяснения «формат не поддерживается»: «мы 20 раз изучили официальную информацию, формат стопроцентно поддерживается». Сказал что знает как решать — будет в новой сессии. **Не писать код и не предлагать pre-extraction**.

### Что не делать (прямой запрет владельца)

- Не говорить «формат не поддерживается» без источника.
- Не предлагать локальный pre-extract DOCX→text как костыль.
- Не добавлять verbose-логи уровня «костыль» без согласования.
- Изначальный план: 3 проверки (race condition / purpose / Tesla 10-K) в начале сессии 3 был **свёрнут** — владелец выбрал per-format тест (MD → Word → Excel → PDF).

---

## Что владелец проверил сам и подтвердил

- **MD работает full end-to-end.** Пример запроса: «какая модель у нас используется для KITT в миграции xAI?» + явная фраза «найди в моей библиотеке». Ответ модели: `Grok 4.1 Fast (non-reasoning)` с дословной цитатой таблицы из `SIMPLY_XAI_ROADMAP.md`, score 0.9957. Citation `file_8047e811-…`.
- **Voyage AI 403 на финском VPN** — известная штука, MIND retrieve падает graceful. К Library/xAI RAG не относится (xAI использует `grok-embedding-small` на своей стороне). Сохранено в памяти как `project_voyage_vpn_finland.md`.
- **«Сброс памяти» в виджете** — владелец увидел падение «Контекст 28374 → 21381» после второго запроса. В логах бэкенда — `[Compaction] action=noop` для обоих запросов (total=6012 и 6116 токенов, soft-порог 100000). **Реальной компакции не было.** Виджет показывает per-request billed tokens, не backend context. Владелец принял объяснение, вопрос виджета — вне ТЗ.

---

## Что сделано в сессии 3 (ФАЙЛЫ)

### 1. Library-context в системном промпте (root-fix, не костыль)

Было: модель не знала про Library, в `<tools_usage>` simply-chat.md нет правила для `librarySearch`, в контекстах промпта не инжектился список коллекций пользователя. На финском VPN (MIND off) модель отвечала «не знаю» вместо вызова librarySearch.

Стало: новый context-block `## Библиотека пользователя` с именами коллекций и counts.

Файлы:
- [lib/ai/library/db.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/lib/ai/library/db.ts) — новая `listLibraryCollectionsSummaryByUser(userId)` (LEFT JOIN + GROUP BY, один запрос). Возвращает `{ id, name, isDefault, documentsCount }[]`.
- [lib/prompts/contexts/library.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/lib/prompts/contexts/library.ts) — **новый файл**, `buildLibraryContext(collections)` → markdown-блок. Пустые коллекции фильтруются.
- [lib/prompts/contexts/index.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/lib/prompts/contexts/index.ts) — re-export.
- [lib/prompts/types.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/lib/prompts/types.ts) — поле `library?: Array<{ name, documentsCount, isDefault? }>` в `BuildContext`.
- [lib/prompts/builder/composer.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/lib/prompts/builder/composer.ts) — `buildLibraryContext` подключён в `combineContextBlocks` после memoryContext.
- [app/(chat)/api/chat/route.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/app/(chat)/api/chat/route.ts) — pre-fetch в `Promise.all` рядом с userProfile, `.catch(() => [])` чтобы упавший запрос не ломал чат. Прокидывается в `promptContext.library`.

Верификация: скрипт `scripts/dump-simply-prompt.ts` (удалён после проверки) подтвердил что блок инжектится. Блок в собранном промпте выглядит так:
```
## Библиотека пользователя

Личный архив загруженных документов. Ищи в нём через инструмент `librarySearch`, когда вопрос касается собственных файлов пользователя, его договоров, отчётов, книг, статей, таблиц — или когда по смыслу видно, что ответ может быть в коллекции ниже.

Коллекции:
- «Мои документы» (2 док.) — коллекция по умолчанию
```

Поведенческое последствие: при явной формулировке «найди в моей библиотеке» модель корректно вызывает librarySearch и цитирует. Без явной формулировки — **не всегда**. Владелец принял решение дожать поведение позже с prompt-специалистом (в `<tools_usage>` simply-chat.md нет секции для librarySearch — это видно, но не правим без него).

### 2. MIME resolver по расширению файла

Файл: [app/(chat)/api/library/documents/route.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/app/(chat)/api/library/documents/route.ts)

Добавлены `MIME_BY_EXTENSION` и `resolveMimeType(browserMime, filename)`. Если браузер вернул пусто или `application/octet-stream` — резолвим по расширению (.docx → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, .xlsx → `...spreadsheetml.sheet`, .pptx, .pdf, .csv, .txt, .md, .jpg/png).

Применяется в `POST`-обработчике перед проверкой `isMimeSupported`. Хранится в БД и передаётся в xAI через `xaiUploadFile`.

**Но это не помогло DOCX** — в БД MIME был корректный, xAI всё равно показал `content_type: application/octet-stream` и вернул ошибку. Что-то между нашим `fetch` и xAI-side перезаписывает content_type, либо xAI сниффит сам и игнорирует client-provided.

### 3. Диагностические скрипты (НЕ удалять до конца ТЗ)

- **[scripts/diagnose-xai-library-state.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/scripts/diagnose-xai-library-state.ts)** — one-shot: listCollections + listDocuments в каждой + полный `DocumentMetadata` (status/content_type/processing_status/error_message/chunk_count/last_indexed_at) + orphan-files в /v1/files. **Это главный диагностический инструмент сессии 3** — по одной команде видно всё состояние xAI.
- **[scripts/search-library.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/scripts/search-library.ts)** — `npx tsx scripts/search-library.ts "фраза"` прогоняет search в трёх режимах (hybrid/keyword/semantic), выводит chunks со score и превью.

### 4. getDocumentMetadata wrapper + типы

- [lib/ai/library/xai-collections.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/lib/ai/library/xai-collections.ts) — новая `getDocumentMetadata(collectionId, fileId)` (GET `/v1/collections/{cid}/documents/{fid}` через management-api).
- [lib/ai/library/types.ts](/Users/mactm/Projects/NegotiateAI%20Chatbot/lib/ai/library/types.ts) — новые `XaiDocumentStatus`, `XaiFileMetadata`, `XaiDocumentMetadata`.

**Не подключено пока** к status-polling — status/route.ts всё ещё использует search-based probe. Подключение = отдельный шаг (F3 mitigation), владелец может захотеть сделать это после фикса DOCX.

---

## Текущее состояние (на момент передачи смены)

### БД (mcp__postgres__query)

```sql
-- Коллекции пользователя bed95407-4160-492e-bdfd-9cf8819878be:
-- «Мои документы» (isDefault=true) — 3 документа
-- «test 1» (isDefault=false) — 0 документов

-- Документы:
-- 1. SIMPLY_XAI_ROADMAP.md           status=ready  mime=application/octet-stream
-- 2. SIMPLY_LIBRARY_PRODUCT_DESIGN.md status=ready  mime=text/markdown
-- 3. Hot hatch... (1).docx            status=ready  mime=application/vnd...docx
```

### xAI (через diagnose script)

```
collection_51557092-... "Мои документы"  docs=3  size=1650415
 ├─ SIMPLY_XAI_ROADMAP.md              PROCESSED text/markdown  chunks=4
 ├─ SIMPLY_LIBRARY_PRODUCT_DESIGN.md   PROCESSED text/markdown  chunks=10
 └─ Hot hatch...docx                   FAILED    octet-stream   chunks=0
                                       error: "File format not supported. The file does not contain readable text."

collection_b84697e2-... "test 1"  docs=0  size=0

orphan files: нет
```

### Команды, нужные следующей смене

```bash
# Диагностика xAI состояния (SSOT)
npx tsx scripts/diagnose-xai-library-state.ts

# Поиск в Library
npx tsx scripts/search-library.ts "фраза из файла"

# Dev — clean restart (HMR не подхватывает server-side)
rm -rf .next/cache && npm run dev

# Валидация
npx tsc --noEmit      # 0 ошибок на момент передачи
```

### Logs dev-сервера (фоновый процесс)

Владелец запустил dev в фоне, лог в `/tmp/simply-dev.log`. **На момент передачи смены** — это чистая сессия после `rm -rf .next/cache && npm run dev`, из логов видно Compaction = noop, Voyage 403 (финский VPN).

---

## Критические правила (из CLAUDE.md и памяти)

1. **Официальные docs FIRST** — перед любым предположением про xAI фичи WebSearch + WebFetch актуальной доки.
2. **No band-aids** — только архитектурные решения, не заплатки.
3. **Research vs task** — если владелец говорит «разберись» — только текстовый ответ, не править код.
4. **Propose, don't ask** — одно решение + обоснование, не бинарные вопросы.
5. **≤10 строк в ответе** — кроме анализа ТЗ / код-ревью.
6. **Один коммит на ТЗ** — на момент передачи ничего не закоммичено, всё в working tree.
7. **HMR не подхватывает server-side** — `rm -rf .next/cache && npm run dev` после правок в `lib/*` и `app/.../route.ts`.
8. **Voyage залочен на финском VPN** — MIND retrieve падает graceful, к Library не относится. Фикс — US VPN.

---

## Первая команда следующей сессии

1. Прочитать этот HANDOFF полностью.
2. **Спросить владельца: «Какое у вас решение по DOCX?»** — он знает.
3. Не писать код до ответа.
4. После ответа — реализовать строго по его решению. Без «улучшений» от себя.
5. Проверить `git status` — всё должно быть в working tree, коммитов нет.
6. Если владелец попросит продолжить per-format тест — использовать `diagnose-xai-library-state.ts` + `search-library.ts` в том же протоколе, что отработал для MD:
   - (a) diagnose → status+content_type+error
   - (b) search → chunks+scores
   - (c) в UI `/simply` явный запрос «найди в моей библиотеке ...» → логи `[Library] search:` + `[Library] search result:`
   - (d) подтверждение ответа модели с цитатой.

---

## Незакрытые технические вопросы (для владельца / архитектора)

1. **Почему xAI показывает `content_type: application/octet-stream` для DOCX**, хотя в нашей БД MIME корректный. Наш `fetch` передаёт Blob с правильным type — либо FormData в Node.js не пробрасывает тип, либо xAI сниффит по магическим байтам и игнорирует client-provided. Диагностировать — прямой `curl` с `-F file=@...docx;type=application/vnd...docx`. (**Не делать без команды владельца**.)
2. **PDF в сессии 3 не перетестировали** — после фикса с MIME и Library context PDF мог начать работать иначе. При возобновлении тестов начать с того места, где закончили — Word, потом Excel, потом PDF.
3. **librarySearch в `<tools_usage>`** (simply-chat.md) — отсутствует секция «когда вызывать librarySearch». Модель без явной фразы «найди в библиотеке» не всегда вызывает tool. Владелец хочет решать с prompt-специалистом, не сейчас.
4. **Widget «Контекст»** показывает per-request billed tokens, не total backend context. Не баг, но UX-путаница — отдельный вопрос вне ТЗ.

---

## Историческая справка (сессии 1-2)

См. предыдущую версию HANDOFF в git history (был сохранён до начала сессии 3 — можно восстановить через `git log -- specs/Simply_xAI/TZ_xai_col_1/HANDOFF.md` если нужно).

Ключевые факты сессий 1-2:
- Фаза 0 + A1-A4 + A5.1-A5.22 — полный backend + UI Library, default-коллекция «Мои документы», CollectionGrid, все CRUD.
- A5.13 PDF — исходный блокер сессии 2: PDF загружался с `purpose=assistants`, индексировался, но search возвращал **бинарные чанки** (шрифты, байтовые потоки), score <0.02. Архитектор отклонил гипотезу «REST API не умеет PDF extraction» (противоречит Tesla 10-K примеру в xAI docs). Три проверки предложены сессии 3: race condition / purpose / Tesla 10-K control test — свёрнуты в per-format протокол по команде владельца.
- Voyage VPN finland, Simply persistent chat, think=strong-model, Anthropic thinking tokens, mode terminology — см. memory (`~/.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/`).
