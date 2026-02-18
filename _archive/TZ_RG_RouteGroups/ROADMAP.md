# Roadmap ТЗ-RG: Route Groups

**Создан:** 2026-02-18
**Версия проекта:** 3.24.0 → 3.25.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Текущий этап | 4 |
| Сессий (оценка) | 1-2 |

---

## Этап 1: Утилита `getChatUrl()` + обновление всех ссылок

**Статус:** ✅ Завершён

**Цель:** Создать единую утилиту формирования URL чатов и заменить все хардкоды `/chat/${id}` на её вызов. Это фундамент — без него route groups не будут работать.

**Задачи:**
- [x] Создать `getChatUrl(chatId, chatMode, projectId?)` в `lib/utils.ts`
- [x] Обновить `components/sidebar-history-item.tsx:83` — использовать `getChatUrl()`
- [x] Обновить `components/chats/chat-list-item.tsx:111` — использовать `getChatUrl()`
- [x] Обновить `components/chats/chat-detail-panel.tsx:68` — использовать `getChatUrl()`
- [x] Обновить `components/multimodal-input.tsx:173` — `window.history.replaceState` с `getChatUrl()`
- [x] Обновить `components/suggested-actions.tsx:40` — `window.history.replaceState` с `getChatUrl()`
- [x] Обновить `components/chat.tsx:363-366` — `window.history.replaceState` с `getChatUrl()`
- [ ] ~~Обновить dashboard pages createButton.href~~ → перенесено в Этап 2 (нужны route group pages для UUID-навигации)

**Файлы:**
- `lib/utils.ts` — добавить `getChatUrl()`
- `components/sidebar-history-item.tsx` — замена href
- `components/chats/chat-list-item.tsx` — замена href
- `components/chats/chat-detail-panel.tsx` — замена href
- `components/multimodal-input.tsx` — замена replaceState URL
- `components/suggested-actions.tsx` — замена replaceState URL
- `components/chat.tsx` — замена replaceState URL
- `app/(dashboard)/expertise/page.tsx` — замена createButton href
- `app/(dashboard)/create/page.tsx` — замена createButton href

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: существующие чаты продолжают открываться по `/chat/[id]` (регрессии нет)
- [x] 🧪 Мануальный тест пользователем
- [x] Bugfix: auto-naming race condition — перенесён на server-side (chat/route.ts)

**Git (после валидации):**
```bash
git add lib/utils.ts components/sidebar-history-item.tsx components/chats/chat-list-item.tsx components/chats/chat-detail-panel.tsx components/multimodal-input.tsx components/suggested-actions.tsx components/chat.tsx app/\(dashboard\)/expertise/page.tsx app/\(dashboard\)/create/page.tsx
git commit -m "feat(tz-rg): stage 1 — getChatUrl utility + update all hardcoded links"
```

**Критерий готовности:** Ни одного хардкода `/chat/${id}` (кроме route definition) не осталось в компонентах. Все ссылки используют `getChatUrl()`.

---

## Этап 2: Route Groups + страницы + redirect

**Статус:** ✅ Завершён

**Цель:** Создать route groups `(expertise)` и `(create)` с page и layout файлами. Добавить redirect в старый `/chat/[id]`.

**Задачи:**
- [x] Создать `app/(expertise)/layout.tsx` — копия `(chat)/layout.tsx` с провайдерами
- [x] Создать `app/(expertise)/expertise/[id]/page.tsx` — обработка и нового, и существующего чата (chatMode=expertise)
- [x] Создать `app/(create)/layout.tsx` — копия `(chat)/layout.tsx` с провайдерами
- [x] Создать `app/(create)/create/[id]/page.tsx` — обработка и нового, и существующего чата (chatMode=create)
- [x] Обновить `app/(chat)/chat/[id]/page.tsx` — redirect если chatMode=expertise/create
- [x] Обновить `ModeChatsPage` — chatMode prop + UUID-based onClick для кнопки создания
- [ ] Удалить обработку `?mode=` из `app/(chat)/chat/page.tsx` (опционально — fallback для старых ссылок)

**Файлы:**
- `app/(expertise)/layout.tsx` — новый
- `app/(expertise)/expertise/[id]/page.tsx` — новый
- `app/(create)/layout.tsx` — новый
- `app/(create)/create/[id]/page.tsx` — новый
- `app/(chat)/chat/[id]/page.tsx` — redirect logic
- `app/(chat)/chat/page.tsx` — упрощение (только chatMode=chat)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: `/expertise/[uuid]` → пустой чат с chatMode=expertise
- [ ] Браузер: `/create/[uuid]` → пустой чат с chatMode=create
- [ ] Браузер: `/chat/[existing-expertise-id]` → redirect на `/expertise/[id]`
- [ ] Браузер: `/chat/[existing-chat-id]` → остаётся на `/chat/[id]` (без redirect)
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/\(expertise\)/ app/\(create\)/ app/\(chat\)/chat/\[id\]/page.tsx app/\(chat\)/chat/page.tsx
git commit -m "feat(tz-rg): stage 2 — route groups + redirect from /chat/[id]"
```

**Критерий готовности:** Три маршрута работают: `/chat/[id]`, `/expertise/[id]`, `/create/[id]`. Старые URL редиректят корректно.

---

## Этап 3: Mode-aware sidebar + history API фильтрация

**Статус:** ✅ Завершён

**Цель:** Sidebar знает текущий режим (chat/expertise/create) и показывает контекстный заголовок, кнопку создания, ссылку "Все..." и отфильтрованную историю.

**Задачи:**
- [x] Расширить `SidebarContext` в `app-sidebar.tsx` — добавить `chatMode` field к `general` type
- [x] Обновить `getSidebarContext()` — детектить `/expertise/[id]` и `/create/[id]` из pathname
- [x] Обновить `getNewChatUrl()` — генерировать UUID и навигировать на mode-specific URL
- [x] Обновить `getContextTitle()` — "Чаты" / "Запросы" / "Задания"
- [x] Обновить навигационную секцию — кнопка "Новый чат" → "Новый запрос" / "Новое задание", tooltip
- [x] Обновить ссылку "Все чаты" → "Все запросы" / "Все задания" с правильным href
- [x] Добавить `?chatMode=` параметр в `/api/history` endpoint
- [x] Обновить `getChatsByUserId()` в `lib/db/queries.ts` — фильтр по chatMode (опционально)
- [x] Обновить `sidebar-history.tsx` — передавать chatMode при запросе истории
- [x] Обновить `chat.tsx` и `use-chat-visibility.ts` — mode-aware SWR cache keys

**Файлы:**
- `components/app-sidebar.tsx` — mode-awareness (context, title, button, link)
- `app/(chat)/api/history/route.ts` — `?chatMode=` параметр
- `lib/db/queries.ts` — фильтр chatMode в `getChatsByUserId()`
- `components/sidebar-history.tsx` — `makeChatHistoryPaginationKey(chatMode)` factory + передача chatMode
- `components/chat.tsx` — mode-aware SWR mutate key
- `hooks/use-chat-visibility.ts` — chatMode prop + mode-aware SWR mutate key

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер `/expertise/[id]`: sidebar показывает "Запросы", кнопку "Новый запрос", ссылку "Все запросы → /expertise", историю только expertise чатов
- [x] Браузер `/create/[id]`: sidebar показывает "Задания", кнопку "Новое задание", ссылку "Все задания → /create", историю только create чатов
- [x] Браузер `/chat/[id]`: sidebar показывает "Чаты", кнопку "Новый чат", ссылку "Все чаты → /chats", историю только chat чатов
- [x] Кнопка "Новый запрос" → генерирует UUID, навигирует на `/expertise/[uuid]`
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/app-sidebar.tsx components/sidebar-history.tsx app/\(chat\)/api/history/route.ts lib/db/queries.ts
git commit -m "feat(tz-rg): stage 3 — mode-aware sidebar + history API filtering"
```

**Критерий готовности:** Каждый режим имеет свой контекстный sidebar с правильным заголовком, кнопкой, ссылкой и отфильтрованной историей.

---

## Этап 4: ADR + Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, ADR, финальная проверка, обновление проектных файлов.

**Задачи:**
- [x] Создать `docs/decisions/014-route-groups-per-chat-mode.md` — ADR
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (структура маршрутов)
- [x] Обновить `package.json` — версия 3.25.0
- [x] Переместить `specs/TZ_RG_RouteGroups/` → `_archive/`

**Файлы:**
- `docs/decisions/014-route-groups-per-chat-mode.md` — ADR
- `CHANGELOG.md` — обновлён
- `SIMPLY_STATUS.md` — обновлён
- `CLAUDE.md` — обновлена структура кода
- `package.json` — версия 3.25.0

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (simply@3.25.0)
- [x] Документация актуальна
- [ ] 🧪 Финальный мануальный тест пользователем

**Git (после валидации):**
```bash
git add docs/adr/route-groups.md CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json
git commit -m "docs(tz-rg): stage 4 — ADR + finalization v3.25.0"
```

**Критерий готовности:** Всё работает, документация обновлена, ТЗ в архиве.
