# Roadmap ТЗ-07C1: Страница проекта — папки, задачи, история задач

**Дата создания:** 2026-02-05
**Версия проекта:** 3.5.0 → 3.6.0

---

## Обзор

| Часть | Описание | Этапы |
|-------|----------|-------|
| **1. Папки для файлов** | БД, API, UI для группировки файлов | 1-3 |
| **2. Терминология** | "Чаты" → "Задачи" в UI проекта | 4 |
| **3. История задач** | Карточка + страница /tasks | 5-7 |
| **Интеграция** | Сборка на странице проекта | 8 |

---

## Этап 1: База данных — папки

**Цель:** Создать таблицу `ProjectFolder`, добавить `folderId` в `ProjectFile`, выполнить миграцию.

**Файлы:**
- `lib/db/schema.ts` — новая таблица + изменение существующей
- `lib/db/migrations/XXXX_project_folders.sql` — миграция

**Задачи:**
- [ ] Добавить таблицу `ProjectFolder` в schema.ts
- [ ] Добавить поле `folderId` в таблицу `ProjectFile`
- [ ] Экспортировать тип `ProjectFolder`
- [ ] Сгенерировать миграцию: `npm run db:generate`
- [ ] Применить миграцию: `npm run db:migrate`

**Критерий готовности:**
- `npx tsc --noEmit` = 0 ошибок
- Миграция применена успешно
- Таблица `ProjectFolder` существует в БД

---

## Этап 2: Queries и API для папок

**Цель:** Добавить функции для работы с папками и API endpoints.

**Файлы:**
- `lib/db/queries.ts` — новые функции
- `app/(chat)/api/projects/[id]/folders/route.ts` — POST, GET
- `app/(chat)/api/projects/[id]/folders/[folderId]/route.ts` — PATCH, DELETE
- `app/(chat)/api/projects/[id]/files/[fileId]/route.ts` — расширить PATCH

**Задачи:**
- [ ] Query: `getProjectFolders({ projectId })`
- [ ] Query: `createProjectFolder({ projectId, name, emoji?, sortOrder? })`
- [ ] Query: `updateProjectFolder({ id, name?, emoji?, sortOrder? })`
- [ ] Query: `deleteProjectFolder({ id })` — файлы → корень (folderId = null)
- [ ] Query: `updateProjectFileFolder({ fileId, folderId })` — перемещение файла
- [ ] API: POST /folders — создание
- [ ] API: GET /folders — список папок (опционально, можно получать вместе с файлами)
- [ ] API: PATCH /folders/[folderId] — обновление
- [ ] API: DELETE /folders/[folderId] — удаление
- [ ] API: Расширить PATCH /files/[fileId] для изменения folderId

**Критерий готовности:**
- `npx tsc --noEmit` = 0 ошибок
- API тестируются через curl/Postman

---

## Этап 3: UI папок в ProjectFilesCard

**Цель:** Отобразить папки с файлами, добавить управление папками.

**Файлы:**
- `components/projects/project-files-card.tsx` — рефакторинг
- `app/(dashboard)/projects/[id]/page.tsx` — передать folders в props

**Задачи:**
- [ ] Получать папки вместе с файлами на странице проекта
- [ ] Группировать файлы по папкам в UI
- [ ] Раскрываемые секции для каждой папки
- [ ] Секция "Без папки" для файлов с folderId = null
- [ ] Кнопка "+ Новая папка" → инлайн-ввод
- [ ] Меню на папке: "Переименовать", "Удалить"
- [ ] Меню на файле: добавить "Переместить в..." с dropdown папок
- [ ] После загрузки файла — dropdown выбора папки (если есть папки)

**Критерий готовности:**
- `npm run build` успешен
- Можно создать/переименовать/удалить папку
- Можно переместить файл в папку / из папки
- Загруженный файл можно сразу поместить в папку

---

## Этап 4: Терминология "Чаты" → "Задачи"

**Цель:** Переименовать UI-тексты внутри контекста проекта.

**Файлы:**
- `components/projects/project-chats-card.tsx` — пока оставляем, меняем тексты
- `components/projects/project-meta.tsx`

**Задачи:**
- [ ] ProjectChatsCard: заголовок "ЧАТЫ" → "ЗАДАЧИ"
- [ ] ProjectChatsCard: кнопка "Новый чат" → "Новая задача"
- [ ] ProjectChatsCard: empty state "Нет чатов" → "Нет задач"
- [ ] ProjectChatsCard: диалог удаления "чат" → "задача"
- [ ] ProjectChatsCard: диалог переименования "чат" → "задача"
- [ ] ProjectMeta: "Чатов: N" → "Задач: N"

**Критерий готовности:**
- `npm run build` успешен
- Все тексты о "чатах" заменены на "задачи" в проекте

---

## Этап 5: Query для задач со статистикой

**Цель:** Создать query `getProjectChatsWithStats` по аналогии с `getGeneralChatsWithStats`.

**Файлы:**
- `lib/db/queries.ts`

**Задачи:**
- [ ] Query: `getProjectChatsWithStats({ projectId, limit? })` — возвращает чаты проекта с messageCount
- [ ] Query: `getProjectChatsCount({ projectId })` — для счётчика в карточке

**Критерий готовности:**
- `npx tsc --noEmit` = 0 ошибок
- Query возвращает корректные данные

---

## Этап 6: Карточка TaskHistoryCard

**Цель:** Создать карточку "История задач" для страницы проекта.

**Файлы:**
- `components/projects/task-history-card.tsx` — новый файл

**Задачи:**
- [ ] Скопировать `chat-history-card.tsx` как основу
- [ ] Адаптировать: "чатов" → "задач", иконка 📋, ссылка на `/projects/[id]/tasks`
- [ ] Props: `projectId`, `count`

**Критерий готовности:**
- `npm run build` успешен
- Карточка отображает количество и ссылается на /tasks

---

## Этап 7: Страница /projects/[id]/tasks

**Цель:** Создать страницу истории задач по паттерну /chats.

**Файлы:**
- `app/(dashboard)/projects/[id]/tasks/page.tsx` — новая страница
- `components/tasks/` — новая папка с 5 компонентами:
  - `tasks-page-content.tsx`
  - `task-list.tsx`
  - `task-list-item.tsx`
  - `task-detail-panel.tsx`
  - `tasks-empty-state.tsx`
- `components/tasks/index.ts` — экспорты

**Задачи:**
- [ ] Создать папку `components/tasks/`
- [ ] Скопировать и адаптировать `chats-page-content.tsx` → `tasks-page-content.tsx`
- [ ] Скопировать и адаптировать `chat-list.tsx` → `task-list.tsx`
- [ ] Скопировать и адаптировать `chat-list-item.tsx` → `task-list-item.tsx`
- [ ] Скопировать и адаптировать `chat-detail-panel.tsx` → `task-detail-panel.tsx`
- [ ] Скопировать и адаптировать `chats-empty-state.tsx` → `tasks-empty-state.tsx`
- [ ] Создать `index.ts` с экспортами
- [ ] Создать страницу `/projects/[id]/tasks/page.tsx`
- [ ] Header: `← {ProjectName} / История задач`
- [ ] Кнопка "+ Новая задача" → `/projects/[id]/chat`
- [ ] Ссылки на задачи → `/projects/[id]/chat/[chatId]`

**Критерий готовности:**
- `npm run build` успешен
- Страница /tasks отображает двухколоночный layout
- Список задач с ⭐, summary, детали справа
- Можно открыть/удалить задачу

---

## Этап 8: Интеграция на странице проекта

**Цель:** Собрать всё вместе на странице проекта.

**Файлы:**
- `app/(dashboard)/projects/[id]/page.tsx`

**Задачи:**
- [ ] Убрать `ProjectChatsCard` из правой колонки
- [ ] Добавить `TaskHistoryCard` рядом с `ProjectInput`
- [ ] Layout: карточка слева, инпут справа (как на Главной)
- [ ] Если задач 0 — карточку не показывать
- [ ] Правая колонка — временно пустая (placeholder "Пульс проекта — скоро")

**Критерий готовности:**
- `npm run build` успешен
- Страница проекта: инпут с карточкой, папки файлов слева, правая колонка пустая
- Переход по карточке на /tasks работает

---

## Финализация

**Цель:** Проверить всё, обновить документацию, подготовить к релизу.

### Обязательная проверка БД

**Claude делает:**
```sql
-- Проверить что все таблицы существуют
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Проверить колонки в изменённых таблицах
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ProjectFile' ORDER BY ordinal_position;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ProjectFolder' ORDER BY ordinal_position;

-- Проверить foreign keys
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('ProjectFile', 'ProjectFolder');
```

**Пользователь делает в браузере:**
1. Открыть страницу проекта
2. Создать папку → проверить что появилась
3. Загрузить файл → проверить что сохранился
4. Переместить файл в папку → обновить страницу, проверить что осталось
5. Удалить папку → проверить что файлы в корне
6. Создать задачу (чат) → проверить что появилась в истории
7. Открыть /projects/[id]/tasks → проверить список

### Задачи

- [ ] **Claude:** Выполнить SQL-проверки БД (см. выше)
- [ ] **Пользователь:** Выполнить мануальные тесты (см. выше)
- [ ] Полное тестирование в браузере
- [ ] Проверить автонейминг для проектных чатов
- [ ] Обновить CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md
- [ ] Обновить package.json (версия 3.6.0)
- [ ] Переместить папку в _archive/

**Критерий готовности:**
- SQL-проверки показывают все таблицы и колонки
- Мануальные тесты пройдены
- Все функции работают
- Документация актуальна
- Версия 3.6.0

---

## Порядок валидации

После **каждой задачи:**
```bash
npx tsc --noEmit
```

После **каждого этапа:**
```bash
npm run build
npm run dev  # проверка в браузере
```

---

## Оценка времени

| Этап | Описание | Сессии |
|------|----------|--------|
| 1 | БД — папки | 0.5 |
| 2 | Queries + API | 0.5 |
| 3 | UI папок | 1 |
| 4 | Терминология | 0.25 |
| 5 | Query задач | 0.25 |
| 6 | Карточка | 0.25 |
| 7 | Страница /tasks | 1 |
| 8 | Интеграция | 0.5 |
| Финал | Тестирование | 0.75 |
| **Итого** | | **~5 сессий** |
