# Передача сессии ТЗ-DV2: Дашборд V2

**Дата:** 2026-02-17
**Сессия:** 6

## Статус этапов
- [x] Этап 1: Удаление экосистемы помощников ✅ (commit `0bbe51b`)
- [x] Этап 2: chatMode — схема, миграция, API ✅ (commit `0ce7dd0`)
- [x] Этап 3: Промпты и Tools по chatMode ✅ (commit `cee6942`)
- [x] Этап 4A: Карточки на дашборде + убрать селектор модели ✅ (commit `e666db2`)
- [x] Этап 4B: ListDetailPage — универсальный layout-shell ✅ (commit `71735a0`)
- [x] Этап 4C: Страницы /expertise и /create ✅ (commits `55939e5`, `e36f3d4`)
- [x] Этап 4D: Рефакторинг /projects на ListDetailPage ✅ (не закоммичено)
- [ ] **Этап 5: AI = Simply + chatMode badge в истории** ← СЛЕДУЮЩИЙ
- [ ] Этап 6: Финализация

## Что сделано в сессии 6

### Этап 4D (не закоммичено)
- Создан `components/projects/project-list-item.tsx` — элемент списка (иконка, название, мета: задачи/файлы/время, dropdown: открыть/переименовать/удалить, selected state)
- Создан `components/projects/project-detail-panel.tsx` — правая панель (название, фаза-badge, дата, задачи/файлы, описание, «Открыть проект →», действия: переименовать/удалить)
- Создан `components/projects/projects-page-content.tsx` — клиентский контейнер с ListDetailPage (state, handlers, rename/delete диалоги)
- Рефакторен `app/(dashboard)/projects/page.tsx` — Server Component → ProjectsPageContent
- Удалён `components/projects/project-card.tsx` (заменён на list-detail компоненты)
- Обновлён `components/projects/index.ts` — убран ProjectCard, добавлен ProjectsPageContent
- Добавлен `phase` в select `getProjectsWithStats` (`lib/db/queries.ts`)
- `create-project-dialog.tsx` оставлен — используется в `sidebar-projects.tsx`

## Ключевые файлы (новые/изменённые)

### Новые компоненты (сессии 4-6)
- `components/list-detail/list-detail-page.tsx` — ListDetailPage (header, two-column, empty state)
- `components/list-detail/index.ts` — exports
- `components/chats/mode-chats-page.tsx` — ModeChatsPage (reusable для /expertise, /create)
- `components/glavnaya/mode-cards-section.tsx` — 3 карточки на дашборде
- `components/projects/project-list-item.tsx` — элемент списка проектов
- `components/projects/project-detail-panel.tsx` — детали проекта
- `components/projects/projects-page-content.tsx` — контейнер /projects

### Новые страницы
- `app/(dashboard)/expertise/page.tsx` — Server Component
- `app/(dashboard)/create/page.tsx` — Server Component

### Изменённые
- `lib/db/queries.ts` — getChatsByModeWithStats(), getProjectsWithStats (+phase), фильтрация getGeneralChats* по chatMode='chat'
- `components/multimodal-input.tsx` — ModelSelectorCompact только для isProjectChat
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — data-model-info dev-badge
- `app/(chat)/chat/page.tsx` — ?mode= query param → initialChatMode
- `app/(dashboard)/projects/page.tsx` — рефакторинг на ProjectsPageContent
- `components/projects/index.ts` — убран ProjectCard, добавлен ProjectsPageContent

### Удалённые
- `components/glavnaya/projects-section.tsx`
- `components/chats/chats-empty-state.tsx`
- `components/projects/project-card.tsx`

## Решения архитектора (обновлённые)

- `/chats` → только `chatMode='chat'` (НЕ единый архив, каждый режим на своей странице)
- Sidebar — показывает ВСЕ чаты (не фильтровать)
- ListDetailPage — composition: render props (НЕ generics)
- Создание чатов: redirect `/chat?mode=...`, чат при первом сообщении
- `/projects` — ListDetailPage с `createButton: { href: "/projects/new" }`

## Известные проблемы (не блокеры)

1. **GitHub Issue #1:** Проектный чат задачи иногда открывается в стандартном окне чата
2. **Нет chatMode badge** в списках — запланировано в Stage 5
3. **Sidebar не фильтрует** по chatMode — показывает все чаты (by design)
4. **Баги зафиксированы** Simply в dev-режиме — будут решаться после внедрения всех этапов

## Следующая сессия

1. Прочитать `HANDOFF.md` (этот файл) и `ROADMAP.md`
2. **Закоммитить этап 4D** (если не закоммичено)
3. **Этап 5:** AI = Simply + chatMode badge
   - Заменить "Claude" → "Simply" в UI
   - Добавить chatMode badge (🔍/✨) в sidebar-history-item и chat-list-item
4. **Этап 6:** Финализация (DB cleanup, docs, v3.24.0)
