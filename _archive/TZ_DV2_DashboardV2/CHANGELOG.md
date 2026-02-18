# Changelog ТЗ-DV2: Дашборд V2

## Сессия 1 — 2026-02-16

### Added
- Создана папка `specs/TZ_DV2_DashboardV2/`
- Создан SPEC.md, ANALYSIS.md, ROADMAP.md, CHANGELOG.md, HANDOFF.md

### Removed (Этап 1: Удаление экосистемы помощников)
- Удалена директория `lib/helpers/` (4 файла: index.ts, types.ts, presets.ts, server.ts)
- Удалена директория `app/(chat)/helpers/` (3 страницы)
- Удалена директория `app/(chat)/api/helpers/` (2 routes)
- Удалён `components/glavnaya/helpers-section.tsx`
- Удалён `components/glavnaya/tools-section.tsx`
- Убраны экспорты HelpersSection и ToolsSection из `components/glavnaya/index.ts`
- Убраны HelpersSection и ToolsSection из `app/(dashboard)/dashboard/page.tsx`
- Убраны helperId/helperName/helperEmoji props из `components/chat.tsx`
- Убраны helper props + breadcrumb из `components/chat-header.tsx`
- Убран helper case из `components/app-sidebar.tsx` (SidebarContext, getSidebarContext, getNewChatUrl, getContextTitle)
- Убран helper case из `components/sidebar-history.tsx` (API endpoint switch)
- Убран helperId из `app/(chat)/api/chat/schema.ts`
- Убран helperId из `app/(chat)/api/chat/route.ts` (destructuring + saveChat)
- Убраны 6 helper-функций из `lib/db/queries.ts` + helperId из saveChat + helperId из select queries
- Убрана таблица Helper и поле helperId из `lib/db/schema.ts` (Drizzle schema only, DB column ещё в базе)
- Убран комментарий про helpers из `components/sidebar-layout.tsx`

### Validation
- `npx tsc --noEmit` — 0 ошибок
- `npm run build` — успешен
- Мануальный тест пользователем — ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ

### Files
- specs/TZ_DV2_DashboardV2/* (все 5 файлов)
- lib/helpers/ (DELETED)
- app/(chat)/helpers/ (DELETED)
- app/(chat)/api/helpers/ (DELETED)
- components/glavnaya/helpers-section.tsx (DELETED)
- components/glavnaya/tools-section.tsx (DELETED)
- components/glavnaya/index.ts
- app/(dashboard)/dashboard/page.tsx
- components/chat.tsx
- components/chat-header.tsx
- components/app-sidebar.tsx
- components/sidebar-history.tsx
- components/sidebar-layout.tsx
- app/(chat)/api/chat/schema.ts
- app/(chat)/api/chat/route.ts
- lib/db/queries.ts
- lib/db/schema.ts
