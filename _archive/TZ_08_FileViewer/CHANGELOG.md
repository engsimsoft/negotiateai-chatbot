# Changelog ТЗ-08: File Viewer

> История изменений в рамках этого ТЗ.
> После завершения — переносится в главный CHANGELOG.md

---

## Сессия 5 — 2026-02-05

### Added (Этап 4 — Office форматы + Финализация)
- `renderers/extracted-content-renderer.tsx` — просмотр Excel/PPTX через extractedContent
  - Автоопределение табличной структуры для Excel
  - Форматированный текст для PPTX (разбивка по слайдам)
  - Fallback если extractedContent отсутствует

### Changed
- `file-viewer-content.tsx` — добавлены case для excel/presentation

### Documentation
- `package.json` — версия 3.7.0
- `CHANGELOG.md` — добавлена секция [3.7.0]
- `SIMPLY_STATUS.md` — обновлена версия

### Already Implemented (из ранних этапов)
- Анимация появления (Radix animate-in/out, fade + zoom)
- Мобильная адаптация (touch targets 48px, responsive padding)
- Индикатор позиции (1/5) в header

### Files
```
components/file-viewer/renderers/extracted-content-renderer.tsx (создан)
components/file-viewer/file-viewer-content.tsx (изменён)
package.json (версия 3.7.0)
CHANGELOG.md (обновлён)
SIMPLY_STATUS.md (обновлён)
```

---

## Сессия 4 — 2026-02-05

### Added (Этап 3 — Текстовые форматы)
- `components/markdown-viewer.tsx` — shared компонент для рендеринга Markdown (вынесен из artifacts)
- `renderers/text-renderer.tsx` — просмотр .txt файлов (моношрифт, 500KB лимит)
- `renderers/markdown-renderer.tsx` — просмотр .md файлов (GFM, prose стили)
- `renderers/csv-renderer.tsx` — просмотр .csv как таблица (парсер, 1000 строк лимит)

### Changed
- `artifacts/markdown/client.tsx` — использует shared MarkdownViewer
- `file-viewer-content.tsx` — добавлены case для text/markdown/csv

### Функциональность
- .txt файлы отображаются с моноширинным шрифтом
- .md файлы рендерятся с форматированием (headers, lists, tables, code blocks)
- .csv файлы парсятся и отображаются как таблица со sticky header
- Файлы > 500KB обрезаются с уведомлением + кнопка "Скачать полный файл"
- CSV > 1000 строк обрезается
- Loading/Error состояния для всех рендереров

### Files
```
components/markdown-viewer.tsx (создан — shared)
components/file-viewer/renderers/text-renderer.tsx (создан)
components/file-viewer/renderers/markdown-renderer.tsx (создан)
components/file-viewer/renderers/csv-renderer.tsx (создан)
components/file-viewer/file-viewer-content.tsx (изменён)
artifacts/markdown/client.tsx (изменён — использует shared)
```

---

## Сессия 3 — 2026-02-05

### Added (Этап 2 — ЗАВЕРШЁН ✅)
- `file-viewer-content.tsx` — switch по типу файла
- `renderers/image-renderer.tsx` — просмотр изображений (object-fit: contain, loading spinner, error fallback)
- `renderers/pdf-renderer.tsx` — просмотр PDF (iframe, fallback кнопки)

### Changed
- `file-viewer.tsx` — заменён UnsupportedRenderer на FileViewerContent
- `index.ts` — добавлены экспорты новых компонентов

### Функциональность
- Изображения (PNG, JPG, GIF, WebP, SVG) отображаются с сохранением пропорций
- Loading spinner пока изображение загружается
- При ошибке загрузки изображения — fallback с кнопкой "Скачать"
- PDF файлы отображаются во встроенном iframe
- Fallback кнопки для PDF: "Открыть в новой вкладке", "Скачать"
- Неподдерживаемые форматы → UnsupportedRenderer (как раньше)

### Мануальный тест
Пользователь подтвердил: "всё идеально работает, 100%"

### Files
```
components/file-viewer/file-viewer-content.tsx (создан)
components/file-viewer/renderers/image-renderer.tsx (создан)
components/file-viewer/renderers/pdf-renderer.tsx (создан)
components/file-viewer/file-viewer.tsx (изменён)
components/file-viewer/index.ts (изменён)
```

---

## Сессия 2 — 2026-02-05

### Added (Этап 1 — ЗАВЕРШЁН ✅)
- `components/file-viewer/` — новая папка компонента
- `types.ts` — типы ViewerFile, FileViewerProps, FileRendererProps
- `utils.ts` — getFileType, getFileIconComponent, formatFileSize
- `file-viewer.tsx` — главный компонент (Radix Dialog, keyboard nav)
- `file-viewer-header.tsx` — header (✕, title, 1/5, download)
- `renderers/unsupported-renderer.tsx` — fallback для неподдерживаемых форматов
- `index.ts` — публичные экспорты

### Changed
- `components/projects/project-files-card.tsx` — добавлен onClick на файлы, интеграция FileViewer

### Функциональность
- Клик по файлу → модалка открывается
- Escape / клик по backdrop → закрывает
- Стрелки ← → → навигация между файлами
- Кнопка "Скачать" работает
- Индикатор позиции (1/5)
- Focus trap, ARIA атрибуты (от Radix)

### Мануальный тест
Пользователь подтвердил: "очень красиво, очень элегантно работает"

### Files
```
components/file-viewer/index.ts
components/file-viewer/types.ts
components/file-viewer/utils.ts
components/file-viewer/file-viewer.tsx
components/file-viewer/file-viewer-header.tsx
components/file-viewer/renderers/unsupported-renderer.tsx
components/projects/project-files-card.tsx (изменён)
```

---

## Сессия 1 — 2026-02-05

### Added
- Создана папка specs/TZ_08_FileViewer/
- Проведён анализ кодовой базы
- Составлен ANALYSIS.md с архитектурными решениями
- Составлен ROADMAP.md (4 этапа)

### Ключевые решения
- Radix Dialog для shell модалки (accessibility бесплатно)
- Переиспользуем MarkdownViewer из artifacts/
- Один ROADMAP с 4 этапами (не два проекта)
- Навигация стрелками обязательна с первого релиза

### Files
```
specs/TZ_08_FileViewer/TZ_08_FILE_VIEWER.md
specs/TZ_08_FileViewer/SPEC.md
specs/TZ_08_FileViewer/ANALYSIS.md
specs/TZ_08_FileViewer/ROADMAP.md
specs/TZ_08_FileViewer/CHANGELOG.md
specs/TZ_08_FileViewer/HANDOFF.md
```
