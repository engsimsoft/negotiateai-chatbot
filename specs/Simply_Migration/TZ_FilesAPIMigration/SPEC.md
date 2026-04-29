# Simply_Migration · Шаг 4 · PDF и файлы на xAI Files API — SPEC

**Серия:** `Simply_Migration` (концепт — `specs/Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md`, Блок 3)
**Шаг в серии:** 4 из 11 (Фаза Б — унификация инструментов в чате)
**Зависимости:** Шаги 1, 2, 3 — закрыты
**Блокирует:** Шаг 5 (Web Tools), Шаг 8 (Экспертиза)
**Версия SPEC:** v3 (обновлено 2026-04-28 после Phase 1.5-1.7 диагностик)

**История версий:**
- v1 — изначальный SPEC
- v2 — узкий скоуп для `pdf-parse` (остаётся), добавлен 3-й call site, backward compat
- **v3 — R2/R3 закрыты (все 7 моделей работают), R5 закрыт (variable agentic depth, не server-side state), R6 закрыт (cost tracking через response.usage). Capability-routing переосмыслен как product decision, не защита от mismatch. Cost tracking через cost_in_usd_ticks.**

---

## 1. Цель

Перевести все вложения **в чате** (PDF, DOCX, XLSX, CSV, TXT, MD, изображения уже работают через native vision) на единый путь **xAI Files API + `attachment_search`** (он же `document_search` в API). Файл загружается в xAI один раз, в payload модели уходит только `file_id`-ссылка, xAI server-side ищет ответы по документу через свой агентский поиск.

Сегодня вложения «налипают» в историю как inline-text портянками — на тестовом chat `3353a183` ОДНО сообщение `c7853a33` весит **685K токенов / 2.85 MB** (87% от всех 790K токенов чата). После миграции это же сообщение должно весить ~50 токенов (file_id reference вместо binary).

Цель **не** «сэкономить на токенах» — цель **архитектурная**: убрать lossy continuity, убрать дубли при повторных загрузках, убрать эвристику «30 символов на страницу» из chat upload, сделать единый путь для всех типов файлов в чате.

**Скоуп ТЗ — только chat.** Library auto-analyze и Project files используют тот же `pdf-parse` для своих целей и в этом ТЗ не трогаются (см. §2.2).

---

## 2. Скоуп

### 2.1 Что входит

**Новый код:**
1. **Модуль `lib/ai/files/xai-files-client.ts`** — typed wrappers над `https://api.x.ai/v1/files` по паттерну существующего `lib/ai/library/xai-collections.ts`. Функции: `uploadFile`, `deleteFile`, `getFileMetadata`, `listFiles`. Bypass SDK через raw `fetch` (см. секцию 5.1).
2. **Развилка в `app/(chat)/api/chat/route.ts`** — при наличии в новом сообщении file attachments идём через **xAI Responses API path** (`POST /v1/responses` с `input_file` content type). Иначе — текущий `streamText({ model: xai(...) })` без изменений.
3. **Drizzle миграция: таблица `chat_attachment`** с FK cascade на `Chat` и `Message_v2`.
4. **Capability-routing расширение** — триггер переключения на taskId `chat-vision` расширяется с `image/*` на любой file part. Семантика `chat-vision` становится «universal attachment routing slot».
5. **🆕 Cost tracking через `response.usage.cost_in_usd_ticks`** — при парсинге Responses API stream извлекать `usage.cost_in_usd_ticks` (точная стоимость в тиках) и `server_side_tool_usage_details.document_search_calls` (количество агентских поисков), писать в `ai_usage_log` точные деньги вместо эстимации по тарифу × токены.
6. **Pre-cascade cleanup hook** при удалении чата — собрать `xaiFileId[]` и `blobUrl[]`, после успешного DB cascade async-удалить из xAI Files API + Vercel Blob.
7. **Background reaper** (cron, раз в сутки, встраивается в существующий `vercel.json` cron pattern с `CRON_SECRET` Bearer auth) — list xAI files → нет в `chat_attachment` → delete.

**Удаление переходного кода (Phase 3):**
8. **`convertTextFilePartsInMessage`** в `app/(chat)/api/chat/route.ts:233-274` — удалить целиком вместе с `convertTextFilesInAllMessages` (batch wrapper) и **всеми тремя** call sites:
   - `route.ts:283` — конвертация на новом user-сообщении
   - `route.ts:652` — конвертация ДО подсчёта `newMessageTokens` для compaction estimator
   - **`route.ts:1157`** — батч на исторические сообщения для всех chat modes (gate `chatMode === "simply"` снят 21.04.2026)
9. **File-text strip** в `stripOldAttachmentsFromHistory` (`route.ts:343-352`) — удалить блок Fix 2 из TZ_SimplyChatBillingLeak (детектор маркера `📄 **Файл:`). Image и PDF strip-блоки сохранить.
10. **Backward compat strip для legacy text/plain file parts** в `stripOldAttachmentsFromHistory` — **расширить** функцию: добавить блок «text/plain file parts → strip целиком из истории» применяемый ко **всей** истории. Закрывает 28 legacy сообщений в БД.
11. **Эвристика chat upload** — удалить из `app/(chat)/api/files/upload/route.ts`:
    - константа `PDF_TEXT_MAX_CHARS = 50_000`
    - import `extractPdfText`
    - ветка trim/text-conversion для PDF

    Сам файл `lib/pdf/extract-pdf-text.ts` и `pdf-parse` **остаются** (Library auto-analyze + Project files).
12. **PDF branch в `upload/route.ts:181-223`** — упростить: PDF → Vercel Blob → `xaiUploadFile` → возвращаем `file_id` вместе с blobUrl.
13. **DOCX/XLSX/CSV/MD/TXT extraction (mammoth, xlsx, TextDecoder)** — **сохранить**. Результат extraction грузится в xAI Files API как .txt-файл.

**Обновление каталога:**
14. **`lib/ai/model-catalog.ts`** — для **всех 7 Grok'ов** установить `documentSupport: { supported: true, method: "files-api", maxSizeMb: 48 }`. Phase 1.5 R2 подтвердил: non-reasoning модели тоже принимают input_file и активно делают document_search.

**UI:**
15. **`components/message.tsx`** — TODO про инлайн-портянку удалить.

### 2.2 Что не входит (явно out of scope)

- **Vector Stores migration.** Library Collections остаётся на `management-api.x.ai/v1/collections`.
- **Перенос `chat-vision` на reasoning-модель.** Выбор конкретной модели для `chat-vision` — через панель `/dev/models`, не в коде.
- **MCP-сервер для Perplexity / Web Tools / Multi-Agent.** Шаги 5, 6, 9 — отдельные ТЗ.
- **Воссоздание artifacts logic для PDF.** Артефакты — Шаг 7.
- **Migration BR-* pipelines.** Briefing — отдельный концепт.
- **Дедупликация одного и того же файла в рамках чата.**
- **Fast-path для маленьких текстовых файлов.** Единый путь для всех.
- **Незакоммиченная правка `lib/ai/registry.ts`** (PAYLOAD-DEBUG из ADR-057).
- **Миграция Library auto-analyze** (`lib/text-extraction/extract.ts`) — отдельный ТЗ.
- **Миграция Project files** — концепт §O2 явно говорит «отдельная серия после Multi-Agent».
- **Удаление `pdf-parse` npm dependency** — после миграции Library и Projects.
- **Удаление `lib/pdf/extract-pdf-text.ts`** — после миграции всех call sites.
- **Backfill 28 legacy сообщений.** Закрывается через strip в `stripOldAttachmentsFromHistory`.
- **🆕 Server-side state (encrypted_content / previous_response_id).** Phase 1.6 R5 показал: variable cost per-turn это agentic-depth behaviour, не накопление контекста. Server-side state не помогает.

---

## 3. Контекст и обоснование

### 3.1 Картина «как сейчас»

| Сценарий | Путь | Что в payload |
|---|---|---|
| **Текстовый PDF** в Simply Chat | upload → `pdf-parse` → text trim до 50K char → Blob → `convertTextFilePartsInMessage` → text part с маркером `📄` | Полный текст PDF inline (до 50K char) |
| **Сканированный PDF** | upload → `pdf-parse` → пусто → Blob как `application/pdf` → file part в payload | PDF binary (между Шагом 3 и 4 деградирует) |
| **DOCX** | upload → `mammoth` → text/plain → Blob → `convertTextFilePartsInMessage` → text part | Полный текст DOCX inline |
| **XLSX** | upload → `xlsx.sheet_to_csv` → text/plain → Blob → text part | Полный CSV inline |
| **CSV/TXT/MD** | upload → TextDecoder → Blob → text part | Полный текст inline |
| **JPEG/PNG** | upload → Blob → file part в payload | Image binary (Grok native vision) |
| **Дубль файла** | две полные копии inline-text в БД | 2x токенов |

**Проблемы:**
- Inline-text накапливается; `stripOldAttachmentsFromHistory` strip'ит только до последних 2 user-msgs
- Estimator не считает binary parts (TZ_EstimatorIgnoresAttachments)
- Compaction режет PDF-портянки сверху (TZ_DocumentTruncationSilent)
- 685K токенов в одном сообщении на chat 3353a183
- `convertTextFilesInAllMessages` работает на ВСЕХ chat modes (gate снят 21.04.2026)

### 3.2 Картина «как станет» (после Шага 4)

| Сценарий | Путь | Что в payload |
|---|---|---|
| **PDF (любой)** | upload → Blob (backup) → `xaiUploadFile` → `chat_attachment` запись → file part с `xaiFileId` | `{type: "input_file", file_id: "..."}` (~50 токенов) |
| **DOCX/XLSX** | upload → mammoth/xlsx → text/plain → Blob → `xaiUploadFile` как `.txt` | `{type: "input_file", file_id: "..."}` |
| **CSV/TXT/MD** | upload → text/plain → Blob → `xaiUploadFile` | `{type: "input_file", file_id: "..."}` |
| **JPEG/PNG** | без изменений (Grok native vision) | image part |
| **Дубль файла** | два upload, два `chat_attachment`, два file_id | 2x file_id (~100 токенов) |
| **Удаление чата** | `deleteChatWithCleanup()` → DB cascade → async cleanup xAI + Blob | xAI files удалены, Blob удалён |
| **Legacy сообщения с маркером `📄`** | `stripOldAttachmentsFromHistory` extended block → strip из всей истории | placeholder text |

**Что Grok видит:** только `file_id`. На каждом запросе xAI server-side выполняет `document_search` (агентская функция). Phase 1.6 показал: количество calls per-turn **варьируется** (1-6) в зависимости от сложности вопроса. Cost = `cost_in_usd_ticks` из `response.usage` (точное число, не эстимация).

### 3.3 Развилка в `route.ts` — псевдокод

```typescript
// app/(chat)/api/chat/route.ts (упрощённо)

const newMessage = uiMessages[uiMessages.length - 1];
const hasFileAttachments = newMessage.parts.some(
  (p) => p.type === "file" && !p.mediaType?.startsWith("image/")
);
const hasImageAttachments = newMessage.parts.some(
  (p) => p.type === "file" && p.mediaType?.startsWith("image/")
);

const taskId = (hasFileAttachments || hasImageAttachments)
  ? "chat-vision"  // universal attachment routing slot
  : currentTaskId;

if (hasFileAttachments) {
  const response = await xaiResponsesApiCall({
    model: resolveModelForTaskId(taskId),
    input: convertMessagesToResponsesInputWithFileIds(uiMessages, chatAttachments),
    stream: true,
  });
  return streamFromResponsesApi(response);
}

return streamText({ model: xai(resolveModelForTaskId(taskId)), messages, tools, ... });
```

---

## 4. Технические факты для реализации

### 4.1 xAI Files API contract (источник: docs.x.ai на 2026-04-28)

| Endpoint | Метод | Notes |
|---|---|---|
| `https://api.x.ai/v1/files` | `POST` | multipart/form-data; `file` (Bytes), `purpose` ("assistants") |
| `https://api.x.ai/v1/files/{file_id}` | `DELETE` | `{id, deleted: true}` |
| `https://api.x.ai/v1/files/{file_id}` | `GET` | metadata: `id, filename, bytes, created_at, purpose, team_id` |
| `https://api.x.ai/v1/files` | `GET` | list с пагинацией |

**Limits:**
- Max file size: **48 MB**
- Auto-delete / TTL: **не существует**
- Files scoped to team/organization

**Поддерживаемые форматы:** PDF, TXT, MD, code-files, CSV, JSON, «and many other text-based formats». DOCX/XLSX/PPTX **не упомянуты** — pre-extraction в text/plain.

### 4.2 xAI Responses API + `input_file` content

```bash
curl -X POST "https://api.x.ai/v1/responses" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4-1-fast-non-reasoning",
    "input": [{
      "role": "user",
      "content": [
        {"type": "input_text", "text": "What was the total revenue?"},
        {"type": "input_file", "file_id": "file-abc123"}
      ]
    }]
  }'
```

**Ключевые свойства (подтверждены Phase 1.5 диагностикой):**
- `document_search` (он же `attachment_search` в pricing) активируется автоматически.
- Можно несколько `input_file` в одном сообщении.
- Можно комбинировать с `input_image`.
- Streaming поддерживается.
- **Все 7 наших Grok моделей работают, включая non-reasoning** (Phase 1.5 R2).
- Не поддерживается batch mode (`n > 1`).

### 4.3 Pricing (источник: docs.x.ai + Phase 1.7 R6 подтверждение)

- **`attachment_search` / `document_search`: $10 / 1k calls.**
- Storage Files: не подтверждено (pricing page 404). Считаем 0 до уточнения.
- **🆕 Variable cost per-turn (Phase 1.6 R5 находка):** один user message = **1-6 document_search calls** в зависимости от сложности вопроса. Простой fact-lookup = 1 call ($0.01). Углублённый аналитический вопрос = до 6 calls ($0.06). Это **не bug, не неэффективность** — это agentic behaviour модели, которая сама решает сколько раз искать.
- **🆕 Точный cost доступен напрямую:** `response.usage.cost_in_usd_ticks` (тики USD) + `response.usage.server_side_tool_usage_details.document_search_calls` (счётчик calls). Не нужна эстимация по тарифу × токены. Не нужен `GET /v1/usage`.

### 4.4 Mapping models

Phase 1.5 R2 диагностика: **все 7 наших Grok моделей работают** с input_file:
- `grok-4-1-fast-reasoning` ✅
- `grok-4-1-fast-non-reasoning` ✅ (архивный ресёрч устарел)
- `grok-4.20-0309-reasoning` ✅
- `grok-4.20-0309-non-reasoning` ✅
- `grok-4.20-multi-agent-0309` ✅
- `grok-4-fast` (упомянут в docs) ✅
- `grok-4` ✅

→ Шаг 4 не блокируется выбором конкретной модели. Vladimir свободен ставить любую через `/dev/models`.

### 4.5 Multi-turn в нашей архитектуре

Phase 1.6 R5 закрыт: **server-side state не нужен.**

Мы пересылаем full conversation history с file_id на каждом turn. xAI делает дедуп файлов. Variable cost per-turn (1-6 calls) — это **agentic depth** конкретного вопроса, не накопление контекста. `encrypted_content` / `previous_response_id` этого не исправят.

Принимаем variable cost. Tracking через `cost_in_usd_ticks` даёт точную картину.

### 4.6 Vercel Blob — backup пути

Существующий паттерн `lib/ai/library/xai-collections.ts:147` (`uploadFile`, `purpose: "assistants"`) — образец.

**По умолчанию: Blob первым** (надёжнее). Если xAI упал — `chat_attachment` с `xaiFileId: null`, пользователю показываем «файл не загружен в обработчик».

### 4.7 Cron infrastructure (Phase 1.4 подтверждено)

`vercel.json` + 3 cron'а + `CRON_SECRET` Bearer auth. Reaper Phase 3 — 4-й entry.

---

## 5. Архитектурные решения (зафиксировано)

### 5.1 Bypass SDK через raw fetch wrapper

`@ai-sdk/xai@3.0.83` (latest на 2026-04-28) throw'ит `UnsupportedFunctionalityError` на `file` part кроме `image/*`. Upgrade SDK не помогает.

**Решение:** новый модуль `lib/ai/files/xai-files-client.ts` повторяет паттерн `xai-collections.ts`. Не миграция Library на Vector Stores, не custom AI SDK middleware.

### 5.2 Capability-routing на существующий `chat-vision` — product decision

**Phase 1.5 R2 нашёл:** все Grok'и (включая non-reasoning default) технически работают с input_file. Capability-routing **не требуется** для технической работоспособности.

**Но оставляем по product reason:** `chat-vision` становится «universal attachment routing slot». Назначение — единый контрол через `/dev/models` для контроля качества разбора файлов:
- Сейчас в панели стоит `grok-4-1-fast-non-reasoning` — дешёвая non-reasoning. Работает, но качество разбора больших документов средне
- Если завтра пользователи жалуются на качество ответов по PDF — Vladimir переключает в панели на `grok-4-1-fast-reasoning` или `grok-4.20-0309-reasoning`. Один клик
- Симметрично с image — давно работающий паттерн, не плодим новые routing slot'ы

Триггер расширяется с `image/*` на любой file part. Семантика обновляется.

### 5.3 Storage: отдельная таблица `chat_attachment`

```typescript
chat_attachment {
  id: uuid PK,
  chatId: uuid FK → Chat (onDelete: cascade),
  messageId: uuid FK → Message_v2 (onDelete: cascade),
  xaiFileId: text NULL,
  blobUrl: text NOT NULL,
  filename: text NOT NULL,
  mimeType: text NOT NULL,
  sizeBytes: integer NOT NULL,
  createdAt: timestamp NOT NULL DEFAULT now(),

  index on (chatId),
  index on (xaiFileId)
}
```

`Message_v2.attachments` JSON остаётся как UI metadata. Без unique constraint — допускаем дубли в рамках чата.

### 5.4 Удаление inline-text path в chat (узкий скоуп)

`convertTextFilePartsInMessage` + `convertTextFilesInAllMessages` (3 call sites), file-text strip, эвристика 50K trim — удалить полностью.

**`pdf-parse` и `lib/pdf/extract-pdf-text.ts` остаются** (Library auto-analyze + Project files). Уйдут естественным путём в будущих ТЗ.

### 5.5 Lifecycle: explicit cleanup function + background reaper

`deleteChatWithCleanup(chatId)`:
1. Read `chat_attachment` записи
2. `DELETE FROM chat` (cascade)
3. Async `Promise.allSettled` cleanup xAI + Blob

Reaper (cron, daily): list xAI files старше 24h → если нет в `chat_attachment` → delete.

### 5.6 Backward compat для 28 legacy сообщений (R8)

Расширить `stripOldAttachmentsFromHistory`: блок «text/plain file parts → strip из ВСЕЙ истории» (не только последних 2 user-msgs). Заменяется на `[Ранее был прикреплён файл]`. 5 строк кода.

### 5.7 Pricing — variable cost, точное tracking

**Pricing model уточнён Phase 1:**
- Cost per-turn: 1-6 attachment_search calls × $0.01 = **$0.01-0.06 per user message**
- **Не эстимируем — забираем точное число из `response.usage.cost_in_usd_ticks`**
- Высокая стоимость (5-6 calls per-turn) сигналит сложный аналитический вопрос — это норма, не bug

ROI: экономим сотни тысяч токенов в payload, тратим $0.01-0.06 за вызов. Положительный с большим запасом.

### 5.9 Phase 3.5 — Smoke-data hot-fix (post-deployment, отступление от §5.6)

**Контекст (29-04 после Phase 3 деплоя):** в smoke-чате 3353a183 обнаружен биллинг-спайк (input 166K, fresh 42K + хвост 33K на следующих turn'ах vs ~5K baseline). Корень — Phase 3 коммит удалил UI-детектор маркера `📄 **Файл:` в `components/message.tsx`, нарушив §5.6 (R8). Legacy сообщения (23 шт, ~720K токенов) визуально раскрылись и продолжили уходить в xAI.

**Решение для smoke-окружения:** полный DELETE данных chat 3353a183 (Message_v2, Stream, memory_entry по userId, chat_attachment cascade). Chat row сохранён, ai_usage_log сохранён.

**Отступление от §5.6:** SPEC запрещал backfill — «strip покрывает». Phase 3.5 идёт другим путём (DELETE), потому что chat — smoke-only, владелец не нуждается в сохранении контента и MIND. **Для prod-deployments §5.6 остаётся в силе** — Phase 3.5 не отменяет архитектурный план, применима только к dev/staging.

**Документация:** [ROADMAP Phase 3.5](ROADMAP.md#phase-35), [FINDINGS Finding #8](FINDINGS.md).

---

### 5.8 🆕 Cost tracking в `ai_usage_log`

В Phase 2 при обработке Responses API stream:
- Парсим `response.usage` финального chunk'а
- Извлекаем `cost_in_usd_ticks` (конвертируем в доллары: tick / 1e9 или согласно xAI единицам — уточнить в Phase 2.1)
- Извлекаем `server_side_tool_usage_details.document_search_calls`
- Пишем в `ai_usage_log` с новой колонкой `serverSideToolCalls` (тип json) для полной observability

Это **не** новая инфраструктура — расширение существующего usage tracking. Точные деньги (не эстимация) дают:
- Корректный billing
- Видимость «дорогих» вопросов (5-6 calls)
- A/B сравнение моделей по реальной стоимости

---

## 6. Риски и митигации

| # | Риск | Уровень | Статус | Митигация |
|---|---|---|---|---|
| **R1** | xAI Files API rate limit hit на массовых uploads | 🟡 Средний | OPEN | Phase 2: retry с exponential backoff. Если жёсткий rate limit — sequential queue. |
| **R2** | Recommended models в docs не совпадают с нашими model id | 🟢 Низкий | ✅ **CLOSED Phase 1.5** | Все 7 наших Grok моделей работают с input_file. |
| **R3** | Non-reasoning Grok не поддерживает Files API | 🟢 Низкий | ✅ **CLOSED Phase 1.5** | Архивный ресёрч TZ_ModelCatalogDocumentFlags устарел. Non-reasoning принимает input_file и активно делает document_search. |
| **R4** | DOCX/XLSX через Files API упадёт | 🟢 Низкий | OPEN | Phase 4 manual test. Если падает — fallback на старый path. Теоретический риск. |
| **R5** | Multi-turn token cost — нужен server-side state? | 🟢 Низкий | ✅ **CLOSED Phase 1.6** | Variable per-turn = 1-6 document_search calls в зависимости от сложности вопроса (agentic depth). Не накопление контекста. Server-side state не помогает. Принимаем variable cost через cost_in_usd_ticks tracking. |
| **R6** | Стоимость per-call неопределённа | 🟢 Низкий | ✅ **CLOSED Phase 1.7** | `response.usage.cost_in_usd_ticks` + `server_side_tool_usage_details.document_search_calls` дают точные числа per-turn. Нет необходимости в GET /v1/usage. |
| **R7** | Background reaper удаляет ещё нужные файлы (race с upload) | 🟡 Средний | OPEN | Reaper только для файлов старше 24 часов. Strict join. |
| **R8** | Legacy сообщения с text/plain file parts (28 в БД) упадут после удаления `convertTextFilesInAllMessages` | 🟡 Средний | OPEN | Strip text/plain в `stripOldAttachmentsFromHistory` для всей истории (§5.6, §2.1 п.10). |
| **R9** | Pre-cascade hook в Drizzle сложно реализовать | 🟢 Низкий | OPEN | Explicit функция `deleteChatWithCleanup`. |
| **R10** | UI карточек для DOCX/XLSX/CSV не существует | 🟢 Низкий | OPEN | После удаления `convertTextFilePartsInMessage` все file parts через `attachmentsFromMessage`. Specific иконки — отдельный ТЗ. |
| **R11** | Незакоммиченная правка `lib/ai/registry.ts` | 🟢 Низкий | OPEN | Pre-Phase 1: Vladimir решает. |
| **R12** | Library auto-analyze / Project files сломаются после правки upload route | 🟢 Низкий | OPEN | Разные pipeline'ы, общий только импорт. Phase 3 typecheck подтвердит. |

---

## 7. Критерии приёмки

### 7.1 Code-level

1. ✅ Модуль `lib/ai/files/xai-files-client.ts` создан с типизированными ответами
2. ✅ Drizzle миграция: таблица `chat_attachment` с FK cascade, индексами
3. ✅ Развилка в `route.ts`: file attachments → Responses API; иначе streamText
4. ✅ Capability-routing расширен на все file mediaType
5. ✅ `lib/ai/vision-ocr.ts` отсутствует (Шаг 3 — проверка)
6. ✅ `convertTextFilePartsInMessage` и `convertTextFilesInAllMessages` отсутствуют, **все три** call sites убраны
7. ✅ Блок file-text strip в `stripOldAttachmentsFromHistory` удалён
8. ✅ Расширение `stripOldAttachmentsFromHistory` добавлено: text/plain strip из всей истории
9. ✅ `PDF_TEXT_MAX_CHARS` отсутствует в `upload/route.ts`
10. ✅ Import `extractPdfText` отсутствует в `upload/route.ts`
11. ✅ `lib/pdf/extract-pdf-text.ts` **остаётся** (Library + Projects — out of scope)
12. ✅ npm dep `pdf-parse` **остаётся**
13. ✅ В `model-catalog.ts` **все 7 Grok моделей** имеют `documentSupport: { supported: true, method: "files-api", maxSizeMb: 48 }`
14. ✅ **🆕 Cost tracking:** при streaming Responses API парсится `usage.cost_in_usd_ticks` и `document_search_calls`, пишется в `ai_usage_log`
15. ✅ `pnpm typecheck` без ошибок
16. ✅ `pnpm build` без ошибок
17. ✅ `grep -rn "convertTextFilePartsInMessage\|convertTextFilesInAllMessages" lib/ app/` → 0 hits
18. ✅ `grep -rn "extractPdfText" app/(chat)/api/files/upload/` → 0 hits (но в `lib/text-extraction/` и `app/(chat)/api/projects/` остаётся — OK)

### 7.2 Manual tests

19. ✅ **Test PDF**: текстовый PDF → ответ от Grok с реальным содержанием, в payload `"file_id"`, не содержит `"application/pdf"` binary
20. ✅ **Test PDF скан**: сканированный PDF → ответ с OCR-данными
21. ✅ **Test DOCX**: ответ с данными из документа
22. ✅ **Test XLSX**: ответ с данными из таблицы
23. ✅ **Test CSV/TXT/MD**: каждый формат работает
24. ✅ **Test multi-turn**: 3 разных вопроса по одному файлу. Cost per-turn варьируется 1-6 calls (зафиксировать в VERIFICATION) — это ожидаемо, не bug
25. ✅ **Test image** (регрессия): JPEG через native vision
26. ✅ **Test регрессия Library**: librarySearch работает
27. ✅ **Test регрессия Library auto-analyze**: новый PDF в Library → autoSummary/autoTags генерируются (pdf-parse работает)
28. ✅ **Test регрессия Project files**: загрузить файл в Проект — работает
29. ✅ **Test legacy сообщений** (R8): открыть один из 28 чатов → новое сообщение проходит без `UnsupportedFunctionalityError`. Старые маркеры заменены на `[Ранее был прикреплён файл]`
30. ✅ **Test 685K baseline**: документ ~2-3 MB в новом чате → tokenCount ~50, не 685K
31. ✅ **Test cleanup на DELETE chat**: через 5 минут `GET /v1/files/${xaiFileId}` → 404; Blob удалён
32. ✅ **🆕 Test cost tracking**: после ответа от Responses API в `ai_usage_log` появилась запись с непустым `cost_in_usd_ticks` и `document_search_calls`. Сравнить с Phase 1.6 baseline (1-6 calls per-turn)

### 7.3 Diagnostic gates ✅ ВСЕ ЗАКРЫТЫ

33. ✅ **Phase 1.5 R2 диагностика**: все 7 Grok работают
34. ✅ **Phase 1.6 R5 диагностика**: variable agentic depth, не накопление. Server-side state не нужен
35. ✅ **Phase 1.7 R6 диагностика**: cost tracking через response.usage

### 7.4 Documentation

36. ✅ `docs/ai-chats-map.md` — chat-путь файлов
37. ✅ `docs/ai-providers.md` — xAI Files API use case
38. ✅ Commit messages по фазам

---

## 8. Тестирование (ручное)

### 8.1 Test data

- Текстовый PDF ~10 страниц
- Сканированный PDF
- DOCX с разными стилями
- XLSX 2-3 листа
- CSV 100+ строк
- MD/TXT
- JPEG
- 30+ MB PDF (проверить 48 MB limit)

### 8.2 Test scenarios

#### Test PDF text (R3 Шага 3 закрыт)

1. Свежий чат, текстовый PDF
2. «Перечисли ключевые пункты»
3. **Ожидание:** ответ содержит конкретные пункты
4. DevTools → Network → payload содержит `"file_id"`, НЕ `"application/pdf"` base64

#### Test 685K baseline

1. Свежий чат, документ ~2-3 MB (или из chat 3353a183 c7853a33 originalFileUrl)
2. Загрузить + тот же вопрос
3. `SELECT tokenCount FROM Message_v2 WHERE id = (last user)`
4. **Ожидание:** ~50, не 685K
5. VERIFICATION.md: `Before 685K, After ${actual}, Reduction ${ratio}`

#### Test multi-turn — variable cost (R5 expectation)

1. DOCX 50K char, 3 turn
2. Turn 1: «Краткое содержание» — простой → ожидаем ~1 document_search call
3. Turn 2: «Какие ключевые цифры в разделе X?» — углублённый → ожидаем 4-6 calls
4. Turn 3: «Таблица всех дат» — структурированный → ожидаем 1-2 calls
5. **Pass:** все turns отвечают корректно. Cost per-turn варьируется. В `ai_usage_log` видно `document_search_calls` для каждого

Это **не STOP**, это expected agentic behaviour. Variable cost зафиксировать в VERIFICATION.

#### Test legacy сообщений (R8)

1. Найти один из 28 чатов с маркером `📄`
2. Открыть в UI
3. Отправить новое сообщение
4. **Ожидание:** ответ без error, старые маркеры → `[Ранее был прикреплён файл]`

#### Test cleanup

1. Свежий чат, PDF
2. `SELECT xaiFileId FROM chat_attachment WHERE chat_id = ...`
3. `GET /v1/files/${xaiFileId}` → metadata
4. Удалить чат
5. Через 1-2 мин: `GET /v1/files/${xaiFileId}` → 404
6. Blob удалён

#### Test Library auto-analyze регрессия

1. Новый PDF в Library
2. **Ожидание:** autoSummary/autoTags/autoDescription как раньше — pdf-parse работает

#### Test Project files регрессия

1. Файл в режим Проект
2. **Ожидание:** работает как раньше — pdf-parse работает

#### Test image регрессия

1. JPEG в чат
2. «Что на картинке»
3. **Ожидание:** native vision, без изменений

#### 🆕 Test cost tracking

1. Любой чат с PDF + сложный аналитический вопрос («сравни X и Y, выведи закономерность»)
2. После ответа: `SELECT * FROM ai_usage_log ORDER BY created_at DESC LIMIT 1`
3. **Ожидание:** запись содержит `costUsd` (точная цифра, не приближение по тарифу × токены), `serverSideToolCalls` JSON с `document_search_calls: N` где N в 1-6

### 8.3 Записать в `VERIFICATION.md`

По каждому из 32 acceptance criteria — Pass / Fail / N/A с notes.

---

## 9. Документация для обновления

### 9.1 `docs/ai-chats-map.md`

Удалить (для chat):
- pdf-parse path
- эвристика 30 chars/page
- inline-text для DOCX/XLSX/CSV

Добавить:
- xAI Files API path для всех вложений в чате
- Capability-routing на `chat-vision`
- Variable agentic depth note

### 9.2 `docs/ai-providers.md`

xAI: добавить «Files API + document_search» с pricing $10/1k, **note про variable per-turn cost**.

### 9.3 `model-catalog.ts` комментарии

Обновить inline комментарии для всех 7 Grok'ов: «xAI Files API integrated, all models support input_file (Phase 1.5 verified)».

### 9.4 SIMPLY_ITOG_UPDATED.md (Vladimir после приёмки)

- Шаг 4 закрыт
- inline-text path в chat удалён
- chat 3353a183 baseline: 685K → ~50
- R3 Шага 3 закрыт
- **🆕 Findings из Phase 1:** все Grok'и поддерживают Files API; variable per-turn cost — agentic depth, не накопление; cost tracking через response.usage
- Backlog: миграция Library auto-analyze и Project files — отдельные ТЗ

---

## 10. Размер ТЗ и ожидание

**Среднее ТЗ.** ~5-9 часов работы Claude Code, разбито на 3 фазы.

**Phase 1 (Audit + диагностика)** — ✅ ЗАВЕРШЕНА (2026-04-28).
**Phase 2 (Foundation)** — 3-4 часа. Pass: smoke test PDF в свежем чате через Files API, cost tracking в ai_usage_log.
**Phase 3 (Cleanup + Lifecycle + backward compat)** — 2-4 часа. Финальный VERIFICATION.

**После приёмки** → переход к **Шагу 5 (Web Tools)**.

---

## 11. Ссылки

- Концепт миграции: `specs/Simply_Migration/SIMPLY_MIGRATION_CONCEPT.md`, Блок 3
- Phase 0 audit: `specs/Simply_Migration/TZ_FilesAPIMigration/ANALYSIS.md`, `FINDINGS.md`
- Phase 1 findings: `specs/Simply_Migration/TZ_FilesAPIMigration/PHASE1_FINDINGS.md`
- Шаг 3: `specs/Simply_Migration/TZ_VisionOcrCleanup/`
- xAI Files API docs: `https://docs.x.ai/developers/files/managing-files`
- xAI Chat with Files: `https://docs.x.ai/developers/model-capabilities/files/chat-with-files`
- xAI Tools overview: `https://docs.x.ai/developers/tools/overview`
- xAI models pricing: `https://docs.x.ai/developers/models`
- Образец raw fetch wrapper: `lib/ai/library/xai-collections.ts`
