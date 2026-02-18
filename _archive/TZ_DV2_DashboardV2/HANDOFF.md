# Передача сессии ТЗ-DV2: Дашборд V2

**Дата:** 2026-02-17
**Сессия:** 7

## Статус этапов
- [x] Этап 1: Удаление экосистемы помощников ✅ (commit `0bbe51b`)
- [x] Этап 2: chatMode — схема, миграция, API ✅ (commit `0ce7dd0`)
- [x] Этап 3: Промпты и Tools по chatMode ✅ (commit `cee6942`)
- [x] Этап 4A: Карточки на дашборде + убрать селектор модели ✅ (commit `e666db2`)
- [x] Этап 4B: ListDetailPage — универсальный layout-shell ✅ (commit `71735a0`)
- [x] Этап 4C: Страницы /expertise и /create ✅ (commits `55939e5`, `e36f3d4`)
- [x] Этап 4D: Рефакторинг /projects на ListDetailPage ✅ (commit `1f47eef`)
- [x] Этап 5: chatMode badges в sidebar и списках ✅ (commit `4c58bdf`)
- [x] Этап 6: Финализация ✅

## Что сделано в сессии 6-7

### Этап 4D (commit `1f47eef`)
- Создан `components/projects/project-list-item.tsx` — элемент списка (иконка, название, мета: задачи/файлы/время, dropdown: открыть/переименовать/удалить, selected state)
- Создан `components/projects/project-detail-panel.tsx` — правая панель (название, фаза-badge, дата, задачи/файлы, описание, «Открыть проект →», действия: переименовать/удалить)
- Создан `components/projects/projects-page-content.tsx` — клиентский контейнер с ListDetailPage (state, handlers, rename/delete диалоги)
- Рефакторен `app/(dashboard)/projects/page.tsx` — Server Component → ProjectsPageContent
- Удалён `components/projects/project-card.tsx` (заменён на list-detail компоненты)
- Обновлён `components/projects/index.ts` — убран ProjectCard, добавлен ProjectsPageContent
- Добавлен `phase` в select `getProjectsWithStats` (`lib/db/queries.ts`)

### Этап 5 (commit `4c58bdf`)
- Добавлены chatMode badges (🔍/✨) в `components/sidebar-history-item.tsx`
- Добавлены chatMode badges в `components/chats/chat-list-item.tsx`
- Добавлен `chatMode` в тип `ChatWithStats` (`components/chats/chats-page-content.tsx`)
- Добавлен `chatMode` в select обоих queries (`getGeneralChatsWithStats`, `getChatsByModeWithStats`)
- Переименовано Claude → Simply в `lib/ai/models.ts` (подготовка, сейчас НЕ видно в UI)
- Переименовано Claude → Simply в серверных логах `app/(chat)/api/chat/route.ts`
- **Примечание:** Пункт "AI = Simply в UI" из ROADMAP фактически не реализован — models.ts нигде не отображается в текущем UI. Реальное изменение — только sidebar/list badges.

## Ключевые файлы (все сессии)

### Новые компоненты
- `components/list-detail/list-detail-page.tsx` — ListDetailPage (header, two-column, empty state)
- `components/list-detail/index.ts` — exports
- `components/chats/mode-chats-page.tsx` — ModeChatsPage (reusable для /expertise, /create)
- `components/glavnaya/mode-cards-section.tsx` — 3 карточки на дашборде
- `components/projects/project-list-item.tsx` — элемент списка проектов
- `components/projects/project-detail-panel.tsx` — детали проекта
- `components/projects/projects-page-content.tsx` — контейнер /projects

### Новые страницы
- `app/(dashboard)/expertise/page.tsx`
- `app/(dashboard)/create/page.tsx`

### Удалённые
- `components/glavnaya/projects-section.tsx`
- `components/chats/chats-empty-state.tsx`
- `components/projects/project-card.tsx`

## Решения архитектора

- `/chats` → только `chatMode='chat'` (каждый режим на своей странице)
- Sidebar — показывает ВСЕ чаты (не фильтровать), с chatMode badges
- ListDetailPage — composition: render props (НЕ generics)
- Создание чатов: redirect `/chat?mode=...`, чат при первом сообщении
- `/projects` — ListDetailPage с `createButton: { href: "/projects/new" }`

## Известные проблемы (не блокеры)

1. **GitHub Issue #1:** Проектный чат задачи иногда открывается в стандартном окне чата
2. **Sidebar не фильтрует** по chatMode — показывает все чаты (by design)
3. **Баги зафиксированы** Simply в dev-режиме — будут решаться после внедрения всех этапов
4. **models.ts** — переименовано в Simply, но нигде не видно в UI (мёртвый код для названий)

## Следующая сессия

1. Прочитать `HANDOFF.md` (этот файл) и `ROADMAP.md`
2. **Этап 6: Финализация** (последний этап ТЗ-DV2)
   - DB-миграция: удалить `helperId` из Chat и таблицу `Helper`
   - Финальное тестирование всех фич
   - Обновить документацию: CHANGELOG.md, SIMPLY_STATUS.md, CLAUDE.md, docs/*
   - Обновить `package.json` → 3.24.0
   - Переместить `specs/TZ_DV2_DashboardV2/` → `_archive/`
