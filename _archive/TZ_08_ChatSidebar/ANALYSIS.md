# Анализ ТЗ-08: Chat Sidebar (Панель материалов чата)

## Резюме

Добавить кнопку-иконку в правый верхний угол чата (header), которая открывает правую панель со списком всех артефактов и вложений текущего чата. Референс — Claude.ai "Open sidebar".

---

## Затронутые файлы (изучены)

| Файл | Что делает | Как затрагивается |
|------|-----------|-------------------|
| `components/chat-header.tsx` | Header чата (sticky, h-14) | + кнопка toggle sidebar |
| `components/chat.tsx` | Главный контейнер чата | + state, передача данных в sidebar |
| `components/artifact.tsx` | Панель артефакта (full-screen overlay) | Не трогаем, но учитываем coexistence |
| `components/message.tsx` | Рендер сообщений | Источник данных: tool-createDocument, file parts |
| `components/document-preview.tsx` | Карточка артефакта (компактная) | Переиспользуем паттерн |
| `components/preview-attachment.tsx` | Превью вложения | Переиспользуем компонент |
| `components/file-viewer/` | Система превью файлов (ТЗ-08 v3.7.0) | Переиспользуем для вложений |
| `components/image-lightbox.tsx` | Полноэкранный просмотр изображений | Переиспользуем для вложений-изображений |
| `lib/types.ts` | Типы (ChatMessage, Attachment) | Используем существующие типы |
| `hooks/use-artifact.ts` | Zustand store артефакта | Используем setArtifact для открытия |

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ
- Кнопка в правом верхнем углу header — паттерн уже заложен (`chat-header.tsx:114`, `ml-auto` блок)
- Три группы (Артефакты, Вложения, Итоги) — логично, "Итоги" отложены
- Не трогать артефакты/canvas/layout — правильный подход, минимальная инвазивность

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|---------------------|
| 1 | "Панель справа" (не уточнено) | **Push-drawer с slide-in анимацией** (как `manager-drawer.tsx`) | В проекте уже есть паттерн правой панели: `fixed right-0 top-[3.5rem] z-30 w-[400px]` с `translate-x-full → translate-x-0`. НО: Artifact overlay (`artifact.tsx:279`) занимает `z-50 w-dvw h-dvh` — при открытии артефакта sidebar полностью скрыт. Поэтому sidebar не должен конфликтовать — просто прячется под overlay. |
| 2 | "Кнопка-иконка документ/листок" | **`PanelRight` иконка из Lucide** (как в Claude.ai) | Referencing Claude.ai — они используют "panel right" иконку. В Lucide это `PanelRight` или `SidebarRight`. Более точно передаёт суть "открыть боковую панель". |

### ❓ Уточнения — СОГЛАСОВАНО ✅

1. **Клик по вложению:** Используем существующую систему превью — `ImageLightbox` для изображений, `FileViewer` для остальных файлов (конвертируем attachment → ViewerFile).

2. **Кнопка sidebar:** Показывать **всегда** + empty state внутри. Кнопка не должна "прыгать".

3. **Иконка:** `PanelRight` из Lucide — как у Anthropic.

4. **Ширина панели:** `w-[380px]` — чуть уже manager drawer, панель только для списка.

5. **Кнопка скачивания (↓):** На каждом элементе в списке — иконка Download справа, как у Anthropic. Нажал — скачал. Без дополнительных шагов. Позволяет скачать артефакты/вложения не открывая их.

---

## Взаимодействие с элементами (согласовано)

### Артефакт (в списке sidebar)
- **Клик по карточке** → открывает артефакт в существующей панели (setArtifact)
- **Кнопка ↓** → скачивает файл напрямую

### Вложение (в списке sidebar)
- **Клик по карточке** → превью (ImageLightbox для изображений, FileViewer для остальных)
- **Кнопка ↓** → скачивает оригинальный файл

---

## Источники данных (из кодовой базы)

### Артефакты — извлечение из messages
```typescript
// В messages.parts ищем tool-createDocument и tool-updateDocument
// Каждый part.output содержит { id, title, kind }
messages.flatMap(msg =>
  msg.parts
    .filter(p => p.type === "tool-createDocument" || p.type === "tool-updateDocument")
    .map(p => ({ id: p.output.id, title: p.output.title, kind: p.output.kind }))
);
```
**Дедупликация нужна** — `message.tsx:85-102` уже делает это по `output.id`.

### Вложения — извлечение из messages
```typescript
// В messages.parts ищем type === "file"
messages.flatMap(msg =>
  msg.parts
    .filter(p => p.type === "file")
    .map(p => ({ name: p.filename, url: p.url, contentType: p.mediaType }))
);
```

---

## Потенциальные риски

1. **Performance** — сканирование всех messages при каждом рендере. Решение: `useMemo` с deps на `messages.length`.
2. **Artifact overlay z-index** — Artifact `z-50`, sidebar `z-30`. Sidebar будет под артефактом — это ОК, так задумано.
3. **Mobile** — На мобильных sidebar должен быть полноэкранным или вообще скрыт. Референс Claude.ai — на мобильном sidebar скрыт, доступ через кнопку.

---

## Зависимости

- Нет новых зависимостей (npm пакетов)
- Используем существующие: Lucide icons, Tailwind, hooks/use-artifact, FileViewer, ImageLightbox
- Не требует изменений БД
- Не требует нового API

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** 1 новый компонент (ChatSidebar), 2 правки в существующих (ChatHeader + Chat). Паттерн панели уже есть (manager-drawer). Данные доступны из messages — новых API не нужно. Превью и скачивание — переиспользуем FileViewer + ImageLightbox.
