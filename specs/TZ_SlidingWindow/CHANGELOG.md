# Changelog ТЗ-SlidingWindow

## Сессия 1 — 2026-04-07

### Added
- Константа `SIMPLY_SLIDING_WINDOW_SIZE = 20` в `lib/ai/context-limits.ts`
- Утилита `trimToUserStart()` — гарантирует начало окна с user message

### Changed
- `app/(chat)/api/chat/route.ts` — для `chatMode=simply` передаётся `maxMessages: 20`

### Files
- `lib/ai/context-limits.ts`
- `app/(chat)/api/chat/route.ts`
