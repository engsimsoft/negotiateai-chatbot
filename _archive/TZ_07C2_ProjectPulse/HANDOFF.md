# Передача сессии ТЗ-07C2 (Project Pulse)

**Дата:** 2026-02-05
**Сессия:** 2

## Статус
- [x] Фаза 1: Анализ — вопросы заданы и отвечены
- [x] Фаза 2: Планирование — ROADMAP.md создан
- [x] Фаза 3: Разработка — все этапы выполнены
- [x] Фаза 4: Финализация — ✅ ЗАВЕРШЕНО

## Этапы разработки
- [x] Этап 1: База данных (миграции)
  - Chat.taskStatus (varchar, default 'not_started')
  - Project.summary (text, nullable)
  - Project.summaryUpdatedAt (timestamp, nullable)
- [x] Этап 2: API endpoints
  - PATCH /api/chat/[id] — поддержка taskStatus
  - POST /api/projects/[id]/generate-summary — генерация итога
  - Автопереход not_started → in_progress в chat/route.ts
- [x] Этап 3: UI статусов
  - Кнопка "Готово" в TaskDetailPanel
  - Статус в TaskListItem (✓ done, 🔄 in_progress, ○ not_started)
  - Галочка в sidebar-history-item для done задач
- [x] Этап 4: Компонент ProjectPulse
  - Статистика статусов
  - Итог проекта с кнопкой обновления
  - Активные задачи
  - Последняя задача
  - Пустое состояние

## SQL-проверка
```sql
-- Все колонки существуют:
Chat.taskStatus (varchar, default 'not_started')
Project.summary (text, nullable)
Project.summaryUpdatedAt (timestamp, nullable)
```

## Ожидает мануальный тест
1. Создать задачу → статус `not_started`
2. Отправить сообщение → статус автоматически `in_progress`
3. Нажать "Готово" → статус `done`, toast, итог обновляется
4. Нажать "Вернуть в работу" → статус обратно `in_progress`
5. Пульс проекта — все секции отображаются корректно
6. Кнопка 🔄 — итог обновляется вручную
7. Пустой проект — показывается пустое состояние

## Bugfix (Сессия 2)
- **Проблема:** Автопереход `not_started → in_progress` не срабатывал при первом сообщении
- **Причина:** При создании нового чата (`chat === null`) блок автоперехода не выполнялся
- **Решение:** Добавлен вызов `updateChatTaskStatus` сразу после `saveChat` для проектных чатов
- **Файл:** `app/(chat)/api/chat/route.ts` (строки 177-181)

## Изменённые файлы
- lib/db/schema.ts
- lib/db/queries.ts
- lib/db/migrations/0021_project_pulse.sql
- app/(chat)/api/chat/[id]/route.ts
- app/(chat)/api/chat/route.ts ← bugfix автоперехода
- app/(chat)/api/projects/[id]/generate-summary/route.ts (новый)
- app/(dashboard)/projects/[id]/page.tsx
- app/(dashboard)/projects/[id]/tasks/page.tsx
- components/projects/project-pulse.tsx (новый)
- components/tasks/task-detail-panel.tsx
- components/tasks/task-list-item.tsx
- components/tasks/task-list.tsx
- components/tasks/tasks-page-content.tsx
- components/sidebar-history-item.tsx
