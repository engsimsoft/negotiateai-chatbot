# Аудит инструментов Simply

**Дата аудита:** 2026-04-08
**Версия проекта:** 3.78.0
**Автор:** Claude Code

---

## Сводка

| Категория | Количество |
|-----------|-----------|
| Стандартные инструменты (getStandardTools) | 14 |
| Сервисные инструменты (inline в service-chat) | 2 |
| Удалённые | 1 (saveFact) |
| **Итого активных** | **16** |

---

## 1. Стандартные инструменты

Регистрируются через `getStandardTools()` в `lib/ai/tools/chat-tools.ts`.
Используются в основном чате и проектных чатах.

### Матрица доступности

| # | Инструмент | Файл | chat (Haiku) | expertise (Sonnet) | create (Sonnet) | simply (MiniMax) | simply+Думать (Sonnet) | Project (Эксперт) |
|---|-----------|------|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | `getCurrentDate` | `lib/ai/tools/get-current-date.ts` | **+** | **+** | **+** | **+** | **+** | **+** |
| 2 | `getWeather` | `lib/ai/tools/get-weather.ts` | **+** | **+** | **+** | **+** | **+** | **+** |
| 3 | `webSearch` | `lib/ai/tools/web-search.ts` | -- | **+** | **+** | **+** | **+** | **+** |
| 4 | `deepResearch` | `lib/ai/tools/deep-research.ts` | -- | **+** | **+** | -- | **+** | **+** |
| 5 | `fetchUrl` | `lib/ai/tools/fetch-url.ts` | -- | **+** | **+** | **+** | **+** | **+** |
| 6 | `readDocument` | `lib/ai/tools/read-document.ts` | **+** | **+** | **+** | **+** | **+** | -- |
| 7 | `readTelegramChannel` | `lib/ai/tools/read-telegram-channel.ts` | **+** | **+** | **+** | **+** | **+** | **+** |
| 8 | `createDocument` | `lib/ai/tools/create-document.ts` | **+** | **+** | **+** | **+** | **+** | **+** |
| 9 | `updateDocument` | `lib/ai/tools/update-document.ts` | **+** | **+** | **+** | **+** | **+** | **+** |
| 11 | `parseExcel` | `lib/ai/tools/excel/parse-excel.ts` | **+** | **+** | **+** | **+** | **+** | **+** |
| 12 | `loadSkill` | `lib/ai/tools/load-skill.ts` | **+** | **+** | **+** | **+** | **+** | **+** |
| 13 | `readProjectFile` | `lib/ai/tools/read-project-file.ts` | -- | -- | -- | -- | -- | **+** |

### Легенда
- **+** — доступен
- **--** — недоступен
- **chat (Haiku)** — `webSearch`, `deepResearch`, `fetchUrl` отфильтрованы через `CHAT_MODE_EXCLUDED_TOOLS` (дорогие для Haiku)
- **simply (MiniMax)** — 12 tools доступны (v3.79.0). `deepResearch` исключён через `SIMPLY_MODE_EXCLUDED_TOOLS` (дорогой Perplexity API). Image/file parts из истории заменяются плейсхолдерами
- **simply+Думать (Sonnet)** — все 14 tools включая `deepResearch`
- **readDocument** — исключён из проектных чатов (документы уже в контексте через manifest)
- **readProjectFile** — доступен ТОЛЬКО в проектных чатах (нужен projectId)

---

## 2. Описание каждого инструмента

### 2.1 getCurrentDate
- **Что делает:** Возвращает текущую дату/время (ISO 8601, Unix, таймзону, русский формат)
- **Параметры:** Нет
- **API ключ:** Не требуется

### 2.2 getWeather
- **Что делает:** Погода по городу или координатам (Open-Meteo API)
- **Параметры:** `city?` или `latitude`/`longitude`
- **Возвращает:** Температура, «ощущается как», описание (WMO → рус), влажность, ветер, восход/закат, прогноз 24ч
- **API ключ:** Не требуется (бесплатный API)

### 2.3 webSearch
- **Что делает:** Поиск в интернете через Brave Search API
- **Параметры:** `query` (обязательный), `count` (1-20, default 5)
- **Возвращает:** Массив результатов (title, URL, description, возраст страницы)
- **API ключ:** `BRAVE_SEARCH_API_KEY` (опционально, free tier 2000/мес)

### 2.4 deepResearch
- **Что делает:** Глубокое исследование через Perplexity Sonar API
- **Параметры:** `query`, `depth` ("pro" | "deep", default "pro")
- **Режимы:** Pro (sonar-pro, 5-15с, ~$0.02) / Deep (sonar-deep-research, 30-120с, ~$0.80)
- **Возвращает:** Текст исследования, цитаты с URL, использование токенов
- **Архитектура:** Factory pattern с closure (defaultDepth override из dev-mode UI)
- **API ключ:** `PERPLEXITY_API_KEY`

### 2.5 fetchUrl
- **Что делает:** Чтение веб-страницы по URL
- **Параметры:** `url`, `maxLength?` (1000-50000, default 10000)
- **Каскад:** Readability (8с) → semantic (JSDOM) → Jina Reader (10с) → graceful degradation
- **Особенности:** Charset detection (windows-1251, koi8-r и др.), source tracking
- **Shared utility:** `lib/ai/tools/fetch-page.ts` (также используется в briefing)
- **API ключ:** Не требуется (Jina бесплатный)

### 2.6 readDocument
- **Что делает:** Чтение файлов из `knowledge/` (DOCX, PDF, TXT, MD, JPG, PNG)
- **Параметры:** `path` (относительно knowledge/)
- **Особенности:** OCR через Gemini Vision для изображений/PDF, directory traversal защита
- **API ключ:** `GOOGLE_GENERATIVE_AI_API_KEY` (для OCR)

### 2.7 readTelegramChannel
- **Что делает:** Чтение публичных Telegram-каналов
- **Параметры:** `channel` (@handle / handle / t.me/URL), `maxPosts?` (1-50, default 50)
- **Возвращает:** Посты (text, date, url, hasMedia), определение приватности, медиа-детекция
- **Shared parser:** `lib/telegram/parser.ts` (также используется в briefing fetcher)
- **API ключ:** Не требуется

### 2.8 createDocument
- **Что делает:** Создание артефактов (документы в холсте)
- **Параметры:** `title`, `kind` (text, markdown, excel, presentation-reveal, presentation-pptx)
- **Архитектура:** Closure-based (session + dataStream)

### 2.9 updateDocument
- **Что делает:** Обновление существующих артефактов
- **Параметры:** `id` (UUID), `description` (описание изменений)
- **Timeout:** 120с (для сложных таблиц)

### 2.10 parseExcel
- **Что делает:** Анализ загруженных пользователем Excel-файлов
- **Параметры:** `fileUrl` (URL из Vercel Blob)
- **Возвращает:** Структура листов, типы колонок, preview 10 строк, формулы
- **Библиотека:** ExcelJS

### 2.12 loadSkill
- **Что делает:** Загрузка детальных инструкций (SKILL.md) по запросу (Progressive Disclosure)
- **Параметры:** `skillId` (формат "категория/название")
- **Доступные скиллы:**
  - `document/create-presentation`
  - `document/create-spreadsheet`
  - `document/create-text-document`
  - `document/analyze-document`
  - `research/web-research`
  - `research/telegram-channel-reading`

### 2.13 readProjectFile
- **Что делает:** Чтение файлов проекта по имени из manifest
- **Параметры:** `fileName`
- **Особенности:** Текстовые файлы — до 30000 символов, бинарные — описание из metadata
- **Архитектура:** Closure-based (projectId)

---

## 3. Сервисные инструменты (service-chat)

Определены inline в `app/(chat)/api/service-chat/route.ts`. Доступны только в соответствующих контекстах.

| # | Инструмент | Контекст | Что делает |
|---|-----------|----------|------------|
| 15 | `updateProjectDraft` | project-creation | Обновление превью проекта (name, description, context) |
| 16 | `updateBriefingPreview` | briefing-onboarding | Обновление профиля брифинга (topics, sources, settings) |

### Дополнительные инструменты в briefing-onboarding:
- `deepResearch` (с override глубины)
- `fetchUrl`
- `readTelegramChannel`

Эти три инструмента используются последовательно для исследования тем и валидации источников при настройке брифинга.

---

## 4. Удалённые инструменты

| Инструмент | Был в версии | Удалён в | Причина |
|-----------|-------------|---------|---------|
| `saveFact` | v3.75.0 (ТЗ-SaveFact) | v3.76.0 (ТЗ-SlidingWindow) | Заменён Extract-on-compression (v3.78.0). AI ненадёжно вызывал инструмент для записи |

**Артефакт в БД:** Колонка `memory_entry.source` (`"extracted" | "explicit"`) осталась в схеме.

---

## 5. Simply Chat (MiniMax) — почему 0 инструментов

**Место в коде:** `app/(chat)/api/chat/route.ts:870-874`

```typescript
// ТЗ-C1: Tools — disabled for Simply with MiniMax/Gemini
...(isSimplyNonAnthropicModel ? {} : {
    experimental_activeTools: getActiveToolNames(isProjectChat, chatMode),
    tools: getStandardTools({ ... }),
}),
```

**Логика:** Когда `chatMode === "simply"` И НЕ режим «Думать» — объект `tools` не передаётся в `streamText()`.

**Причины:**
1. MiniMax M2.7 — не Anthropic-модель, tool calling формат не протестирован
2. Дешёвые модели хуже справляются с tool use (частые галлюцинации)
3. Tool Call Guardian заточен под Anthropic

**Исключение:** При нажатии «Думать» модель переключается на Claude Sonnet → все инструменты включаются (условие `&& !think`).

**Можно ли подключить?** Технически да — MiniMax поддерживает OpenAI-совместимый tool calling. Нужно убрать условие `isSimplyNonAnthropicModel` и протестировать каждый инструмент.

---

## 6. Vision / Multimodal (не инструменты, но связано)

| Возможность | Модель | Файл |
|------------|--------|------|
| Image OCR | Gemini 2.5 Flash | `lib/ai/vision-ocr.ts` |
| PDF OCR | Gemini 2.5 Flash | `lib/ai/vision-ocr.ts` |
| Загрузка файлов | — | `app/(chat)/api/files/upload/route.ts` |

**Форматы загрузки:** JPG, PNG, PDF, DOCX, TXT, MD, XLSX, XLS (лимит 20MB).

---

## 7. API ключи

| Ключ | Сервис | Обязательный | Используется |
|------|--------|:---:|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini | Да | Vision OCR, briefing filter |
| `BRAVE_SEARCH_API_KEY` | Brave Search | Нет | webSearch |
| `PERPLEXITY_API_KEY` | Perplexity Sonar | Нет | deepResearch |
| `CLOUDCONVERT_API_KEY` | CloudConvert | Нет | PPTX preview |

---

## 8. Расхождения с документацией (docs/ai-tools.md)

| Проблема | Детали |
|---------|--------|
| Версия документации | v3.52.0, текущая v3.78.0 |
| `saveFact` | Упоминается в getStandardTools() примере кода — удалён в v3.76.0 |
| `startResearch` | Упоминается в обзорной таблице (15-й инструмент) — это НЕ отдельный tool, а внутренняя функция briefing research engine |
| Количество инструментов | Документация: «15 инструментов», реально: 14 стандартных + 2 сервисных = 16 |
| Simply Chat | Не упоминается, что все инструменты отключены |

---

*Этот файл — временный аудит. Актуальная документация: [docs/ai-tools.md](docs/ai-tools.md)*
