# Находки Phase 0 Audit — Simply_Migration · Шаг 4 · Files API Migration

> Список нерешённых архитектурных вопросов и потенциальных блокеров, обнаруженных во время read-only audit.
> Все требуют **решения архитектора** в SPEC до начала Phase 1+.

---

## 🚨 Finding #1: @ai-sdk/xai 3.0.83 не поддерживает file parts в payload

**Где:** `node_modules/@ai-sdk/xai/dist/index.mjs:54-67` (Chat Completions path), `index.mjs:1075-1085` (Responses path).

**Что:** SDK throw'ит `UnsupportedFunctionalityError` для любого `file` part с `mediaType !== "image/*"`. PDF/DOC/любой бинарь физически не пропускается. `convertToXaiChatMessages` и `convertToXaiResponsesInput` идентично ограничены — обе функции оборудованы только под `image_url`.

`xaiTools.fileSearch` в SDK существует ([index.d.ts:275-294](file://node_modules/@ai-sdk/xai/dist/index.d.ts#L275)), но требует `vectorStoreIds` (другой xAI surface — `/v1/vector_stores`), не интегрируется с нашими Collections и работает только через Responses API.

**Почему проблема:** концепт Шага 4 предполагает path «upload → file_id → передача в messages как `input_file` content type». Через стандартный `streamText({ model: xai("..."), messages })` в текущем SDK это сделать невозможно.

**Вопросы архитектору:**
1. Проверить через WebSearch актуальную версию `@ai-sdk/xai` (>3.0.83) — добавлен ли `input_file` content type? Если да — путь через upgrade SDK.
2. Если нет — какой путь? Варианты:
   - (a) Bypass SDK: raw `fetch` wrapper (паттерн `lib/ai/library/xai-collections.ts`) поверх `https://api.x.ai/v1/chat/completions` или `/v1/responses`.
   - (b) Custom AI SDK `LanguageModelV3` middleware: перехват `prepareRequest` ДО `convertToXaiChatMessages`, ручная инжекция `{ type: "input_file", file_id }`.
   - (c) Migrate Library Collections → Vector Stores и использовать `xaiTools.fileSearch` как server-side tool (потеря инвестиций в Collections-инфраструктуру).

**Влияние:** **критическое** — определяет всю архитектуру Шага 4. Без решения этого вопроса SPEC писать нельзя.

**Обнаружено:** Phase 0 audit, Section 6.2. STOP-условие #3 эскалирует это решение.

---

## 🚨 Finding #2: simply-chat default-модель не agentic — Files API недоступен по архивному ресёрчу

**Где:** [lib/ai/task-assignments.ts:94-96](../../../lib/ai/task-assignments.ts#L94-L96) — `simply-chat` = `grok-4-1-fast-non-reasoning`, `chat-vision` = `grok-4-1-fast-non-reasoning`.

**Что:** [Архивный TZ_ModelCatalogDocumentFlags](../../../_archive/TZ_ModelCatalogDocumentFlags/TZ_MODEL_CATALOG_DOCUMENT_FLAGS.md) (2026-03-XX) утверждает: «Files API доступен только для agentic-моделей — тех, которые поддерживают серверный tool calling (`attachment_search`). Non-reasoning варианты — НЕ agentic.»

Соответственно:
- ✅ `grok-4-1-fast-reasoning` — Files API работает.
- ✅ `grok-4.20-0309-reasoning` — Files API работает.
- ✅ `grok-4.20-multi-agent-0309` — Files API работает.
- ❌ `grok-4-1-fast-non-reasoning` (default `simply-chat`) — НЕТ.
- ❌ `grok-4.20-0309-non-reasoning` — НЕТ.

**Почему проблема:** если правило архива верное в 2026-04+, то default Simply Chat при добавлении PDF либо упадёт, либо Files API не активируется. Пользователь не получает обещанного «PDF полностью на xAI».

**Вопросы архитектору:**
1. WebSearch текущей docs.x.ai/docs/guides/files — изменилось ли правило «только agentic»?
2. Если правило ещё актуально — какое решение:
   - (A) Capability-routing: при PDF в новом сообщении автоматически переключить taskId `simply-chat → simply-chat-think` (паттерн `chat-vision`).
   - (B) Откат: default `simply-chat` снова на `grok-4.20-0309-reasoning` (откат TZ-XAI-4 v3.88).
   - (C) Новый taskId `chat-files`: отдельная агентская модель для файлов, как `chat-vision` для image.
3. Что с `grok-4-1-fast-non-reasoning` в `chat-vision`? Если он не agentic — image возможно тоже плохо обрабатывает в Шаге 4 контексте?

**Влияние:** **критическое** — определяет UX «бесшовность» PDF-обработки в Simply default flow.

**Обнаружено:** Phase 0 audit, Section 6.3.

---

## ⚠️ Finding #3: Pricing Files API — расхождение архив vs концепт

**Где:**
- Архив [TZ_MODEL_CATALOG_DOCUMENT_FLAGS.md:80](../../../_archive/TZ_ModelCatalogDocumentFlags/TZ_MODEL_CATALOG_DOCUMENT_FLAGS.md#L80) — «Дополнительная тарификация: **$5/1000** вызовов tool».
- Концепт SIMPLY_MIGRATION_CONCEPT.md / HANDOFF — «**$10/1000** вызовов» (от архитектора 2026-04-28).
- Memory `feedback_xai_api_costs` — прямые вызовы xAI жгут реальные деньги.

**Что:** разные числа. Архитектор обязан определиться через WebFetch актуальной [docs.x.ai/docs/guides/files](https://docs.x.ai/docs/guides/files) или pricing page.

**Почему проблема:**
- Cost tracking и ROI расчёты Шага 4 зависят от точного числа.
- Решение «фильтровать ли cheap chats от Files API» зависит от цены за вызов.
- Может ли Шаг 4 окупиться: 685K токен сэкономленных vs N tool invocations × цена.

**Влияние:** **medium** — не блокирует SPEC, но влияет на финансовую обоснованность.

**Обнаружено:** Phase 0 audit, Section 5.

---

## ⚠️ Finding #4: Drizzle нет таблицы chat_attachment

**Где:** [lib/db/schema.ts:254-265](../../../lib/db/schema.ts#L254-L265) — `Message_v2` имеет `attachments: json("attachments").notNull()` JSON-поле, но **отдельной таблицы под mapping `(xaiFileId, blobUrl, chatId)` нет**.

**Что:** для Шага 4 нужна персистентность пары `(xaiFileId → blobUrl)` чтобы:
- При ошибке xAI Files API → re-upload из Blob.
- При delete chat → cleanup orphan files в xAI (как уже работает Library через `xaiDeleteFile`).
- Дедупликация: тот же файл, прикреплённый дважды в одном чате — один `xaiFileId`?

**Вопросы архитектору:**
1. Отдельная таблица `chat_attachment(id, chatId, messageId, xaiFileId, blobUrl, filename, mimeType, size, createdAt)` с FK cascade на `Chat`?
2. Или расширить `Message_v2.attachments` JSON-полем структурированными `{xaiFileId, blobUrl, ...}`?
3. Нужны ли индексы по `xaiFileId` для cleanup-сценариев?
4. Дедупликация на уровне chat / на уровне user / нет дедупликации?

**Влияние:** **medium** — структура storage влияет на migration plan и cleanup ops.

**Обнаружено:** Phase 0 audit, Section 6.4.

---

## ⚠️ Finding #5: convertTextFilePartsInMessage — judgment call в SPEC

**Где:** [app/(chat)/api/chat/route.ts:233-274](../../../app/(chat)/api/chat/route.ts#L233-L274), [route.ts:283](../../../app/(chat)/api/chat/route.ts#L283), [route.ts:652](../../../app/(chat)/api/chat/route.ts#L652).

**Что:** функция конвертирует text/plain file parts в inline text с маркером `📄 **Файл:**`. После Шага 4 надо решить:

**Варианты:**
1. **Удалить полностью** — все файлы (даже мелкие .txt 100 байт) идут через xAI Files API. Минус: overhead на upload+delete для крошечных файлов; плюс: единый путь.
2. **Оставить для маленьких файлов** (< N байт) — гибрид: маленькие inline, большие через Files API. Минус: два разных пути в коде. Плюс: cost savings на крошках.
3. **Удалить для DOCX/XLSX/CSV/PDF, оставить для .md/.txt** — выборочно по mediaType.

Концепт говорит про «трёх-уровневую стратегию» (inline / Files API / Library). Уровень 1 (inline) предполагает что мелкие текстовые остаются, но порог не определён.

**Вопросы архитектору:**
1. Что является «маленьким файлом» по threshold (10 KB? 50 KB? estimateTokens < N?)?
2. Гибрид или единый путь?

**Влияние:** **low** — judgment call, не блокер. Но важен для cleanup плана и compaction-консистентности.

**Обнаружено:** Phase 0 audit, Section 2.

---

## ⚠️ Finding #6: Vercel Blob garbage collection после Шага 4

**Где:** [app/(chat)/api/files/upload/route.ts:227](../../../app/(chat)/api/files/upload/route.ts#L227) — `put(originalFilename, fileBuffer, { access: "public" })`.

**Что:** сейчас Blob файлы chat upload **никогда не удаляются**. Live в Blob storage навсегда — orphans от отменённых upload, удалённых сообщений, удалённых чатов.

После Шага 4 при добавлении xAI Files API path:
- Blob — резервная копия.
- xAI — primary.

**Вопросы архитектору:**
1. Кто owns lifecycle Blob-файла? FK от `chat_attachment` с `onDelete: cascade` + хук на `del()` из `@vercel/blob`?
2. Уже есть утечка orphan-файлов в Blob от текущей реализации — закрывать в Шаге 4 или отдельным ТЗ?
3. Шаг 4 расширяет проблему (двойное хранение xAI + Blob) или сокращает (если Blob становится только staging)?

**Влияние:** **low-medium** — orphan storage стоит копейки, но архитектурно неаккуратно.

**Обнаружено:** Phase 0 audit, Section 4.3.

---

## ℹ️ Finding #7: Незакоммиченные правки лежат в lib/ai/registry.ts

**Где:** `git status` — `M lib/ai/registry.ts` (от ТЗ-SimplyChatBillingLeak).

**Что:** диагностический PAYLOAD-DEBUG fetch wrapper из ADR-057 ([HANDOFF Шага 3, Phase 1 audit](../TZ_VisionOcrCleanup/ANALYSIS.md#L47)). **НЕ относится к Шагу 4** — это диагностика для отдельного ТЗ.

**Решение:** не смешивать с Шагом 4. Архитектор решает отдельно — закоммитить как часть TZ_SimplyChatBillingLeak финализации, удалить (если diagnostic больше не нужен), или оставить как dev-only.

**Влияние:** **none** для Шага 4, но напомнить владельцу при выборе ветки.

**Обнаружено:** Phase 0 audit, общий обзор `git status`.

---

## 🚨 Finding #8: Phase 3 пропустил миграцию legacy данных — портянки лежали в БД

**Где:** `Message_v2` — 23 user-сообщения с маркером `📄 **Файл:` (накоплены 14-28 апр), суммарно **~720K токенов** (одна запись `c7853a33` = 685K).

**Что:** Phase 3 (коммит `1dedf27`) удалил `convertTextFilePartsInMessage` и UI-детектор маркера в `components/message.tsx`, корректно закрыв inline-конверсию для **новых** файлов. Legacy записи в БД, созданные ДО фикса, никто не чистил. После удаления UI-детектора эти записи стали отображаться в чате полным текстом («раскрылись портянки»).

**Биллинг-следствие (29-04, chat 3353a183):** на каждом turn'е legacy портянки уходили в xAI как часть истории. Из `ai_usage_log`:
- Spike 15:54 UTC: input=166,415 (cacheRead=123,876, fresh=42,539, баланс ~720K раздутой истории + новый PDF).
- Subsequent turns 15:57/15:58: fresh застрял на ~33K (vs baseline ~3-6K в чистом expertise-чате с тем же PDF).

Сравнение с чистым expertise-чатом (DevPanel, тот же PDF, та же модель `grok-4-1-fast-non-reasoning`): fresh = 23,380 — реальная цена OCR-парсинга скана. Разница 33-23 = 10K хвоста от legacy портянок в Simply.

**Почему проблема:** Phase 3 спецификация фокусировалась на закрытии inline-pipeline для новых файлов. Миграция исторических `Message_v2.parts` записей не была пунктом ROADMAP — это пропуск планирования. Биллинг-утечка жила всё время после b0670c3 (28-04), просто была невидима — UI-детектор маркера маскировал портянки как карточку, удаление детектора в `1dedf27` сделало проблему видимой.

**Решение (выполнено в этой сессии, hot-fix):** smoke-test данные, владелец дал явное согласие на полную очистку:
```sql
DELETE FROM memory_entry WHERE "userId" = 'bed95407-4160-492e-bdfd-9cf8819878be';   -- 273 MIND
DELETE FROM "Stream" WHERE "chatId" = '3353a183-37f5-498e-b461-c2e87ff65ef1';        -- 232
DELETE FROM "Message_v2" WHERE "chatId" = '3353a183-37f5-498e-b461-c2e87ff65ef1';    -- 454 + 4 chat_attachment cascade
```
Chat row сохранён (Simply persistent), `ai_usage_log` (519 записей) сохранён для baseline-сравнения.

**Влияние:** **none** для будущих файлов — архитектура Phase 3 закрыта. **Для prod-deployments с реальными пользователями** при следующей подобной миграции — добавить Phase «Legacy data cleanup» в ROADMAP перед удалением UI-маскировки. Текущий случай smoke-only, поэтому DELETE достаточно.

**Обнаружено:** разбор биллинг-спайка 29-04, верификация фактом по `ai_usage_log` + `Message_v2.parts` + dev-panel сравнение Simply vs expertise.
