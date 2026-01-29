# Инструменты AI-агентов

**Версия:** 2.7.0
**Последнее обновление:** 2026-01-29
**Статус:** 8 инструментов

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
| `readDocument` | Чтение из knowledge/ | Все агенты |
| `createDocument` | Создание артефактов | Все агенты (презентации — только Презентатор) |
| `updateDocument` | Обновление артефактов | Все агенты |
| `requestSuggestions` | Предложения по улучшению | Все агенты |

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

**Обработка:**
- DOCX → конвертация в TXT (mammoth)
- TXT/MD → UTF-8 текст
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

Инструменты регистрируются в chat route:

```typescript
// app/(chat)/api/chat/route.ts
const tools = {
  webSearch: webSearch(),
  getWeather: getWeather(),
  getCurrentDate: getCurrentDate(),
  readDocument: readDocument(),
  createDocument: createDocument({ session, dataStream }),
  updateDocument: updateDocument({ session, dataStream }),
  requestSuggestions: requestSuggestions({ session }),
};
```

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

**Обновлено:** 2026-01-29
