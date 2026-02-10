# Анализ ТЗ-C2: TaskCompletion

**Дата анализа:** 2026-02-10

---

## Резюме

Замкнуть цикл выполнения задач в проектах. Три компонента: (1) кнопка «Завершить задачу» с UI-flow, (2) Клерк-суммаризатор — AI автоматически создаёт резюме задачи для передачи контекста следующим задачам, (3) Профессор-ревьюер — опциональная проверка качества результата. Плюс обвязка: разблокировка зависимых задач, обновление статусов, навигация «Следующая задача», переход проекта в `completed`.

---

## Результаты анализа кодовой базы

### Что уже есть (готово к использованию)

| Что | Где | Статус |
|-----|-----|--------|
| DB-поля `outputSummary` (text), `professorVerdict` (jsonb) | `lib/db/schema.ts:181-182` | Есть, пустые |
| Статусы `review`, `issues`, `done` в enum | `lib/db/schema.ts:156-163` | Есть в enum |
| `Project.phase = 'completed'` | `lib/db/schema.ts:71` | Есть в varchar |
| `getProjectTasksByProjectId()`, `getProjectTaskById()` | `lib/db/queries.ts` | Есть |
| `getCompletedTaskSummaries()` | `lib/db/queries.ts:2342-2375` | Есть |
| `updateProjectPhase()` | `lib/db/queries.ts:1106-1130` | Есть |
| `startTask()` (паттерн create + update) | `lib/db/queries.ts:2406-2448` | Паттерн |
| `CompletedState` (placeholder) | `components/projects/phase-states/completed-state.tsx` | Заглушка |
| TaskSidebar со всеми иконками статусов | `components/projects/task-sidebar.tsx` | Готов |
| TaskChat с header | `components/projects/task-chat.tsx` | Готов, нужно расширить |
| Clerk промпт-файл pattern | `lib/prompts/clerks/file-analyzer.md` | Паттерн |
| Professor промпт pattern | `lib/prompts/professors/planning.md` | Паттерн |
| Zod schemas pattern | `lib/ai/professor-types.ts` | Паттерн |
| Provider config + env variables | `lib/ai/providers.ts` | Паттерн |

### Что нужно создать

| Что | Путь |
|-----|------|
| Zod-схемы TaskSummary + ProfessorVerdict | `lib/ai/task-completion-types.ts` |
| Промпт клерка-суммаризатора | `lib/prompts/clerks/task-summarizer.md` |
| Промпт профессора-ревьюера | `lib/prompts/professors/task-review.md` |
| Функция `summarizeTask()` | `lib/ai/clerks/task-summarizer.ts` |
| Функция `reviewTask()` | `lib/ai/professors/task-reviewer.ts` |
| DB queries: `completeTask()`, `reopenTask()`, `acceptTask()` | `lib/db/queries.ts` |
| API `POST .../complete` | `app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts` |
| API `POST .../reopen` | `app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts` |
| API `POST .../accept` | `app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts` |
| Кнопка завершения в header TaskChat | `components/projects/task-chat.tsx` (модификация) |
| Completion card компонент | `components/projects/task-completion-card.tsx` |
| Обновление TaskSidebar (revalidation) | `components/projects/task-sidebar.tsx` (модификация) |

---

## Вопросы для уточнения

> Ответь на эти вопросы перед началом разработки

1. **[Модель суммаризатора]:** ТЗ указывает `gemini-2.5-flash` как дефолт для клерка. Промпт PE (CLERK_SUMMARIZER.md) упоминает «Haiku или Flash». Сейчас в проекте все модели — Gemini (Claude временно отключён). Подтверди: используем `gemini-2.5-flash` для суммаризатора?

2. **[Модель профессора-ревьюера]:** ТЗ говорит `process.env.PROFESSOR_MODEL || 'gemini-3-pro'` (та же что для планирования). Промпт PE (PROFESSOR_REVIEW.md) указывает «Claude Opus (prod) / gemini-pro (dev)». Учитывая что Claude временно отключён — используем `gemini-3-pro` для ревью? Или нужно добавить отдельный env `REVIEWER_MODEL`?

3. **[Completion card — персистенция]:** ТЗ говорит «Completion card не персистится как отдельное сообщение в БД — рендерится по status задачи при загрузке чата». Это значит: при `task.status === 'done' || 'issues'` — отрисовать карточку в конце чата на клиенте, без записи в messages. Верно?

4. **[professorEnabled]:** ТЗ упоминает `project.professorEnabled` — toggle в настройках проекта. В текущей схеме БД такого поля **нет** (`Project` не содержит `professorEnabled`). Варианты:
   - **A)** Добавить поле в Project (нужна миграция)
   - **B)** Считать что professor всегда enabled (проверяем только `task.needsReview`)
   - **C)** Отложить toggle на отдельное ТЗ, сейчас hardcode `true`

   Какой вариант?

5. **[Chat.snapshots]:** ТЗ упоминает проверку `Chat.snapshots` для суммаризатора. Такого поля нет в схеме (C1.5 не реализован). Код должен проверять его для forward-compatibility, но реально всегда fallback на «последние 40 сообщений». Просто подтверди подход: пишем проверку snapshots с fallback?

6. **[Навигация после завершения]:** Кнопка «→ Следующая задача» делает `router.push()`. Но мы в route group `(task)` — URL вида `/projects/[id]/tasks/[taskId]`. Переход на другую задачу — это обычный `router.push()` внутри того же layout. Это ОК? Или нужен полный reload для обновления server-данных?

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Синхронная проверка Профессором > 60 сек | Средняя | UX: пользователь ждёт | Spinner «Профессор проверяет...» + timeout 90 сек с fallback |
| Suммаризатор возвращает невалидный JSON | Низкая | Задача не завершится | Zod lenient parsing + fallback summary из title/goal |
| Профессор «придирается» — false positive issues | Средняя | UX: раздражение | Анти-scope-creep инструкция уже в промпте PE |
| `dependsOn` содержит circular dependency | Низкая | Задача никогда не разблокируется | Валидация при approve-plan (уже есть), но проверить |
| Race condition: два tab-а завершают одну задачу | Низкая | Дублирование | Guard `task.status === 'in_progress'` на backend |
| Нет поля `professorEnabled` в Project | Нет | Блокер | Решить в вопросе 4 |

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-C1 (ExpertTaskChat) — завершён
- [ ] Ответы на вопросы выше (особенно #4 — professorEnabled)

**Затронутые компоненты:**

**Новые файлы:**
- `lib/ai/task-completion-types.ts` — Zod-схемы
- `lib/ai/clerks/task-summarizer.ts` — Клерк-суммаризатор
- `lib/ai/professors/task-reviewer.ts` — Профессор-ревьюер
- `lib/prompts/clerks/task-summarizer.md` — Промпт клерка
- `lib/prompts/professors/task-review.md` — Промпт профессора
- `app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts` — API
- `app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts` — API
- `app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts` — API
- `components/projects/task-completion-card.tsx` — UI компонент

**Модификации:**
- `lib/db/queries.ts` — `completeTask()`, `reopenTask()`, `acceptTask()`
- `components/projects/task-chat.tsx` — кнопка завершения в header + completion card
- `components/projects/task-sidebar.tsx` — revalidation после статуса
- `components/projects/phase-states/completed-state.tsx` — базовая реализация
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — передача доп. данных

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:**
- ~10 новых файлов + ~5 модификаций
- 3 API endpoint-а (стандартные CRUD)
- 2 AI-функции (суммаризатор + ревьюер) — но промпты уже готовы от PE
- 1 UI компонент (completion card) + модификация header
- Основная сложность: integration testing полного цикла (complete → unlock → next)
- Оценка: 3-4 сессии

---

## Ответы на вопросы

> Получены 2026-02-10

1. **Модель суммаризатора:** `gemini-2.5-flash`. Через env `SUMMARIZER_MODEL` с этим fallback.
2. **Модель профессора-ревьюера:** `gemini-3-pro`. Тот же `PROFESSOR_MODEL` что и для планирования. Один env.
3. **Completion card:** Рендерим по `task.status` + `task.professorVerdict`. Не персистим как Message.
4. **professorEnabled:** Hardcode `true`. Проверяем только `task.needsReview`. Когда будет UI настроек → добавим поле + toggle. Логика: `if (task.needsReview) → вызвать Профессора`.
5. **Chat.snapshots:** Да, проверка с fallback. Сейчас всегда fallback на 40 сообщений. Когда C1.5 готов — заработает.
6. **Навигация:** `router.push()` между задачами в `(task)` layout. Паттерн из C1.
