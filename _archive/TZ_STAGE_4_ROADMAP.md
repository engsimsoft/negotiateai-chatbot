# Roadmap: Этап 4 — Система проектов и база знаний

**Проект:** Family AI Assistant
**Версия:** 2.1.4 → 2.2.0
**Дата создания:** 2026-01-27
**Статус:** 📋 Планирование

---

## 🎯 Цель этапа

Добавить систему персональных проектов с базой знаний, которая позволит:
1. **Создавать проекты** - каждый пользователь создает свои проекты
2. **Привязывать чаты к проектам** - чаты группируются по проектам
3. **Загружать файлы в проект** - PDF, DOCX, MD, TXT, код (база знаний)
4. **AI читает файлы проекта** - агенты автоматически используют файлы при ответе

**Примеры использования:**

**Юлия (маркетолог):**
- Создает проект "VK Продвижение 2026"
- Загружает: брендбук.pdf, стратегия.docx, примеры_постов.md
- Спрашивает Маркетолога: "Создай пост про новую коллекцию"
- Агент читает брендбук и использует правильные цвета/стиль

**Владимир (инженер):**
- Создает проект "Next.js App"
- Загружает: README.md, architecture.md, код компонентов
- Спрашивает Наставника: "Как улучшить эту архитектуру?"
- Агент анализирует загруженный код и дает советы

---

## 📊 Текущая ситуация

### Что УЖЕ работает (Этап 3):

✅ **Система агентов** - 8 специализированных агентов с промптами
✅ **Role-based фильтрация** - engineer видит 3 агента, marketer видит 8
✅ **Автовыбор AI модели** - Gemini 3 Pro / 2.5 Flash по агенту
✅ **UI для загрузки файлов** - кнопка скрепки в чате (`components/multimodal-input.tsx`)
✅ **БД для attachments** - поле `attachments` в таблице Message_v2

### Что НЕ работает (нужно доделать):

❌ **API `/api/files/upload`** - фронтенд вызывает, но endpoint отсутствует
❌ **Система проектов** - нет таблиц Project, ProjectFile
❌ **Группировка по проектам** - sidebar группирует только по датам
❌ **AI tool для чтения файлов** - `read_document` работает только с локальной папкой `knowledge/`, не с Vercel Blob

---

## 🏗️ Архитектурное решение

### Иерархия данных:

```
User (vladimir@family.local)
├── Project 1: "VK Продвижение"
│   ├── Files (база знаний)
│   │   ├── брендбук.pdf
│   │   ├── стратегия.docx
│   │   └── примеры.md
│   └── Chats
│       ├── Chat 1 (с Маркетологом)
│       └── Chat 2 (с Копирайтером)
│
├── Project 2: "Next.js App"
│   ├── Files
│   │   ├── README.md
│   │   └── architecture.md
│   └── Chats
│       └── Chat 3 (с Наставником)
│
└── Чаты без проекта (старые чаты)
    └── Chat 4 (общий чат)
```

### Принципы:

1. **Проекты опциональны** - старые чаты без проектов продолжают работать
2. **Файлы привязаны к проекту** - не к чату, а к проекту целиком
3. **AI видит только файлы своего проекта** - изоляция данных
4. **Простой поиск на старте** - по ключевым словам, без vector search (это Stage 5)

---

## 📝 Детальный план реализации

### Фаза 1: База данных (1-2 дня)

#### 1.1 Новые таблицы

**Таблица `Project`** (проекты пользователей):
```sql
CREATE TABLE "Project" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id"),
  "name" varchar(128) NOT NULL,              -- "VK Продвижение"
  "description" text,                        -- опционально
  "icon" varchar(16) DEFAULT '📁',           -- emoji
  "color" varchar(7) DEFAULT '#3b82f6',      -- hex color для UI
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL,
  "archivedAt" timestamp                     -- soft delete
);

CREATE INDEX idx_project_user ON "Project"("userId");
CREATE INDEX idx_project_archived ON "Project"("archivedAt");
```

**Таблица `ProjectFile`** (файлы в проекте = база знаний):
```sql
CREATE TABLE "ProjectFile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" uuid NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,              -- "брендбук.pdf"
  "originalName" varchar(255) NOT NULL,      -- оригинальное имя
  "mimeType" varchar(128) NOT NULL,          -- "application/pdf"
  "size" integer NOT NULL,                   -- размер в байтах
  "blobUrl" text NOT NULL,                   -- URL в Vercel Blob
  "extractedText" text,                      -- текст из PDF/DOCX
  "createdAt" timestamp NOT NULL
);

CREATE INDEX idx_projectfile_project ON "ProjectFile"("projectId");
```

#### 1.2 Обновить таблицу Chat

```sql
-- Добавить projectId (nullable для обратной совместимости)
ALTER TABLE "Chat" ADD COLUMN "projectId" uuid REFERENCES "Project"("id");
CREATE INDEX idx_chat_project ON "Chat"("projectId");
```

**Генерация миграции:**
```bash
npm run db:generate
# Создаст drizzle/{timestamp}_add_projects.sql
```

---

### Фаза 2: Database Queries (1 день)

**Файл:** `lib/db/queries.ts`

#### 2.1 Project CRUD

```typescript
// Создать проект
export async function createProject({
  userId,
  name,
  description,
  icon,
  color,
}: {
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}) {
  const now = new Date();
  return await db.insert(project).values({
    userId,
    name,
    description,
    icon: icon || "📁",
    color: color || "#3b82f6",
    createdAt: now,
    updatedAt: now,
  });
}

// Получить проекты пользователя (только активные)
export async function getUserProjects(userId: string): Promise<Project[]> {
  return await db
    .select()
    .from(project)
    .where(and(
      eq(project.userId, userId),
      isNull(project.archivedAt)
    ))
    .orderBy(desc(project.updatedAt));
}

// Обновить проект
export async function updateProject({
  id,
  name,
  description,
  icon,
  color,
}: {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}) {
  return await db
    .update(project)
    .set({
      name,
      description,
      icon,
      color,
      updatedAt: new Date(),
    })
    .where(eq(project.id, id));
}

// Архивировать проект (soft delete)
export async function archiveProject(id: string) {
  return await db
    .update(project)
    .set({ archivedAt: new Date() })
    .where(eq(project.id, id));
}
```

#### 2.2 ProjectFile CRUD

```typescript
// Создать запись о файле
export async function createProjectFile({
  projectId,
  name,
  originalName,
  mimeType,
  size,
  blobUrl,
  extractedText,
}: {
  projectId: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  blobUrl: string;
  extractedText?: string;
}) {
  return await db.insert(projectFile).values({
    projectId,
    name,
    originalName,
    mimeType,
    size,
    blobUrl,
    extractedText,
    createdAt: new Date(),
  });
}

// Получить файлы проекта
export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  return await db
    .select()
    .from(projectFile)
    .where(eq(projectFile.projectId, projectId))
    .orderBy(asc(projectFile.name));
}

// Удалить файл
export async function deleteProjectFile(id: string) {
  // Получить blobUrl для удаления из storage
  const [file] = await db
    .select()
    .from(projectFile)
    .where(eq(projectFile.id, id));

  if (file) {
    // Удалить из Vercel Blob
    await del(file.blobUrl);

    // Удалить из БД
    await db.delete(projectFile).where(eq(projectFile.id, id));
  }
}
```

#### 2.3 Обновить saveChat

```typescript
// Добавить projectId в существующую функцию
export async function saveChat({
  id,
  userId,
  title,
  visibility,
  agentId,
  projectId, // NEW
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  agentId?: string;
  projectId?: string; // NEW
}) {
  return await db.insert(chat).values({
    id,
    createdAt: new Date(),
    userId,
    title,
    visibility,
    agentId,
    projectId, // NEW
  });
}
```

---

### Фаза 3: API Endpoints (2 дня)

#### 3.1 `/api/files/upload` - ДОДЕЛАТЬ для существующего UI

**Файл:** `app/api/files/upload/route.ts` (СОЗДАТЬ)

```typescript
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

// POST /api/files/upload
// Для загрузки attachments в сообщениях (существующий UI)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return new Response("No file provided", { status: 400 });
  }

  // Upload to Vercel Blob
  const blob = await put(file.name, file, {
    access: "public",
  });

  // Return Attachment format
  return NextResponse.json({
    name: file.name,
    url: blob.url,
    contentType: file.type,
  });
}
```

**Это починит существующую кнопку скрепки!**

#### 3.2 `/api/project` - Список и создание проектов

**Файл:** `app/api/project/route.ts` (СОЗДАТЬ)

```typescript
import { auth } from "@/app/(auth)/auth";
import { createProject, getUserProjects } from "@/lib/db/queries";

// GET /api/project - список проектов пользователя
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const projects = await getUserProjects(session.user.id);
  return Response.json(projects);
}

// POST /api/project - создать новый проект
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { name, description, icon, color } = await request.json();

  await createProject({
    userId: session.user.id,
    name,
    description,
    icon,
    color,
  });

  return new Response("Project created", { status: 201 });
}
```

#### 3.3 `/api/project/[id]` - Обновление и архивирование

**Файл:** `app/api/project/[id]/route.ts` (СОЗДАТЬ)

```typescript
import { auth } from "@/app/(auth)/auth";
import { updateProject, archiveProject } from "@/lib/db/queries";

// PATCH /api/project/[id] - обновить проект
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { name, description, icon, color } = await request.json();

  await updateProject({
    id: params.id,
    name,
    description,
    icon,
    color,
  });

  return new Response("Project updated", { status: 200 });
}

// DELETE /api/project/[id] - архивировать проект
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  await archiveProject(params.id);
  return new Response("Project archived", { status: 200 });
}
```

#### 3.4 `/api/project/[id]/upload` - Загрузка файлов в проект

**Файл:** `app/api/project/[id]/upload/route.ts` (СОЗДАТЬ)

```typescript
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { createProjectFile } from "@/lib/db/queries";
import mammoth from "mammoth";
import pdf from "pdf-parse";

// POST /api/project/[id]/upload
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return new Response("No file provided", { status: 400 });
  }

  // Проверка типа файла
  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/javascript",
    "text/typescript",
  ];

  if (!allowedTypes.includes(file.type)) {
    return new Response("File type not supported", { status: 400 });
  }

  // Загрузить в Vercel Blob
  const blob = await put(file.name, file, {
    access: "public",
  });

  // Извлечь текст для поиска
  let extractedText: string | undefined;
  const buffer = await file.arrayBuffer();

  if (file.type === "application/pdf") {
    const pdfData = await pdf(Buffer.from(buffer));
    extractedText = pdfData.text;
  } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const docxData = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    extractedText = docxData.value;
  } else if (file.type.startsWith("text/")) {
    extractedText = await file.text();
  }

  // Сохранить в БД
  await createProjectFile({
    projectId: params.id,
    name: file.name,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    blobUrl: blob.url,
    extractedText,
  });

  return NextResponse.json({ success: true, url: blob.url });
}
```

#### 3.5 Обновить Chat API

**Файл:** `app/(chat)/api/chat/schema.ts`

```typescript
export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum([
    "auto",
    "gemini-3-pro",
    "gemini-2.5-flash",
  ]),
  selectedVisibilityType: z.enum(["public", "private"]),
  agentId: z.string().optional(),
  projectId: z.string().optional(), // NEW
});
```

**Файл:** `app/(chat)/api/chat/route.ts`

```typescript
const { id, message, selectedChatModel, selectedVisibilityType, agentId, projectId } = requestBody;

// ...

await saveChat({
  id,
  userId: session.user.id,
  title,
  visibility: selectedVisibilityType,
  agentId,
  projectId, // NEW
});
```

---

### Фаза 4: AI Tool - read_project_files (1 день)

**Файл:** `lib/ai/tools/read-project-files.ts` (СОЗДАТЬ)

```typescript
import { tool } from "ai";
import { z } from "zod";
import { getProjectFiles } from "@/lib/db/queries";

export const readProjectFiles = (projectId: string | undefined) =>
  tool({
    description: `Читает файлы из базы знаний текущего проекта.
      Доступны: PDF, DOCX, MD, TXT, JSON, код.
      Используй для: поиска информации в документах проекта,
      анализа кода, чтения технической документации.`,

    parameters: z.object({
      query: z.string().optional().describe(
        "Что ищешь в файлах проекта? (например: 'брендбук цвета', 'архитектура API')"
      ),
    }),

    execute: async ({ query }) => {
      // Проверка что чат привязан к проекту
      if (!projectId) {
        return "⚠️ Этот чат не привязан к проекту. Файлы недоступны.";
      }

      // Получить все файлы проекта
      const files = await getProjectFiles(projectId);

      if (files.length === 0) {
        return "📁 В проекте пока нет загруженных файлов.";
      }

      // Фильтрация по запросу (простой поиск по тексту)
      let relevantFiles = files;
      if (query) {
        relevantFiles = files.filter(
          (file) =>
            file.extractedText?.toLowerCase().includes(query.toLowerCase()) ||
            file.name.toLowerCase().includes(query.toLowerCase())
        );
      }

      if (relevantFiles.length === 0) {
        return `🔍 Не найдено файлов по запросу "${query}". Всего файлов в проекте: ${files.length}`;
      }

      // Вернуть список файлов + содержимое (первые 1000 символов каждого)
      const result = relevantFiles.map((file) => ({
        name: file.name,
        size: file.size,
        content: file.extractedText?.slice(0, 1000) || "[binary file]",
      }));

      return `
📚 Найдено файлов: ${result.length}

${result
  .map(
    (file, i) => `
${i + 1}. ${file.name} (${Math.round(file.size / 1024)}KB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${file.content}
${file.content.length >= 1000 ? "\n... (truncated, call again for full content)" : ""}
`
  )
  .join("\n")}
`;
    },
  });
```

**Интеграция в chat endpoint:**

**Файл:** `app/(chat)/api/chat/route.ts`

```typescript
import { readProjectFiles } from "@/lib/ai/tools/read-project-files";

// В execute функции streamText:
const result = streamText({
  model: myProvider.languageModel(modelToUse),
  system: systemPromptText,
  messages: convertToModelMessages(uiMessages),
  temperature: 1.0,
  tools: {
    createDocument,
    getCurrentDate,
    webSearch,
    readProjectFiles: readProjectFiles(chat?.projectId), // NEW
  },
  // ...
});
```

**Обновить промпты всех агентов:**

Добавить в каждый `lib/ai/agents/{agentId}.md`:

```markdown
## 📚 Инструменты

### readProjectFiles
**Когда использовать:**
- Если пользователь упоминает документы/файлы проекта
- Если задача требует информации из базы знаний
- Если нужно проанализировать загруженный код/документы

**Примеры:**
- Пользователь: "Посмотри наш брендбук и предложи цвета для поста"
  → readProjectFiles({ query: "брендбук цвета" })

- Пользователь: "Как у нас реализована авторизация?"
  → readProjectFiles({ query: "auth authentication" })
```

---

### Фаза 5: UI Components (2-3 дня)

#### 5.1 Project Selector (главная страница)

**Вариант А: Проекты опциональны (РЕКОМЕНДУЮ)**

Сейчас главная страница = Agent Selector. Добавим кнопку "📁 Выбрать проект":

```
┌─────────────────────────────────────┐
│  Привет, Юлия! 👋                  │
│  Выберите агента для начала работы  │
│                                     │
│  [📁 Выбрать проект]  (новая кнопка)│
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ 📊   │ │ ✍️    │ │ 🌐   │        │
│  │Марк. │ │Копир.│ │Перев.│        │
│  └──────┘ └──────┘ └──────┘        │
└─────────────────────────────────────┘
```

При клике на "Выбрать проект" → переход на `/projects`

#### 5.2 Projects Page

**Файл:** `app/projects/page.tsx` (СОЗДАТЬ)

```
┌─────────────────────────────────────┐
│  Мои проекты          [+ Создать]   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 💬 Без проекта               │   │
│  │ Общие чаты                   │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 📊 VK Продвижение            │   │
│  │ Маркетинговая стратегия 2026 │   │
│  │ 📁 5 файлов | 💬 8 чатов      │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 💻 Next.js App               │   │
│  │ Разработка веб-приложения    │   │
│  │ 📁 3 файла | 💬 2 чата        │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

При клике на проект → `/project/[id]`

#### 5.3 Project Page

**Файл:** `app/project/[id]/page.tsx` (СОЗДАТЬ)

```
┌─────────────────────────────────────┐
│ ← Назад                             │
│                                     │
│  📊 VK Продвижение                  │
│  Маркетинговая стратегия 2026       │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                     │
│  📁 База знаний (5)   [⬆ Загрузить]│
│                                     │
│  • брендбук.pdf (2.3MB)       [×]   │
│  • стратегия.docx (156KB)     [×]   │
│  • примеры_постов.md (12KB)   [×]   │
│  • tone_of_voice.txt (8KB)    [×]   │
│  • colors.json (2KB)          [×]   │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                     │
│  Выберите агента:                   │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ 📊   │ │ ✍️    │ │ 🌐   │        │
│  │Марк. │ │Копир.│ │Перев.│        │
│  └──────┘ └──────┘ └──────┘        │
└─────────────────────────────────────┘
```

#### 5.4 Обновить Sidebar

**Файл:** `components/sidebar-history.tsx`

Добавить группировку чатов по проектам:

```
┌─────────────────────────┐
│ 📁 VK Продвижение       │
│  • Пост про коллекцию   │
│  • Идеи для Stories     │
│                         │
│ 💻 Next.js App          │
│  • Улучшение архитектуры│
│                         │
│ 💬 Без проекта          │
│  • Случайный вопрос     │
│                         │
│ Сегодня                 │
│  • Недавний чат         │
└─────────────────────────┘
```

---

### Фаза 6: Artifact-only sharing (2-3 дня) 🎯

**Цель:** Возможность делиться артефактами по публичной ссылке БЕЗ показа истории чата

**Use Case:**
- Юлия создает HTML презентацию с Наставником
- Нужно показать боссу ТОЛЬКО презентацию (без переписки)
- Кликает "Share Artifact" → копирует ссылку `/share/artifact/abc-123`
- Босс открывает → видит только артефакт (HTML рендерится)
- Privacy: вся переписка остается приватной

---

#### 6.1 Database Schema

**Обновить таблицу `Document`:**

```sql
-- Добавить поле isPublic для публичного доступа
ALTER TABLE "Document" ADD COLUMN "isPublic" boolean DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "shareToken" varchar(64) UNIQUE;

CREATE INDEX idx_document_sharetoken ON "Document"("shareToken");
```

**Генерация миграции:**
```bash
npm run db:generate
# Создаст drizzle/{timestamp}_add_document_sharing.sql
```

**Drizzle Schema (lib/db/schema.ts):**

```typescript
export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("kind", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    isPublic: boolean("isPublic").default(false).notNull(),     // NEW
    shareToken: varchar("shareToken", { length: 64 }).unique(), // NEW
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);
```

---

#### 6.2 Database Queries

**Файл:** `lib/db/queries.ts`

```typescript
import { nanoid } from "nanoid";

// Сделать артефакт публичным и сгенерировать токен
export async function shareDocument(documentId: string, documentCreatedAt: Date) {
  const shareToken = nanoid(32); // Генерация уникального токена

  await db
    .update(document)
    .set({
      isPublic: true,
      shareToken
    })
    .where(
      and(
        eq(document.id, documentId),
        eq(document.createdAt, documentCreatedAt)
      )
    );

  return shareToken;
}

// Сделать артефакт приватным
export async function unshareDocument(documentId: string, documentCreatedAt: Date) {
  await db
    .update(document)
    .set({
      isPublic: false,
      shareToken: null
    })
    .where(
      and(
        eq(document.id, documentId),
        eq(document.createdAt, documentCreatedAt)
      )
    );
}

// Получить публичный артефакт по токену (БЕЗ проверки userId!)
export async function getPublicDocument(shareToken: string) {
  const [doc] = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.shareToken, shareToken),
        eq(document.isPublic, true)
      )
    )
    .limit(1);

  return doc;
}
```

---

#### 6.3 API Endpoint: Share/Unshare

**Файл:** `app/api/document/[id]/share/route.ts` (СОЗДАТЬ)

```typescript
import { auth } from "@/app/(auth)/auth";
import { shareDocument, unshareDocument, getDocumentById } from "@/lib/db/queries";
import { NextResponse } from "next/server";

// POST /api/document/[id]/share - сделать публичным
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { createdAt } = await request.json();

  // Проверка владения (только владелец может делать публичным)
  const doc = await getDocumentById({ id: params.id, createdAt: new Date(createdAt) });
  if (!doc || doc.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // Генерация токена и обновление БД
  const shareToken = await shareDocument(params.id, new Date(createdAt));

  // Возврат ссылки
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/artifact/${shareToken}`;

  return NextResponse.json({
    shareToken,
    shareUrl
  });
}

// DELETE /api/document/[id]/share - сделать приватным
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { createdAt } = await request.json();

  // Проверка владения
  const doc = await getDocumentById({ id: params.id, createdAt: new Date(createdAt) });
  if (!doc || doc.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  await unshareDocument(params.id, new Date(createdAt));

  return new Response("Document unshared", { status: 200 });
}
```

---

#### 6.4 Public Share Page (БЕЗ авторизации!)

**Файл:** `app/(share)/share/artifact/[token]/page.tsx` (СОЗДАТЬ новый route group!)

**Важно:** Это публичная страница, НЕ требует авторизации!

```typescript
import { getPublicDocument } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { PreviewDocument } from "@/components/preview-document";

export default async function SharedArtifactPage({
  params,
}: {
  params: { token: string };
}) {
  // Получить публичный документ (БЕЗ проверки userId)
  const document = await getPublicDocument(params.token);

  if (!document) {
    notFound(); // 404 если токен неверный или документ приватный
  }

  // Рендер только артефакта (БЕЗ чата, БЕЗ истории)
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        <PreviewDocument
          document={{
            id: document.id,
            title: document.title,
            content: document.content || "",
            kind: document.kind,
          }}
          isReadonly={true}
        />
      </div>
    </div>
  );
}
```

**Layout для public pages:** `app/(share)/layout.tsx`

```typescript
export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
```

**Важно:** Отдельный route group `(share)` БЕЗ middleware авторизации!

---

#### 6.5 UI: Share Button в артефактах

**Обновить компоненты артефактов:**

**Файл:** `components/document.tsx` (или `artifacts/*/client.tsx`)

Добавить кнопку "Share" рядом с "Copy":

```tsx
import { useState } from "react";
import { ShareIcon, CheckIcon } from "./icons";

export function DocumentToolbar({
  documentId,
  documentCreatedAt,
  isPublic,
  shareToken,
}: {
  documentId: string;
  documentCreatedAt: Date;
  isPublic: boolean;
  shareToken?: string | null;
}) {
  const [sharing, setSharing] = useState(isPublic);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (sharing) {
      // Unshare
      await fetch(`/api/document/${documentId}/share`, {
        method: "DELETE",
        body: JSON.stringify({ createdAt: documentCreatedAt }),
      });
      setSharing(false);
    } else {
      // Share
      const res = await fetch(`/api/document/${documentId}/share`, {
        method: "POST",
        body: JSON.stringify({ createdAt: documentCreatedAt }),
      });
      const { shareUrl } = await res.json();

      // Копировать ссылку в буфер обмена
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setSharing(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant={sharing ? "default" : "outline"}
        onClick={handleShare}
      >
        {copied ? (
          <>
            <CheckIcon /> Ссылка скопирована
          </>
        ) : (
          <>
            <ShareIcon /> {sharing ? "Приватный" : "Поделиться"}
          </>
        )}
      </Button>

      {/* Existing Copy button */}
      <Button variant="outline" onClick={handleCopy}>
        <CopyIcon /> Копировать
      </Button>
    </div>
  );
}
```

**UX Flow:**
1. Пользователь создает артефакт (HTML презентацию)
2. Кликает "Поделиться"
3. Система генерирует токен, делает артефакт публичным
4. Ссылка автоматически копируется в буфер обмена
5. Toast notification: "Ссылка скопирована! Любой с этой ссылкой сможет просмотреть артефакт"
6. Пользователь отправляет ссылку боссу (Telegram, email, etc.)
7. Босс открывает → видит ТОЛЬКО артефакт (без переписки)

---

#### 6.6 Security Considerations

**1. Токены должны быть непредсказуемыми:**
- Используем `nanoid(32)` (32 символа) = 5.24e57 возможных комбинаций
- Практически невозможно угадать

**2. Проверка владения:**
- Только владелец документа может сделать его публичным
- API проверяет `doc.userId === session.user.id`

**3. Индексация поисковиками:**
- Добавить `<meta name="robots" content="noindex, nofollow">` на share pages
- Предотвращает индексацию Google/Yandex

**4. Rate limiting (опционально):**
- Ограничить количество share операций (10 в минуту)
- Предотвращает спам и злоупотребление

**5. Expiration (будущее):**
- Можно добавить `expiresAt` timestamp
- Автоматическое удаление токена через N дней

---

#### 6.7 Testing Checklist

**Backend:**
- [ ] POST `/api/document/[id]/share` → возвращает shareToken и shareUrl
- [ ] DELETE `/api/document/[id]/share` → делает приватным
- [ ] Только владелец может share/unshare (403 для чужих)
- [ ] shareToken уникальный (нет коллизий)

**Public Page:**
- [ ] `/share/artifact/[validToken]` → показывает артефакт
- [ ] `/share/artifact/[invalidToken]` → 404 Not Found
- [ ] Приватный документ (isPublic=false) → 404 даже с правильным токеном
- [ ] Публичная страница работает БЕЗ авторизации (incognito mode)

**UI:**
- [ ] Кнопка "Поделиться" в Text Artifact
- [ ] Кнопка "Поделиться" в Code Artifact
- [ ] Кнопка "Поделиться" в Sheet Artifact
- [ ] Клик → ссылка копируется в буфер обмена
- [ ] Toast: "Ссылка скопирована!"
- [ ] Кнопка меняется на "Приватный" после share

**Privacy:**
- [ ] Public page НЕ показывает историю чата
- [ ] Public page НЕ показывает имя пользователя
- [ ] Public page НЕ индексируется (noindex, nofollow)
- [ ] Сделать приватным → старая ссылка перестает работать (404)

**Edge Cases:**
- [ ] Удаленный документ → 404
- [ ] Документ без content → рендерится корректно
- [ ] Очень длинный Code Artifact → скролл работает
- [ ] Mobile view → адаптивный дизайн

---

#### 6.8 Files to Create/Update

**Создать новые файлы:**
- [ ] `app/(share)/share/artifact/[token]/page.tsx` - Public share page
- [ ] `app/(share)/layout.tsx` - Layout БЕЗ auth middleware
- [ ] `app/api/document/[id]/share/route.ts` - Share/Unshare API
- [ ] `components/preview-document.tsx` - Readonly preview компонент
- [ ] `lib/db/migrations/00XX_add_document_sharing.sql` - Migration

**Обновить существующие:**
- [ ] `lib/db/schema.ts` - добавить isPublic, shareToken в Document
- [ ] `lib/db/queries.ts` - добавить shareDocument, unshareDocument, getPublicDocument
- [ ] `components/document.tsx` - добавить Share button
- [ ] `artifacts/text/client.tsx` - добавить DocumentToolbar
- [ ] `artifacts/code/client.tsx` - добавить DocumentToolbar
- [ ] `artifacts/sheet/client.tsx` - добавить DocumentToolbar
- [ ] `middleware.ts` - исключить `/share/*` из auth проверки

---

#### 6.9 Оценка времени

| Задача | Время |
|--------|-------|
| Database schema + migration | 1 час |
| Database queries (share/unshare/get) | 1 час |
| API endpoint `/api/document/[id]/share` | 2 часа |
| Public share page + layout | 3 часа |
| UI: Share buttons в артефактах | 2 часа |
| Preview document component | 2 часа |
| Testing (backend + frontend + privacy) | 3 часа |
| Bug fixes and polish | 2 часа |
| **ИТОГО** | **16 часов (2-3 дня)** |

---

#### 6.10 Future Enhancements (Post Stage 4)

1. **Expiring Links** - Ссылка действует 7 дней
2. **Password Protection** - Опциональный пароль для доступа
3. **View Counter** - Сколько раз открыли ссылку
4. **Embed Mode** - `?embed=true` для iframe
5. **Download Button** - Скачать HTML/PDF/DOCX
6. **Custom Domain** - share.familyai.com вместо длинного URL

---

## 🔧 Критические файлы (чек-лист для реализации)

### База данных:
- [ ] `lib/db/schema.ts` - добавить Project, ProjectFile, обновить Chat
- [ ] `lib/db/queries.ts` - CRUD для проектов и файлов
- [ ] Запустить `npm run db:generate` - создать миграцию

### API:
- [ ] `app/api/files/upload/route.ts` - **СОЗДАТЬ** (починит кнопку скрепки)
- [ ] `app/api/project/route.ts` - список и создание проектов
- [ ] `app/api/project/[id]/route.ts` - обновление и архивирование
- [ ] `app/api/project/[id]/upload/route.ts` - загрузка файлов в проект
- [ ] `app/(chat)/api/chat/route.ts` - добавить projectId в saveChat
- [ ] `app/(chat)/api/chat/schema.ts` - добавить projectId в Zod schema

### AI:
- [ ] `lib/ai/tools/read-project-files.ts` - **СОЗДАТЬ** новый tool
- [ ] `app/(chat)/api/chat/route.ts` - добавить tool в streamText
- [ ] `lib/ai/agents/*.md` - обновить все 8 промптов

### UI:
- [ ] `components/project-selector.tsx` - **СОЗДАТЬ** компонент выбора
- [ ] `components/agent-selector.tsx` - добавить projectId prop
- [ ] `components/sidebar-history.tsx` - группировка по проектам
- [ ] `app/projects/page.tsx` - **СОЗДАТЬ** список проектов
- [ ] `app/project/[id]/page.tsx` - **СОЗДАТЬ** страницу проекта

### Artifact Sharing (Фаза 6):
- [ ] `lib/db/schema.ts` - добавить isPublic, shareToken в Document
- [ ] `lib/db/queries.ts` - shareDocument, unshareDocument, getPublicDocument
- [ ] `app/api/document/[id]/share/route.ts` - **СОЗДАТЬ** Share/Unshare API
- [ ] `app/(share)/share/artifact/[token]/page.tsx` - **СОЗДАТЬ** Public share page
- [ ] `app/(share)/layout.tsx` - **СОЗДАТЬ** Layout БЕЗ auth
- [ ] `components/preview-document.tsx` - **СОЗДАТЬ** Readonly preview
- [ ] `components/document.tsx` - добавить Share button
- [ ] `middleware.ts` - исключить `/share/*` из auth проверки

---

## ✅ Порядок реализации (пошагово)

### День 1-2: Backend (база данных)
1. Обновить `lib/db/schema.ts` - добавить Project, ProjectFile
2. Запустить `npm run db:generate` - создать миграцию
3. Обновить `lib/db/queries.ts` - CRUD функции
4. **ВАЖНО:** Создать `/api/files/upload` - починит существующую кнопку скрепки
5. Протестировать через Drizzle Studio

### День 3: API endpoints
1. Создать `/api/project` - список и создание
2. Создать `/api/project/[id]` - обновление и архивирование
3. Создать `/api/project/[id]/upload` - загрузка файлов
4. Обновить chat API для projectId
5. Протестировать через Postman/curl

### День 4: AI Integration
1. Создать `lib/ai/tools/read-project-files.ts`
2. Добавить tool в chat endpoint
3. Обновить промпты всех 8 агентов
4. Протестировать: загрузить файл → спросить агента

### День 5-6: UI
1. Создать Project Selector component
2. Создать Projects Page
3. Создать Project Page
4. Обновить Sidebar (группировка по проектам)
5. Обновить Agent Selector (передавать projectId)

### День 7: Production
1. Seed скрипт (создать тестовые проекты)
2. Миграция на production БД
3. Deploy на Vercel
4. Тестирование с реальными пользователями

---

## 🧪 Тестирование

### 1. Существующая функциональность (attachments):
- [ ] Открыть любой чат → кликнуть скрепку
- [ ] Загрузить PDF → увидеть в сообщении
- [ ] Отправить → проверить сохранение в БД

### 2. Backend (проекты):
- [ ] API создания проекта → проверить в Drizzle Studio
- [ ] API загрузки файла → проверить Vercel Blob + БД
- [ ] Создать чат с projectId → проверить связь

### 3. UI (навигация):
- [ ] Главная → кликнуть "Выбрать проект"
- [ ] Создать проект → увидеть в списке
- [ ] Кликнуть проект → загрузить файл
- [ ] Выбрать агента → создать чат
- [ ] Sidebar → чаты сгруппированы по проектам

### 4. AI (чтение файлов):
- [ ] Создать проект "Test"
- [ ] Загрузить README.md с текстом "This is a test file"
- [ ] Создать чат в проекте
- [ ] Спросить: "Что в README?"
- [ ] Проверить что агент прочитал файл

### 5. Edge Cases:
- [ ] Старые чаты без projectId работают
- [ ] Попытка readProjectFiles без проекта → корректное сообщение
- [ ] Удалить файл → tool не ломается
- [ ] Архивировать проект → чаты остаются доступными

---

## 📦 После завершения

1. **Создать ADR 005:** `docs/decisions/005-project-system.md`
2. **Обновить CHANGELOG.md:** Версия 2.2.0
3. **Обновить docs/ai-capabilities.md:** Добавить `readProjectFiles`
4. **Обновить README.md:** Упомянуть проекты в Features
5. **Seed скрипт:** `lib/db/seed.ts` - создать тестовые проекты

---

## 💡 Будущие улучшения (Stage 5+)

**Artifact Sharing (Stage 4 - Фаза 6):**
- ✅ Artifact-only sharing - публичные ссылки на артефакты БЕЗ истории чата
- ⏭️ Expiring links - ссылка действует 7 дней
- ⏭️ Password protection - опциональный пароль для доступа
- ⏭️ Download buttons - скачать HTML/PDF/DOCX
- ⏭️ View counter - статистика просмотров

**File Management (Stage 5):**
1. **Vector Search** - Embeddings для семантического поиска
2. **File Chunking** - Разбивать большие файлы на части
3. **Git Integration** - Загрузка репозитория целиком
4. **Web Scraping** - Добавить URL в базу знаний
5. **Project Templates** - Шаблоны (Marketing, Development, etc.)
6. **Project Sharing** - Совместная работа (Vladimir + Julia)
7. **File Versioning** - История изменений файлов
8. **Smart Context** - Автоматический выбор релевантных файлов

---

## 🤔 Вопросы для обсуждения

1. **Навигация:** Проекты опциональны (кнопка на главной) или обязательны (Project Selector первым)?
2. **Типы файлов:** Какие форматы приоритетны? (PDF/DOCX/MD/Code/Images)
3. **Лимиты:** Максимум файлов/размер на проект?
4. **Поиск:** Простой текстовый поиск или сразу vector search?
5. **UI для загрузки:** Drag & drop или только кнопка?

---

**Документ создан:** 2026-01-27
**Версия:** 1.0
**Статус:** Ожидает обратной связи
