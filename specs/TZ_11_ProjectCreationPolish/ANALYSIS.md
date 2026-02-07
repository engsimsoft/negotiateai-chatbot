# Анализ ТЗ-11: Project Creation Polish

## Резюме

Polish-задача для страницы создания проекта (`/projects/new`). Четыре направления:
1. Фикс бага скролла чата (критический UX)
2. Умные placeholder-подсказки вместо "Ожидание..."
3. Preview длинной инструкции с fade + полный просмотр
4. Техническая проверка tool `updateProjectDraft`

## Анализ текущего кода

### 1. Скролл чата
**Текущее состояние:**
- `project-creation-client.tsx:313` — контейнер `h-dvh overflow-hidden`
- `project-chat-panel.tsx:51` — `<ScrollArea className="flex-1 p-4">` (Radix ScrollArea)
- Radix ScrollArea использует viewport с `h-full w-full`, но `flex-1` должен давать ему высоту
- **Проблема:** Нет auto-scroll к новым сообщениям. Нужен `useRef` + `scrollIntoView` при добавлении сообщений

**Решение:**
- Добавить `ref` на конец списка сообщений (scroll anchor)
- `useEffect` при изменении `messages` — автоскролл к anchor
- Убедиться что Radix ScrollArea viewport получает правильную высоту

### 2. Placeholder-подсказки
**Текущее состояние:**
- `project-draft-preview.tsx:57` — "Ожидание..." для названия
- `project-draft-preview.tsx:72` — "Ожидание..." для описания
- `project-draft-preview.tsx:86` — "Опционально" для инструкции

**Решение:** Просто заменить тексты на подсказки из ТЗ + добавить CSS transition для плавной замены.

### 3. Инструкция: preview + fade
**Текущее состояние:**
- `project-draft-preview.tsx:83-88` — показывает инструкцию целиком через `whitespace-pre-wrap`

**Решение:**
- Truncate после 4-5 строк с gradient mask
- Кнопка "Читать полностью" → открывает модалку

### 4. Tool updateProjectDraft
**Текущее состояние:**
- `route.ts:223-236` — поддерживает `name`, `description`, `instruction` (все optional)
- `instruction` — string без ограничения длины
- Работает корректно, возвращает `{ success: true, draft: {...} }`

## Вопрос для уточнения

### 1. FileViewer vs простой Dialog для инструкции

ТЗ говорит: "открывается FileViewer в режиме read-only". Но текущий `FileViewer`:
- Требует `ViewerFile` с полями `url`, `contentType` и т.д.
- Предназначен для файлов из Blob Storage (с навигацией между файлами)
- Для строки в памяти — это overkill

**Предлагаю:** Использовать простой `Dialog` (Radix) + `MarkdownViewer` — он уже есть, поддерживает Markdown, и результат визуально будет таким же. Это чище архитектурно. Согласен?

## Потенциальные риски

- **Radix ScrollArea auto-scroll** — может потребовать доступ к viewport ref через `querySelector`, т.к. Radix не экспортирует viewport ref напрямую. Есть workaround через `[data-radix-scroll-area-viewport]`.

## Зависимости

- Все компоненты уже существуют, новых зависимостей не нужно
- `MarkdownViewer` (`components/markdown-viewer.tsx`) — готов
- Radix Dialog — уже установлен (используется в FileViewer)

## Оценка сложности

- [x] Простое (1 сессия)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)
