# Simply_Migration · Шаг 4 · PDF и файлы на xAI Files API — ROADMAP

**SPEC:** `specs/Simply_Migration/TZ_FilesAPIMigration/SPEC.md` (v3)
**Phase 0 audit:** `ANALYSIS.md`, `FINDINGS.md` (выполнен)
**Phase 1:** ✅ **ЗАВЕРШЕНА** 2026-04-28 (см. инлайн-результаты + `PHASE1_FINDINGS.md`)
**Phase 2:** ✅ **ЗАВЕРШЕНА** 2026-04-29 — коммит `6eabfd7` (19 файлов, +4186/−87)
**Phase 3:** ✅ **ЗАВЕРШЕНА** 2026-04-29 — коммит `1dedf27` (5 файлов, +122/−133)
**Status:** Шаг 4 закрыт локально. Push на origin не сделан — на усмотрение Vladimir.
**Версия ROADMAP:** v3 (обновлено 2026-04-28 после Phase 1.5-1.7 диагностик)

---

## ✅ Pre-Phase 1 — Подготовка (Vladimir) — ВЫПОЛНЕНА

`lib/ai/registry.ts` PAYLOAD-DEBUG — решение по нему за пределами этого ТЗ, не блокирует Phase 2.

---

## ✅ Phase 1 — ЗАВЕРШЕНА

Всё прошло. Critical findings:

### 1.1-1.4 ✅ ВЫПОЛНЕНО

| Шаг | Результат |
|---|---|
| 1.1 grep'ы старых паттернов | 3 call sites `convertTextFilesInAllMessages` (283, 652, 1157), 3 call sites `extractPdfText` (chat / Library / Projects), `PDF_TEXT_MAX_CHARS` локально в upload route |
| 1.2 образец `xai-collections.ts` | Готов к копированию паттерна |
| 1.3 backward compat | 28 messages с маркером `📄 **Файл:` в БД → strip в Phase 3 |
| 1.4 cron infrastructure | `vercel.json` + 3 cron'а + `CRON_SECRET` Bearer auth → reaper Phase 3 встраивается 4-м entry |

### 1.5 R2 диагностика ✅ ЗАКРЫТО

**ВСЕ 7 моделей принимают `input_file` и активно делают `document_search`.** Архивный TZ_ModelCatalogDocumentFlags устарел — non-reasoning Grok'и тоже agentic-capable для Files API.

| model_id | input_file accepted | content extracted |
|---|---|---|
| grok-4-1-fast-reasoning | ✅ | ✅ |
| grok-4-1-fast-non-reasoning | ✅ | ✅ |
| grok-4.20-0309-reasoning | ✅ | ✅ |
| grok-4.20-0309-non-reasoning | ✅ | ✅ |
| grok-4.20-multi-agent-0309 | ✅ | ✅ |
| grok-4-fast | ✅ | ✅ |
| grok-4 | ✅ | ✅ |

→ R3 риск **отменён**. Все Grok'и в каталоге получат `documentSupport: { supported: true }` в Phase 2.7.

### 1.6 R5 диагностика ✅ ЗАКРЫТО

ratio Turn 2 / Turn 1 = 7300 / 4498 = **1.62** > 1.5 (формальное STOP).

**Природа другая:** Turn 2 сделал **6 document_search calls** (углублённый агентский поиск под сложный вопрос). Turn 1 и 3 — по 1 call каждый.

→ Это **variable agentic depth** per-turn, **не накопление контекста**. Server-side state (encrypted_content / previous_response_id) **не помогает**.

→ STOP-условие снято. **Решение архитектора: продолжаем без server-side state.** Variable per-turn cost (1-6 document_search calls = $0.01-0.06 per user message) принимаем как expected behaviour.

### 1.7 R6 диагностика ✅ ЗАКРЫТО

`GET /v1/usage` → 404, **не нужен**.

`response.usage` содержит:
- `cost_in_usd_ticks` (точная стоимость turn'а в USD-тиках)
- `server_side_tool_usage_details.document_search_calls` (счётчик calls)

→ Phase 2 парсит `response.usage` финального chunk'а Responses API stream'а и пишет в `ai_usage_log` точные деньги (новая колонка `serverSideToolCalls` JSON).

### 1.8-1.10 ✅ ВЫПОЛНЕНО

`PHASE1_FINDINGS.md` написан, диагностический скрипт удалён, не закоммичено.

---

## ✅ Phase 2 — Foundation (новый код) — ЗАВЕРШЕНА 2026-04-29

**Коммит:** `6eabfd7 feat(migration-step-4): xAI Files API + Responses путь для PDF/DOCX/XLSX/MD`
**Статус:** все 11 пунктов выполнены, smoke test 5 форматов (PDF/MD/DOCX/XLSX/CSV) зелёный.

**Pre-condition:** Phase 1 пройдена ✅. SPEC v3 обновлён ✅. Зелёный свет.

**Цель:** новый path работает end-to-end, cost tracking точный. Старый path ещё на месте (удаляем в Phase 3).

### 2.1 `lib/ai/files/xai-files-client.ts`

Создать модуль по образцу `lib/ai/library/xai-collections.ts`:

```typescript
export async function xaiUploadFile(
  buffer: Buffer,
  filename: string,
  options?: { purpose?: "assistants"; mimeType?: string }
): Promise<{ id: string; bytes: number; createdAt: number }>;

export async function xaiDeleteFile(fileId: string): Promise<{ deleted: boolean }>;

export async function xaiGetFileMetadata(fileId: string): Promise<{
  id: string; filename: string; bytes: number; createdAt: number; purpose: string;
} | null>;

export async function xaiListFiles(options?: {
  limit?: number;
  paginationToken?: string;
}): Promise<{
  data: Array<{ id: string; filename: string; bytes: number; createdAt: number }>;
  hasMore: boolean;
  nextToken?: string;
}>;
```

Требования:
- `fetch` напрямую
- Auth: `Authorization: Bearer ${process.env.XAI_API_KEY}`
- multipart/form-data для upload (`FormData` + `Blob`)
- Retry на 5xx (1 попытка с 1с задержкой)
- Typed errors: `XaiFilesApiError extends Error`
- JSDoc + ссылка на docs.x.ai

### 2.2 Drizzle миграция: таблица `chat_attachment`

```typescript
export const chatAttachment = pgTable(
  "chat_attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id").notNull().references(() => chat.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").notNull().references(() => messageV2.id, { onDelete: "cascade" }),
    xaiFileId: text("xai_file_id"),
    blobUrl: text("blob_url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    chatIdIdx: index("chat_attachment_chat_id_idx").on(table.chatId),
    xaiFileIdIdx: index("chat_attachment_xai_file_id_idx").on(table.xaiFileId),
  })
);
```

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 2.3 Расширить capability-routing на все file parts

```typescript
// БЫЛО
const hasImageAttachment = newMessage.parts.some(
  (p) => p.type === "file" && p.mediaType?.startsWith("image/")
);
const taskId = hasImageAttachment ? "chat-vision" : currentTaskId;

// СТАЛО
const hasAnyFileAttachment = newMessage.parts.some(
  (p) => p.type === "file"
);
const taskId = hasAnyFileAttachment ? "chat-vision" : currentTaskId;
```

Описание `chat-vision` в `task-assignments.ts` обновить на «universal attachment routing slot».

### 2.4 Обновить `app/(chat)/api/files/upload/route.ts`

PDF branch:

```typescript
if (file.type === "application/pdf") {
  const blob = await put(filename, buffer, { access: "public" });
  let xaiFileId: string | null = null;
  try {
    const xaiFile = await xaiUploadFile(buffer, filename, {
      purpose: "assistants",
      mimeType: "application/pdf"
    });
    xaiFileId = xaiFile.id;
  } catch (err) {
    console.warn("[xai-files] upload failed, blob backup remains", err);
  }
  return Response.json({ url: blob.url, name: filename, contentType: file.type, xaiFileId });
}
```

DOCX/XLSX/CSV/TXT/MD branch — добавить `xaiUploadFile` после конверсии в text/plain.

Image branch — без изменений.

**Удалить:** import `extractPdfText`, `PDF_TEXT_MAX_CHARS`. **Не трогать** `lib/pdf/extract-pdf-text.ts` и `pdf-parse`.

### 2.5 Сохранить `chat_attachment` запись при создании user message

После save Message_v2 — для каждого file part с `xaiFileId` или `blobUrl` создать запись в `chat_attachment` транзакционно.

### 2.6 Развилка в `route.ts`: новый Responses API path

```typescript
const newMessage = uiMessages[uiMessages.length - 1];
const fileAttachments = await getChatAttachmentsForMessage(newMessage.id);
const hasInputFiles = fileAttachments.some(a => a.xaiFileId !== null);

if (hasInputFiles) {
  const responsesInput = buildResponsesInput(uiMessages, fileAttachments);
  const stream = await xaiResponsesApiStream({
    model: resolveModelForTaskId(taskId),
    input: responsesInput,
  });
  return adaptResponsesStreamToUI(stream);
}

return streamText({
  model: xai(resolveModelForTaskId(taskId)),
  messages: convertedMessages,
  tools,
});
```

`buildResponsesInput`:
- text parts → `{type: "input_text", text: ...}`
- file parts с `xaiFileId` → `{type: "input_file", file_id: xaiFileId}`
- file parts с `mediaType: "image/*"` → `{type: "input_image", image_url: ...}`
- assistant messages → `{role: "assistant", content: [...]}`

`xaiResponsesApiStream(...)` — обёртка над `POST /v1/responses` с `stream: true`, парсинг SSE chunks.

`adaptResponsesStreamToUI(stream)` — адаптер к existing streaming UI.

**STOP-условие:** если адаптация streaming формата требует переписывания UI слоя — STOP, эскалация. Альтернатива: `streamText({ model: xai.responses(...) })` если обходит блокер SDK для file parts.

### 2.7 model-catalog.ts — все 7 Grok моделей

Phase 1.5 R2 подтвердил: **все** Grok'и работают. Для всех 5 моделей в каталоге:

```typescript
documentSupport: {
  supported: true,
  method: "files-api",
  maxSizeMb: 48,
  notes: "PDF/DOCX/XLSX/CSV/TXT/MD. xAI server-side document_search активируется автоматически при input_file. Variable cost per-turn 1-6 calls. Phase 1.5 verified.",
},
```

(Не только reasoning — также non-reasoning и multi-agent.)

### 2.8 🆕 Cost tracking в `ai_usage_log`

Найти существующую инфраструктуру `ai_usage_log` (или создать колонку):
- Колонка `cost_usd` (если есть как `decimal`/`numeric`) — писать конвертацию `cost_in_usd_ticks` в USD
- **Новая колонка `server_side_tool_calls jsonb`** — добавить через Drizzle migration в этой же Phase 2.2 (или отдельной migration). Содержит JSON: `{document_search_calls: N, ...}`

При парсинге Responses API stream'а — на финальном chunk'e (где есть `usage`) извлекать:

```typescript
// Псевдокод (точные имена полей — Phase 2.1 из docs)
const finalUsage = stream.getFinalUsage();
const costUsd = ticksToUsd(finalUsage.cost_in_usd_ticks); // конверсия по xAI единицам
const toolCalls = finalUsage.server_side_tool_usage_details ?? {};

await db.insert(aiUsageLog).values({
  chatId, messageId, model: resolvedModel,
  inputTokens: finalUsage.input_tokens,
  outputTokens: finalUsage.output_tokens,
  costUsd, // точное число, не эстимация
  serverSideToolCalls: toolCalls,
  // ...
});
```

**Уточнить в Phase 2.1:** конверсия `cost_in_usd_ticks` → USD (документация xAI или эмпирически из Phase 1 диагностики).

### 2.9 TypeScript + Build check

```bash
pnpm typecheck
pnpm build
```

### 2.10 Phase 2 manual smoke test

`pnpm dev`:
1. Свежий чат
2. Загрузить текстовый PDF
3. Спросить «о чём документ»
4. **Pass:**
   - Ответ от Grok с реальным содержанием
   - DevTools Network: `/v1/responses` запрос с `"file_id"`
   - БД: `chat_attachment` запись существует
   - **🆕** `ai_usage_log` запись содержит непустой `cost_usd` и `server_side_tool_calls.document_search_calls > 0`

### 2.11 Commit Phase 2

```
feat(migration-step-4-phase2): xAI Files API foundation + cost tracking

- New module lib/ai/files/xai-files-client.ts (raw fetch wrappers)
- New table chat_attachment with FK cascade
- New column ai_usage_log.server_side_tool_calls (jsonb)
- Capability-routing extended: chat-vision triggers on any file part
- Upload route: PDF/DOCX/XLSX/CSV/TXT/MD upload to both Vercel Blob and xAI Files API
- New Responses API path in chat route when message has file attachments
- Cost tracking: parse response.usage.cost_in_usd_ticks + document_search_calls,
  write exact cost (not estimation) to ai_usage_log
- model-catalog.ts: documentSupport=true for ALL 7 Grok models
  (Phase 1.5 verified non-reasoning works too)

Phase 1 findings: PHASE1_FINDINGS.md
SPEC v3: specs/Simply_Migration/TZ_FilesAPIMigration/SPEC.md

Old inline-text path still in place — removed in Phase 3.
pdf-parse and lib/pdf/extract-pdf-text.ts kept (Library + Projects out of scope).
```

---

## ✅ Phase 3 — Cleanup + Lifecycle + Backward Compat — ЗАВЕРШЕНА 2026-04-29

**Коммит:** `1dedf27 feat(migration-step-4): cleanup inline-text path, cascade delete, reaper cron`
**Статус:** все 11 пунктов выполнены, manual verification зелёный.

**Pre-condition:** Phase 2 пройдена, smoke test зелёный.

**Цель:** удалить inline-text path в chat, добавить cleanup, reaper и backward compat для legacy сообщений.

### Отступление от плана архитектора

- **3.5** `lib/repositories/chat-cleanup.ts` НЕ создан как отдельный файл. Вместо этого cleanup-логика встроена в существующие `deleteChatById` + `deleteAllChatsByUserId` в `lib/db/queries.ts` через приватный helper `cleanupAttachmentExternals`. Причина: чтобы не экспортировать private `db` instance (`const db = drizzle(...)` внутри queries.ts) и не плодить новые директории. Каскадное поведение идентичное: fetch attachments → DB cascade delete → `Promise.allSettled` для xAI files + Vercel Blob.
- **3.3** text/plain placeholder применяется **только к старым сообщениям** (idx < cutoff в `stripOldAttachmentsFromHistory`), а не ко всей истории. Причина: после Phase 4 свежий MD/TXT в последнем user message несёт `providerMetadata.xai.fileId` для fork — placeholder бы убил file_id reference и Responses API path. PDF/Image поведение не изменилось.

### 3.1 Удалить `convertTextFilePartsInMessage` и `convertTextFilesInAllMessages`

В `app/(chat)/api/chat/route.ts`:
- Функция `convertTextFilePartsInMessage` (примерно строки 233-274)
- Функция `convertTextFilesInAllMessages` (batch wrapper)
- **Все три** call sites: `route.ts:283`, `route.ts:652`, `route.ts:1157`
- Упоминание в комментарии `lib/utils.ts:370` (если есть)

### 3.2 Удалить file-text strip в `stripOldAttachmentsFromHistory`

Удалить блок Fix 2 из TZ_SimplyChatBillingLeak (детектор маркера `📄 **Файл:`, ~строки 343-352).

Image и PDF strip-блоки **сохранить**.

### 3.3 Расширить `stripOldAttachmentsFromHistory` для backward compat (R8)

Добавить блок: text/plain file parts strip'ятся из **всей** истории:

```typescript
// Применяется ко всей истории, не только до последних 2 user-msgs
if (part.type === "file" && part.mediaType === "text/plain") {
  return {
    type: "text",
    text: `[Ранее был прикреплён файл: ${getFilenameFromUrl(part.url) ?? "файл"}]`
  };
}
```

Закрывает 28 legacy сообщений в БД.

### 3.4 Удалить константы и связанный код в upload/route.ts

- `PDF_TEXT_MAX_CHARS = 50_000`
- `import { extractPdfText }`
- ветка trim/text-conversion для PDF (уже сделано в Phase 2.4)

**Не удалять:**
- ❌ Файл `lib/pdf/extract-pdf-text.ts`
- ❌ npm dep `pdf-parse`
- ❌ `SCAN_AVG_CHARS_PER_PAGE_THRESHOLD`, `SCAN_SINGLE_PAGE_MIN_CHARS`

### 3.5 Pre-cascade cleanup function

`lib/repositories/chat-cleanup.ts`:

```typescript
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { xaiDeleteFile } from "@/lib/ai/files/xai-files-client";

export async function deleteChatWithCleanup(chatId: string): Promise<void> {
  const attachments = await db
    .select()
    .from(chatAttachment)
    .where(eq(chatAttachment.chatId, chatId));

  await db.delete(chat).where(eq(chat.id, chatId));

  await Promise.allSettled([
    ...attachments
      .filter(a => a.xaiFileId)
      .map(a => xaiDeleteFile(a.xaiFileId!).catch(err =>
        console.warn(`[chat-cleanup] xai delete failed for ${a.xaiFileId}`, err)
      )),
    ...attachments.map(a =>
      del(a.blobUrl).catch(err =>
        console.warn(`[chat-cleanup] blob delete failed for ${a.blobUrl}`, err)
      )
    ),
  ]);
}
```

Заменить все места удаления чатов на вызов `deleteChatWithCleanup`.

### 3.6 Background reaper

`app/api/cron/reap-attachments/route.ts`:

```typescript
export const GET = async (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let token: string | undefined;
  let totalReaped = 0;
  let totalScanned = 0;

  do {
    const { data, hasMore, nextToken } = await xaiListFiles({
      limit: 100, paginationToken: token
    });
    totalScanned += data.length;

    for (const file of data) {
      const ageHours = (Date.now() - file.createdAt * 1000) / (1000 * 60 * 60);
      if (ageHours < 24) continue;

      const exists = await db
        .select({ id: chatAttachment.id })
        .from(chatAttachment)
        .where(eq(chatAttachment.xaiFileId, file.id))
        .limit(1);

      if (exists.length === 0) {
        await xaiDeleteFile(file.id).catch(err =>
          console.warn(`[reaper] failed to delete orphan ${file.id}`, err)
        );
        totalReaped++;
      }
    }

    token = nextToken;
  } while (token);

  return Response.json({ totalScanned, totalReaped });
};
```

Зарегистрировать в `vercel.json` (4-й entry):

```json
{
  "crons": [
    /* существующие 3 cron'а */,
    { "path": "/api/cron/reap-attachments", "schedule": "0 3 * * *" }
  ]
}
```

### 3.7 UI карточки

`components/message.tsx` — удалить TODO про инлайн-портянку. После Phase 3 file parts рендерятся через `attachmentsFromMessage`.

### 3.8 TypeScript + Build check

```bash
pnpm typecheck
pnpm build
```

### 3.9 Полный manual verification

`pnpm dev`. Прогнать все 32 acceptance criteria из SPEC v3 секции 7.

| # | Test | Pass / Fail / N/A |
|---|---|---|
| 19 | Текстовый PDF | |
| 20 | Сканированный PDF | |
| 21 | DOCX | |
| 22 | XLSX | |
| 23 | CSV/TXT/MD | |
| 24 | Multi-turn variable cost | |
| 25 | Image регрессия | |
| 26 | Library регрессия | |
| 27 | Library auto-analyze регрессия | |
| 28 | Project files регрессия | |
| 29 | Legacy сообщения (R8 backward compat) | |
| 30 | 685K baseline | |
| 31 | Cleanup на DELETE chat | |
| 32 | 🆕 Cost tracking в ai_usage_log | |

Записать в `VERIFICATION.md`.

**Test 30 — главный численный результат миграции.**
**Test 32 — подтверждение что Phase 1.7 R6 находка переехала в production.**

### 3.10 Документация

- `docs/ai-chats-map.md` — chat-путь файлов (Library и Projects не трогать)
- `docs/ai-providers.md` — xAI Files API + variable per-turn cost
- inline-комментарии в `model-catalog.ts` обновлены в Phase 2.7

### 3.11 Commit Phase 3

```
feat(migration-step-4-phase3): cleanup chat inline-text, add lifecycle + backward compat

Removed (chat only):
- app/(chat)/api/chat/route.ts: convertTextFilePartsInMessage, convertTextFilesInAllMessages
  (all 3 call sites: lines 283, 652, 1157)
- app/(chat)/api/chat/route.ts: file-text strip block (Fix 2 from TZ_SimplyChatBillingLeak)
- app/(chat)/api/files/upload/route.ts: PDF_TEXT_MAX_CHARS, extractPdfText import,
  pdf trim/text-conversion branch
- TODO comment in components/message.tsx

Added:
- app/(chat)/api/chat/route.ts: extended stripOldAttachmentsFromHistory with
  text/plain file part strip from entire history (R8 backward compat for 28 legacy messages)
- lib/repositories/chat-cleanup.ts: deleteChatWithCleanup with pre-cascade cleanup
- app/api/cron/reap-attachments/route.ts: daily orphan reaper
- vercel.json: 4th cron entry for reaper

Kept (out of scope, still used by Library auto-analyze and Project files):
- lib/pdf/extract-pdf-text.ts
- npm dep pdf-parse
- SCAN_AVG_CHARS_PER_PAGE_THRESHOLD, SCAN_SINGLE_PAGE_MIN_CHARS

Test 30 baseline: chat 3353a183 c7853a33 was 685K tokens / 2.85 MB.
After migration equivalent: ${ACTUAL} tokens. Reduction ${RATIO}.

Test 32 cost tracking: ai_usage_log now records exact cost_in_usd_ticks
and document_search_calls per-turn.

Closes Шаг 4. Closes R3 of Шаг 3.
SPEC v3: specs/Simply_Migration/TZ_FilesAPIMigration/SPEC.md
VERIFICATION: specs/Simply_Migration/TZ_FilesAPIMigration/VERIFICATION.md
```

---

## Phase 4 — PR (Vladimir)

После 2 коммитов локально:
1. Финальное ревью SPEC v3 + VERIFICATION + git log
2. `git push` в master
3. Обновляет `SIMPLY_ITOG_UPDATED.md`:
   - Шаг 4 закрыт
   - 685K → N reduction
   - inline-text path в chat удалён
   - R3 Шага 3 закрыт
   - **Phase 1 findings:** все Grok'и поддерживают Files API; variable per-turn cost (1-6 document_search calls); cost tracking через response.usage точный
   - Backlog: миграция Library auto-analyze и Project files на Files API — отдельные ТЗ
4. Переход к Шагу 5 (Web Tools)

---

## Что НЕ делать

- Не делать backfill 28 legacy сообщений с маркером `📄`. Strip покрывает.
- **🆕 Не реализовывать server-side state** (encrypted_content / previous_response_id). Phase 1.6 показал — variable cost per-turn это agentic depth, не накопление контекста. Server-side state бесполезен.
- Не удалять `lib/pdf/extract-pdf-text.ts` — Library + Projects.
- Не удалять `pdf-parse`.
- Не трогать `lib/text-extraction/extract.ts` или `app/(chat)/api/projects/[id]/files/route.ts`.
- Не пытаться поддержать DOCX/XLSX напрямую в Files API — конвертим в text/plain до upload.
- Не унифицировать «новый Responses path» и «старый streamText path» в одну ветку.
- Не трогать `lib/ai/library/xai-collections.ts`.
- Не миграцию на Vector Stores.
- Не смешивать с PAYLOAD-DEBUG из ADR-057.
- **🆕 Не делать estimation-based cost** в `ai_usage_log` для Responses API path. Использовать `cost_in_usd_ticks` напрямую — это точная цифра.

---

## STOP-условия (общая сводка, обновлено)

| Phase | Условие | Действие |
|---|---|---|
| ~~1.5~~ | ~~Ни одна reasoning Grok не работает с input_file~~ | ✅ ЗАКРЫТО — все 7 моделей работают |
| ~~1.6~~ | ~~Multi-turn ratio > 1.5~~ | ✅ ЗАКРЫТО — variable agentic depth, не нужен server-side state |
| 1.1 | Неожиданные hits в grep'ах мёртвого кода | ✅ ЗАКРЫТО — карта удалений зафиксирована |
| 2.6 | Streaming формат Responses API несовместим с UI | STOP, fallback на `streamText({ model: xai.responses(...) })` |
| 2.2 | Drizzle migration упала / FK cascade не работает | STOP, отладка БД до коммита |
| 2.8 | `cost_in_usd_ticks` → USD конверсия неоднозначна | STOP, уточнить через docs.x.ai или эмпирически из Phase 1 ответов |
| 2.10 | Phase 2 smoke test не Pass (особенно Test cost tracking) | STOP, не коммитить, debug |
| 3 | Любой regression в acceptance tests 27/28 (Library / Projects) | STOP, rollback Phase 3 коммита, оставить Phase 2 |
| 3 | Test 30 baseline reduction < 100x | STOP, эскалация |
| 3 | Test 29 legacy сообщений падает в `UnsupportedFunctionalityError` | STOP, доработать strip block |
| 3 | Test 32 cost tracking не работает (cost_usd null или document_search_calls 0) | STOP, проверить парсинг response.usage |
