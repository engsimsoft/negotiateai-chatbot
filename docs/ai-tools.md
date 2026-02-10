# Инструменты AI-агентов

**Версия:** 3.17.0
**Последнее обновление:** 2026-02-10
**Статус:** 10 инструментов (readProjectFile добавлен в v3.17)

---

## О документе

Этот документ — **источник правды** для инструментов AI-агентов в Simply.

**Связанные документы:**
- [ai-agents.md](ai-agents.md) — AI-агенты
- [ai-artifacts.md](ai-artifacts.md) — система артефактов

---

## Обзор инструментов

| Инструмент | Описание | Доступ |
|------------|----------|--------|
| `webSearch` | Поиск в интернете | Все агенты |
| `getWeather` | Погода по городу | Все агенты |
| `getCurrentDate` | Текущая дата | Все агенты |
| `readDocument` | Чтение из knowledge/ | Только обычные чаты |
| `createDocument` | Создание артефактов (text, markdown, excel, presentations) | Все агенты (презентации — только Презентатор) |
| `updateDocument` | Обновление артефактов | Все агенты |
| `requestSuggestions` | Предложения по улучшению | Все агенты |
| `parseExcel` | Анализ загруженных Excel-файлов | Все агенты |
| `loadSkill` | Загрузка инструкций из SKILL.md | Все агенты |
| `readProjectFile` | Чтение файлов проекта по имени из manifest | Только проектные чаты (Эксперт) |

> **Примечание:** Excel создаётся через `createDocument(kind: "excel")`, редактируется через `updateDocument`. Отдельный `parseExcel` используется только для анализа **загруженных** пользователем файлов.

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

## Get Weather

Погода по координатам или названию города через Open-Meteo API.

### Возможности
- Погода по названию города
- Геокодирование (название → координаты)
- Текущая температура
- Восход/закат солнца
- Почасовой прогноз

### Параметры

```typescript
getWeather({
  city: string,         // Название города
})
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

## Request Suggestions

Генерация предложений по улучшению текстовых артефактов.

### Возможности
- Анализ текста
- До 5 умных предложений
- Описание каждого изменения
- Сохранение в БД (таблица `Suggestion`)

### Параметры

```typescript
requestSuggestions({
  documentId: string,   // UUID документа
})
```

### Модель
Использует **Gemini 2.5 Pro** (более умная модель для анализа).

### Файл
[lib/ai/tools/request-suggestions.ts](../lib/ai/tools/request-suggestions.ts)

### Пример использования
```
[После создания текстового артефакта]
Предложи улучшения для этого текста
```

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
export function getStandardTools({ session, dataStream, isProjectChat, projectId }) {
  return {
    getCurrentDate,
    getWeather,
    ...(isProjectChat ? {} : { readDocument }),              // только обычные чаты
    ...(isProjectChat && projectId
      ? { readProjectFile: readProjectFile({ projectId }) }  // только проектные чаты
      : {}),
    createDocument: createDocument({ session, dataStream }),
    updateDocument: updateDocument({ session, dataStream }),
    requestSuggestions: requestSuggestions({ session, dataStream }),
    webSearch,
    parseExcel,
    loadSkill,
  };
}
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

2. **Зарегистрировать в chat route:**
   ```typescript
   // app/(chat)/api/chat/route.ts
   import { myTool } from "@/lib/ai/tools/my-tool";

   const tools = {
     ...,
     myTool: myTool(),
   };
   ```

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

**Обновлено:** 2026-02-10 (v3.17.0 — readProjectFile для Эксперта, getStandardTools() shared factory)
