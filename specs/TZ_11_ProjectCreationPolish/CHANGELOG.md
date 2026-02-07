# Changelog ТЗ-11: Project Creation Polish

## Сессия 1 — 2026-02-07

### Fixed
- Баг скролла чата — добавлен scroll anchor + auto-scroll к новым сообщениям

### Changed
- Placeholder-подсказки: "Ожидание..." заменены на полезные подсказки
- Лейбл "Инструкция для AI" → "Контекст проекта" в preview создания
- Tool `updateProjectDraft`: параметр `instruction` → `context`
- API POST /api/projects: сохраняет в колонку `context`
- Страница проекта: вкладка "Паспорт" → КОНТЕКСТ читает из БД (убрана заглушка)

### Added
- Колонка `context` (text) в таблице Project (миграция 0022)
- ADR 012: Context vs Instruction separation

### Files
- `app/(dashboard)/projects/new/components/project-chat-panel.tsx`
- `app/(dashboard)/projects/new/components/project-draft-preview.tsx`
- `app/(dashboard)/projects/new/project-creation-client.tsx`
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/projects/route.ts`
- `app/(dashboard)/projects/[id]/page.tsx`
- `components/projects/project-passport.tsx`
- `lib/db/schema.ts`
- `lib/db/queries.ts`
- `lib/db/migrations/0022_flat_adam_destine.sql`
- `docs/decisions/012-context-vs-instruction-separation.md`
