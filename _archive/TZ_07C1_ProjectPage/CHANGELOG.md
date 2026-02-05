# Changelog ТЗ-07C1: Страница проекта

## Сессия 1 — 2026-02-05

### Added

**Этап 1: БД**
- Таблица `ProjectFolder` в `lib/db/schema.ts`
- Поле `folderId` в таблице `ProjectFile`
- Миграция `0020_natural_victor_mancha.sql`

**Этап 2: Queries + API**
- 6 новых функций в `lib/db/queries.ts`:
  - `getProjectFolders`, `createProjectFolder`, `updateProjectFolder`
  - `deleteProjectFolder`, `getProjectFolderWithFileCount`, `updateProjectFileFolder`
- API routes для папок:
  - `app/(chat)/api/projects/[id]/folders/route.ts` (POST, GET)
  - `app/(chat)/api/projects/[id]/folders/[folderId]/route.ts` (GET, PATCH, DELETE)
- Расширен `app/(chat)/api/projects/[id]/files/[fileId]/route.ts` (PATCH для перемещения)

**Документация**
- Создана структура `specs/TZ_07C1_ProjectPage/`
- SPEC.md, ANALYSIS.md, ROADMAP.md, CHANGELOG.md, HANDOFF.md

### Verified
- ✅ `npx tsc --noEmit` — 0 ошибок
- ✅ `npm run build` — успешен
- ✅ Миграция применена через `npm run db:migrate`
- ✅ Endpoint `generate-title` работает для всех чатов

### Files Changed
- `lib/db/schema.ts`
- `lib/db/queries.ts`
- `lib/db/migrations/0020_natural_victor_mancha.sql`
- `app/(chat)/api/projects/[id]/folders/route.ts` (new)
- `app/(chat)/api/projects/[id]/folders/[folderId]/route.ts` (new)
- `app/(chat)/api/projects/[id]/files/[fileId]/route.ts`

### Next
- Этап 3: UI папок в ProjectFilesCard
- После Этапа 3 → мануальный тест папок
