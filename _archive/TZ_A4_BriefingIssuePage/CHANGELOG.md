# Changelog ТЗ-А4: Страница выпуска брифинга

## Сессия 1 — 2026-02-20

### Added
- `components/briefing/briefing-issue-header.tsx` — header для страницы выпуска
- `components/briefing/briefing-player-placeholder.tsx` — sticky заглушка аудиоподкаста
- `components/briefing/briefing-source-card.tsx` — карточка источника с Russian tier badges
- `components/briefing/briefing-article-view.tsx` — полный рендер статьи (intro, sections, Collapsible sources, outro, meta, NoBriefingsYet)
- `components/briefing/briefing-sidebar.tsx` — sidebar (темы, история, генерация, настройки) + BriefingSidebarMobile (Sheet)
- `lib/db/queries.ts` — `getBriefingByDate()` timezone-aware query

### Changed
- `app/(dashboard)/briefing/page.tsx` — двухколоночный layout с sidebar, history (limit 10), дедупликация

### Fixed
- `formatDateLabel` из "use client" → server-only (Next.js ограничение)
- Дедупликация history по дате (duplicate React keys)
