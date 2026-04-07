# Передача сессии ТЗ-KITT

**Дата:** 2026-04-07
**Сессия:** 1

## Статус этапов
- [x] Этап 1: Core — маршрут `/simply` + persistent chat ✅
- [x] Этап 2: UI — главная + sidebar + кнопка «Думать» ✅
- [ ] Этап 3: «Мой контекст» dashboard + MIND idea ← СЛЕДУЮЩИЙ
- [ ] Этап 4: Polish + edge cases
- [ ] Этап 5: Финализация

## Ветка
`feature/simply-kitt` — коммит `c3b6261`

## Что сделано

### Этап 1: Core
- `getOrCreateSimplyChat(userId)` — один чат на пользователя, chatMode="simply"
- Маршрут `/simply` — Server Component, загружает persistent chat
- Auto-naming отключено (isRenamed=true + guard в autoNameChat)
- Simply скрыт из sidebar history и /chats query
- chatMode="simply" добавлен в chatModeSchema, CHAT_MODE_CONFIG, MEMORY_SOURCE_TYPES
- Snapshot/compaction guards обновлены для simply (Haiku=snapshot, Sonnet при think=compaction)

### Этап 2: UI + Think + Cache Fix
- Главная: ввод → redirect `/simply` (вместо `/chat`)
- Sidebar: пункт "Simply" (MessageCircle), скрытие "Новый чат"/"Все чаты" для simply
- Карточка "Мой контекст" (Brain icon, factCount) вместо "История чатов"
- getChatUrl: case "simply" → "/simply" (без chatId в URL)
- **Кнопка «Думать»**: toggle в toolbar, `think: true` в request body → Sonnet override
- Кнопка остаётся активной пока пользователь сам не выключит
- DevPanel: исправлен resolvedModelId в onFinish для think mode
- Research depth toggle скрыт для simply (как для chat)
- **Cache fix**: MIND retrieved facts вынесены из system prompt в отдельный system message без cacheControl. Profile (стабильный) остаётся в кэшируемом system prompt. Это починило prompt caching для всех режимов.

## Следующая сессия: начни с
1. Прочитать ROADMAP.md → Этап 3
2. Добавить категорию `idea` в MIND (types.ts, extract.ts, extract.md)
3. Быстрые команды в system prompt
4. API `/api/user/memory/context` — факты по категориям
5. Страница `/context` с 7 карточками MIND

## Открытые вопросы (обсудить с архитектором)
- **Tool `saveFact`**: пользователь говорит "запомни" → AI вызывает tool для гарантированной записи в MIND. Сейчас AI "врёт" — говорит "запомнил" но ничего не записывает, надеется на Extract. Решение: добавить tool в scope Этапа 3 или отдельное ТЗ.
- **System prompt KITT**: роль дворецкого-маршрутизатора пока не прописана в промпте. PE-контракт на будущее.

## Блокеры
- Нет
