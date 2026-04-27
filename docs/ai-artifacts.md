# Система артефактов (документы в холсте)

**Версия:** 2.9.1
**Последнее обновление:** 2026-04-27
**Статус:** 5 типов документов (text, markdown, excel, presentation-reveal, presentation-pptx)

---

## О документе

Этот документ — **источник правды** для системы артефактов в Simply.

**Связанные документы:**
- [ai-agents.md](ai-agents.md) — AI-агенты
- [ai-tools.md](ai-tools.md) — инструменты агентов

---

## System-промпты артефактов

С v2.9.1 (ТЗ-MigrateArtifactPromptsToSkills) inline промпты в `artifacts/<kind>/server.ts` вынесены в формат Anthropic Agent Skills. Это даёт provider-agnostic базу для будущего A/B тестирования модели per-type (Sonnet vs Kimi vs Grok) без правок кода.

**Расположение:** `lib/prompts/skills/artifact-generation/<kind>/`
- `SKILL.md` — system prompt для `onCreateDocument` (frontmatter + body)
- `references/update.md` — system prompt для `onUpdateDocument` (без frontmatter)

**Загрузчик:** `lib/prompts/skills/artifact-generation/loader.ts`
```ts
loadArtifactSkill(kind, op, vars?) → string
// kind: 'text' | 'markdown' | 'excel' | 'pptx' | 'reveal'
// op: 'create' | 'update'
// vars: подстановка {{placeholder}} через render() из lib/prompts/template.ts
```

**Плейсхолдеры** (caller форматирует данные перед передачей):

| kind | SKILL.md (create) | references/update.md |
|---|---|---|
| text, markdown | — | `{{currentContent}}` |
| excel | `{{templatesList}}` | `{{templatesList}}`, `{{currentExcelData}}` |
| pptx, reveal | — | `{{currentSlides}}`, `{{description}}` |

Кэш сырого template — только в `NODE_ENV === 'production'` (в dev HMR подхватывает правки .md мгновенно).

**Integrity-проверка** (для excel/pptx/reveal — где `update.md` дублирует body `SKILL.md` + delta):
```bash
pnpm exec tsx scripts/integrity-artifact-skills.ts
```
Проверяет что body `SKILL.md` (без frontmatter и trailing footer) — substring `references/update.md`. Защита от тихого расхождения create/update при правке одного файла без другого.

---

## Типы документов

| Тип | Описание | Доступ | Экспорт | Формат в UI |
|-----|----------|--------|---------|-------------|
| `text` | Plain text для соцсетей | Все агенты | .txt, Copy | Текст · TXT |
| `markdown` | Форматированные документы | Все агенты | .pdf, .md, Copy | Документ · MD |
| `excel` | Excel-таблицы с формулами | Все агенты | .xlsx, .pdf, Copy CSV | Таблица · XLSX |
| `presentation-reveal` | Веб-презентации Reveal.js | Только Презентатор | Copy HTML, Fullscreen | Презентация · HTML |
| `presentation-pptx` | PowerPoint файлы | Только Презентатор | .pptx | Презентация · PPTX |

---

## 1. Text Artifact

Plain text с emoji для соцсетей (VK, Telegram, Instagram).

### Возможности
- Копирование в буфер обмена
- Скачивание как `.txt`
- Public Share (публичная ссылка)
- Редактирование в UI

### Хранение контента
Строка в поле `content` таблицы `Document`.

### Файлы
- [artifacts/text/server.ts](../artifacts/text/server.ts) — генерация
- [artifacts/text/client.tsx](../artifacts/text/client.tsx) — UI

### Пример использования
```
Напиши пост для VK про наш новый продукт
Создай текст для Telegram-канала
```

---

## 2. Markdown Artifact (NEW в v2.8.0)

Форматированные документы с поддержкой заголовков, списков, таблиц и кода.

### Возможности
- **Рендеринг:** react-markdown + remark-gfm (GitHub Flavored Markdown)
- **Режим просмотра:** красивый рендеринг с prose-стилями
- **Режим редактирования:** textarea с исходным markdown кодом
- **Переключение режимов:** кнопки ✏️ (редактировать) / 👁️ (просмотр)
- **Скачивание:** PDF (html2pdf.js), .md файл
- **Копирование:** в буфер обмена
- **Public Share:** публичная ссылка

### Поддерживаемое форматирование
| Элемент | Markdown | Результат |
|---------|----------|-----------|
| Заголовки | `# H1`, `## H2`, `### H3` | Иерархия заголовков |
| Жирный | `**текст**` | **текст** |
| Курсив | `*текст*` | *текст* |
| Код inline | `` `код` `` | `код` |
| Списки | `- item` / `1. item` | Маркированные/нумерованные |
| Таблицы | GFM синтаксис | Таблицы с заголовком |
| Цитаты | `> цитата` | Блочные цитаты |
| Блоки кода | ` ``` ` | Подсветка синтаксиса |

### Хранение контента
Строка markdown в поле `content` таблицы `Document`.

### DataStream события
| Событие | Данные | Описание |
|---------|--------|----------|
| `data-markdownDelta` | `string` | Часть markdown текста |

### Файлы
- [artifacts/markdown/server.ts](../artifacts/markdown/server.ts) — генерация
- [artifacts/markdown/client.tsx](../artifacts/markdown/client.tsx) — UI

### Зависимости
```json
{
  "react-markdown": "^9.x",
  "remark-gfm": "^4.x",
  "html2pdf.js": "^0.10.x"
}
```

### Пример использования
```
Напиши маркетинговый план для нового продукта
Создай инструкцию по установке в формате Markdown
Составь отчёт по результатам исследования
```

---

## 3. Excel Artifact (NEW в v2.9.0)

Профессиональные таблицы Excel с формулами, графиками и стилями.

### Возможности
- **Множественные листы:** поддержка нескольких листов в одном документе
- **Типы данных:** текст, число, валюта (₽), процент, дата
- **Формулы:** SUM, AVERAGE, IF, VLOOKUP и другие
- **5 цветовых тем:** corporate-blue, forest-green, warm-orange, professional-gray, modern-teal
- **Графики:** столбчатые, линейные, круговые, area, doughnut
- **Профессиональные стили:** замороженные заголовки, чередование строк, стилизация итоговых строк
- **Русская локализация:** "15 000 ₽", даты DD.MM.YYYY

### Экспорт
- **XLSX:** скачивание оригинального Excel-файла
- **PDF:** экспорт таблицы в PDF (html2pdf.js)
- **CSV:** копирование в буфер обмена

### 10 шаблонов
1. Семейный бюджет
2. Бюджет проекта
3. Учёт доходов/расходов ИП
4. Контент-план
5. Медиаплан
6. Счёт/Инвойс
7. Учёт клиентов
8. График отпусков
9. Сравнительная таблица
10. Трекер задач

### Хранение контента
JSON в поле `content`:
```typescript
{
  filename: string,       // Имя файла
  fileUrl?: string,       // URL в Vercel Blob
  sheets: [{
    name: string,         // Имя листа
    columns: [...],       // Колонки с типами
    data: [...],          // Данные
    rows?: [...],         // Структурированные строки
    charts?: [...],       // Графики
    styles?: {...}        // Стили
  }]
}
```

### DataStream события
| Событие | Данные | Описание |
|---------|--------|----------|
| `data-excelDelta` | `object` | `{ excelData, fileUrl, isComplete }` |

### Файлы
- [artifacts/excel/server.ts](../artifacts/excel/server.ts) — генерация
- [artifacts/excel/client.tsx](../artifacts/excel/client.tsx) — UI
- [lib/ai/tools/excel/](../lib/ai/tools/excel/) — Excel tools

### Зависимости
```json
{
  "exceljs": "^4.4.0",
  "xlsx": "^0.18.5",
  "recharts": "^2.15.0",
  "html2pdf.js": "^0.10.x"
}
```

### Пример использования
```
Сделай таблицу расходов за месяц: продукты 15000, транспорт 5000
Создай медиаплан с бюджетом 100000₽ и расчётом ROI
Сделай счёт для клиента ООО "Рога и Копыта" с НДС 20%
```

---

## 4. Presentation-Reveal

Интерактивные веб-презентации на Reveal.js.

### Возможности
- 5 тем: corporate, modern, minimal, dark, creative
- Интерактивные переходы между слайдами
- Fullscreen режим
- Copy HTML
- Public Share

### Доступ
**Эксклюзивно для агента Презентатор.**

### Хранение контента
JSON в поле `content`:
```typescript
{
  slides: Slide[],      // Массив слайдов
  themeId: string,      // "corporate" | "modern" | ...
  html: string          // Готовый HTML с Reveal.js
}
```

### Файлы
- [artifacts/presentation-reveal/server.ts](../artifacts/presentation-reveal/server.ts)
- [artifacts/presentation-reveal/client.tsx](../artifacts/presentation-reveal/client.tsx)
- [lib/presentations/themes.ts](../lib/presentations/themes.ts) — темы Reveal.js

### Пример использования
```
[Через агента Презентатор]
Создай веб-презентацию про AI в современном стиле
```

---

## 5. Presentation-PPTX

Настоящие PowerPoint файлы для PowerPoint/Keynote/Google Slides.

### Возможности
- 5 тем: corporate, modern, minimal, dark, creative
- Галерея превью слайдов (PNG)
- Скачивание `.pptx`
- Public Share

### Доступ
**Эксклюзивно для агента Презентатор.**

### Хранение контента
JSON в поле `content` + файлы в Vercel Blob:
```typescript
{
  slides: Slide[],           // Массив слайдов
  themeId: string,           // "corporate" | "modern" | ...
  pptxUrl: string,           // URL в Vercel Blob (presentations/pptx/)
  previewUrls: string[]      // URLs PNG превью (presentations/preview/)
}
```

### Внешние сервисы
- **PptxGenJS** — генерация PPTX файлов
- **CloudConvert API** — конвертация PPTX → PDF → PNG для превью
- **Vercel Blob Storage** — хранение PPTX и PNG файлов

### Файлы
- [artifacts/presentation-pptx/server.ts](../artifacts/presentation-pptx/server.ts)
- [artifacts/presentation-pptx/client.tsx](../artifacts/presentation-pptx/client.tsx)
- [lib/presentations/pptx-themes.ts](../lib/presentations/pptx-themes.ts)
- [lib/services/pptx-preview.ts](../lib/services/pptx-preview.ts) — CloudConvert

### Пример использования
```
[Через агента Презентатор]
Создай PPTX презентацию для инвестора про наш стартап
```

---

## Схема БД

### Таблица `Document`

```sql
CREATE TABLE "Document" (
  id UUID NOT NULL DEFAULT random(),
  createdAt TIMESTAMP NOT NULL,
  title TEXT NOT NULL,
  content TEXT,                    -- Контент (строка или JSON)
  kind VARCHAR NOT NULL DEFAULT 'text',  -- 'text' | 'markdown' | 'excel' | 'presentation-reveal' | 'presentation-pptx'
  userId UUID NOT NULL REFERENCES "User"(id),

  -- Public Share
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token VARCHAR(32) UNIQUE,
  shared_at TIMESTAMP,

  PRIMARY KEY (id, createdAt)      -- Версионирование!
);
```

**Файл:** [lib/db/schema.ts:214-237](../lib/db/schema.ts#L214-L237)

### Версионирование

Primary key = `(id, createdAt)` позволяет хранить несколько версий одного документа:
- Одинаковый `id`, разные `createdAt`
- UI показывает историю версий (Undo/Redo)

### Таблица `Suggestion`

```sql
CREATE TABLE "Suggestion" (
  id UUID PRIMARY KEY,
  documentId UUID NOT NULL,
  documentCreatedAt TIMESTAMP NOT NULL,
  originalText TEXT NOT NULL,
  suggestedText TEXT NOT NULL,
  description TEXT,
  isResolved BOOLEAN DEFAULT false,
  userId UUID REFERENCES "User"(id),
  createdAt TIMESTAMP NOT NULL,

  FOREIGN KEY (documentId, documentCreatedAt)
    REFERENCES "Document"(id, createdAt)
);
```

---

## Tool Definitions

### createDocument

Создаёт новый документ в холсте.

```typescript
// lib/ai/tools/create-document.ts
createDocument({
  title: string,
  kind: "text" | "markdown" | "excel" | "presentation-reveal" | "presentation-pptx"
})
```

**Параметры:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `title` | string | Название документа |
| `kind` | enum | Тип артефакта |

**Timeout:** 120 секунд (для сложных документов)

**Поток выполнения:**
1. Генерирует UUID
2. Отправляет в dataStream: `data-kind`, `data-id`, `data-title`, `data-clear`
3. Вызывает handler по типу (`textDocumentHandler`, `presentationRevealHandler`, etc.)
4. Handler генерирует контент и сохраняет в БД
5. Отправляет `data-finish`

### updateDocument

Обновляет существующий артефакт.

```typescript
// lib/ai/tools/update-document.ts
updateDocument({
  id: string,
  description: string
})
```

**Параметры:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | UUID документа |
| `description` | string | Описание изменений |

**Timeout:** 120 секунд

---

## DataStream протокол

Артефакты используют real-time streaming через `dataStream`:

### События создания

| Событие | Данные | Описание |
|---------|--------|----------|
| `data-kind` | `string` | Тип артефакта |
| `data-id` | `string` | UUID документа |
| `data-title` | `string` | Название |
| `data-clear` | `null` | Очистить UI |
| `data-finish` | `null` | Завершение |

### События контента (по типу)

**Text:**
| Событие | Данные | Описание |
|---------|--------|----------|
| `data-textDelta` | `string` | Часть текста |

**Markdown:**
| Событие | Данные | Описание |
|---------|--------|----------|
| `data-markdownDelta` | `string` | Часть markdown текста |

**Presentation-Reveal:**
| Событие | Данные | Описание |
|---------|--------|----------|
| `data-presentationDelta` | `string` | JSON delta слайдов |

**Excel:**
| Событие | Данные | Описание |
|---------|--------|----------|
| `data-excelDelta` | `object` | `{ excelData, fileUrl, isComplete }` |

**Presentation-PPTX:**
| Событие | Данные | Описание |
|---------|--------|----------|
| `data-pptxStatus` | `string` | Статус генерации |
| `data-pptxComplete` | `object` | `{ pptxUrl, previewUrls }` |

### Обработка в UI

```typescript
// components/data-stream-handler.tsx
// Обрабатывает события dataStream и обновляет состояние артефакта
```

---

## Хранение файлов

### PostgreSQL (таблица Document)
- `text` контент — строка
- `markdown` контент — строка markdown
- `excel` контент — JSON с ExcelData
- `presentation-reveal` контент — JSON с HTML
- `presentation-pptx` контент — JSON с URLs

### Vercel Blob Storage
- XLSX файлы → `excel/{id}.xlsx`
- PPTX файлы → `presentations/pptx/{id}.pptx`
- PNG превью → `presentations/preview/{id}-{slideIndex}.png`

---

## Public Share

### Создание ссылки

```typescript
// POST /api/document/{id}/share
{
  shareToken: string,    // 32-символьный токен
  shareUrl: string,      // https://domain.com/share/{token}
  alreadyShared: boolean
}
```

### Публичный просмотр

```
GET /share/{token}
```

- Без авторизации
- Только документ (без истории чата)
- Поддерживается: `text`, `markdown`
- Не поддерживается: `excel`, `presentation-reveal`, `presentation-pptx`
- Для markdown: скачивание PDF и .md на публичной странице

### Отзыв ссылки

```typescript
// DELETE /api/document/{id}/share
{ success: true, wasShared: boolean }
```

### Файлы
- [app/(chat)/api/document/[id]/share/route.ts](../app/(chat)/api/document/[id]/share/route.ts)
- [app/share/[token]/page.tsx](../app/share/[token]/page.tsx)

---

## UI компоненты

| Компонент | Файл | Описание |
|-----------|------|----------|
| Artifact | [components/artifact.tsx](../components/artifact.tsx) | Главный контейнер с версионированием |
| DocumentPreview | [components/document-preview.tsx](../components/document-preview.tsx) | Компактное превью в чате (Anthropic-стиль) |
| TextEditor | [artifacts/text/client.tsx](../artifacts/text/client.tsx) | Редактор текста |
| MarkdownViewer/Editor | [artifacts/markdown/client.tsx](../artifacts/markdown/client.tsx) | Просмотр/редактирование markdown |
| RevealViewer | [artifacts/presentation-reveal/client.tsx](../artifacts/presentation-reveal/client.tsx) | Iframe с Reveal.js |
| PptxViewer | [artifacts/presentation-pptx/client.tsx](../artifacts/presentation-pptx/client.tsx) | Галерея превью |
| DataStreamHandler | [components/data-stream-handler.tsx](../components/data-stream-handler.tsx) | Обработка streaming |
| ArtifactActions | [components/artifact-actions.tsx](../components/artifact-actions.tsx) | Кнопки (Copy, Download, Share, Edit/View) |

---

## Ограничения

| Ограничение | Статус |
|-------------|--------|
| Экспорт в PDF | ✅ Да для markdown (html2pdf.js) |
| Генерация изображений | Нет |
| Public Share для презентаций | Только text и markdown |

---

## Добавление нового типа артефакта

1. **Добавить тип в schema:**
   ```typescript
   // lib/db/schema.ts
   kind: varchar("text", { enum: [..., "new-type"] })
   ```

2. **Создать server handler:**
   ```typescript
   // artifacts/new-type/server.ts
   export const newTypeDocumentHandler = createDocumentHandler<"new-type">({
     kind: "new-type",
     onCreateDocument: async ({ id, title, dataStream, session }) => { ... },
     onUpdateDocument: async ({ document, description, dataStream, session }) => { ... },
   });
   ```

3. **Зарегистрировать handler:**
   ```typescript
   // lib/artifacts/server.ts
   export const documentHandlersByArtifactKind = [
     ...,
     newTypeDocumentHandler,
   ];
   ```

4. **Создать client component:**
   ```typescript
   // artifacts/new-type/client.tsx
   export const newTypeArtifact = new Artifact<"new-type", Metadata>({
     kind: "new-type",
     description: "...",
     content: NewTypeContent,
     actions: [...],
     toolbar: [...],
     onStreamPart: ({ ... }) => { ... },
   });
   ```

5. **Зарегистрировать в UI:**
   ```typescript
   // components/artifact.tsx
   import { newTypeArtifact } from "@/artifacts/new-type/client";
   export const artifactDefinitions = [..., newTypeArtifact];
   ```

6. **Добавить тип в CustomUIDataTypes** (если нужен streaming):
   ```typescript
   // lib/types.ts
   export type CustomUIDataTypes = {
     ...
     newTypeDelta: string,
   };
   ```

7. **Обновить документацию** (этот файл!)

---

**Обновлено:** 2026-04-27 (v2.9.1 — inline промпты вынесены в `lib/prompts/skills/artifact-generation/`, ТЗ-MigrateArtifactPromptsToSkills)
**До этого:** 2026-01-29 (v2.9.0 — добавлен Excel)
