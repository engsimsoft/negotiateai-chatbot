# Changelog ТЗ-DV2U: UX навигации Dashboard V2

## Сессия 1 — 2026-02-18

### Added
- `countNoun` prop в ModeChatsPage — сериализуемые формы существительных (one/few/many)
- `summaryLabel`, `openLabel` props в ChatDetailPanel
- Кнопка "+ Новый чат" на странице /chats

### Changed
- /expertise: "Новая экспертиза" → "Новый запрос", "N чатов" → "N запросов", "О чём чат" → "О чём запрос"
- /create: title "Создать" → "Создание", "Новый документ" → "Новое задание", "N чатов" → "N заданий"
- /chats: теперь использует ModeChatsPage (унификация)
- Empty states: "Нет экспертиз" → "Нет запросов", "Нет документов" → "Нет заданий"

### Removed
- `components/chats/chats-page-content.tsx` — заменён ModeChatsPage (устранение дублирования)

### Files
- `components/chats/mode-chats-page.tsx` — ChatWithStats type + countNoun + props
- `components/chats/chat-detail-panel.tsx` — summaryLabel, openLabel props
- `components/chats/chat-list.tsx` — import fix
- `components/chats/chat-list-item.tsx` — import fix
- `components/chats/index.ts` — re-export ModeChatsPage
- `app/(dashboard)/chats/page.tsx` — ModeChatsPage + createButton
- `app/(dashboard)/expertise/page.tsx` — новая терминология
- `app/(dashboard)/create/page.tsx` — новая терминология
