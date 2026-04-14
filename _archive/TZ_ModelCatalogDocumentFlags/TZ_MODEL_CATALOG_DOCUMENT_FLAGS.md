# ТЗ: Флаги поддержки документов в model-catalog.ts

**Версия:** 1.0  
**Дата:** 13 апреля 2026  
**Автор:** Архитектор Simply  
**Для:** Claude Code  
**Цель:** Сделать Model Router надёжным при работе с документами — роутер должен знать, какая модель «видит» PDF, а какая нет.

---

## Контекст

Сейчас в CAPS-колонке `model-catalog.ts` только иконки — роутер не может автоматически решить, куда направить запрос с PDF-вложением. Самая критичная проблема: MiniMax M2.7 через Anthropic-compat **не поддерживает document input**, но это нигде явно не зафиксировано в коде.

---

## Что сделать

### 1. Расширить интерфейс ModelConfig

Добавить три новых поля в каждый объект модели:

```ts
// Добавить в существующий interface ModelConfig (или как он называется в коде)
supportsDocumentInput: boolean;           // Может ли модель принимать PDF/документы
documentMethod: "native" | "files-api" | "none";  // Способ доставки документа
documentNotes?: string;                   // Оговорки, лимиты, зависимости
```

**Значения `documentMethod`:**
- `"native"` — PDF передаётся inline в messages (base64 или URL), модель видит его напрямую
- `"files-api"` — нужен предварительный upload через Files API провайдера, затем ссылка по ID
- `"none"` — документы не поддерживаются

### 2. Заполнить флаги для каждой модели

Все данные ниже верифицированы по **официальной документации** провайдеров (апрель 2026).

---

#### ANTHROPIC (все модели Claude)

**Источник:** https://docs.anthropic.com/en/docs/build-with-claude/pdf-support

| CATALOG ID | supportsDocumentInput | documentMethod | documentNotes |
|---|---|---|---|
| claude-sonnet-4-6 | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. Inline base64 + URL + Files API (beta). |
| claude-haiku-4-5-20251001 | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. |
| claude-opus-4-6 | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. |
| claude-sonnet-4-5-20250929 | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. |
| claude-sonnet (alias) | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. |
| claude-haiku (alias) | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. |
| claude-opus (alias) | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. |
| title-model | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. |
| artifact-model | `true` | `"native"` | Макс. 100 стр., 32MB на запрос. |

> ⚠️ **ИСПРАВЛЕНИЕ:** В предыдущей версии таблицы было указано 600 страниц. Официальная документация Anthropic: **максимум 100 страниц на запрос, 32MB на весь запрос** (включая другой контент).

---

#### MINIMAX (M2.7 через Anthropic-compat)

**Источник:** https://platform.minimax.io/docs/api-reference/text-anthropic-api  
**Подтверждение:** SIMPLY_MINIMAX_M27_REFERENCE.md, раздел 7 (type="document" ❌) и раздел 11

| CATALOG ID | supportsDocumentInput | documentMethod | documentNotes |
|---|---|---|---|
| MiniMax-M2.7 | `false` | `"none"` | Через Anthropic-compat: type="image" и type="document" НЕ поддерживаются. MiniMax имеет нативный File API (platform.minimax.io), но он не интегрирован через AI SDK provider. |
| MiniMax-M2.7-long | `false` | `"none"` | То же самое. |

---

#### xAI GROK

**Источник:** https://docs.x.ai/docs/guides/files  
**Ключевое правило:** Files API доступен **только для agentic-моделей** — тех, которые поддерживают серверный tool calling (attachment_search). Non-reasoning варианты — НЕ agentic.

| CATALOG ID | supportsDocumentInput | documentMethod | documentNotes |
|---|---|---|---|
| grok-4.20-0309-reasoning | `true` | `"files-api"` | Agentic-модель. Макс. 48MB на файл. PDF через Files API + автоматический attachment_search. Дополнительная тарификация: $5/1000 вызовов tool. |
| grok-4.20-0309-non-reasoning | `false` | `"none"` | Non-reasoning — НЕ поддерживает agentic tools, включая Files. |
| grok-4.20-multi-agent-0309 | `true` | `"files-api"` | Agentic-модель. Макс. 48MB на файл. |
| grok-4-1-fast-reasoning | `true` | `"files-api"` | Agentic-модель. Макс. 48MB на файл. |
| grok-4-1-fast-non-reasoning | `false` | `"none"` | Non-reasoning — НЕ поддерживает agentic tools. |
| grok-4 | `true` | `"files-api"` | Agentic-модель (reasoning always-on). Макс. 48MB на файл. |

> **Механизм xAI Files:** Upload файла → получение file_id → передача в messages как `input_file` → xAI автоматически активирует серверный tool `attachment_search`. Это делает запрос agentic (модель может искать по документу несколько раз). Batch API (`n > 1`) с файлами не работает.

---

#### PERPLEXITY

**Источник:** https://docs.perplexity.ai/guides/file-attachments

| CATALOG ID | supportsDocumentInput | documentMethod | documentNotes |
|---|---|---|---|
| sonar-pro | `true` | `"native"` | PDF/DOC/DOCX/TXT/RTF через file_url content type (base64 или URL). Макс. 50MB. |
| sonar-deep-research | `false` | `"none"` | В официальной документации file attachments подтверждены ТОЛЬКО для sonar/sonar-pro. Deep Research — автономный multi-step research agent, примеров с файлами в docs нет. Помечаем как `false` до подтверждения. |

> ⚠️ **Важно для Simply:** `sonar-deep-research` вызывается только через tool `deepResearch` в Sonnet-контексте. Файлы туда не передаются — это поисковый инструмент, а не документный анализатор. Поэтому `false` корректно для нашего use case.

---

#### GOOGLE GEMINI

**Источник:** https://ai.google.dev/gemini-api/docs/document-processing

| CATALOG ID | supportsDocumentInput | documentMethod | documentNotes |
|---|---|---|---|
| gemini-2.5-flash-preview-tts | `true` | `"native"` | Inline base64 до 100MB (с Jan 2026). Files API до 2GB. Макс. 1000 стр., 50MB через Files API. 258 токенов на страницу. Gemini 3 поддерживает media_resolution. |

> ⚠️ **ИСПРАВЛЕНИЕ:** Старая документация указывала 3600 страниц. Актуальный лимит: **1000 страниц** (подтверждено ошибками API и обновлённой документацией ai.google.dev от 25.03.2026).

> **Про `documentMethod`:** Gemini поддерживает ОБА метода (native inline и Files API), но для каталога фиксируем `"native"` как предпочтительный для Simply — он проще (не нужен предварительный upload).

---

#### СЛУЖЕБНЫЕ МОДЕЛИ (не LLM)

| CATALOG ID | supportsDocumentInput | documentMethod | documentNotes |
|---|---|---|---|
| voyage-4 | `false` | `"none"` | Embedding-модель. |
| voyage-4-lite | `false` | `"none"` | Embedding-модель. |
| deepgram-nova-3 | `false` | `"none"` | Транскрипция аудио. |

---

#### OPENROUTER (GLM, Qwen и пр.)

**НЕ включать в document flags.** OpenRouter используется только для краткосрочных тестов — в production всегда прямое подключение к провайдеру. Если модели OpenRouter останутся в каталоге, пометить:

| CATALOG ID | supportsDocumentInput | documentMethod | documentNotes |
|---|---|---|---|
| z-ai/glm-* | — | — | OpenRouter proxy. Не для production. Document support зависит от OpenRouter, не от провайдера модели. |
| qwen/* | — | — | OpenRouter proxy. Не для production. |

---

## 3. Использование флагов в роутере

Роутер использует **только `supportsDocumentInput` (boolean)** для принятия решений. Это простая проверка:

```ts
// Псевдокод логики роутера при наличии вложения-документа
if (hasDocumentAttachment && !currentModel.supportsDocumentInput) {
  // Fallback на модель с поддержкой документов
  // Для chatMode=simply: Haiku 4.5
  // Для chatMode=expertise: Sonnet
  // и т.д.
}
```

`documentMethod` и `documentNotes` — информационные поля для DevPanel и для будущей логики доставки документа (native vs files-api требуют разного кода).

---

## 4. Критерий приёмки

1. Все модели в `model-catalog.ts` имеют три новых поля
2. TypeScript компилируется без ошибок
3. Значения флагов соответствуют таблицам выше (сверить поштучно)
4. Существующий роутинг вложений не сломан (регрессия)
5. DevPanel показывает `supportsDocumentInput` для текущей модели (опционально, nice-to-have)

---

## Сводка исправлений vs предыдущая версия таблицы

| Что | Было | Стало | Почему |
|---|---|---|---|
| Anthropic maxPages | 600 | **100** | Официальная документация docs.anthropic.com: "Maximum pages per request: 100" |
| Gemini maxPages | 1000 | **1000** (подтверждено) | Была неоднозначность 3600 vs 1000. API возвращает ошибку на >1000. Docs от 25.03.2026 подтверждают 1000. |
| sonar-deep-research | true/native | **false/none** | В docs file attachments подтверждены только для sonar/sonar-pro. Для нашего use case (tool deepResearch) файлы не передаются. |
| OpenRouter модели | Включены с "native" | **Исключены** | Только для тестов, не production. Document support через proxy ненадёжен. |
| Gemini documentMethod | "native / files-api" | **"native"** | Одно значение в поле. Native — предпочтительный метод для Simply. |
