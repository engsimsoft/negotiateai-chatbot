# Changelog ТЗ-KITT: Simply — Persistent Chat

## Сессия 1 — 2026-04-07

### Added
- `app/(chat)/simply/page.tsx` — маршрут `/simply` (persistent chat)
- `getOrCreateSimplyChat()` в `lib/db/queries.ts`
- `chatMode="simply"` в chatModeSchema, CHAT_MODE_CONFIG
- `"simply"` в MEMORY_SOURCE_TYPES
- Кнопка «Думать» — toggle Haiku↔Sonnet (`think` param в schema + route)
- Карточка «Мой контекст» на главной (заменяет «История чатов»)
- Пункт "Simply" в sidebar навигации
- SPEC.md, ANALYSIS.md, ROADMAP.md, HANDOFF.md

### Changed
- Главная: redirect `/chat` → `/simply`
- getChatUrl: case "simply" → "/simply"
- Sidebar: скрытие "Новый чат"/"Все чаты"/"История" для chatMode=simply
- getChatsByUserId: `ne(chat.chatMode, "simply")` — исключение из history
- autoNameChat: guard для chatMode=simply
- Snapshot/compaction guards: isHaikuChat включает simply
- isMemoryEnabled: добавлен "simply"
- **MIND cache fix**: retrieved facts вынесены из system prompt в отдельный system message без cacheControl (починило prompt caching для всех режимов)
- DevPanel: resolvedModelId корректен при think mode

### Files
- `app/(chat)/simply/page.tsx` — НОВЫЙ
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/chat/schema.ts`
- `app/(dashboard)/dashboard/page.tsx`
- `components/app-sidebar.tsx`
- `components/chat.tsx`
- `components/multimodal-input.tsx`
- `components/glavnaya/chat-history-card.tsx`
- `components/glavnaya/glavnaya-input.tsx`
- `components/glavnaya/index.ts`
- `lib/ai/chat-mode-config.ts`
- `lib/ai/memory/types.ts`
- `lib/db/queries.ts`
- `lib/utils.ts`
