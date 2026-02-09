# Передача сессии ТЗ-B2

**Дата:** 2026-02-09
**Сессия:** 2

## Статус этапов
- [x] Этап 1: БД — ProjectTask + миграция ✅
- [x] Этап 2: Backend — approve-plan + tasks ✅
- [x] Этап 3: UI — кнопка «Утвердить» + ApprovedState ✅
- [x] Этап 4: Пульс — реальные задачи + Менеджер ✅
- [ ] Этап 5: Финализация ← СЛЕДУЮЩИЙ

## Что сделано в Сессии 2 (Этап 4)

### Пульс (project-pulse.tsx)
- Новый prop `projectTasks: ProjectTask[]`
- `ProjectTaskStatusIcon` — 6 иконок: pending=Circle, locked=Lock, in_progress=Loader2(spin), review=Brain, issues=AlertTriangle, done=Check
- При `phase !== 'planning'` и `projectTasks.length > 0` → рендерит ProjectTask[] с номерами и статусами
- Счётчики статусов в шапке секции (все 6 типов)
- Fallback на legacy chat-based tasks если projectTasks пусты

### page.tsx
- Проброс `projectTasks` в `ProjectPulse`

### Менеджер (service-chat/route.ts)
- `buildPlanPresentationStub()` → `buildPlanPresentationMode()` (async)
- Загружает ProjectTask[] из БД
- Формирует `<task_statuses>` XML с order, status, title
- Mode instructions: отвечать о задачах, указывать на pending, объяснять locked
- `buildModeInjection()` стал async из-за нового режима

## Следующая сессия: Этап 5 (Финализация)
1. Мануальный тест Этапов 3+4 (утверждение плана → Пульс с задачами → Менеджер знает задачи)
2. SQL-проверка БД
3. Обновить CHANGELOG.md (главный)
4. Обновить SIMPLY_STATUS.md
5. Обновить CLAUDE.md
6. Обновить package.json (3.14.0 → 3.15.0)
7. Git commit Этапа 4
8. Переместить в _archive/

## Блокеры / Вопросы
- (нет)
