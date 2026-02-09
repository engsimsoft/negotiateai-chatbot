# Changelog ТЗ-B2: Утверждение плана + ProjectTask + Пульс

## Сессия 1 — 2026-02-09

### Added
- `lib/db/schema.ts` — pgEnum `project_task_status` + таблица `projectTask` (18 колонок)
- `lib/db/migrations/0026_useful_supernaut.sql` — миграция применена
- `lib/db/queries.ts` — `createProjectTasks()`, `getProjectTasksByProjectId()`, каскад в `deleteProjectById()`
- `app/(chat)/api/projects/[id]/approve-plan/route.ts` — POST: planJson → ProjectTask[], phase → approved
- `app/(chat)/api/projects/[id]/tasks/route.ts` — GET: ProjectTask[] ORDER BY orderIndex
- `components/projects/phase-states/approved-state.tsx` — карта задач (номер, title, goal, tools, status)
- `components/projects/phase-states/planning-state.tsx` — кнопка «Утвердить план» + AlertDialog

### Changed
- `components/projects/project-work-area.tsx` — prop `projectTasks: ProjectTask[]`
- `app/(dashboard)/projects/[id]/page.tsx` — загрузка и проброс ProjectTask[]

### Этап 4 (Сессия 2)
- `components/projects/project-pulse.tsx` — prop `projectTasks`, `ProjectTaskStatusIcon`, рендер ProjectTask[] при approved+
- `app/(dashboard)/projects/[id]/page.tsx` — проброс `projectTasks` в `ProjectPulse`
- `app/(chat)/api/service-chat/route.ts` — `buildPlanPresentationMode()` с taskStatuses XML вместо stub

### Git commits
- `f65fddd` feat(tz-b2): ProjectTask table + queries + migration
- `e1969c2` feat(tz-b2): approve-plan + tasks API endpoints
- `e571782` feat(tz-b2): approve button + task cards in ApprovedState
