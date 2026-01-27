# Архитектура системы артефактов (Artifacts)

## Обзор

Система артефактов позволяет AI создавать интерактивные документы:
- **text** - текстовые документы (статьи, эссе)
- **code** - код (Python, HTML)
- **sheet** - таблицы (CSV)

**HTML презентации** автоматически отображаются как визуальный preview (iframe), Python код показывается в редакторе с возможностью выполнения.

## Полный стек работы артефактов

### 1. Серверная часть (создание артефактов)

#### Создание артефакта

**Файл:** `lib/ai/tools/create-document.ts`

```
User запрос → AI вызывает createDocument tool →
→ dataStream.write("data-kind") → вид артефакта (text/code/sheet)
→ dataStream.write("data-id") → ID документа
→ dataStream.write("data-title") → заголовок
→ dataStream.write("data-clear") → очистка контента
→ documentHandler.onCreateDocument() → генерация контента
→ dataStream.write("data-finish") → завершение
```

#### Генерация контента для CODE артефакта

**Файл:** `artifacts/code/server.ts`

```typescript
export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  onCreateDocument: async ({ title, dataStream }) => {
    // Генерация кода через AI
    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: codePrompt,  // ← ПРОМПТ ОПРЕДЕЛЯЕТ ЧТО ГЕНЕРИРОВАТЬ
      prompt: title,
      schema: z.object({ code: z.string() }),
    });

    // Streaming кода кусками
    for await (const delta of fullStream) {
      if (type === "object") {
        dataStream.write({
          type: "data-codeDelta",  // ← ВОТ КЛЮЧ!
          data: code,
          transient: true,
        });
      }
    }

    return draftContent;
  },
});
```

**Промпт для генерации (`lib/ai/prompts.ts`):**

```typescript
export const codePrompt = `
You are a code generator that creates executable code snippets or HTML documents.

**For HTML/Web content (presentations, web pages, visualizations):**
- Generate PURE HTML starting with <!DOCTYPE html>
- Include all necessary CSS in <style> tags
- Make it self-contained and visually appealing
- DO NOT wrap HTML in Python code or comments
- DO NOT add any text before <!DOCTYPE html> or after </html>
- Return ONLY the HTML document itself

**For Python code snippets:**
1. Each snippet should be complete and runnable on its own
2. Prefer using print() statements to display outputs
...
`;
```

**Ключевые моменты:**
- Промпт инструктирует AI генерировать **чистый HTML** без обёрток
- Для HTML: начинается с `<!DOCTYPE html>`, ничего лишнего
- Для Python: обычный Python код с комментариями

**Зарегистрированные handlers:**
```typescript
// lib/artifacts/server.ts
export const documentHandlersByArtifactKind = [
  textDocumentHandler,  // data-textDelta
  codeDocumentHandler,  // data-codeDelta
  sheetDocumentHandler, // data-sheetDelta
];
```

### 2. Клиентская часть (отображение артефактов)

#### Stream обработка

**Файл:** `components/data-stream-handler.tsx`

```typescript
export function DataStreamHandler() {
  const { dataStream } = useDataStream();
  const { artifact, setArtifact, setMetadata } = useArtifact();

  useEffect(() => {
    for (const delta of newDeltas) {
      // 1. Находим определение артефакта
      const artifactDefinition = artifactDefinitions.find(
        (def) => def.kind === artifact.kind
      );

      // 2. Вызываем onStreamPart для обработки delta
      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,  // ← сюда попадает data-codeDelta
          setArtifact,
          setMetadata,
        });
      }

      // 3. Обрабатываем системные события
      switch (delta.type) {
        case "data-id": // установка ID
        case "data-title": // установка заголовка
        case "data-kind": // установка типа
        case "data-clear": // очистка
        case "data-finish": // завершение
      }
    }
  }, [dataStream]);
}
```

#### Определение CODE артефакта

**Файл:** `artifacts/code/client.tsx`

```typescript
export const codeArtifact = new Artifact<"code", Metadata>({
  kind: "code",

  // 1. ИНИЦИАЛИЗАЦИЯ (вызывается 1 раз при создании)
  initialize: ({ setMetadata }) => {
    setMetadata({
      outputs: [],
      isHTML: false,
    });
  },

  // 2. ОБРАБОТКА СТРИМА (вызывается для каждого delta)
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === "data-codeDelta") {
      // Обновляем content артефакта
      setArtifact((draft) => ({
        ...draft,
        content: streamPart.data,  // ← ВОТ КОНТЕНТ!
        status: "streaming",
      }));

      // Обновляем metadata
      setMetadata((metadata) => ({
        ...metadata,
        isHTML: isHTMLCode(streamPart.data),
      }));
    }
  },

  // 3. РЕНДЕР КОМПОНЕНТА (вызывается на каждый render)
  content: ({ metadata, content, ...props }) => {
    const isHTML = isHTMLCode(content);

    // ДЛЯ HTML - ПОКАЗЫВАЕМ IFRAME
    if (isHTML) {
      return (
        <div className="h-full w-full overflow-hidden">
          <iframe
            srcDoc={content}
            className="h-full w-full border-0"
            title="HTML Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      );
    }

    // ДЛЯ КОДА - ПОКАЗЫВАЕМ РЕДАКТОР
    return (
      <>
        <div className="px-1">
          <CodeEditor content={content} {...props} />
        </div>
      </>
    );
  },

  // 4. ACTIONS (кнопки управления)
  actions: [
    {
      icon: <DownloadIcon />,
      label: "Download",
      onClick: ({ content }) => {
        // Скачать HTML файл
      },
      isDisabled: ({ content }) => !isHTMLCode(content),
    },
    // ... другие кнопки
  ],
});
```

#### Рендер артефакта

**Файл:** `components/artifact.tsx`

```typescript
// Находим определение артефакта
const artifactDefinition = artifactDefinitions.find(
  (def) => def.kind === artifact.kind
);

// Рендерим content компонент
<artifactDefinition.content
  content={artifact.content}  // ← ВОТ КОНТЕНТ ИЗ useArtifact
  metadata={metadata}         // ← METADATA ИЗ useArtifact
  setMetadata={setMetadata}
  // ... другие props
/>
```

### 3. State Management

**Файл:** `hooks/use-artifact.ts`

```typescript
export function useArtifact() {
  // Artifact state хранится в SWR с ключом "artifact"
  const { data: localArtifact, mutate: setLocalArtifact } =
    useSWR<UIArtifact>("artifact", null, {
      fallbackData: initialArtifactData,
    });

  // Metadata хранится в SWR с ключом "artifact-metadata-{documentId}"
  const { data: localArtifactMetadata, mutate: setLocalArtifactMetadata } =
    useSWR<any>(
      `artifact-metadata-${artifact.documentId}`,
      null,
      { fallbackData: null }
    );

  return {
    artifact,        // { documentId, content, kind, title, status, isVisible }
    setArtifact,     // функция обновления артефакта
    metadata,        // metadata артефакта (outputs, isHTML, etc)
    setMetadata,     // функция обновления metadata
  };
}
```

## Решённые проблемы

### ✅ Проблема 1: HTML показывался как код

**Причина:** Проверка типа контента опиралась на metadata, которая не обновлялась для существующих артефактов.

**Решение ([artifacts/code/client.tsx:150](artifacts/code/client.tsx#L150)):**
```typescript
content: ({ content, ...props }) => {
  // Проверяем content напрямую, а не metadata
  const isHTML = isHTMLCode(content);

  if (isHTML) {
    return <iframe srcDoc={content} />;
  }

  return <CodeEditor content={content} />;
}
```

### ✅ Проблема 2: Артефакты исчезали после перезагрузки

**Причина:** Tool results (`tool-createDocument`) фильтровались при сохранении сообщений для экономии токенов, поэтому кнопки для открытия артефактов исчезали.

**Решение ([app/(chat)/api/chat/route.ts:360-379](app/(chat)/api/chat/route.ts#L360-L379)):**
```typescript
const filteredParts = currentMessage.parts.filter((part: any) => {
  const type = part.type;

  // Сохраняем текст и step markers
  if (type === 'text' || type === 'step-start' || type === 'step-finish') {
    return true;
  }

  // Сохраняем результаты артефактов (они маленькие и нужны для UI)
  if (type === 'tool-createDocument' || type === 'tool-updateDocument') {
    return true;
  }

  // Фильтруем остальные tool results (web search и т.д.)
  return false;
});
```

**Результат:**
- Кнопки артефактов сохраняются в истории
- После закрытия артефакта его можно открыть снова
- После перезагрузки страницы кнопка остаётся

### ✅ Проблема 3: HTML генерировался с Python комментариями

**Причина:** Промпт `codePrompt` всегда генерировал Python код, даже для HTML.

**Решение ([lib/ai/prompts.ts:140-189](lib/ai/prompts.ts#L140-L189)):**
Обновили промпт для различия между HTML и Python:
```typescript
**For HTML/Web content (presentations, web pages, visualizations):**
- Generate PURE HTML starting with <!DOCTYPE html>
- DO NOT wrap HTML in Python code or comments
- DO NOT add any text before <!DOCTYPE html> or after </html>
- Return ONLY the HTML document itself
```

**Результат:**
- HTML генерируется чистым, без обёрток
- Презентации показываются визуально с первого раза
- Python код остаётся с комментариями как и был

## Текущая реализация

### Обнаружение HTML

**Файл:** `artifacts/code/client.tsx`

```typescript
function isHTMLCode(code: string): boolean {
  const trimmed = code.trim().toLowerCase();
  return (
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<html") ||
    (trimmed.includes("<head") && trimmed.includes("<body"))
  );
}
```

### Рендеринг артефакта

**Файл:** `artifacts/code/client.tsx`

```typescript
content: ({ content, ...props }) => {
  // Проверяем content напрямую на каждый render
  const isHTML = isHTMLCode(content);

  // HTML → iframe preview
  if (isHTML) {
    return (
      <div className="h-full w-full overflow-hidden">
        <iframe
          srcDoc={content}
          className="h-full w-full border-0"
          title="HTML Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    );
  }

  // Python/другой код → редактор
  return (
    <>
      <div className="px-1">
        <CodeEditor content={content} {...props} />
      </div>
      {metadata?.outputs && metadata.outputs.length > 0 && (
        <Console consoleOutputs={metadata.outputs} />
      )}
    </>
  );
}
```

### Actions для HTML

```typescript
actions: [
  {
    icon: <DownloadIcon size={18} />,
    label: "Download",
    description: "Download HTML file",
    onClick: ({ content }) => {
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "presentation.html";
      a.click();
      URL.revokeObjectURL(url);
    },
    isDisabled: ({ content }) => !isHTMLCode(content),
  },
  {
    icon: <EyeIcon size={18} />,
    label: "Open",
    description: "Open HTML in new window",
    onClick: ({ content }) => {
      const blob = new Blob([content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    },
    isDisabled: ({ content }) => !isHTMLCode(content),
  },
  // ... другие actions
]
```

## Возможные улучшения

### Вариант: Отдельный тип артефакта "html"

Вместо универсального "code" можно создать отдельный тип "html":

**Плюсы:**
- Чистая архитектура
- Отдельная логика для HTML
- AI выбирает правильный kind автоматически

**Минусы:**
- Больше кода
- Нужна миграция существующих артефактов
- Нужно обновить AI промпты

**Решение:** Пока оставляем текущую реализацию, она работает хорошо.

## Диаграмма полного потока

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER REQUEST                                             │
│    "Создай HTML презентацию про AI"                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AI TOOL CALL                                             │
│    createDocument({                                         │
│      title: "HTML презентация про AI",                      │
│      kind: "code"                                           │
│    })                                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. SERVER GENERATION (codeDocumentHandler)                  │
│    ├─ streamObject(                                         │
│    │    model: "artifact-model",                            │
│    │    system: codePrompt  ← "Generate PURE HTML..."       │
│    │    prompt: "HTML презентация про AI"                   │
│    │  )                                                      │
│    │                                                         │
│    ├─ dataStream.write("data-kind", "code")                 │
│    ├─ dataStream.write("data-id", "uuid-123")               │
│    ├─ dataStream.write("data-title", "HTML презентация")    │
│    ├─ dataStream.write("data-codeDelta", "<!DOCTYPE html>") │
│    ├─ dataStream.write("data-codeDelta", "<html>...")       │
│    ├─ ...streaming HTML chunks...                           │
│    ├─ dataStream.write("data-finish")                       │
│    └─ saveDocument({ content: html, kind: "code" })  → DB   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CLIENT STREAM PROCESSING (DataStreamHandler)             │
│    For each delta in dataStream:                            │
│      ├─ "data-kind" → setArtifact({ kind: "code" })         │
│      ├─ "data-id" → setArtifact({ documentId: "uuid-123" }) │
│      ├─ "data-title" → setArtifact({ title: "..." })        │
│      │                                                       │
│      ├─ "data-codeDelta" →                                  │
│      │    ├─ codeArtifact.onStreamPart({                    │
│      │    │    streamPart: delta,                           │
│      │    │    setArtifact, setMetadata                     │
│      │    │  })                                             │
│      │    ├─ setArtifact({ content: html, status: "streaming" })│
│      │    └─ setMetadata({ isHTML: true })                  │
│      │                                                       │
│      └─ "data-finish" → setArtifact({ status: "idle" })     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. ARTIFACT RENDER (artifact.content)                       │
│    content: ({ content }) => {                              │
│      const isHTML = isHTMLCode(content);  ← CHECK           │
│                                                             │
│      if (isHTML) {                                          │
│        return (                                             │
│          <iframe                                            │
│            srcDoc={content}  ← ВИЗУАЛЬНЫЙ PREVIEW           │
│            sandbox="allow-scripts allow-same-origin"        │
│          />                                                  │
│        );                                                    │
│      }                                                       │
│                                                             │
│      return <CodeEditor content={content} />;  ← РЕДАКТОР   │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 6. MESSAGE SAVE (onFinish)                                  │
│    ├─ Filter message parts:                                 │
│    │    ✓ text                                              │
│    │    ✓ step-start / step-finish                          │
│    │    ✓ tool-createDocument  ← СОХРАНЯЕТСЯ!               │
│    │    ✓ tool-updateDocument  ← СОХРАНЯЕТСЯ!               │
│    │    ✗ other tool results (web search, etc.)             │
│    │                                                         │
│    └─ saveMessages(filteredMessages)  → DB                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 7. PAGE RELOAD                                              │
│    ├─ Load messages from DB                                 │
│    ├─ Render message with tool-createDocument part          │
│    ├─ Show DocumentToolResult button  ← КНОПКА ЕСТЬ!        │
│    └─ Click → setArtifact({ documentId, kind, ... })        │
│         → Load artifact from /api/document?id=uuid-123      │
│         → Render in iframe                                  │
└─────────────────────────────────────────────────────────────┘
```

## Итоги

### ✅ Что работает

1. **HTML презентации** отображаются визуально (iframe), а не как код
2. **Python код** показывается в редакторе с возможностью выполнения
3. **Артефакты сохраняются** после перезагрузки страницы
4. **Кнопки для открытия** артефактов остаются в чате
5. **Чистый HTML** генерируется без Python обёрток

### 🎯 Текущая архитектура

- **Тип артефакта:** `code` (универсальный для Python и HTML)
- **Определение типа:** По содержимому (`isHTMLCode()` проверяет `<!DOCTYPE html>`)
- **Рендеринг:** Динамический выбор между iframe и CodeEditor
- **Сохранение:** Tool results для артефактов сохраняются в истории
- **Безопасность:** iframe с `sandbox="allow-scripts allow-same-origin"`

### 📝 Changelog

**2026-01-27:**
- ✅ Исправлено исчезновение артефактов после перезагрузки
- ✅ Исправлена генерация чистого HTML без Python обёрток
- ✅ Добавлены actions для HTML (Download, Open)
- ✅ Обновлена документация

---

**Версия документа:** 2.0
**Последнее обновление:** 2026-01-27

## Ключевые файлы

### Серверная часть (генерация)

1. **[lib/ai/prompts.ts](lib/ai/prompts.ts)** - промпты для генерации кода/HTML
2. **[artifacts/code/server.ts](artifacts/code/server.ts)** - обработчик создания code артефактов
3. **[lib/artifacts/server.ts](lib/artifacts/server.ts)** - registry всех handlers
4. **[lib/ai/tools/create-document.ts](lib/ai/tools/create-document.ts)** - AI tool для создания артефактов

### Клиентская часть (отображение)

1. **[artifacts/code/client.tsx](artifacts/code/client.tsx)** - определение code артефакта (render, actions)
2. **[components/data-stream-handler.tsx](components/data-stream-handler.tsx)** - обработка streaming updates
3. **[components/artifact.tsx](components/artifact.tsx)** - рендер артефакта в UI
4. **[hooks/use-artifact.ts](hooks/use-artifact.ts)** - state management (SWR)
5. **[components/document.tsx](components/document.tsx)** - кнопка для открытия артефакта

### Сохранение сообщений

1. **[app/(chat)/api/chat/route.ts](app/(chat)/api/chat/route.ts)** - фильтрация tool results при сохранении

## Отладка

### Проблемы с кешированием

Если изменения не применяются:

```bash
# 1. Остановить dev server (Ctrl+C)
# 2. Очистить Next.js кеш
rm -rf .next

# 3. Перезапустить dev server
npm run dev

# 4. Очистить browser cache (Cmd+Shift+R в Chrome)
```

### Проблемы с существующими артефактами

**Важно:** Изменения в коде влияют только на **НОВЫЕ** артефакты.

Старые артефакты в БД:
- Уже сохранены с определённым content
- Если промпт был изменён - старые артефакты не обновятся
- Нужно создать новый артефакт для проверки

### Логи

Полезные логи для отладки:

```typescript
// lib/db/queries.ts - логи сохранения документов
console.log('[saveDocument] Saving document:', { id, title, kind });

// app/(chat)/api/chat/route.ts - логи фильтрации tool results
console.log('[onFinish] Filtering parts:', filteredParts.map(p => p.type));
```
