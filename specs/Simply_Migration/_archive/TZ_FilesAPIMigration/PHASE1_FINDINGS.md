# Phase 1 Findings — Simply_Migration · Шаг 4 · Files API Migration

**Дата:** 2026-04-28
**Образец:** ROADMAP v2 §1.8
**Источник R2/R5/R6:** `scripts/diagnose-xai-files-models.ts` (удалён после Phase 1, как требовал ROADMAP §1.10).

---

## Резюме

| Раздел | Статус | Ключевой вывод |
|---|---|---|
| 1.1 Карта удалений | ✅ | 3 call sites `convertTextFilesInAllMessages` (route.ts:283, 652, 1157) — не 2. `pdf-parse` живёт в 3 местах, в скоупе только chat. |
| 1.2 Образец xai-collections | ✅ | Шаблон готов, скопировать паттерн raw fetch + AbortController + typed errors. |
| 1.3 Backward compat scope | ✅ | 28 messages с `📄` маркером в БД. Митигация — strip в `stripOldAttachmentsFromHistory`. |
| 1.4 Cron infrastructure | ✅ | 3 cron'а в `vercel.json` + `CRON_SECRET` Bearer. Reaper встраивается как 4-й entry. |
| 1.5 R2 диагностика | ✅ **сюрприз: R3 риск отменяется** | **Все 7 моделей** (включая non-reasoning) принимают `input_file` и делают `document_search`. Архивный ресёрч TZ_ModelCatalogDocumentFlags устарел. |
| 1.6 R5 диагностика | ⚠️ **STOP-условие сработало (ratio 1.62)**, но природа другая | Не «full re-search документа», а **варьирующая глубина агентского поиска per-turn**. Turn 2 сделал 6 search calls (вопрос требовал множественного поиска), Turns 1/3 по 1 calls. Server-side state не помогает. |
| 1.7 R6 диагностика | ✅ | `response.usage.server_side_tool_usage_details.document_search_calls` отдаётся в каждом ответе. `GET /v1/usage` не существует (404), но не нужен — все детали уже есть. |

**Решение:** Phase 1.5 (R2 PASS) и 1.7 (R6 PASS) разрешены. **Phase 1.6 (R5) — эскалация архитектору** перед стартом Phase 2: природа ratio 1.62 не требует server-side state, но ROADMAP STOP-условие формально сработало; архитектору решать корректировать SPEC или продолжать.

---

## 1.1 Карта удалений (для Phase 3)

| Где | Что | В Phase 3? | Out of scope? |
|---|---|---|---|
| `lib/pdf/extract-pdf-text.ts` | Файл целиком | ❌ Нет | ✅ Да — используется Library + Projects |
| `app/(chat)/api/files/upload/route.ts:6,183` | Import + call site `extractPdfText` + branch | ✅ Удалить | — |
| `app/(chat)/api/files/upload/route.ts:8` | `PDF_TEXT_MAX_CHARS = 50_000` | ✅ Удалить | — |
| `lib/text-extraction/extract.ts:12,105` | Import + call site `extractPdfText` | ❌ Нет | ✅ Library auto-analyze |
| `app/(chat)/api/projects/[id]/files/route.ts:12,86` | Import + call site `extractPdfText` | ❌ Нет | ✅ Project files pipeline |
| `app/(chat)/api/chat/route.ts:233-274` | Функция `convertTextFilePartsInMessage` | ✅ Удалить | — |
| `app/(chat)/api/chat/route.ts:280-284` | Функция `convertTextFilesInAllMessages` (batch wrapper) | ✅ Удалить | — |
| `app/(chat)/api/chat/route.ts:283` | Call site #1 (внутри `convertTextFilesInAllMessages`) | ✅ Удалить | — |
| `app/(chat)/api/chat/route.ts:652` | Call site #2 (на новом user-сообщении до подсчёта `newMessageTokens`) | ✅ Удалить | — |
| `app/(chat)/api/chat/route.ts:1157` | Call site #3 (батч на исторические сообщения для всех chat modes) | ✅ Удалить | — |
| `app/(chat)/api/chat/route.ts:343-352` | Блок file-text strip (Fix 2 из TZ_SimplyChatBillingLeak) | ✅ Удалить | — |
| `app/(chat)/api/chat/route.ts:322-384` | `stripOldAttachmentsFromHistory` целиком | ❌ Не удалять, **расширить** для R8: добавить strip text/plain file parts из всей истории | — |
| `lib/utils.ts:370` | Комментарий ссылается на `convertTextFilePartsInMessage` | ✅ Обновить | — |
| `lib/ai/tools/chat-tools.ts:55` | Комментарий ссылается на `convertTextFilesInAllMessages` | ✅ Обновить | — |
| `components/message.tsx:356` | TODO про маркер `📄 **Файл:` (детектор UI-фикса v3.100.5) | ✅ Удалить | — |

`grep "vision-ocr|extractTextFromImage|extractTextFromPDF"` возвращает **0 hits** — Шаг 3 закрыл чисто.

---

## 1.2 Образец xai-collections.ts — шаблон для xai-files-client.ts

**Файл:** [lib/ai/library/xai-collections.ts](../../../lib/ai/library/xai-collections.ts) (318 строк).

| Аспект | Значение |
|---|---|
| Импорты | Только `./citations-parser`, `./types`. **Нет `node:fs`** — всё через `Buffer/ArrayBuffer/Blob`. |
| Auth | `process.env.XAI_API_KEY` через геттер `apiKey()`, throw'ит `Error` если не задан. Header: `Authorization: Bearer ${authKey}`. |
| Endpoints | `https://api.x.ai/v1` (files + search), `https://management-api.x.ai/v1` (collections CRUD). Для нашего Files-only — только `api.x.ai/v1/files`. |
| Timeout | `REQUEST_TIMEOUT_MS = 30_000` через `AbortController` + `setTimeout`. |
| Errors | Простой `throw new Error(...)` с `${response.status} ${response.statusText} at ${url}: ${text}`. Для Phase 2 ROADMAP требует typed `XaiFilesApiError extends Error` — это шаг вперёд от шаблона. |
| Retry | **Нет** в xai-collections.ts. Phase 2 ROADMAP требует «retry на 5xx (1 попытка с 1с задержкой)» — добавлять как улучшение шаблона. |
| Multipart upload | `FormData` + `new Blob([copy], { type })` (line 159-165 в `uploadFile`). Точно тот же путь нужен в `xaiUploadFile`. |
| Content-Type гейт | callJson сам не ставит `Content-Type` если body — FormData (line 62). Обязательно сохранить в новой клиентке. |
| 204 / non-JSON ответы | `if (response.status === 204) return undefined; if (!contentType.includes("application/json")) return undefined;` (line 77-83). |

**Diff против Phase 2 ROADMAP §2.1 требований:**
- ✅ `fetch` напрямую — да
- ✅ `Authorization: Bearer ${process.env.XAI_API_KEY}` — да
- ✅ multipart/form-data через FormData + Blob — да
- ⚠ Retry на 5xx — НЕТ в шаблоне, добавляем сами
- ⚠ Typed `XaiFilesApiError` — НЕТ в шаблоне, добавляем сами
- ✅ JSDoc — частично есть (как комментарии вверху функций)

Совместимо. Никаких паттернов несовместимых с chat upload (STOP-условие #3 Phase 1.9 — снято).

---

## 1.3 Backward compat scope (R8)

```sql
SELECT COUNT(*) AS total_messages,
       COUNT(*) FILTER (WHERE attachments::text != 'null' AND attachments::text != '[]') AS with_attachments_json,
       COUNT(*) FILTER (WHERE jsonb_path_exists(parts::jsonb, '$[*] ? (@.type == "file")')) AS with_file_part,
       COUNT(*) FILTER (WHERE parts::text LIKE '%📄 **Файл:%') AS with_file_marker
FROM "Message_v2";
```

| Поле | Значение |
|---|---|
| Total messages в БД | **551** |
| `attachments` JSON непустой | **0** (поле всегда `[]`) |
| Сообщений с `file` part | **42** |
| Сообщений с маркером `📄 **Файл:` (text part после `convertTextFilePartsInMessage`) | **28** |

**Митигация (SPEC §5.6):** расширить `stripOldAttachmentsFromHistory` блоком strip `file` parts с `mediaType === "text/plain"` из ВСЕЙ истории (не только до последних 2 user-msgs). Маркер `📄 **Файл:` уже есть в существующем strip-блоке (Fix 2 из TZ_SimplyChatBillingLeak), но он удаляется в Phase 3 §3.3 — нужно сохранить семантику в новом расширении (text/plain file parts → placeholder).

**Backfill 28 сообщений не делаем** (cost vs benefit низкий).

---

## 1.4 Cron infrastructure

**`vercel.json`:**
```json
{
  "crons": [
    { "path": "/api/cron/memory-deep-consolidate", "schedule": "0 22 * * *" },
    { "path": "/api/cron/memory-profile",          "schedule": "0 0 * * *"  },
    { "path": "/api/cron/briefing",                "schedule": "0 5 * * *"  }
  ]
}
```

**Auth pattern** (`app/api/cron/memory-profile/route.ts:26-31`):
```typescript
const authHeader = request.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return new Response("Unauthorized", { status: 401 });
}
```

**Reaper в Phase 3:** добавить 4-й entry `/api/cron/reap-attachments` со schedule `0 3 * * *` (3 утра, между briefing 5:00 и memory-profile 0:00). Использовать тот же `CRON_SECRET` Bearer pattern.

---

## 1.5 R2 диагностика — какие model id принимают input_file

**Тестовый PDF:** «Выбор кофемашины для офиса» (4 страницы, ~12 KB), скачан из существующего chat 3353a183 → Vercel Blob.
**Метод:** Upload в xAI Files API → `POST /v1/responses` с `{type:"input_file", file_id}` для каждой модели → проверка что ответ упоминает «кофемашин» / «кофе» / «офис».

| model_id | accepted | content extracted | input_tokens | doc_search_calls | preview |
|---|---|---|---:|---:|---|
| `grok-4-1-fast-reasoning` | ✅ 200 | ✅ | 7871 | 3 | «Этот документ — руководство по выбору кофемашины для офиса...» |
| `grok-4-1-fast-non-reasoning` | ✅ 200 | ✅ | 3985 | 1 | «**Документ — это руководство на русском языке по выбору кофемашины для офиса**» |
| `grok-4.20-0309-reasoning` | ✅ 200 | ✅ | 4457 | 0 | «Подробное руководство... под названием «Выбор кофемашины для офиса»» |
| `grok-4.20-0309-non-reasoning` | ✅ 200 | ✅ | 8996 | 1 | «Правильная кофемашина — это инвестиция в продуктивность и настроение команды» (точно процитировал заголовок) |
| `grok-4.20-multi-agent-0309` | ✅ 200 | ✅ | 25053 | 1 | «Подробный гид по выбору кофемашины для офиса...» |
| `grok-4-fast` (из docs) | ✅ 200 | ✅ | 4481 | 1 | «Документ "test-coffee-machine.pdf" представляет собой руководство...» |
| `grok-4` (из docs) | ✅ 200 | ✅ | 5650 | 1 | «Этот документ — это руководство по выбору кофемашины для офиса...» |

**Вывод:** **все 7 model id работают с `input_file`**, включая **non-reasoning** варианты. Архивный ресёрч TZ_ModelCatalogDocumentFlags (2026-03-XX) который утверждал «Files API только agentic-моделям» — **устарел** к 2026-04-28.

**Импликация для SPEC:**
- **R3 риск отменяется** — `simply-chat` default на `grok-4-1-fast-non-reasoning` физически работает с Files API.
- **Capability-routing на `chat-vision` для PDF — необязателен по технической причине.** Может оставаться по UX-консистентности (все вложения через одну модель), но не ради «non-reasoning не умеет».
- **Phase 2.7 model-catalog обновление:** все 5 наших Grok моделей (включая non-reasoning) → `documentSupport: { supported: true, method: "files-api", maxSizeMb: 48 }`. Архитектор может решить ограничить только reasoning по продуктовым соображениям.

**STOP-условие #1 ROADMAP §1.9** — снято. Минимум одна reasoning Grok работает + бонус: все non-reasoning тоже.

---

## 1.6 R5 диагностика — multi-turn cost ratio

**Метод:** один файл (тот же 4-страничный PDF), 3 последовательных запроса к `grok-4-1-fast-reasoning` через `POST /v1/responses` с тем же `file_id`, разные вопросы.

| Turn | Question | input_tokens | output_tokens | cached | doc_search_calls | cost_ticks |
|---|---|---:|---:|---:|---:|---:|
| 1 | «Дай краткое содержание в 3-4 предложениях» | 4498 | 1018 | 1379 | **1** | 62,017,500 |
| 2 | «Какие конкретные модели кофемашин упомянуты?» | 7300 | 2030 | 3894 | **6** | 318,909,000 |
| 3 | «Какие критерии выбора предложены?» | 4295 | 1258 | 1916 | **1** | 62,006,000 |

**Ratio Turn2/Turn1 = 7300 / 4498 = 1.62**

**Формально STOP-условие #2 ROADMAP §1.9 сработало** (ratio > 1.5). Но природа отличается от того, что ожидал ROADMAP §1.6:

- ROADMAP ожидал «full re-search документа на каждом turn» → решение «server-side state (encrypted_content)».
- Фактически: **разные вопросы требуют разной глубины агентского поиска**. Turn 2 («перечисли все упомянутые модели») заставил модель сделать 6 `document_search_calls` (она искала по разным фрагментам документа), Turns 1 и 3 обошлись 1 search call.
- xAI **уже кэширует** input — `cached_tokens`: Turn 1 = 1379/4498 = 31%, Turn 2 = 3894/7300 = 53%, Turn 3 = 1916/4295 = 45%. Документ не «загружается заново».
- **Server-side state (encrypted_content) этого не исправит** — это не lossy continuity, это intentional agentic search depth, контролируемая моделью.

**Cost variance:**
- Turn 1: 62 млн ticks
- Turn 2: 319 млн ticks (5.1× от Turn 1) — за счёт +5 document_search calls
- Turn 3: 62 млн ticks

Если предположить 1 tick = 1 nano-USD (нужно подтвердить через console.x.ai): Turn 1 ≈ $0.062, Turn 2 ≈ $0.32, Turn 3 ≈ $0.062. **Реальная цена для пользователя — variance per-turn.**

**Open question архитектору:**
- Принимаем variance ($0.06-$0.32/turn в зависимости от агентского поведения)?
- Или нужен **rate-limit per-turn** на стороне Simply (например cap на 3 `document_search_calls` через Responses API параметр, если он существует)?
- Или ограничить через product UX (предупреждение пользователю «сложный вопрос потратит больше»)?

**Моя рекомендация (как Claude Code, в пределах своей роли):** не делать архитектурного решения сейчас, проинформировать архитектора о реальной природе ratio, ждать его решения. Это не блокер для Phase 2 — даже с variance Шаг 4 принципиально работает и закрывает 685K-portyanka problem. Архитектор может корректировать SPEC отдельно.

---

## 1.7 R6 диагностика — что считается attachment_search call

**`GET /v1/usage`** → 404 Not Found. Endpoint не существует.

**Но не нужен** — детальный per-call breakdown уже отдаётся в каждом `response.usage`:

```json
{
  "input_tokens": 4498,
  "input_tokens_details": { "cached_tokens": 1379 },
  "output_tokens": 1018,
  "output_tokens_details": { "reasoning_tokens": 798 },
  "total_tokens": 5516,
  "num_sources_used": 0,
  "num_server_side_tools_used": 1,
  "cost_in_usd_ticks": 62017500,
  "server_side_tool_usage_details": {
    "web_search_calls": 0,
    "x_search_calls": 0,
    "code_interpreter_calls": 0,
    "file_search_calls": 0,
    "mcp_calls": 0,
    "document_search_calls": 1
  }
}
```

**Что считается attachment_search call:** `server_side_tool_usage_details.document_search_calls`. На наших 3 R5 turns это **1, 6, 1** соответственно — то есть **1 user message ≠ 1 call** (модель сама решает по агентскому loop'у).

Pricing $10/1k применяется к `document_search_calls`. Для cost tracking нужно агрегировать `usage.cost_in_usd_ticks` (или вычислять из `document_search_calls × $0.01 + tokens × prices`).

**Импликация для Phase 2:**
- В StreamObservability (или где сейчас собирается AppUsage) добавить парсинг `server_side_tool_usage_details` из Responses API ответов.
- В DevPanel показывать `document_search_calls` per-turn как новую метрику.
- Поле `cost_in_usd_ticks` — официальный xAI расчёт цены, можно использовать для cost tracking (нужно подтвердить unit: 1 tick = 1 nano-USD?).

---

## STOP-условия Phase 1 (итог)

| # | Условие | Сработало? | Решение |
|---|---|---|---|
| 1 | Ни одна reasoning Grok не работает с input_file (R2) | ❌ Нет — все 7 моделей работают | Снято. |
| 2 | Multi-turn ratio > 1.5 (R5) | ⚠️ Сработало формально (1.62), но природа не «full re-search» | **Эскалирую архитектору** перед Phase 2 — нужно ли корректировать SPEC. |
| 3 | xai-collections.ts incompatible patterns | ❌ Нет — паттерны совместимы | Снято. |
| 4 | Неожиданные hits в grep'ах (мёртвый код) | ✅ Сработало в Phase 0 (extractPdfText в 3 местах + 3-й call site) — закрыто SPEC v2 | Снято. |

**Phase 1 итог:** диагностика прошла, но Phase 1.6 STOP по R5 формально требует эскалации архитектору. Жду решения архитектора по природе variance — корректирует ли SPEC §6 R5 митигацию или оставляет «продолжать без encrypted_content, accepting cost variance».

---

## Расход на Phase 1 диагностику

- 7 R2 calls + 3 R5 calls + 1 R6 GET = ~11 API calls
- Sum input_tokens (R2): 60,493 + R5: 16,093 = 76,586 input tokens
- Sum output_tokens: ~7,677 + 4,306 = ~12K output tokens
- Sum doc_search_calls (R2 + R5): 7 + 8 = **15 calls × $0.01 = $0.15**
- Tokens cost: ~76K input × $0.20/M + 12K output × $0.50/M ≈ $0.02
- **Итого: ~$0.17** — в пределах оценки $0.10-0.30 ✅

Файл скрипта удалён после прогона (per ROADMAP §1.10).

---

## Что дальше

**До старта Phase 2 — жду решение архитектора по R5.** Phase 1 не коммитится (per ROADMAP §1.10). PHASE1_FINDINGS.md в working tree, коммит вместе с Phase 2.

**Если архитектор подтверждает «продолжать»** — Phase 2 начинаю с §2.1 (`xai-files-client.ts`).

**Если корректирует SPEC** — перечитываю изменения, пересматриваю TodoWrite, после OK от Vladimir стартую Phase 2.
