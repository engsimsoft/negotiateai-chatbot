# Передача сессии ТЗ-A1

**Дата:** 2026-02-08
**Сессия:** 2 → 3

## Статус этапов
- [x] Этап 1: Миграция БД + Schema ✅
- [x] Этап 2: ProjectPageLayout + Header ✅
- [x] Этап 3: Пульс (левая панель) ✅
- [x] Этап 4: Рабочая область (WorkArea) + Фазы ✅
- [ ] Этап 5: ManagerDrawer ← СЛЕДУЮЩИЙ
- [ ] Этап 6: Очистка + Финализация

## Следующая сессия: начни с
1. Прочитать `specs/TZ_A1_ProjectPageLayout/ROADMAP.md` — Этап 5
2. Прочитать текущие компоненты:
   - `components/projects/project-page-layout.tsx` — layout уже поддерживает `isDrawerOpen` prop (marginRight: 400px)
   - `components/service-chat/service-chat-drawer.tsx` — можно использовать как референс
3. Создать `components/projects/manager-drawer.tsx`:
   - Push-drawer справа (~400px), WorkArea сжимается (не overlay)
   - Header: аватар + «Менеджер проекта» + кнопка закрытия (X)
   - Зона сообщений: заглушка
   - Зона действий: пустой блок (~60-80px)
   - Поле ввода: disabled, placeholder
   - Анимация открытия/закрытия (transition)
4. Интегрировать в page.tsx — кнопка [Менеджер] → toggle drawer
5. Мобильный: bottom sheet

## Что сделано в сессии 2

### Этап 3: Пульс
- Полный рефакторинг `components/projects/project-pulse.tsx` — контейнер трёх сворачиваемых секций (Collapsible):
  - **План** (раскрыт) — задачи со статусами (done/in_progress/not_started), счётчик, клик → навигация
  - **Файлы** (раскрыт) — ProjectFilesCard в compact-режиме
  - **Паспорт** (свёрнут) — описание, контекст, инструкция, мета-данные
- `components/projects/project-files-card.tsx` — добавлен `compact` prop (убирает border, уменьшает padding, скрывает заголовок)
- `components/projects/project-page-layout.tsx` — мобильный bottom sheet (Sheet снизу, плавающая кнопка `LayoutList`, lg:hidden)
- `app/(dashboard)/projects/[id]/page.tsx` — передаёт files, folders, passport data в Pulse
- Паспорт встроен прямо в Pulse (старый ProjectPassport с табами не используется на странице проекта)

### Этап 4: WorkArea + Фазы
- Создан `components/projects/project-work-area.tsx` — switch по phase
- Создано 5 компонентов фаз в `components/projects/phase-states/`:
  - `welcome-state.tsx` (setup/documents) — «Добро пожаловать», кнопки «Загрузить файлы» / «Начать работу»
  - `planning-state.tsx` — заглушка
  - `approved-state.tsx` — заглушка
  - `execution-state.tsx` — сетка карточек задач с навигацией + «Новая задача»
  - `completed-state.tsx` — заглушка
- Добавлена `updateProjectPhase()` в `lib/db/queries.ts`
- Авто-переход setup → documents при первом открытии страницы (server-side в page.tsx)
- Мануально проверено: WelcomeState работает, ExecutionState показывает карточки, авто-переход пишет в БД

## Коммиты
- `8cbed4a` feat(tz-a1): add phase column to Project table
- `60db774` feat(tz-a1): two-column layout and clean header
- `8a05ef1` feat(tz-a1): pulse panel with collapsible sections
- `3142e86` feat(tz-a1): work area with phase rendering

## Ключевые решения
- Tasks route `/projects/[id]/tasks/` — оставить (не удалять)
- Кнопка "Настроить" — убрана из header, настройки в Паспорте (Пульс)
- ProjectMeta — встроен в секцию Паспорт (Пульс), компактно внизу
- Mobile Pulse — bottom sheet с кнопкой-триггером (LayoutList)
- Scroll isolation — `overscroll-contain` на обе колонки
- Авто-переход setup → documents — server-side (не client-side effect)

## Известные ограничения (не баги, а legacy)
- URL-ы задач содержат `/chat` и `/chat/[chatId]` — legacy, т.к. задачи = чаты (таблица Chat). Рефакторинг URL → `/tasks` запланирован вместе с созданием таблицы `ProjectTask` (будущее ТЗ). Пользователь URL не видит, в UI везде «задачи».

## Блокеры / Вопросы
- Нет
