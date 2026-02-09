# Roadmap ТЗ-B2: Утверждение плана + ProjectTask + Пульс

**Создан:** 2026-02-09
**Версия проекта:** 3.14.0 → 3.15.0
**Статус:** Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 5 ✅ (все завершены) |
| Сессий (оценка) | 1 |

---

## Этап 1: БД — таблица ProjectTask + миграция

**Статус:** ✅ Завершён

**Цель:** Создать таблицу ProjectTask с pgEnum статусов, добавить query-функции и каскадное удаление.

**Задачи:**
- [x] Добавить `pgEnum('project_task_status', [...])` в `schema.ts`
- [x] Добавить таблицу `projectTask` в `schema.ts` (все поля из ТЗ)
- [x] Экспортировать тип `ProjectTask`
- [x] Запустить `npx drizzle-kit generate` для создания миграции
- [x] Запустить `npx drizzle-kit migrate` для применения миграции
- [x] Добавить в `queries.ts`: `createProjectTasks(projectId, tasks[])` — bulk insert
- [x] Добавить в `queries.ts`: `getProjectTasksByProjectId(projectId)` — SELECT ORDER BY orderIndex
- [x] Добавить удаление ProjectTask в `deleteProjectById()` (перед удалением chats)
- [x] Проверить миграцию через MCP SQL: таблица и enum существуют

**Файлы:**
- `lib/db/schema.ts` — pgEnum + таблица projectTask
- `lib/db/queries.ts` — createProjectTasks, getProjectTasksByProjectId, обновить deleteProjectById
- `lib/db/migrations/0026_useful_supernaut.sql` — миграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: таблица ProjectTask существует с 18 колонками
- [x] SQL: enum `project_task_status` содержит 6 значений
- [x] 🧪 Мануальный тест: не требуется (только БД)

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts lib/db/migrations/
git commit -m "feat(tz-b2): ProjectTask table + queries + migration"
```

**Критерий готовности:** Таблица существует в БД, типы экспортируются, query-функции работают.

---

## Этап 2: Backend — approve-plan + tasks endpoints

**Статус:** ✅ Завершён

**Цель:** API для утверждения плана (создание задач из planJson) и получения списка задач.

**Задачи:**
- [x] Создать `app/(chat)/api/projects/[id]/approve-plan/route.ts` — POST endpoint
  - Загрузить Project, проверить planJson.tasks
  - Guard: если ProjectTask уже существуют → 409 Conflict (защита от дубликатов)
  - Маппинг planJson.tasks → ProjectTask[]: задачи без dependencies → `pending`, с dependencies → `locked`
  - Обновить phase → `approved`
  - Вернуть созданные задачи
- [x] Создать `app/(chat)/api/projects/[id]/tasks/route.ts` — GET endpoint
  - Вернуть ProjectTask[] ORDER BY orderIndex
- [x] Проверить авторизацию в обоих endpoints (session + userId match)

**Файлы:**
- `app/(chat)/api/projects/[id]/approve-plan/route.ts` — новый
- `app/(chat)/api/projects/[id]/tasks/route.ts` — новый

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] 🧪 Мануальный тест: вызвать approve-plan через DevTools/curl для проекта с planJson → задачи создаются в БД

**Git (после валидации):**
```bash
git add app/(chat)/api/projects/[id]/approve-plan/ app/(chat)/api/projects/[id]/tasks/
git commit -m "feat(tz-b2): approve-plan + tasks API endpoints"
```

**Критерий готовности:** POST approve-plan создаёт ProjectTask[], GET tasks возвращает их. Двойной вызов не создаёт дубли.

---

## Этап 3: UI — кнопка «Утвердить» + ApprovedState с картой задач

**Статус:** ✅ Завершён

**Цель:** Кнопка «Утвердить план» активна, по клику создаёт задачи и переходит на approved. Рабочая область показывает карту задач.

**Задачи:**
- [x] В `planning-state.tsx`: убрать `disabled` с кнопки, заменить Lock на CheckCircle2
- [x] Добавить `AlertDialog` подтверждения: «Утвердить план из N задач?»
- [x] Обработчик: POST `/api/projects/[id]/approve-plan` → `router.refresh()` при успехе
- [x] В `project-work-area.tsx`: передать `projectTasks` prop в `ApprovedState`
- [x] Переписать `approved-state.tsx`: карта задач (номер, заголовок, goal, tools, needsReview, статус)
- [x] Кнопка «Начать первую задачу» — toast «Скоро — в следующем обновлении»
- [x] В `page.tsx`: загрузить ProjectTask[] через `getProjectTasksByProjectId()` и передать вниз

**Файлы:**
- `components/projects/phase-states/planning-state.tsx` — активировать кнопку + confirmation
- `components/projects/phase-states/approved-state.tsx` — полная переработка (карта задач)
- `components/projects/project-work-area.tsx` — новый prop projectTasks
- `app/(dashboard)/projects/[id]/page.tsx` — загрузка ProjectTask[]

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: кнопка «Утвердить план» активна, появляется диалог подтверждения
- [ ] Браузер: после утверждения — рабочая область показывает карту задач с номерами и статусами
- [ ] Браузер: «Начать первую задачу» показывает toast
- [ ] 🧪 Мануальный тест пользователем (ожидает вместе с Этапом 4)

**Git (после валидации):**
```bash
git add components/projects/phase-states/ components/projects/project-work-area.tsx app/(dashboard)/projects/[id]/page.tsx
git commit -m "feat(tz-b2): approve button + task cards in ApprovedState"
```

**Критерий готовности:** Полный flow: кнопка → confirmation → approve → карта задач в рабочей области.

---

## Этап 4: Пульс — реальные задачи + контекст Менеджера

**Статус:** ✅ Завершён

**Цель:** Пульс показывает ProjectTask[] из БД (при approved+). Менеджер получает taskStatuses в контексте.

**Задачи:**
- [x] В `project-pulse.tsx`: добавить prop `projectTasks: ProjectTask[]`
- [x] Условие: при `phase !== 'planning'` И `projectTasks.length > 0` → показывать ProjectTask[] вместо Chat[]
- [x] Иконки статусов: pending=⬜, locked=🔒, in_progress=🔄, review=🧠, issues=⚠️, done=✅
- [x] В `page.tsx`: передать `projectTasks` в `ProjectPulse`
- [x] В `service-chat/route.ts`: обновить `buildPlanPresentationStub()` → передавать taskStatuses XML
- [x] Загружать ProjectTask[] в manager context при phase=approved

**Файлы:**
- `components/projects/project-pulse.tsx` — новый prop + рендер ProjectTask[]
- `app/(dashboard)/projects/[id]/page.tsx` — передать projectTasks в Pulse
- `app/(chat)/api/service-chat/route.ts` — taskStatuses в manager prompt

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: Пульс при approved показывает задачи с иконками статусов (pending/locked)
- [ ] Браузер: Менеджер в drawer понимает что план утверждён и знает задачи
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/projects/project-pulse.tsx app/(dashboard)/projects/[id]/page.tsx app/(chat)/api/service-chat/route.ts
git commit -m "feat(tz-b2): pulse real tasks + manager task context"
```

**Критерий готовности:** Пульс показывает реальные ProjectTask с корректными статусами. Менеджер получает статусы в XML.

---

## Этап 5: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] SQL-проверка БД (таблица, колонки, FK, enum)
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (структура кода — ProjectTask)
- [x] Обновить package.json (3.14.0 → 3.15.0)
- [x] Переместить папку в `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна
- [x] Все функции работают в браузере
