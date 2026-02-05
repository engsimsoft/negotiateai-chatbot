# Changelog ТЗ-07C2 (Project Pulse)

## Сессия 1 — 2026-02-05

### Added
- Создана структура папки ТЗ
- SPEC.md — техническое задание
- ANALYSIS.md — анализ и вопросы
- ROADMAP.md — план из 5 этапов

### Database
- Chat.taskStatus (varchar, default 'not_started')
- Project.summary (text, nullable)
- Project.summaryUpdatedAt (timestamp, nullable)
- Миграция: 0021_project_pulse.sql

### API
- PATCH /api/chat/[id] — поддержка taskStatus
- POST /api/projects/[id]/generate-summary — генерация итога AI
- Автопереход not_started → in_progress при первом сообщении

### Components
- project-pulse.tsx — панель "Пульс проекта"
- Обновлён task-detail-panel.tsx — кнопка "Готово"
- Обновлён task-list-item.tsx — визуальный статус
- Обновлён task-list.tsx — передача onToggleTaskStatus
- Обновлён tasks-page-content.tsx — тип TaskStatus, обработчик
- Обновлён sidebar-history-item.tsx — галочка для done

### Decisions
- Автопереход статуса: в chat/route.ts
- Галочка done: sidebar + /tasks
- Модель для итога: gemini-2.5-flash
- Обновление итога: фоном с toast

### Files
- lib/db/schema.ts
- lib/db/queries.ts
- lib/db/migrations/0021_project_pulse.sql
- app/(chat)/api/chat/[id]/route.ts
- app/(chat)/api/chat/route.ts
- app/(chat)/api/projects/[id]/generate-summary/route.ts (новый)
- app/(dashboard)/projects/[id]/page.tsx
- app/(dashboard)/projects/[id]/tasks/page.tsx
- components/projects/project-pulse.tsx (новый)
- components/tasks/task-detail-panel.tsx
- components/tasks/task-list-item.tsx
- components/tasks/task-list.tsx
- components/tasks/tasks-page-content.tsx
- components/sidebar-history-item.tsx

### Bugfix (Session 2)
- Исправлен автопереход: теперь срабатывает при создании нового чата (первое сообщение)
- Ранее автопереход срабатывал только при втором сообщении

### Status
- Build: PASSED
- TypeScript: PASSED
- SQL check: PASSED
- Manual test: PENDING
