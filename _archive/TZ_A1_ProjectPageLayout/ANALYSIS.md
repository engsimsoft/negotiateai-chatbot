# Анализ ТЗ-A1: Новая страница проекта — Layout

## Резюме

Перестроить страницу проекта из карточного layout в двухколоночный (Пульс + Рабочая область) с фазовой системой. Добавить Drawer Менеджера (каркас). Миграция БД: колонка `phase`.

## Вопросы для уточнения

> Все вопросы разрешены 2026-02-08.

1. **Tasks route** `/projects/[id]/tasks/` — **оставить пока**, не удалять.
2. **Кнопка "Настроить"** — **убрать из header**. Настройки переезжают в Паспорт (Пульс).
3. **ProjectMeta** — **переместить в Паспорт** (Пульс), компактно внизу секции.
4. **Mobile Pulse** — **bottom sheet** с кнопкой-триггером.

## Потенциальные риски

- **ProjectFilesCard (779 строк)** — самый большой компонент, адаптация под узкую колонку может потребовать рефакторинг.
- **Push-drawer Менеджера** — текущий ServiceChatDrawer использует overlay, а нужен push. Потребуется новый компонент.
- **Миграция phase** — на продакшене нужно DEFAULT 'setup' для существующих проектов.

## Зависимости

- **Drizzle ORM** — миграция колонки `phase`
- **Существующие компоненты:** ProjectPulse, ProjectFilesCard, ProjectPassport, ProjectActions, ProjectMeta — рефакторинг/удаление
- **ServiceChatDrawer** — как референс для ManagerDrawer

## Затронутые компоненты

| Компонент | Действие |
|-----------|----------|
| `app/(dashboard)/projects/[id]/page.tsx` | Полная переработка |
| `components/projects/project-pulse.tsx` | Рефакторинг под левую панель |
| `components/projects/project-passport.tsx` | Рефакторинг (убрать табы → сворачиваемые секции) |
| `components/projects/project-files-card.tsx` | Адаптация под узкую колонку |
| `components/projects/project-actions.tsx` | Удалить |
| `components/projects/project-meta.tsx` | Перенести в Паспорт |
| `components/projects/manager-card.tsx` | Удалить (заменён drawer) |
| `components/projects/new-task-card.tsx` | Удалить (перенесён в WorkArea) |
| `components/projects/task-history-card.tsx` | Удалить (план в Пульсе) |
| Новые: ProjectPageLayout, ProjectWorkArea, ManagerDrawer | Создать |

## Оценка сложности

- [x] Среднее (3-5 сессий)
