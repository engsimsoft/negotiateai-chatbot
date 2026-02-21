# Changelog ТЗ-BF3: BriefingSidebarRedesign

> История изменений в рамках этого ТЗ.
> После завершения — переносится в главный CHANGELOG.md

---

## 2026-02-21 — Этап 1: Фирменный header + удаление дублей
- `briefing-sidebar.tsx`: Branded header «S Simply» (Link → /dashboard), primary Button «Сгенерировать», удаление «Настройки» из footer
- `briefing-issue-header.tsx`: md:hidden на стрелке ←

## 2026-02-21 — Этап 2: Папки по темам (Collapsible)
- `briefing-sidebar.tsx`: groupByTopic(), formatShortDate(), extractHeadline(), getDisplayTitle(), Collapsible папки, localStorage persistence expandedTopics
- `briefing-page-client.tsx`: headline extraction при сохранении (## header или первая строка)

## 2026-02-21 — Этап 3: Финализация
- CHANGELOG.md, SIMPLY_STATUS.md, CLAUDE.md, package.json → v3.41.0
- Папка перемещена в _archive/
