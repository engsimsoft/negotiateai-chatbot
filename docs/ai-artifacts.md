# Система артефактов

**Версия:** 2.7.0
**Последнее обновление:** 2026-01-29
**Статус:** 3 типа артефактов (text, presentation-reveal, presentation-pptx)

---

## О документе

Этот документ — **источник правды** для системы артефактов в Simply.

**Связанные документы:**
- [ai-agents.md](ai-agents.md) — AI-агенты
- [ai-tools.md](ai-tools.md) — инструменты агентов

---

## Типы артефактов

| Тип | Описание | Доступ | Экспорт |
|-----|----------|--------|---------|
| `text` | Plain text для соцсетей | Все агенты | .txt, Copy |
| `presentation-reveal` | Веб-презентации Reveal.js | Только Презентатор | Copy HTML, Fullscreen |
| `presentation-pptx` | PowerPoint файлы | Только Презентатор | .pptx |

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

## 2. Presentation-Reveal

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

## 3. Presentation-PPTX

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
  kind VARCHAR NOT NULL DEFAULT 'text',  -- 'text' | 'presentation-reveal' | 'presentation-pptx'
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

Создаёт новый артефакт.

```typescript
// lib/ai/tools/create-document.ts
createDocument({
  title: string,
  kind: "text" | "presentation-reveal" | "presentation-pptx"
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

**Presentation-Reveal:**
| Событие | Данные | Описание |
|---------|--------|----------|
| `data-presentationDelta` | `string` | JSON delta слайдов |

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
- `presentation-reveal` контент — JSON с HTML
- `presentation-pptx` контент — JSON с URLs

### Vercel Blob Storage
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
- Только артефакт (без истории чата)
- Поддерживается только `text` (пока)

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
| TextEditor | [artifacts/text/client.tsx](../artifacts/text/client.tsx) | Редактор текста |
| RevealViewer | [artifacts/presentation-reveal/client.tsx](../artifacts/presentation-reveal/client.tsx) | Iframe с Reveal.js |
| PptxViewer | [artifacts/presentation-pptx/client.tsx](../artifacts/presentation-pptx/client.tsx) | Галерея превью |
| DataStreamHandler | [components/data-stream-handler.tsx](../components/data-stream-handler.tsx) | Обработка streaming |
| ArtifactActions | [components/artifact-actions.tsx](../components/artifact-actions.tsx) | Кнопки (Copy, Download, Share) |

---

## Ограничения

| Ограничение | Статус |
|-------------|--------|
| Экспорт в PDF | Нет (только Print из браузера) |
| Генерация изображений | Нет |
| Public Share для презентаций | Только text пока |

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

6. **Обновить документацию** (этот файл!)

---

**Обновлено:** 2026-01-29
