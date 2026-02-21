# Changelog ТЗ-BF1: Привязка контента по itemId

## Сессия 1 — 2026-02-21

### Fixed
- fullTextsMap lookup: ключ `item.url` → `item.itemId` (web/jina источники получают полный текст)
- Автор брифинга: lookup `c.url` → `c.sourceItemId`

### Added
- `RawContent.itemId` — уникальный ID (`src-0`, `src-1`, ...) присваивается в route.ts
- `FilteredItem.sourceItemId` — обязательное поле в Zod-схеме фильтра
- Промпт-инструкция фильтру: возвращать EXACT itemId из `[src-N]`
- Debug-лог `[Briefing] Full text hit: X/Y candidates`

### Files
- `lib/briefing/source-fetchers/types.ts`
- `lib/briefing/briefing-filter.ts`
- `lib/briefing/briefing-author.ts`
- `app/(chat)/api/briefing/generate/route.ts`
