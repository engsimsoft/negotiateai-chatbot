# ANALYSIS — TZ_ModelCatalogDocumentFlags

**Дата:** 2026-04-14
**Цель:** независимая верификация данных ТЗ против официальной документации провайдеров (правило #1).

---

## Изученная документация

| Провайдер | URL | Дата фетча | Статус |
|---|---|---|---|
| Anthropic PDF | https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support | 2026-04-14 | ✅ полный текст получен |
| xAI Files | https://docs.x.ai/docs/guides/files | 2026-04-14 | ✅ |
| Perplexity Files | https://docs.perplexity.ai/guides/file-attachments | 2026-04-14 | ✅ |
| MiniMax Anthropic-compat | https://platform.minimax.io/docs/api-reference/text-anthropic-api.md | 2026-04-13 (предыдущая сессия) | ✅ verified в `project_minimax_catalog_audit.md` |
| Google Gemini documents | — не фетчил | — | ⚠️ не нужно: Gemini-моделей в каталоге нет (есть только TTS, документы не принимает) |

---

## Anthropic Claude — PDF Support

**Источник:** https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support

### Ключевые лимиты (точные цитаты из docs)

| Параметр | Значение |
|---|---|
| **Maximum request size** | **32 MB** (varies by platform) |
| **Maximum pages per request** | **600** (для моделей с context window > 200K), **100** (для моделей с 200K-token context window) |
| **Format** | Standard PDF (no passwords/encryption) |
| **Доп. плата** | НЕТ. «Standard API pricing applies with no additional PDF fees» |

> **«Both limits are on the entire request payload, including any other content sent alongside PDFs.»**

### Методы доставки (3 варианта)
1. **URL reference** — `{ type: "document", source: { type: "url", url: "..." } }`
2. **Base64 inline** — `{ type: "document", source: { type: "base64", media_type: "application/pdf", data: "..." } }`
3. **Files API (beta `files-api-2025-04-14`)** — `{ type: "document", source: { type: "file", file_id: "..." } }`

### Поддерживаемые модели
Цитата: **«All active models support PDF processing»**

### Применение к нашему каталогу

| catalog id | context window | maxPages |
|---|---|---|
| `claude-sonnet-4-6` | 1,000,000 | **600** |
| `claude-haiku-4-5-20251001` | 200,000 | **100** |
| `claude-opus-4-6` | 1,000,000 | **600** |
| `claude-sonnet-4-5-20250929` | 200,000 | **100** |

> ⚠️ **Расхождение с ТЗ:** ТЗ указывал 100 страниц для всех Claude моделей. Это неверно — для моделей с 1M контекстом (Sonnet 4.6, Opus 4.6) лимит **600 страниц**. Для моделей с 200K контекстом (Haiku 4.5, Sonnet 4.5 legacy) — 100. Это критично: 6× разница в реальных возможностях.

### Caveats (из docs)
- «Dense PDFs (many small-font pages, complex tables, or heavy graphics) can fill the context window before reaching the page limit»
- «Requests with large PDFs can also fail before reaching the page limit, even when using the Files API»
- Each page typically uses 1,500-3,000 tokens

---

## xAI Grok — Files API

**Источник:** https://docs.x.ai/docs/guides/files

### Ключевые требования
| Параметр | Значение |
|---|---|
| **Maximum file size** | **48 MB** per file |
| **Поддерживаемые модели** | «Requires models that support agentic tool calling (e.g., `grok-4-fast`, `grok-4`, `grok-4.20`)» |
| **Хард-требование** | «Agentic models only: Requires models that support agentic tool calling» |
| **Доп. плата** | «Document search is billed per tool invocation» — каждый вызов attachment_search считается tool invocation |
| **Batch API** | НЕ поддерживается: «File attachments with document search are agentic requests and do not support batch mode (n > 1)» |
| **Streaming** | Поддерживается |

### Поддерживаемые форматы
Plain text, Markdown, code files (.py, .js, .java), CSV, JSON, **PDF**, и «many other text-based formats»

### Методы передачи файла
- By URL: `input_file` с `file_url`
- By ID: загрузить в Files API → `file_id` → `input_file` с `file_id`

### Применение к нашему каталогу

| catalog id | xAI поддерживает? | Simply интегрирует? | Решение |
|---|---|---|---|
| `grok-4.20-0309-reasoning` | ✅ (agentic) | ❌ нет | `supported: false`, reason: "xAI Files API не интегрирован в Simply" |
| `grok-4.20-0309-non-reasoning` | ❌ (non-agentic) | ❌ | `supported: false`, reason: "Non-reasoning variant — не agentic" |
| `grok-4.20-multi-agent-0309` | ✅ (multi-agent reasoning) | ❌ | `supported: false`, reason: "xAI Files API не интегрирован в Simply" |
| `grok-4-1-fast-reasoning` | ✅ (grok-4-fast в docs) | ❌ | `supported: false`, reason: "xAI Files API не интегрирован в Simply" |
| `grok-4-1-fast-non-reasoning` | ❌ (non-agentic) | ❌ | `supported: false`, reason: "Non-reasoning variant — не agentic" |
| `grok-4` | ✅ (по docs) | ❌ | `supported: false`, reason: "DEPRECATED + xAI Files API не интегрирован" |

> **Решение:** все Grok модели → `supported: false`. Декларативная истина (провайдер умеет) ≠ фактическая истина (Simply не интегрирует). Роутер должен отражать факт, иначе будет посылать PDF в Grok и получать silent fail.

> **Backlog:** будущее ТЗ-XAIFilesIntegration — реализовать upload → file_id → input_file поток и поднять флаги для 4 reasoning моделей.

---

## Perplexity Sonar — File Attachments

**Источник:** https://docs.perplexity.ai/guides/file-attachments

### Ключевые лимиты
| Параметр | Значение |
|---|---|
| **Maximum file size** | **50 MB** per file |
| **Maximum files per request** | **30** files |
| **Supported formats** | PDF, DOC, DOCX, TXT, RTF |

### Методы передачи
- **Public URL** — file должен быть publicly accessible
- **Base64** — без `data:` prefix (отличие от изображений)

### Поддерживаемые модели
Документация показывает примеры **только для `sonar-pro`**. Прямого списка нет, но docs не запрещают другие. Соответственно:
- `sonar-pro` — поддержка подтверждена примерами
- `sonar-deep-research` — не упомянут в примерах. Это автономный multi-step research agent, file inputs не очевидны

### Применение к нашему каталогу — наш use case

В Simply Perplexity вызывается **только через tool `deepResearch`** в Sonnet-контексте. Это поисковый инструмент, файлы туда не передаются (мы передаём поисковый запрос).

| catalog id | API поддерживает? | Simply use case | Решение |
|---|---|---|---|
| `sonar-pro` | ✅ через file_url | tool deepResearch, файлы НЕ передаются | `supported: false`, reason: "Используется только через tool deepResearch — файлы не передаются в текущей интеграции" |
| `sonar-deep-research` | ⚠️ не подтверждено | то же | `supported: false`, reason: "Deep Research agent + не используется для прямых файловых запросов" |

> **Альтернативное решение:** пометить `sonar-pro` как `supported: true / "native"` (декларативная истина). Я выбираю **false для нашего use case**, потому что флаг будет читаться роутером, а роутер не может направить PDF в perplexity tool — это инструмент, а не модель в обычном смысле. Если будущий refactor добавит file inputs в deep-research tool — поднимем флаг.

---

## MiniMax — Anthropic-compat endpoint

**Источник:** [project_minimax_catalog_audit.md](../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/project_minimax_catalog_audit.md), верифицировано 2026-04-13

### Ключевые ограничения Anthropic-compat layer
- **НЕ поддерживает:** image input, document/PDF input
- **Игнорируется:** `top_k`, `stop_sequences`, `service_tier`, `mcp_servers`, `context_management`, `container`
- Native MiniMax API «may offer broader multimodal support», но мы используем только Anthropic-compat

### Применение к нашему каталогу

| catalog id | Решение |
|---|---|
| `MiniMax-M2.7` | `supported: false`, reason: "Anthropic-compat endpoint не поддерживает image/document inputs" |
| `MiniMax-M2.7-long` | то же (alias на тот же endpoint) |

---

## OpenRouter (5 моделей в каталоге)

**Не фетчил docs OpenRouter** — в каталоге явно помечено `notes: "OpenRouter — для тестов, не для production"`, и universal проверка document support через proxy ненадёжна.

### Применение к нашему каталогу

| catalog id | Решение |
|---|---|
| `z-ai/glm-4.6` | `supported: false`, reason: "OpenRouter proxy — document support not validated, не для production" |
| `z-ai/glm-5.1` | то же |
| `qwen/qwen3.6-plus` | то же |
| `z-ai/glm-4.6v` | то же (vision-модель, но не documents) |
| `z-ai/glm-5v-turbo` | то же |

---

## Не-LLM модели (4 записи)

| catalog id | Решение |
|---|---|
| `voyage-4` | `supported: false`, reason: "Embedding model" |
| `voyage-4-lite` | `supported: false`, reason: "Embedding model" |
| `deepgram-nova-3` | `supported: false`, reason: "Audio transcription, not text-input model" |
| `gemini-2.5-flash-preview-tts` | `supported: false`, reason: "TTS model — generates audio from text" |

---

## Финальная таблица всех 24 записей каталога

| catalog id | supported | method | maxPages | maxSizeMb | reason/notes |
|---|---|---|---|---|---|
| `claude-sonnet-4-6` | true | native | 600 | 32 | All Claude active models support PDF |
| `claude-haiku-4-5-20251001` | true | native | 100 | 32 | 200K context → 100 pages limit |
| `claude-opus-4-6` | true | native | 600 | 32 | 1M context → 600 pages limit |
| `claude-sonnet-4-5-20250929` | true | native | 100 | 32 | 200K context (legacy) → 100 pages |
| `claude-sonnet` (alias) | true | native | 600 | 32 | mirrors claude-sonnet-4-6 |
| `claude-haiku` (alias) | true | native | 100 | 32 | mirrors claude-haiku-4-5-20251001 |
| `claude-opus` (alias) | true | native | 600 | 32 | mirrors claude-opus-4-6 |
| `title-model` (alias) | true | native | 100 | 32 | mirrors claude-haiku-4-5-20251001 |
| `artifact-model` (alias) | true | native | 600 | 32 | mirrors claude-sonnet-4-6 |
| `MiniMax-M2.7` | false | — | — | — | Anthropic-compat endpoint не поддерживает image/document inputs |
| `MiniMax-M2.7-long` | false | — | — | — | то же (alias) |
| `grok-4.20-0309-reasoning` | false | — | — | — | xAI Files API не интегрирован в Simply |
| `grok-4.20-0309-non-reasoning` | false | — | — | — | Non-reasoning variant — не agentic |
| `grok-4.20-multi-agent-0309` | false | — | — | — | xAI Files API не интегрирован в Simply |
| `grok-4-1-fast-reasoning` | false | — | — | — | xAI Files API не интегрирован в Simply |
| `grok-4-1-fast-non-reasoning` | false | — | — | — | Non-reasoning variant — не agentic |
| `grok-4` | false | — | — | — | DEPRECATED + xAI Files API не интегрирован |
| `z-ai/glm-4.6` | false | — | — | — | OpenRouter proxy, не для production |
| `z-ai/glm-5.1` | false | — | — | — | OpenRouter proxy, не для production |
| `qwen/qwen3.6-plus` | false | — | — | — | OpenRouter proxy, не для production |
| `z-ai/glm-4.6v` | false | — | — | — | OpenRouter proxy, не для production |
| `z-ai/glm-5v-turbo` | false | — | — | — | OpenRouter proxy, не для production |
| `voyage-4` | false | — | — | — | Embedding model |
| `voyage-4-lite` | false | — | — | — | Embedding model |
| `sonar-pro` | false | — | — | — | Используется через tool deepResearch — файлы не передаются |
| `sonar-deep-research` | false | — | — | — | Deep Research agent + не используется для file inputs |
| `deepgram-nova-3` | false | — | — | — | Audio transcription |
| `gemini-2.5-flash-preview-tts` | false | — | — | — | TTS model |

**Итого:** 27 записей (5 физических Claude + 5 alias Claude = 10, MiniMax 2, Grok 6, OpenRouter 5, не-LLM 4). 9 поддерживают документы, 18 — нет.

---

## Расхождения с исходным ТЗ

| Что | ТЗ говорил | Реальность (по docs) | Источник |
|---|---|---|---|
| Anthropic maxPages | 100 для всех | **600** для 1M-моделей (Sonnet 4.6, Opus 4.6), 100 для 200K (Haiku 4.5, Sonnet 4.5) | platform.claude.com/docs/.../pdf-support |
| Grok 4.20 reasoning supportsDocumentInput | true / files-api | **false** (декларативно true, но в Simply не интегрировано) | code review chat/route.ts — нет import xai files |
| Grok 4 | true / files-api | **false** (deprecated в каталоге) | model-catalog.ts notes |
| Gemini Flash для документов | gemini-2.5-flash-preview-tts | **TTS-модель**, не для документов. Реально PDF в Simply идёт на Claude Haiku 4.5 (`simply-chat-vision`) | task-assignments.ts + chat/route.ts:598 |
| Sonar Deep Research | «было true/native, стало false» | Уже было `documents: false` в каталоге | model-catalog.ts:472 |
| OpenRouter | «не включать» | Включаем как `supported: false` (поля required в interface) | architecture decision |

---

## Готов к Этапу 1

Все данные собраны и верифицированы. Следующий шаг — расширить тип `ModelCapabilities` в [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts).
