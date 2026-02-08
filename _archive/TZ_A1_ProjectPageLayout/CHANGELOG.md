# Changelog ТЗ-A1

## Сессия 1 — 2026-02-08

### Added
- Создана папка specs/TZ_A1_ProjectPageLayout/ с документами (SPEC, ANALYSIS, ROADMAP, CHANGELOG, HANDOFF)
- Колонка `phase` в таблице Project (varchar(20), default 'setup')
- Миграция `lib/db/migrations/0023_rich_swordsman.sql`
- `components/projects/project-page-layout.tsx` — двухколоночный layout (Pulse 300px + WorkArea flex-1)

### Changed
- `app/(dashboard)/projects/[id]/page.tsx` — полностью переписан под новый layout
- Header: убрана кнопка "Настроить", добавлена кнопка "Менеджер"
- Layout: полноэкранный (убран max-w-960px), колонки скроллятся независимо

### Removed
- Использование ProjectActions, ProjectPassport, ProjectFilesCard, ProjectMeta из page.tsx (компоненты ещё не удалены — Этап 6)

### Files
- `lib/db/schema.ts`
- `lib/db/migrations/0023_rich_swordsman.sql`
- `lib/db/migrations/meta/0023_snapshot.json`
- `lib/db/migrations/meta/_journal.json`
- `components/projects/project-page-layout.tsx` (новый)
- `app/(dashboard)/projects/[id]/page.tsx` (переписан)
