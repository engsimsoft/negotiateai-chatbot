# Анализ ТЗ-08: File Viewer

**Дата анализа:** 2026-02-05

---

## Резюме

Lightbox-модалка для просмотра файлов проекта. Клик по файлу → полноэкранный оверлей с содержимым или fallback "Скачать". Radix Dialog даёт accessibility бесплатно.

---

## Ключевые находки

### Что уже есть в проекте

| Компонент | Путь | Использование |
|-----------|------|---------------|
| Radix Dialog | `components/ui/dialog.tsx` | Shell модалки (focus trap, ESC, click outside — бесплатно) |
| MarkdownViewer | `artifacts/markdown/client.tsx` | Рендеринг .md файлов (чистый, без зависимостей) |
| ProjectFilesCard | `components/projects/project-files-card.tsx` | Список файлов, нужно добавить onClick |
| ProjectFile тип | `lib/db/schema.ts` | name, url, mimeType, metadata |

### MarkdownViewer — можно использовать

```tsx
// Чистый компонент, принимает только content: string
const MarkdownViewer = memo(function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none ...">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
});
```

**Решение:** Вынести в shared компонент `components/markdown-viewer.tsx` или импортировать напрямую.

### Зависимости — уже установлены

- `react-markdown` ✅
- `remark-gfm` ✅
- `@radix-ui/react-dialog` ✅

---

## Архитектурные решения

### 1. Структура компонента

```
components/
└── file-viewer/
    ├── file-viewer.tsx        # Главный компонент (модалка)
    ├── file-viewer-header.tsx # Header (close, title, download)
    ├── file-viewer-content.tsx # Switch по типу файла
    └── renderers/
        ├── image-renderer.tsx
        ├── pdf-renderer.tsx
        ├── text-renderer.tsx
        ├── markdown-renderer.tsx
        ├── csv-renderer.tsx
        ├── extracted-content-renderer.tsx  # Excel/PPTX
        └── unsupported-renderer.tsx
```

### 2. Определение типа файла

Приоритет: `contentType` (mimeType) → расширение файла

```tsx
function getFileType(file: { contentType: string; name: string }): FileType {
  const mime = file.contentType?.toLowerCase() || '';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // Images
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return 'image';
  }
  // PDF
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  // ... etc
}
```

### 3. Навигация между файлами

```tsx
interface FileViewerProps {
  file: ProjectFile;
  files?: ProjectFile[];      // Массив файлов для навигации
  currentIndex?: number;       // Индекс текущего файла
  onClose: () => void;
  onNavigate?: (index: number) => void;
}
```

При открытии из папки — передаём все файлы папки + индекс.

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Большие текстовые файлы | Средняя | Средняя | Ограничение 500KB + "Скачать" |
| CORS при fetch файлов | Низкая | Высокая | Vercel Blob на том же домене |
| PDF не загружается в iframe | Низкая | Средняя | Fallback на "Скачать" |

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:**
- Один компонент с 7 рендерерами
- Radix даёт 80% accessibility бесплатно
- MarkdownViewer уже есть
- Навигация — дополнительная логика, но не сложная

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-07C1 завершён (папки и файлы на странице проекта)
- [x] Radix Dialog установлен
- [x] react-markdown установлен

**Затронутые компоненты:**
- `components/projects/project-files-card.tsx` — добавить onClick для открытия FileViewer
- `components/file-viewer/` — новая папка (создать)
