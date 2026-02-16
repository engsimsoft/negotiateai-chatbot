# Передача сессии ТЗ-DV2: Дашборд V2

**Дата:** 2026-02-17
**Сессия:** 5 (продолжение)

## Статус этапов
- [x] Этап 1: Удаление экосистемы помощников ✅ (commit `0bbe51b`)
- [x] Этап 2: chatMode — схема, миграция, API ✅ (commit `0ce7dd0`)
- [x] Этап 3: Промпты и Tools по chatMode ✅ (commit `cee6942`)
- [x] Этап 4A: Карточки на дашборде + убрать селектор модели ✅ (commit `e666db2`)
- [x] Этап 4B: ListDetailPage — универсальный layout-shell ✅ (commit `71735a0`)
- [x] Этап 4C: Страницы /expertise и /create ✅ (commits `55939e5`, `e36f3d4`)
- [ ] **Этап 4D: Рефакторинг /projects на ListDetailPage** ← СЛЕДУЮЩИЙ
- [ ] Этап 5: AI = Simply + chatMode badge в истории
- [ ] Этап 6: Финализация

## Что сделано в сессии 4-5

### Этап 4A (commit `e666db2`)
- Создан `components/glavnaya/mode-cards-section.tsx` — 3 карточки-лаунчера (Экспертиза, Создать, Проекты)
- Удалён `components/glavnaya/projects-section.tsx`
- Убран `InputModelSelector` из `components/input/compact-input.tsx`
- Добавлен `?mode=` query param в `app/(chat)/chat/page.tsx`

### Этап 4B (commit `71735a0`)
- Создан `components/list-detail/list-detail-page.tsx` — универсальный layout-shell (composition: render props)
- Создан `components/list-detail/index.ts`
- Рефакторен `components/chats/chats-page-content.tsx` на ListDetailPage
- Удалён `components/chats/chats-empty-state.tsx` (inlined в ListDetailPage)
- Убран `ModelSelectorCompact` из обычных чатов (`components/multimodal-input.tsx` — только для isProjectChat)
- Добавлен dev-badge в проектные чаты (`app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`)

### Этап 4C (commits `55939e5`, `e36f3d4`)
- Добавлен `getChatsByModeWithStats()` в `lib/db/queries.ts`
- Создан `components/chats/mode-chats-page.tsx` — shared client component
- Создан `app/(dashboard)/expertise/page.tsx`
- Создан `app/(dashboard)/create/page.tsx`
- **Фильтрация:** `getGeneralChatsWithStats` и `getGeneralChatsCount` теперь фильтруют `chatMode='chat'` — экспертизы/создание НЕ попадают в `/chats`

### Дополнительно
- Создан GitHub Issue #1: баг с маршрутизацией проектных чатов (task chat открывается в стандартном окне)

## Ключевые файлы (новые/изменённые)

### Новые компоненты
- `components/list-detail/list-detail-page.tsx` — ListDetailPage (header, two-column, empty state)
- `components/list-detail/index.ts` — exports
- `components/chats/mode-chats-page.tsx` — ModeChatsPage (reusable для /expertise, /create)
- `components/glavnaya/mode-cards-section.tsx` — 3 карточки на дашборде

### Новые страницы
- `app/(dashboard)/expertise/page.tsx` — Server Component
- `app/(dashboard)/create/page.tsx` — Server Component

### Изменённые
- `lib/db/queries.ts` — getChatsByModeWithStats(), фильтрация getGeneralChats* по chatMode='chat'
- `components/multimodal-input.tsx` — ModelSelectorCompact только для isProjectChat
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — data-model-info dev-badge
- `app/(chat)/chat/page.tsx` — ?mode= query param → initialChatMode

### Удалённые
- `components/glavnaya/projects-section.tsx`
- `components/chats/chats-empty-state.tsx`

## Решения архитектора (обновлённые)

- `/chats` → только `chatMode='chat'` (НЕ единый архив, каждый режим на своей странице)
- Sidebar — показывает ВСЕ чаты (не фильтровать)
- ListDetailPage — composition: render props (НЕ generics)
- Создание чатов: redirect `/chat?mode=...`, чат при первом сообщении

## Известные проблемы (не блокеры)

1. **GitHub Issue #1:** Проектный чат задачи иногда открывается в стандартном окне чата
2. **Нет chatMode badge** в списках — запланировано в Stage 5
3. **Sidebar не фильтрует** по chatMode — показывает все чаты (by design)

## Следующая сессия

1. Прочитать `HANDOFF.md` (этот файл) и `ROADMAP.md`
2. **Этап 4D:** Рефакторинг `/projects` на ListDetailPage
   - Создать `project-list-item.tsx`, `project-detail-panel.tsx`, `projects-page-content.tsx`
   - Рефакторить `app/(dashboard)/projects/page.tsx`
   - Удалить `project-card.tsx` если не используется
3. **Этап 5:** AI = Simply + chatMode badge
4. **Этап 6:** Финализация (DB cleanup, docs, v3.24.0)
