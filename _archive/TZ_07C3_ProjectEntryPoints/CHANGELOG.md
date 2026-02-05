# Changelog ТЗ-07C3: Project Entry Points

> История изменений в рамках этого ТЗ.
> Перенесено в главный CHANGELOG.md

---

## Сессия 1 — 2026-02-05

### Added
- **`new-task-card.tsx`** — карточка "Новая задача" (➕)
- **`manager-card.tsx`** — карточка "Менеджер" (👤)
- **`manager-dialog.tsx`** — модалка Менеджера (заглушка с превью функций)
- **`project-actions.tsx`** — wrapper для секции с 3 карточками

### Changed
- **`task-history-card.tsx`** — flex-1, показывается всегда (даже с 0 задач)
- **`app/(dashboard)/projects/[id]/page.tsx`** — убран ProjectInput, добавлена секция ProjectActions

### Removed
- Поле ввода (ProjectInput) убрано со страницы проекта

### Files
```
components/projects/new-task-card.tsx      (new)
components/projects/manager-card.tsx       (new)
components/projects/manager-dialog.tsx     (new)
components/projects/project-actions.tsx    (new)
components/projects/task-history-card.tsx  (modified)
app/(dashboard)/projects/[id]/page.tsx     (modified)
```
