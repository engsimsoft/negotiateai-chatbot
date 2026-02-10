# Roadmap ТЗ-C2: TaskCompletion

**Создан:** 2026-02-10
**Версия проекта:** 3.16.0 → 3.17.0
**Статус:** В работе

> **Инструкция:** [specs/ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md)

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 1 |
| Сессий (оценка) | 3-4 |

---

## Решения (из ANALYSIS.md)

- **Суммаризатор:** `SUMMARIZER_MODEL` → `gemini-2.5-flash`
- **Ревьюер:** `PROFESSOR_MODEL` → `gemini-3-pro` (общий с планированием)
- **professorEnabled:** hardcode `true`, проверяем только `task.needsReview`
- **Completion card:** рендерим по `task.status`, не персистим в Messages
- **Chat.snapshots:** проверка с fallback на 40 сообщений (forward-compat)
- **Навигация:** `router.push()` в `(task)` layout

---

## Этапы

### Этап 1: Типы, схемы, промпты

**Статус:** ✅ Завершён

**Цель:** Создать фундамент — Zod-схемы, TypeScript типы и промпт-файлы для суммаризатора и ревьюера.

**Задачи:**
- [x] Создать `lib/ai/task-completion-types.ts` — Zod-схемы `taskSummarySchema`, `professorVerdictSchema` + TypeScript типы `TaskSummary`, `ProfessorVerdict`
- [x] Создать `lib/prompts/clerks/task-summarizer.md` — промпт из CLERK_SUMMARIZER.md (system prompt секция)
- [x] Создать `lib/prompts/professors/task-review.md` — промпт из PROFESSOR_REVIEW.md (system prompt секция)

**Файлы:**
- `lib/ai/task-completion-types.ts` — новый
- `lib/prompts/clerks/task-summarizer.md` — новый
- `lib/prompts/professors/task-review.md` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Типы импортируются без ошибок

**Git (после валидации):**
```bash
git add lib/ai/task-completion-types.ts lib/prompts/clerks/task-summarizer.md lib/prompts/professors/task-review.md
git commit -m "feat(tz-c2): types, schemas, and prompts for task completion"
```

**Критерий готовности:** Zod-схемы парсят примеры из мысленных тестов PE без ошибок. Промпты на месте.

---

### Этап 2: AI-функции (суммаризатор + ревьюер)

**Статус:** ✅ Завершён

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 1

**Цель:** Реализовать две AI-функции: `summarizeTask()` и `reviewTask()`.

**Задачи:**
- [x] Создать директорию `lib/ai/clerks/` и файл `task-summarizer.ts` — функция `summarizeTask()` (загрузка промпта, вызов `generateText`, Zod-парсинг, fallback)
- [x] Создать директорию `lib/ai/professors/` и файл `task-reviewer.ts` — функция `reviewTask()` (загрузка промпта, вызов `generateText`, парсинг `<review_analysis>` + `<review_json>`, Zod-валидация)
- [x] Реализовать подготовку сообщений чата для суммаризатора: фильтрация user/assistant, лимит 40 сообщений, проверка snapshots (fallback)

**Файлы:**
- `lib/ai/clerks/task-summarizer.ts` — новый
- `lib/ai/professors/task-reviewer.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен

**Git (после валидации):**
```bash
git add lib/ai/clerks/ lib/ai/professors/
git commit -m "feat(tz-c2): summarizeTask and reviewTask AI functions"
```

**Критерий готовности:** Функции экспортируются, типы корректны, промпты загружаются.

---

### Этап 3: DB queries + API endpoints

**Статус:** ✅ Завершён

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 2

**Цель:** Backend — DB-функции и 3 API endpoint-а для завершения, доработки и принятия задач.

**Задачи:**
- [x] Добавить в `lib/db/queries.ts`: `completeTask()` — обновить статус, сохранить outputSummary + verdict, разблокировать зависимые, проверить завершение проекта
- [x] Добавить в `lib/db/queries.ts`: `reopenTask()` — status `issues` → `in_progress`
- [x] Добавить в `lib/db/queries.ts`: `acceptTask()` — status `issues` → `done` + разблокировка зависимых
- [x] Создать `app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts` — POST: auth guard, status guard, вызов summarizeTask, [вызов reviewTask если needsReview], вызов completeTask, возврат результата
- [x] Создать `app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts` — POST: auth guard, status guard, reopenTask
- [x] Создать `app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts` — POST: auth guard, status guard, acceptTask

**Файлы:**
- `lib/db/queries.ts` — модификация (3 новые функции)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts` — новый
- `app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts` — новый
- `app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts` — новый

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] 🧪 Мануальный тест: POST .../complete через DevTools — summarizer OK, reviewer critical 3 issues, status→issues

**Git (после валидации):**
```bash
git add lib/db/queries.ts "app/(chat)/api/projects/[id]/tasks/[taskId]/complete/" "app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/" "app/(chat)/api/projects/[id]/tasks/[taskId]/accept/"
git commit -m "feat(tz-c2): complete/reopen/accept API endpoints + DB queries"
```

**Критерий готовности:** API endpoints доступны, POST .../complete возвращает JSON с outputSummary и (опционально) professorVerdict.

---

### Этап 4: UI — кнопка завершения + completion card

**Статус:** ✅ Завершён

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 3

**Цель:** Пользователь видит кнопку «Завершить задачу», может завершить задачу, видит результат в карточке.

**Задачи:**
- [x] Создать `components/projects/task-completion-card.tsx` — три варианта карточки (success, issues, critical) с кнопками навигации (→ Следующая, ← К проекту, Подробнее, Доработать, Принять)
- [x] Модифицировать `components/projects/task-chat.tsx` — добавить кнопку «Завершить задачу» в header (CheckCircle + текст), AlertDialog подтверждения, spinner «Обработка...», вызов POST .../complete, отображение completion card после завершения
- [x] Реализовать рендер completion card по `task.status` при загрузке чата (если status = done/issues — показать карточку в конце)
- [x] Реализовать «Доработать» (POST .../reopen → status back to in_progress) и «Принять» (POST .../accept → status done)

**Файлы:**
- `components/projects/task-completion-card.tsx` — новый
- `components/projects/task-chat.tsx` — модификация

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: кнопка видна в header при status=in_progress, скрыта при done
- [x] Браузер: AlertDialog показывается, spinner работает
- [x] Браузер: completion card отображается после завершения
- [x] 🧪 Мануальный тест: полный flow — открыть задачу → поработать → завершить → увидеть карточку

**Git (после валидации):**
```bash
git add components/projects/task-completion-card.tsx components/projects/task-chat.tsx
git commit -m "feat(tz-c2): complete button + completion card UI"
```

**Критерий готовности:** Пользователь может завершить задачу через UI, видит результат (success или issues), может доработать или принять.

---

### Этап 5: Интеграция — sidebar, навигация, project completion

**Статус:** ✅ Завершён

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 4

**Цель:** Всё работает вместе — sidebar обновляется, «Следующая задача» работает, проект переходит в completed.

**Задачи:**
- [x] Обновить `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — передать `task` и `allTasks` в TaskChat для определения следующей задачи и рендера completion card при загрузке (сделано в Этапе 4)
- [x] Обновить TaskSidebar — revalidation после завершения задачи (router.refresh в handleComplete)
- [x] Реализовать кнопку «→ Следующая задача» — найти первую pending задачу по orderIndex, router.push (сделано в Этапе 4)
- [x] Обновить `components/projects/phase-states/completed-state.tsx` — базовая реализация (когда все задачи done)
- [x] Проверить edge cases: последняя задача → project completed, задача без needsReview → сразу done, все зависимые разблокированы

**Файлы:**
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — модификация
- `components/projects/task-sidebar.tsx` — модификация (minor)
- `components/projects/task-chat.tsx` — модификация (навигация)
- `components/projects/phase-states/completed-state.tsx` — модификация

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: TaskSidebar обновляется при завершении задачи (иконка меняется)
- [x] Браузер: «Следующая задача» переходит к правильной задаче
- [x] Браузер: зависимые задачи разблокируются (locked → pending)
- [x] Браузер: при завершении всех задач — project phase = completed (проверено через accept API)
- [x] 🧪 Мануальный тест: полный цикл подтверждён (complete → issues card → accept → unlock)

**Git (после валидации):**
```bash
git add "app/(task)/projects/" components/projects/
git commit -m "feat(tz-c2): sidebar update, navigation, project completion"
```

**Критерий готовности:** Полный цикл работает: задача 1 → завершить → sidebar обновился → следующая задача → ... → все задачи done → проект completed.

---

### Этап 6: Финализация

**Статус:** ✅ Завершён

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения всех предыдущих этапов

**Цель:** Завершить ТЗ, обновить документацию, архивировать.

**Задачи:**
- [x] Перенести CHANGELOG.md → главный CHANGELOG.md (сделано в сессии 5)
- [x] Обновить SIMPLY_STATUS.md (сделано в сессии 5)
- [x] Обновить CLAUDE.md (новые файлы, структура) (сделано в сессии 5)
- [x] SQL-проверка БД: outputSummary=1496 chars, professorVerdict=true, статусы done/pending/locked — корректно
- [x] Обновить package.json (версия 3.17.0)
- [x] Переместить папку `specs/TZ_C2_TaskCompletion/` → `_archive/TZ_C2_TaskCompletion/`

**Валидация финальная:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен (simply@3.17.0)
- [x] Документация актуальна
- [x] Версия обновлена везде (package.json, STATUS, CHANGELOG, CLAUDE.md)

**Критерий готовности:** Документация актуальна, папка в архиве, версия 3.17.0.

---

## Правила валидации

### После каждой задачи
```bash
npx tsc --noEmit  # Должен быть 0 ошибок
```

### После каждого этапа
```bash
npm run build     # Должен пройти
npm run dev       # Проверить в браузере
```

### Мануальные тесты
Запрашивать у пользователя после:
- Завершения этапа
- Значительных изменений UI
- Изменений API

---

## Чек-лист перехода между этапами

Прежде чем начать следующий этап:
- [ ] Все задачи текущего этапа отмечены [x]
- [ ] Валидация этапа пройдена (все пункты)
- [ ] **Git commit сделан** (фиксация этапа)
- [ ] Пользователь подтвердил мануальный тест
- [ ] CHANGELOG.md обновлён
- [ ] HANDOFF.md обновлён
