# Передача сессии ТЗ-DV2U

**Дата:** 2026-02-18
**Сессия:** 2 (финальная)
**Статус ТЗ:** ЗАКРЫТО

## Статус этапов
- [x] Этап 1: Терминология ✅
- [x] Этап 2: Breadcrumbs в чате ✅
- [ ] ~~Этап 3: Контекст sidebar~~ — ОТМЕНЁН
- [ ] ~~Этап 4: Финализация~~ — ОТМЕНЁН

## Причина отмены этапов 3-4
Контекстный sidebar через деривацию chatMode (React Context) — архитектурный workaround. Принято решение перейти на route groups Next.js (`/expertise/[id]`, `/create/[id]`, `/chat/[id]`), где каждый режим имеет свой layout и sidebar "из коробки". Это устраняет проблему на корню. Реализация — в следующем ТЗ.

## Что доставлено

### Сессия 1: Этап 1
- Унифицировали ChatsPageContent → ModeChatsPage (удалили дубль)
- Configurable props: countNoun, summaryLabel, openLabel
- Терминология на /expertise, /create, /chats
- Кнопка "+ Новый чат" на /chats
- Git: `8e14dce feat(tz-dv2u): stage 1 — terminology unification`

### Сессия 2: Этап 2
- Передача chat.chatMode из page.tsx → Chat → ChatHeader
- Breadcrumbs по chatMode: "Экспертиза > Запрос", "Создание > Задание"
- Конфиг CHAT_MODE_BREADCRUMBS с иконками (Search, Sparkles)
- Git: `bdfc2bc feat(tz-dv2u): stage 2 — chat breadcrumbs by chatMode`

## Ключевые решения
- `CountNoun` interface { one, few, many } — сериализуемая замена функции для Russian plural rules
- `CHAT_MODE_BREADCRUMBS` — декларативный конфиг breadcrumbs по chatMode
- Breadcrumbs не показываются для projectId чатов (приоритет у проектных breadcrumbs)
