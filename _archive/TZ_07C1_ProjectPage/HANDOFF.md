# Передача сессии ТЗ-07C1

**Дата:** 2026-02-05
**Сессия:** 3 (ФИНАЛЬНАЯ)

---

## Статус этапов

- [x] Этап 1: БД — таблица `ProjectFolder` + поле `folderId` ✅
- [x] Этап 2: Queries + API для папок ✅
- [x] Этап 3: UI папок в `ProjectFilesCard` ✅
- [x] Этап 4: Терминология "Чаты" → "Задачи" ✅
- [x] Этап 5: Query `getProjectChatsWithStats` ✅
- [x] Этап 6: Карточка `TaskHistoryCard` ✅
- [x] Этап 7: Страница `/projects/[id]/tasks` ✅
- [x] Этап 8: Интеграция на странице проекта ✅
- [x] Финализация ✅

**ВСЕ ЭТАПЫ ЗАВЕРШЕНЫ!**

---

## Что сделано в сессии 3

### Этап 4: Терминология ✅
- `components/projects/project-chats-card.tsx`:
  - "Чаты" → "Задачи"
  - "Новый чат" → "Новая задача"
  - "Удалить чат?" → "Удалить задачу?"
  - "Переименовать чат" → "Переименовать задачу"
  - "Нет чатов" → "Нет задач"
- `components/projects/project-meta.tsx`:
  - "Чатов:" → "Задач:"

### Этап 5: Query ✅
- `lib/db/queries.ts`:
  - `getProjectChatsWithStats({ projectId })` — чаты с messageCount
  - `getProjectChatsCount({ projectId })` — для счётчика карточки

### Этап 6: TaskHistoryCard ✅
- `components/projects/task-history-card.tsx` — новый компонент
  - Аналог ChatHistoryCard для проектов
  - Props: projectId, count
  - Ссылка на `/projects/[id]/tasks`

### Этап 7: Страница /tasks ✅
- `components/tasks/` — новая папка с 5 компонентами:
  - `tasks-page-content.tsx` — главный контейнер с состоянием
  - `task-list.tsx` — список задач (левая колонка)
  - `task-list-item.tsx` — элемент списка с ⭐, меню
  - `task-detail-panel.tsx` — детали задачи (правая колонка)
  - `tasks-empty-state.tsx` — пустое состояние
  - `index.ts` — экспорты
- `app/(dashboard)/projects/[id]/tasks/page.tsx` — страница

### Этап 8: Интеграция ✅
- `app/(dashboard)/projects/[id]/page.tsx`:
  - TaskHistoryCard слева от инпута (если есть задачи)
  - Правая колонка: placeholder "Пульс проекта — скоро"
  - Убран ProjectChatsCard

### Проверка БД ✅
```sql
-- Все таблицы на месте
ProjectFile: id, projectId, name, type, mimeType, size, url, metadata, createdAt, folderId
ProjectFolder: id, projectId, name, emoji, sortOrder, createdAt
```

**Валидация:** `npx tsc --noEmit` ✅, `npm run build` ✅

---

## Новые файлы

```
components/
├── projects/
│   └── task-history-card.tsx      # Новый
└── tasks/                          # Новая папка
    ├── index.ts
    ├── tasks-page-content.tsx
    ├── task-list.tsx
    ├── task-list-item.tsx
    ├── task-detail-panel.tsx
    └── tasks-empty-state.tsx

app/(dashboard)/projects/[id]/
└── tasks/
    └── page.tsx                    # Новый
```

---

## Изменённые файлы

- `lib/db/queries.ts` — 2 новых query
- `components/projects/project-chats-card.tsx` — терминология
- `components/projects/project-meta.tsx` — терминология
- `app/(dashboard)/projects/[id]/page.tsx` — интеграция

---

## Что осталось для пользователя

### Мануальные тесты (в браузере)
1. Открыть страницу проекта → проверить карточку "История задач"
2. Нажать на карточку → должна открыться `/projects/[id]/tasks`
3. На странице /tasks:
   - Список задач слева с ⭐ и датой
   - Детали справа с summary
   - Кнопка "Новая задача" → `/projects/[id]/chat`
   - Меню задачи: Открыть, Отметить, Удалить
4. Проверить терминологию: везде "задачи" вместо "чаты"

### Документация
- [ ] Обновить CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (если нужно)
- [ ] Обновить package.json → 3.6.0
- [ ] Переместить папку в `_archive/`

---

## Блокеры / Вопросы

Нет блокеров. Все этапы завершены.

---

## Итоги ТЗ-07C1

**Добавлено:**
- Папки для файлов проекта (БД + API + UI)
- История задач (страница + карточка)
- Терминология "Задачи" вместо "Чаты" в контексте проекта
- Placeholder для будущего "Пульс проекта"

**Сессии:** 3
**Версия:** 3.5.0 → 3.6.0
