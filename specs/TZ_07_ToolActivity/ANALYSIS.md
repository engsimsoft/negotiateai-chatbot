# Анализ ТЗ-07: Tool Activity UX

## Резюме

Добавить пользовательский индикатор работы инструментов AI внутри сообщений. Чисто фронтенд — backend уже стримит всё необходимое через Vercel AI SDK `message.parts`.

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Концепция** — inline tool indicator в сообщении, компактный, раскрывается по клику. Отлично.
- **Config-подход** — маппинг `toolName → UI`. Чистая архитектура, легко расширяется.
- **Что НЕ делаем** — backend, промпты, БД не трогаем. Правильно.
- **hidden для технических tools** — getCurrentDate, loadSkill, createSnapshot, requestSuggestions. Согласен.
- **Стилизация** — bg-muted, text-muted-foreground, rounded-lg, text-sm. Всё по дизайн-системе.

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | `type: 'tool-invocation'` с property `toolName` | Реальный тип — `tool-${toolName}` (например `tool-webSearch`). Нет generic `tool-invocation` | `message.tsx:229-408` — все handlers проверяют `type === "tool-getWeather"`, `type === "tool-readDocument"` и т.д. AI SDK создаёт typed parts даже для неописанных в ChatTools инструментов. Код использует `@ts-ignore` для untyped (строка 332, 384). |
| 2 | Таблица включает tools с СУЩЕСТВУЮЩИМИ рендерерами (getWeather, createDocument, updateDocument, readDocument) | Исключить из ToolActivityIndicator — у них уже есть custom UI | `message.tsx:229-406` — getWeather → `<Weather>`, createDocument/updateDocument → `<DocumentPreview>`, readDocument → `<Tool><ToolOutput>`, createSnapshot → `<SnapshotCard>`. Дублировать UI не нужно. |
| 3 | Tool names: `web_search`, `read_document` (snake_case) | Реальные имена: `webSearch`, `readDocument` (camelCase) | `chat-tools.ts:46-63` — все tool names в camelCase |
| 4 | Эмодзи для иконок (🔍, 📄, 📊) | **Lucide React иконки** — Search, FileText, Table2, FolderOpen | Все существующие компоненты используют Lucide (tool.tsx, snapshot-card.tsx, sidebar-history-item.tsx). Эмодзи рендерятся по-разному на разных ОС и не вписываются в Anthropic-стиль. |
| 5 | `border border-border rounded-lg` | **Без border** — только `bg-muted rounded-lg` | Референс Claude.ai: tool indicators безрамочные, просто мягкий фон. Чище, компактнее. Border утяжеляет. |
| 6 | "Оба места рендеринга" (чат + task chat) | **Одно место** — `components/message.tsx` | Оба чата (главный и task) используют ОДИН компонент `PreviewMessage` из `message.tsx`. Код пишется один раз. |
| 7 | `animate-spin` на иконке для in-progress | **Animated dots** (как у Anthropic) или `animate-pulse` на всём блоке | Anthropic не спинит иконку — они показывают пульсирующий текст. `animate-spin` на иконке типа Search выглядит странно. Предлагаю pulse на блоке + animated "..." в тексте. |

### ❓ Требует уточнения

1. **readProjectFile** — в ТЗ описан как видимый ("Читаю файл проекта"). Но подобный `readDocument` уже имеет полноценный рендерер (показывает путь, размер, контент). Хотим ли мы для readProjectFile тоже ToolActivityIndicator или полноценный рендерер как у readDocument? **Моя рекомендация:** ToolActivityIndicator — он компактнее и достаточен.

2. **parseExcel** — единственный tool с файловым аргументом. Откуда брать имя файла для `argsFormatter`? Из `args.fileUrl`? Нужно проверить формат input.

---

## Реальный скоуп (после анализа кода)

### Tools которым НУЖЕН ToolActivityIndicator (3 штуки):

| Tool | Part type в коде | activeLabel | doneLabel |
|------|-----------------|-------------|-----------|
| `webSearch` | `tool-webSearch` | Поиск в интернете | Поиск завершён |
| `parseExcel` | `tool-parseExcel` | Анализирую таблицу | Таблица проанализирована |
| `readProjectFile` | `tool-readProjectFile` | Читаю файл проекта | Файл прочитан |

### Tools которые СКРЫВАЕМ (hidden: true):

| Tool | Причина |
|------|---------|
| `getCurrentDate` | Технический, мгновенный |
| `loadSkill` | Технический, внутренний |
| `createSnapshot` | Есть SnapshotCard |
| `requestSuggestions` | Есть DocumentToolResult |

### Tools с СУЩЕСТВУЮЩИМИ рендерерами (не трогаем):

| Tool | Рендерер |
|------|----------|
| `getWeather` | `<Weather>` |
| `createDocument` | `<DocumentPreview>` |
| `updateDocument` | `<DocumentPreview>` |
| `readDocument` | `<Tool><ToolHeader><ToolOutput>` |

---

## Важное наблюдение: persistence

Tool parts (кроме createDocument/updateDocument) **фильтруются перед сохранением в БД** (`chat/route.ts:564-580`). Это значит:

- ToolActivityIndicator видно ТОЛЬКО во время live streaming
- При reload страницы / открытии старого чата — индикаторов не будет
- Это **правильное поведение** — пользователю не нужно видеть "Поиск завершён" в старых сообщениях

---

## Зависимости

- Vercel AI SDK `message.parts` — уже стримит tool states
- `components/message.tsx` — единственная точка интеграции
- `docs/design-system.md` — стилизация по токенам
- Lucide React — иконки (уже в проекте)

## Оценка сложности

- [x] Простое (1-2 сессии)

**Обоснование:** 3 новых файла (config + component + интеграция в 1 строчку). Scope сужен до 3 tools. Чисто фронтенд, без миграций и API.

---

**Дата:** 2026-02-15
