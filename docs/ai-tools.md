# Инструменты AI-агентов

**Версия:** 3.78.0
**Последнее обновление:** 2026-04-08
**Статус:** 14 стандартных инструментов + 2 сервисных = 16 активных

---

## О документе

Этот документ — **источник правды** для инструментов AI-агентов в Simply.

**Связанные документы:**
- [ai-agents.md](ai-agents.md) — AI-агенты
- [ai-artifacts.md](ai-artifacts.md) — система артефактов

---

## Обзор инструментов

### Стандартные инструменты (14 шт)

Регистрируются через `getStandardTools()` в `lib/ai/tools/chat-tools.ts`.

| Инструмент | Описание | Доступ |
|------------|----------|--------|
| `getCurrentDate` | Текущая дата/время с таймзоной | Все агенты |
| `getWeather` | Погода по городу (Open-Meteo) | Все агенты |
| `webSearch` | Поиск в интернете (Brave API) | Все агенты (кроме chat/simply) |
| `deepResearch` | Глубокое исследование (Perplexity Sonar API) | Все агенты (кроме chat/simply) |
| `fetchUrl` | Чтение веб-страниц по URL (Readability + Jina Reader fallback) | Все агенты (кроме chat/simply) |
| `readDocument` | Чтение из knowledge/ (DOCX, PDF, OCR) | Только обычные чаты |
| `readTelegramChannel` | Чтение публичных Telegram-каналов (посты, даты, медиа) | Все агенты |
| `createDocument` | Создание артефактов (text, markdown, excel, presentations) | Все агенты |
| `updateDocument` | Обновление артефактов | Все агенты |
| `parseExcel` | Анализ загруженных Excel-файлов | Все агенты |
| `loadSkill` | Загрузка инструкций из SKILL.md (6 скиллов) | Все агенты |
| `readProjectFile` | Чтение файлов проекта по имени из manifest | Только проектные чаты (Эксперт) |

### Сервисные инструменты (2 шт)

Определены inline в `app/(chat)/api/service-chat/route.ts`.

| Инструмент | Контекст | Описание |
|------------|----------|----------|
| `updateProjectDraft` | project-creation | Обновление превью проекта (name, description, context) |
| `updateBriefingPreview` | briefing-onboarding | Обновление профиля брифинга (topics, sources, settings) |

> В контексте `briefing-onboarding` также доступны: `deepResearch`, `fetchUrl`, `readTelegramChannel` — для исследования тем и валидации источников.

> **Примечание:** Excel создаётся через `createDocument(kind: "excel")`, редактируется через `updateDocument`. Отдельный `parseExcel` используется только для анализа **загруженных** пользователем файлов.

### Удалённые инструменты

| Инструмент | Был в версии | Удалён | Причина |
|-----------|-------------|--------|---------|
| `saveFact` | v3.75.0 | v3.76.0 | Заменён Extract-on-compression (v3.78.0) |
| `startResearch` | v3.52.0 | — | Не отдельный tool, а внутренняя функция briefing research engine |
| `createSnapshot` | v3.18.0 | v3.87.3 | SQL audit: 2 all-time calls (оба через Sonnet-«Думать»), 0 через MiniMax. Model-invoked trigger ненадёжен, schema хрупкая (1/2 calls failed JSON parse). Заменён Extract-on-compression (L1) + Anthropic Compaction (L2). См. [ADR 052](decisions/052-context-management-strategy-per-provider.md) |
| `requestSuggestions` | v1.0 (template) | 2026-04-17 | SQL audit: 0 all-time calls за всю историю продукта. AI не вызывал tool ни разу — пользователи просят правки через `updateDocument` или обычным текстом. Удалён как неиспользуемый legacy из Vercel AI Chatbot template. |

---

## Матрица доступности по режимам

| Инструмент | chat (Haiku) | expertise (Sonnet) | create (Sonnet) | simply (MiniMax) | simply+Думать (Sonnet) | Project (Эксперт) |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| `getCurrentDate` | + | + | + | + | + | + |
| `getWeather` | + | + | + | + | + | + |
| `webSearch` | -- | + | + | + | + | + |
| `deepResearch` | -- | + | + | -- | + | + |
| `fetchUrl` | -- | + | + | + | + | + |
| `readDocument` | + | + | + | + | + | -- |
| `readTelegramChannel` | + | + | + | + | + | + |
| `createDocument` | + | + | + | + | + | + |
| `updateDocument` | + | + | + | + | + | + |
| `parseExcel` | + | + | + | + | + | + |
| `loadSkill` | + | + | + | + | + | + |
| `readProjectFile` | -- | -- | -- | -- | -- | + |

**Примечания:**
- **chat (Haiku):** `webSearch`, `deepResearch`, `fetchUrl` отфильтрованы через `CHAT_MODE_EXCLUDED_TOOLS` (дорогие для Haiku)
- **simply (MiniMax):** 12 tools доступны (v3.79.0). `deepResearch` исключён через `SIMPLY_MODE_EXCLUDED_TOOLS` (дорогой Perplexity API). Image/file parts из истории заменяются на текстовые плейсхолдеры (`stripMediaPartsForTextModel`)
- **simply+Думать (Sonnet):** Все 14 tools включая `deepResearch`. Модель переключается на Claude Sonnet при нажатии «Думать»
- **readDocument:** Исключён из проектных чатов (документы уже в контексте через manifest)
- **readProjectFile:** Доступен ТОЛЬКО в проектных чатах (нужен projectId)

---

## Web Search

Поиск актуальной информации в интернете через Brave Search API.

### Возможности
- Поиск новостей и текущих событий
- До 20 результатов за запрос
- Фильтрация по стране и языку

### Параметры

```typescript
webSearch({
  query: string,        // Поисковый запрос
  count?: number,       // Количество результатов (default: 10, max: 20)
  country?: string,     // Код страны (default: "RU")
})
```

### Требования
- `BRAVE_SEARCH_API_KEY` в `.env.local`

### Файл
[lib/ai/tools/web-search.ts](../lib/ai/tools/web-search.ts)

### Пример использования
```
Найди последние новости о GPT-5
Что нового в React 19?
```

---

## Deep Research

Глубокое исследование тем через Perplexity Sonar API. Добавлен в v3.29.0 (ТЗ-PX).

### Два режима

| Режим | Модель | Время | Стоимость | Когда |
|-------|--------|-------|-----------|-------|
| **Pro** | sonar-pro | 5-15 сек | ~$0.02 | По умолчанию. Быстрый мультишаговый поиск |
| **Deep** | sonar-deep-research | 30-120 сек | ~$0.80 | Исчерпывающее исследование. Только по явному запросу |

### Доступность

| Тип чата | Доступен |
|----------|----------|
| Chat (Haiku) | Нет (отфильтрован через `CHAT_MODE_EXCLUDED_TOOLS`) |
| Expertise (Sonnet) | Да |
| Create (Sonnet) | Да |
| Проектный чат | Да |

### Параметры

```typescript
deepResearch({
  query: string,       // Что исследовать
  depth?: "pro" | "deep",  // Режим (default: "pro")
})
```

### Возвращает

```typescript
{
  query: string,
  depth: "pro" | "deep",
  content: string,        // Текст исследования
  citations: Array<{ url: string, title?: string }>,
  citationsCount: number,
  usage?: { totalTokens: number, searchQueries?: number },
}
```

### Dev-mode override

Переключатель 🔬 Auto/Pro/Deep в toolbar (только `NODE_ENV=development`, не chatMode='chat'). Override передаётся через `researchDepth` в request body → `defaultDepth` в factory-замыкании.

### Архитектура

Factory-pattern — `deepResearch({ defaultDepth })` возвращает tool с замкнутым `defaultDepth`. Client override побеждает выбор модели: `const depth = defaultDepth ?? modelDepth`.

### Требования
- `PERPLEXITY_API_KEY` в `.env.local`

### Файл
[lib/ai/tools/deep-research.ts](../lib/ai/tools/deep-research.ts)

### Пример использования
```
Исследуй тенденции рынка EdTech в России
Сравни React vs Vue для enterprise проекта
```

---

## Fetch URL

Чтение веб-страниц по URL через каскад Readability → Jina Reader API. Добавлен в v3.29.0 (ТЗ-FU). Charset detection в v3.34.0 (ТЗ-WS1). Jina Reader fallback в v3.35.0 (ТЗ-WS2).

### Доступность

| Тип чата | Доступен |
|----------|----------|
| Chat (Haiku) | Нет (отфильтрован через `CHAT_MODE_EXCLUDED_TOOLS`) |
| Expertise (Sonnet) | Да |
| Create (Sonnet) | Да |
| Проектный чат | Да |

### Возможности
- **Каскад извлечения**: Readability (8s) → semantic fallback → Jina Reader API (10s) → graceful degradation
- **Jina Reader API** — headless Chrome на стороне Jina, рендерит JS, обрабатывает SPA и сложные layouts
- **Charset detection** — windows-1251, koi8-r, ISO-8859-5 и другие кодировки (chardet + iconv-lite)
- **Source tracking** — `source: 'readability' | 'semantic' | 'jina'` для отладки
- Автоматическая обрезка по `maxLength`
- Timeout 30 сек (бюджет каскада: 8s Readability + 10s Jina)
- **forceJina** — опция для пропуска Readability (используется в briefing dispatcher)

### Параметры

```typescript
fetchUrl({
  url: string,             // URL страницы
  maxLength?: number,      // Макс символов (default: 10000, max: 50000)
})
```

### Возвращает

```typescript
{
  url: string,
  title: string | null,
  content: string,
  originalLength: number,
  source: 'readability' | 'semantic' | 'jina',
  truncated: boolean,
}
```

### Архитектура

Shared utility `fetch-page.ts` — единый entry point для извлечения веб-контента. Используется в `fetchUrl` tool и briefing `web-fetcher.ts`.

**Каскад (v3.35.0):**
1. `forceJina?` → сразу Jina Reader → return
2. Readability (8s timeout) → если content ≥ 5000 chars → return (source: 'readability')
3. Semantic fallback (JSDOM DOM API) → если content ≥ 5000 chars → return (source: 'semantic')
4. Jina Reader API (10s timeout) → если контент есть → return (source: 'jina')
5. Graceful degradation: вернуть лучшее что есть

**Charset detection:** HTTP Content-Type header → `<meta charset>` regex → chardet auto-detection → UTF-8 fallback.

### Файл
- [lib/ai/tools/fetch-url.ts](../lib/ai/tools/fetch-url.ts) — tool definition
- [lib/ai/tools/fetch-page.ts](../lib/ai/tools/fetch-page.ts) — shared utility (cascade + charset)
- [lib/ai/tools/jina-reader.ts](../lib/ai/tools/jina-reader.ts) — Jina Reader API utility

### Пример использования
```
Прочитай статью по ссылке https://example.com/article
Что написано на этой странице: https://...
```

---

## Get Weather

Погода по координатам или названию города через Open-Meteo API.

### Возможности
- Погода по названию города (геокодирование с `language=ru`)
- Погода по координатам (latitude + longitude)
- Текущая температура + ощущается как
- Описание погоды (WMO-коды → русский текст, 28 описаний)
- Влажность, скорость ветра
- Восход/закат солнца
- Почасовой прогноз (24 часа, `forecast_days=1`)

### Параметры

```typescript
getWeather({
  city?: string,           // Название города (e.g., "Москва", "London")
  latitude?: number,       // Широта (альтернатива city)
  longitude?: number,      // Долгота (альтернатива city)
})
```

### Возвращает

Два формата данных в одном ответе:

1. **Сырые данные Open-Meteo** — для Weather UI-компонента (`current`, `hourly`, `daily`)
2. **`summary`** — чистые данные для модели:

```typescript
{
  summary: {
    location: string,      // "Москва"
    temperature: string,   // "-8°C"
    feelsLike: string,     // "-12°C"
    description: string,   // "Небольшой снег" (из WMO-кодов)
    humidity: string,      // "85%"
    wind: string,          // "15 км/ч"
    time: string,          // ISO timestamp
  },
  cityName: string,        // Для UI-компонента
  current: { ... },        // Сырые данные API
  hourly: { ... },         // 24 значения (forecast_days=1)
  daily: { ... },          // sunrise/sunset
}
```

### Требования
- Бесплатный API, ключ не требуется

### Файл
[lib/ai/tools/get-weather.ts](../lib/ai/tools/get-weather.ts)

### Пример использования
```
Какая погода в Москве?
Температура в Сан-Франциско?
```

---

## Get Current Date

Текущая дата и время с локализацией.

### Возможности
- ISO 8601 формат
- Unix timestamp
- Часовой пояс (Intl API)
- Локализация (русский формат)

### Параметры

```typescript
getCurrentDate()  // Без параметров
```

### Файл
[lib/ai/tools/get-current-date.ts](../lib/ai/tools/get-current-date.ts)

### Пример использования
```
Какой сегодня день?
Сколько дней до Нового года?
```

---

## Read Telegram Channel

Чтение публичных Telegram-каналов. Добавлен в v3.47.0 (ТЗ-TG1).

### Возможности
- Чтение последних постов публичного канала
- Определение приватных/несуществующих каналов (redirect detection)
- Медиа-детекция (фото, видео, документы, стикеры, голосовые)
- Диапазон дат (oldestDate, newestDate)
- Любой формат ввода: @channel, channel, t.me/channel

### Параметры

```typescript
readTelegramChannel({
  channel: string,      // @handle, handle, или t.me/handle URL
  maxPosts?: number,    // 1-50, default 50
})
```

### Возвращает

```typescript
{
  isValid: boolean,
  channel: string,
  channelUrl: string,
  totalFetched: number,       // Сколько постов доступно на странице
  posts: TelegramPost[],      // text, date, url, hasMedia
  oldestDate: string | null,  // ISO 8601
  newestDate: string | null,  // ISO 8601
  error?: string,             // При isValid=false
}
```

### Архитектура

Обёртка над shared parser `lib/telegram/parser.ts`:

```
readTelegramChannel (AI tool)
  └─ parseTelegramChannel (shared parser)
       └─ fetch t.me/s/{channel} + cheerio parsing
```

Shared parser также используется в briefing fetcher (`lib/briefing/source-fetchers/telegram-fetcher.ts`).

### Skill

При анализе канала модель загружает `loadSkill("research/telegram-channel-reading")` — инструкции для структурированного анализа (тематика, частота, стиль, аудитория).

### Файл
[lib/ai/tools/read-telegram-channel.ts](../lib/ai/tools/read-telegram-channel.ts)

### Пример использования
```
Прочитай канал @durov
Проанализируй @breakingmash
Сравни @rbc_news и @tass_agency
```

---

## Read Document

Чтение документов из базы знаний (папка `knowledge/`).

> **Примечание:** Этот инструмент доступен **только в обычных чатах**. В проектных чатах документы автоматически включаются в контекст через `buildProjectContext()`.

### Доступность

| Тип чата | Доступен |
|----------|----------|
| Обычный чат | Да |
| Проектный чат | Нет (документы уже в контексте) |

### Возможности
- Чтение файлов из `knowledge/`
- Поддержка форматов: DOCX, PDF, TXT, MD, JPG, JPEG, PNG
- OCR для изображений и PDF
- Индексный файл: `knowledge/index.md`
- Автоподсказки при ошибке пути

### Параметры

```typescript
readDocument({
  path: string,         // Путь относительно knowledge/
})
```

### Безопасность
- Directory traversal защита
- Только папка `knowledge/` доступна
- Запись файлов запрещена

### Файл
[lib/ai/tools/read-document.ts](../lib/ai/tools/read-document.ts)

### Пример использования
```
Прочитай knowledge/index.md
Найди информацию в knowledge/Проекты/project.pdf
```

### Проектные чаты

В проектных чатах (Claude) документы обрабатываются иначе:
- Файлы загружаются через `/api/projects/[id]/files`
- Текст извлекается при загрузке (`extractedContent` в metadata)
- Контекст строится через `buildProjectContext()` в system prompt
- Лимиты: 50K символов на файл, 150K общий контекст

---

## Create Document

Создание артефактов. Подробнее в [ai-artifacts.md](ai-artifacts.md).

### Параметры

```typescript
createDocument({
  title: string,
  kind: "text" | "presentation-reveal" | "presentation-pptx"
})
```

### Доступ
- `text` — все агенты
- `presentation-reveal` — только Презентатор
- `presentation-pptx` — только Презентатор

### Файл
[lib/ai/tools/create-document.ts](../lib/ai/tools/create-document.ts)

---

## Update Document

Обновление существующих артефактов. Подробнее в [ai-artifacts.md](ai-artifacts.md).

### Параметры

```typescript
updateDocument({
  id: string,           // UUID документа
  description: string   // Описание изменений
})
```

### Файл
[lib/ai/tools/update-document.ts](../lib/ai/tools/update-document.ts)

---

## Excel (через артефакты)

Excel-документы создаются и редактируются через систему артефактов.

### Создание Excel

Используйте `createDocument` с `kind: "excel"`.

**Возможности:**
- Множественные листы
- Типы данных: текст, число, валюта (₽), процент, дата
- Формулы: SUM, AVERAGE, IF, VLOOKUP и др.
- 5 цветовых тем
- Графики: столбчатые, линейные, круговые, и др.
- Русская локализация

**10 шаблонов:**
- Семейный бюджет
- Бюджет проекта
- Учёт доходов/расходов ИП
- Контент-план
- Медиаплан
- Счёт/Инвойс
- Учёт клиентов
- График отпусков
- Сравнительная таблица
- Трекер задач

**Файл:** [artifacts/excel/server.ts](../artifacts/excel/server.ts)

### Редактирование Excel

Используйте `updateDocument` для редактирования созданных Excel-документов.

**Операции:**
- Добавление колонок и строк
- Изменение значений ячеек
- Добавление формул
- Добавление графиков
- Изменение стилей и тем

### Parse Excel

Анализ загруженных пользователем Excel-файлов (.xlsx, .xls).

**Возможности:**
- Чтение структуры файла
- Определение типов колонок
- Preview первых 10 строк
- Извлечение формул
- Генерация саммари

**Параметры:**

```typescript
parseExcel({
  fileUrl: string,        // URL файла (Vercel Blob)
})
```

**Файл:** [lib/ai/tools/excel/parse-excel.ts](../lib/ai/tools/excel/parse-excel.ts)

### Пример использования

```
Сделай таблицу расходов за месяц: продукты 15000, транспорт 5000, ЖКХ 8000
Создай медиаплан для VK с бюджетом 100000₽
Добавь в таблицу колонку с НДС 20%
[Загрузить .xlsx] — Какой итог по всем месяцам?
```

---

## Load Skill

Динамическая загрузка инструкций из SKILL.md файлов (Progressive Disclosure).

### Когда использовать

Модель вызывает `loadSkill` перед выполнением сложных задач:

| Задача | Skill ID |
|--------|----------|
| Создание презентации | `document/create-presentation` |
| Создание таблицы | `document/create-spreadsheet` |
| Создание документа | `document/create-text-document` |
| Анализ файла | `document/analyze-document` |
| Веб-поиск | `research/web-research` |
| Чтение Telegram-канала | `research/telegram-channel-reading` |

### Параметры

```typescript
loadSkill({
  skillId: string,  // ID в формате "категория/название"
})
```

### Возвращает

```typescript
{
  success: boolean,
  skillId: string,
  instructions: string,  // Полный контент SKILL.md
  note: string,
}
```

### Принцип работы

1. Metadata skills (короткие описания) всегда в system prompt
2. Модель решает когда нужны детальные инструкции
3. Вызывает `loadSkill()` для загрузки полного SKILL.md
4. Следует инструкциям (включая вопросы пользователю)

### Файл

[lib/ai/tools/load-skill.ts](../lib/ai/tools/load-skill.ts)

### Пример использования

```
Сделай презентацию о компании
→ Модель вызывает loadSkill("document/create-presentation")
→ Получает инструкции
→ Задаёт уточняющие вопросы
→ Создаёт презентацию
```

---

## Read Project File

Чтение файлов проекта по имени из manifest. Доступен только в проектных чатах (Эксперт).

### Доступность

| Тип чата | Доступен |
|----------|----------|
| Обычный чат | Нет |
| Проектный чат (Эксперт) | Да (при наличии projectId) |

### Возможности
- Чтение текстовых файлов проекта по имени из manifest
- Fallback определение типа по расширению (TEXT_EXTENSIONS: `.md`, `.txt`, `.csv`, `.json`, `.xml`, `.html`, `.css`, `.js`, `.ts`, `.yaml`, `.yml`, `.env`, `.log`, `.sql`, `.sh`, `.py`, `.rb`, `.go`, `.java`, `.c`, `.cpp`, `.h`, `.rs`, `.swift`, `.kt`, `.jsx`, `.tsx`, `.vue`, `.svelte`)
- Бинарные файлы → описание из metadata (analysis description + documentType)
- Лимит: 30,000 символов на файл

### Параметры

```typescript
readProjectFile({
  fileName: string,   // Имя файла из manifest проекта
})
```

### Возвращает

```typescript
{
  success: boolean,
  fileName: string,
  content?: string,      // Содержимое текстового файла
  description?: string,  // Описание бинарного файла из metadata
  error?: string,
}
```

### Архитектура

Инструмент реализован как **closure-based tool** — фабричная функция принимает `projectId` и возвращает tool с замкнутым контекстом:

```typescript
// lib/ai/tools/read-project-file.ts
export const readProjectFile = ({ projectId }: { projectId: string }) =>
  tool({
    description: "Read a project file by name...",
    parameters: z.object({ fileName: z.string() }),
    execute: async ({ fileName }) => { ... },
  });
```

### Регистрация

Включается автоматически через `getStandardTools()` при `isProjectChat && projectId`:

```typescript
// lib/ai/tools/chat-tools.ts
...(isProjectChat && projectId
  ? { readProjectFile: readProjectFile({ projectId }) }
  : {}),
```

### Файл
[lib/ai/tools/read-project-file.ts](../lib/ai/tools/read-project-file.ts)

### Пример использования
```
Прочитай файл "brief.md" из проекта
Покажи содержимое README.md
```

---

## Vision / Multimodal

### Image OCR

Распознавание текста на изображениях через Gemini Vision.

**Форматы:** JPG, JPEG, PNG

**Возможности:**
- Распознавание текста на фотографиях
- Анализ скриншотов
- Чтение сканированных документов
- Извлечение текста из таблиц (markdown)

**Модель:** Gemini 2.5 Flash

**Файл:** [lib/ai/vision-ocr.ts](../lib/ai/vision-ocr.ts)

### PDF OCR

**Возможности:**
- Чтение текстовых PDF
- Распознавание отсканированных PDF
- Многостраничные документы

**Таймауты:** До 120 секунд для больших файлов

**Модель:** Gemini 2.5 Flash

### Загрузка файлов через чат

**Лимит размера:** 20MB

**Поддерживаемые форматы:**
- Изображения: JPG, PNG
- Документы: PDF, DOCX, TXT, MD
- Таблицы: XLSX, XLS

**Обработка:**
- DOCX → конвертация в TXT (mammoth)
- TXT/MD → UTF-8 текст
- XLSX/XLS → конвертация в CSV текст (xlsx library)
- PDF/Images → без конвертации (multimodal)

**Хранилище:** Vercel Blob Storage

**Файл:** [app/(chat)/api/files/upload/route.ts](../app/(chat)/api/files/upload/route.ts)

### Пример использования
```
[Прикрепи скриншот]
Что на этом изображении?

[Загрузи PDF]
Составь краткое резюме этого документа
```

---

## Регистрация инструментов

Инструменты регистрируются через shared factory `getStandardTools()`:

```typescript
// lib/ai/tools/chat-tools.ts
export function getStandardTools({ session, dataStream, isProjectChat, projectId, chatId, messageId, chatMode, researchDepth }) {
  return {
    getCurrentDate,
    getWeather,
    ...(isProjectChat ? {} : { readDocument }),              // только обычные чаты
    ...(isProjectChat && projectId
      ? { readProjectFile: readProjectFile({ projectId }) }  // только проектные чаты
      : {}),
    ...(chatId && messageId
      ? { createSnapshot: createSnapshot({ chatId, messageId }) }  // управление контекстом
      : {}),
    createDocument: createDocument({ session, dataStream }),
    updateDocument: updateDocument({ session, dataStream }),
    webSearch,
    fetchUrl,
    deepResearch: deepResearch({ defaultDepth: researchDepth }),
    parseExcel,
    loadSkill,
    readTelegramChannel,
  };
}

// chatMode-фильтрация: fetchUrl + deepResearch исключены для 'chat' (Haiku)
const CHAT_MODE_EXCLUDED_TOOLS = ["fetchUrl", "deepResearch"];

// Simply Chat (MiniMax): tools отключены на уровне route.ts (isSimplyNonAnthropicModel)
// При «Думать» (think=true) → Sonnet → tools включены
```

**Используется в:**
- `app/(chat)/api/chat/route.ts` — основной чат
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — чат Эксперта

---

## Добавление нового инструмента

1. **Создать файл инструмента:**
   ```typescript
   // lib/ai/tools/my-tool.ts
   import { tool } from "ai";
   import { z } from "zod";

   export const myTool = () =>
     tool({
       description: "Описание инструмента",
       inputSchema: z.object({
         param: z.string().describe("Описание параметра"),
       }),
       execute: async ({ param }) => {
         // Логика
         return { result: "..." };
       },
     });
   ```

2. **Зарегистрировать в `getStandardTools()`:**
   ```typescript
   // lib/ai/tools/chat-tools.ts
   import { myTool } from "./my-tool";

   export function getStandardTools(...) {
     return {
       ...,
       myTool,
     };
   }
   ```
   И добавить в `getActiveToolNames()` в обе ветки (project / non-project).

3. **Обновить документацию** (этот файл!)

---

## Ограничения

| Ограничение | Статус |
|-------------|--------|
| Запись в knowledge/ | Нет (только чтение) |
| Файлы > 20MB | Не поддерживаются |
| Генерация изображений | Нет |
| Аудио/видео обработка | Нет |
| Code execution | Нет |

---

## Требования

### API ключи

| Переменная | Сервис | Обязательно |
|------------|--------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini | Да |
| `BRAVE_SEARCH_API_KEY` | Brave Search | Нет (для webSearch) |
| `PERPLEXITY_API_KEY` | Perplexity | Нет (для deepResearch) |
| `CLOUDCONVERT_API_KEY` | CloudConvert | Нет (для PPTX превью) |

### Инфраструктура

- **Vercel Blob Storage** — загрузка файлов
- **PostgreSQL/Neon** — артефакты и suggestions
- **Папка knowledge/** — база знаний (с `index.md`)

---

## Excel зависимости

| Пакет | Версия | Назначение |
|-------|--------|------------|
| `exceljs` | ^4.4.0 | Генерация .xlsx файлов |
| `xlsx` | ^0.18.5 | Парсинг загруженных файлов |
| `recharts` | ^2.15.0 | Рендеринг графиков в UI |

---

**Обновлено:** 2026-04-08 (v3.78.0 — аудит: saveFact удалён, startResearch не tool, матрица доступности, Simply Chat tools)
