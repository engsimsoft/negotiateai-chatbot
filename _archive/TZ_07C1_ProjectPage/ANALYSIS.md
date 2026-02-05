# Анализ ТЗ-07C1: Страница проекта — папки, задачи, история задач

**Дата:** 2026-02-05
**Версия проекта:** 3.5.0

---

## Резюме

Три связанных изменения на странице проекта:

1. **Папки для файлов** — новая таблица `ProjectFolder`, UI группировки в `ProjectFilesCard`, API для CRUD папок
2. **Терминология "Задачи"** — переименование "чаты" → "задачи" только в UI проекта
3. **История задач** — карточка + страница `/projects/[id]/tasks` (по паттерну 07B `/chats`)

---

## Анализ существующего кода

### Часть 1: Папки для файлов

**Текущее состояние:**
- Таблица `ProjectFile` — без поддержки папок ([lib/db/schema.ts:77-96](lib/db/schema.ts#L77-L96))
- Компонент `ProjectFilesCard` — плоский список файлов ([components/projects/project-files-card.tsx](components/projects/project-files-card.tsx))
- API файлов — `/api/projects/[id]/files/` (upload, delete) ([app/(chat)/api/projects/[id]/files/route.ts](app/(chat)/api/projects/[id]/files/route.ts))

**Что нужно сделать:**
1. Новая таблица `ProjectFolder` в schema.ts
2. Добавить `folderId` в `ProjectFile`
3. Миграция БД
4. Новые queries: `getProjectFolders`, `createProjectFolder`, `updateProjectFolder`, `deleteProjectFolder`, `updateProjectFileFolder`
5. Новые API routes: `/api/projects/[id]/folders/`
6. Рефакторинг `ProjectFilesCard` для отображения папок

### Часть 2: Терминология

**Файлы для изменения (только UI-текст):**
- [components/projects/project-chats-card.tsx](components/projects/project-chats-card.tsx) — заголовок "ЧАТЫ" → "ЗАДАЧИ"
- [components/projects/project-meta.tsx](components/projects/project-meta.tsx) — "Чатов: N" → "Задач: N"
- Диалоги удаления/переименования — "чат" → "задача"

**Не меняем:**
- Код (переменные, функции)
- Роуты URL
- Таблицы БД

### Часть 3: История задач

**Паттерн из 07B (для копирования):**
- [components/glavnaya/chat-history-card.tsx](components/glavnaya/chat-history-card.tsx) — карточка
- [app/(dashboard)/chats/page.tsx](app/(dashboard)/chats/page.tsx) — страница
- [components/chats/](components/chats/) — 5 компонентов:
  - `chats-page-content.tsx` — контейнер с состоянием
  - `chat-list.tsx` — левая колонка
  - `chat-list-item.tsx` — элемент списка
  - `chat-detail-panel.tsx` — правая колонка
  - `chats-empty-state.tsx` — пустое состояние

**Что нужно создать:**
1. `components/projects/task-history-card.tsx` — карточка рядом с инпутом
2. `app/(dashboard)/projects/[id]/tasks/page.tsx` — страница истории задач
3. `components/tasks/` — 5 компонентов (адаптация из `/chats`)
4. Query `getProjectChatsWithStats` — аналог `getGeneralChatsWithStats`

**Изменения на странице проекта:**
- Убрать `ProjectChatsCard` из правой колонки
- Добавить `TaskHistoryCard` рядом с `ProjectInput`
- Правая колонка временно пустая (будет "Пульс проекта" в 07C-2)

---

## Вопросы для уточнения

### Критические (блокеры)

1. ~~**Автонейминг для проектных чатов**~~ — ✅ **ПРОВЕРЕНО:** endpoint `generate-title` работает для ВСЕХ чатов (не проверяет `projectId`). Блокер снят.

### Уточняющие (не блокеры)

2. **Layout инпута с карточкой** — на Главной карточка слева от инпута. На странице проекта тот же layout? Предполагаю да.

3. **Сортировка папок** — по умолчанию по `sortOrder`. Нужен ли UI для ручной сортировки или достаточно порядка создания?

4. **Удаление папки** — файлы перемещаются в корень автоматически (cascade null). Нужно ли показывать confirmation с количеством файлов?

---

## Потенциальные риски

1. **Миграция БД** — новая таблица + изменение существующей. Риск: конфликты с production данными. Митигация: проверить миграцию на dev.

2. **Копирование кода /chats** — много дублирования. Риск: рассинхрон при изменениях. Митигация: можно вынести общий layout в shared компонент (на усмотрение).

3. ~~**Автонейминг**~~ — ✅ Проверено: endpoint работает для всех чатов. Риск снят.

---

## Зависимости

### Входные (от предыдущих ТЗ)
- ТЗ-07A: `ProjectInput`, `CompactInput` ✅
- ТЗ-07B: паттерн `/chats`, `ChatHistoryCard`, `getGeneralChatsWithStats` ✅
- Таблица `Chat` с полями `summary`, `isStarred` ✅

### Затрагиваемые компоненты
- `lib/db/schema.ts` — новая таблица, изменение существующей
- `lib/db/queries.ts` — новые queries
- `components/projects/project-files-card.tsx` — рефакторинг для папок
- `components/projects/project-chats-card.tsx` — терминология (потом удаление)
- `components/projects/project-meta.tsx` — терминология
- `app/(dashboard)/projects/[id]/page.tsx` — новый layout с карточкой
- Новые API routes для папок
- Новая страница `/projects/[id]/tasks`
- Новые компоненты `components/tasks/`

---

## Оценка сложности

- [x] Среднее (3-5 сессий)

**Разбивка:**
- Часть 1 (Папки): ~2 сессии (БД + API + UI)
- Часть 2 (Терминология): ~0.5 сессии
- Часть 3 (История задач): ~1.5 сессии (копирование + адаптация)
- Интеграция + тестирование: ~1 сессия

---

## Предлагаемый порядок реализации

1. **Этап 1:** БД — таблица `ProjectFolder`, поле `folderId` в `ProjectFile`, миграция
2. **Этап 2:** Queries + API для папок
3. **Этап 3:** UI папок в `ProjectFilesCard`
4. **Этап 4:** Терминология "Задачи" (быстрые UI-изменения)
5. **Этап 5:** Query `getProjectChatsWithStats`
6. **Этап 6:** Карточка `TaskHistoryCard`
7. **Этап 7:** Страница `/projects/[id]/tasks` + компоненты
8. **Этап 8:** Интеграция на странице проекта (убрать ChatsCard, добавить карточку)
9. **Этап 9:** Проверка автонейминга для проектных чатов
10. **Финализация:** Тестирование, документация
