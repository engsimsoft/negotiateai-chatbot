# Анализ ТЗ-DV2U: UX навигации Dashboard V2

## Резюме

Три блока работ:
1. **Терминология** — замена текстов на страницах /expertise, /create, /chats + ChatDetailPanel
2. **Breadcrumbs** — навигационные хлебные крошки в chat-header по chatMode
3. **Sidebar контекст** — фильтрация истории + контекстная кнопка "Новый чат" по chatMode

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Часть 1 (Терминология)** — все замены логичны и реализуемы. Текущий код содержит именно те строки, которые описаны в ТЗ.
- **Часть 2 (Breadcrumbs)** — отличное улучшение. Паттерн breadcrumbs уже существует в `chat-header.tsx` для проектных чатов (projectId + projectName). Расширить на chatMode — естественное развитие.
- **Часть 3 (Sidebar контекст)** — логически верно. Сейчас sidebar (`sidebar-history.tsx`) показывает ВСЕ чаты без фильтрации по chatMode.
- **Кнопка "+ Новый чат" на /chats** — сейчас действительно отсутствует. `ChatsPageContent` не передаёт `createButton` в `ListDetailPage`, хотя /expertise и /create — передают через `ModeChatsPage`.

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | Менять тексты в ChatDetailPanel | Сделать лейблы **props-ами** ChatDetailPanel вместо хардкода | `chat-detail-panel.tsx:73` хардкодит "О чём чат" и `chat-detail-panel.tsx:62` "Открыть чат". Компонент шарится между /chats, /expertise, /create. Нужны props `summaryLabel` и `openLabel` |
| 2 | Менять счётчик "N чатов" | Сделать `itemCountLabel` **конфигурируемой** в ModeChatsPage | `mode-chats-page.tsx:11-15` хардкодит `chatCountLabel()` → "чат/чата/чатов". Нужен prop для "запрос/запросов" и "задание/заданий" |
| 3 | Два отдельных компонента для /chats vs /expertise,/create | **Унифицировать** ChatsPageContent → использовать ModeChatsPage | `chats-page-content.tsx` и `mode-chats-page.tsx` — почти идентичный код (delete, toggleStar, ListDetailPage). ChatsPageContent — это ModeChatsPage с другими пропсами. Устраняем дублирование |
| 4 | Sidebar фильтрация (без деталей реализации) | Использовать **React Context** (`ChatModeContext`) | `app-sidebar.tsx` определяет контекст через `usePathname()`, но для `/chat/[id]` chatMode **нет в URL** — только в БД. Нужен механизм: Chat компонент устанавливает chatMode → AppSidebar читает через Context |
| 5 | — | Добавить `?chatMode=xxx` фильтр в `/api/history` | `app/(chat)/api/history/route.ts` и `getChatsByUserId()` НЕ фильтруют по chatMode. Сейчас sidebar загружает ВСЕ чаты. Нужен query param для фильтрации |
| 6 | Заголовок /create: "Создание" | Текущий заголовок: **"Создать"** (`create/page.tsx:26`) | Подтверждаю — нужно менять "Создать" → "Создание" как в таблице ТЗ |

### ❓ Требует уточнения

1. **Breadcrumbs для chatMode='chat':** ТЗ говорит "без breadcrumbs" как основной вариант, но добавляет "(или Чаты > ... если открыт из /chats)". Какой вариант выбираем? Я рекомендую **без breadcrumbs** — проще, чище, и нет надёжного способа отследить "откуда пришёл пользователь" (referrer ненадёжен, query-параметр `?from=chats` — хрупкое решение).

2. **Sidebar: ссылка "Все чаты"** — сейчас в sidebar есть кнопка "Все чаты" → `/chats`. Когда sidebar в режиме expertise, должна ли ссылка стать "Все запросы" → `/expertise`? Аналогично "Все задания" → `/create`? ТЗ это явно не описывает, но логика подсказывает, что да.

3. **Empty state тексты** — на /expertise сейчас "Нет экспертиз", на /create "Нет документов". Нужно ли менять на "Нет запросов" / "Нет заданий" соответственно? ТЗ не упоминает empty states.

---

## Зависимости

### Затронутые файлы

**Часть 1 (Терминология):**
- `app/(dashboard)/expertise/page.tsx` — createButton.label, title
- `app/(dashboard)/create/page.tsx` — createButton.label, title
- `app/(dashboard)/chats/page.tsx` — добавить createButton
- `components/chats/chats-page-content.tsx` — добавить createButton (или унифицировать с ModeChatsPage)
- `components/chats/mode-chats-page.tsx` — configurable itemCountLabel
- `components/chats/chat-detail-panel.tsx` — props для лейблов

**Часть 2 (Breadcrumbs):**
- `components/chat-header.tsx` — добавить chatMode breadcrumbs
- `components/chat.tsx` — передать chatMode в ChatHeader
- `app/(chat)/chat/[id]/page.tsx` — передать chatMode из БД

**Часть 3 (Sidebar контекст):**
- Новый: контекст ChatModeContext (или расширение существующего)
- `components/app-sidebar.tsx` — расширить SidebarContext, изменить навигацию
- `components/sidebar-history.tsx` — фильтрация по chatMode
- `app/(chat)/api/history/route.ts` — параметр chatMode
- `lib/db/queries.ts` — фильтрация getChatsByUserId по chatMode

### Зависимости от существующей архитектуры
- `ListDetailPage` — полностью готов, props уже поддерживают всё нужное
- Chat schema — поле `chatMode` уже есть в БД (varchar, default "chat")
- `/chat?mode=xxx` — маршрут уже работает для создания чатов с нужным mode

---

## Потенциальные риски

1. **React Context для chatMode** — нужно аккуратно обработать переходы между чатами (когда пользователь кликает по другому чату в sidebar, Context должен обновиться)
2. **History API фильтрация** — при добавлении chatMode фильтра нужно убедиться, что пагинация работает корректно
3. **Backward compatibility** — чаты без chatMode (старые) имеют default "chat" в БД, это ОК

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

Часть 1 — чистые текстовые замены + пара props. Часть 2 — расширение существующего паттерна breadcrumbs. Часть 3 — React Context + API filter, но логика простая.
