# ТЗ-C2: Завершение задачи + суммаризация + проверка

**Версия:** 1.0  
**Дата:** 2026-02-10  
**Зависит от:** ТЗ-C1 (ExpertTaskChat) ✅  
**Цель:** Замкнуть цикл выполнения задач. После C2 оркестрация проекта работает от создания до завершения.

---

## Что делаем

Три вещи в одном ТЗ:

1. **Кнопка «Завершить задачу»** — пользователь завершает работу над задачей
2. **Клерк-суммаризатор** — автоматическое резюме для передачи в контекст следующих задач
3. **Проверка Профессором** — опциональная проверка качества (если включена)

Плюс обвязка: разблокировка следующей задачи, обновление статусов, навигация.

---

## Часть 1: Кнопка завершения

### Где

**В header чата задачи** — справа. Всегда видна пока задача `in_progress`. Кнопка с иконкой CheckCircle и текстом «Завершить задачу».

### User flow

```
Пользователь нажимает «Завершить задачу»
  → AlertDialog: «Завершить задачу "[название]"?
     Результаты будут сохранены [и проверены Профессором].»
     [Отмена] [Завершить]
  → Кнопка меняется на spinner «Обработка...»
  → Backend:
     1. Вызов Клерка-суммаризатора → outputSummary
     2. [Если needsReview && professorEnabled] → Профессор → verdict
     3. Обновление статуса задачи
     4. Разблокировка зависимых задач
  → В чате появляется completion card (результат)
  → Кнопка в header скрывается (задача завершена)
```

### API endpoint

```
POST /api/projects/[id]/tasks/[taskId]/complete

Auth: session + project ownership guard
Guard: task.status === 'in_progress'

Шаги:
1. Загрузить сообщения чата задачи (последние 40 сообщений, или от последнего snapshot)
2. Загрузить артефакты задачи (ProjectFile где taskId = this, source = 'generated')
3. Вызвать Клерка-суммаризатора → получить outputSummary JSON
4. Сохранить outputSummary в ProjectTask
5. Если task.needsReview && project.professorEnabled:
   a. Установить status = 'review'
   b. Вызвать Профессора (проверка) → получить verdict JSON
   c. Сохранить verdict в ProjectTask.professorVerdict
   d. Если verdict === 'approved' → status = 'done'
   e. Если verdict === 'issues' или 'critical' → status = 'issues'
6. Иначе: status = 'done'
7. Разблокировать зависимые задачи (все задачи где dependsOn содержит этот orderIndex и все зависимости выполнены)
8. Если все задачи done → project.phase = 'completed'

Response: {
  status: 'done' | 'issues',
  outputSummary: { summary, keyDecisions, createdArtifacts, openQuestions },
  professorVerdict?: { verdict, shortSummary, fullAnalysis, issues },
  unlockedTasks: [{ id, title, orderIndex }],
  projectCompleted: boolean
}
```

### Completion card в чате

После завершения — вставить в чат **системное сообщение** с результатом (не от Эксперта, а от системы). Визуально — карточка:

**Если без проверки (или approved):**
```
┌──────────────────────────────────────┐
│ ✅ Задача завершена                   │
│                                      │
│ Результаты сохранены и будут         │
│ использованы в следующих задачах.    │
│                                      │
│ [→ Следующая задача]  [← К проекту]  │
└──────────────────────────────────────┘
```

**Если issues:**
```
┌──────────────────────────────────────┐
│ ⚠️ Замечания Профессора              │
│                                      │
│ «[shortSummary из вердикта]»         │
│                                      │
│ [Подробнее]  [Доработать]  [Принять] │
└──────────────────────────────────────┘
```

**«Подробнее»** — раскрывает fullAnalysis (Markdown). **«Доработать»** — status возвращается в `in_progress`, чат продолжается. **«Принять»** — пользователь принимает несмотря на замечания, status → `done`.

**Если critical:**
```
┌──────────────────────────────────────┐
│ ❌ Критические замечания              │
│                                      │
│ «[shortSummary из вердикта]»         │
│                                      │
│ [Подробнее]  [Доработать]            │
└──────────────────────────────────────┘
```

При critical нет кнопки «Принять» — нужно доработать.

### Навигация «Следующая задача»

Кнопка «→ Следующая задача» определяет следующую задачу:
- Первая задача со status = `pending` по orderIndex
- Если таких нет — показать «Все задачи выполнены» или «← К проекту»
- `router.push(`/projects/${projectId}/tasks/${nextTaskId}`)`

---

## Часть 2: Клерк-суммаризатор

### Endpoint

```
Не отдельный публичный endpoint — вызывается внутри POST .../complete.
Но логика выделена в отдельную функцию для переиспользования.
```

### Функция

```typescript
// lib/ai/clerks/task-summarizer.ts

async function summarizeTask({
  taskTitle: string,
  taskGoal: string,
  chatMessages: Message[],       // последние N или от snapshot
  artifacts: ProjectFile[],
}): Promise<TaskSummary>

interface TaskSummary {
  summary: string;               // 3-5 предложений
  keyDecisions: string[];        // принятые решения
  createdArtifacts: { name: string; description: string }[];
  openQuestions: string[];       // нерешённые вопросы
}
```

### Модель

`process.env.SUMMARIZER_MODEL || 'gemini-2.5-flash'` — клерк, дешёвая модель. Паттерн как PROFESSOR_MODEL и EXPERT_MODEL.

### Промпт

Файл: `lib/prompts/clerks/task-summarizer.md`

Placeholder на основе контракта из MVP_ROLES_AND_CONTRACTS.md §2.6. Когда PE подготовит финальный — подменяем файл, логика не меняется.

### Что передавать из чата

```
Если Chat.snapshots не пустой:
  → последний snapshot.fullMarkdown + сообщения ПОСЛЕ snapshot
Если Chat.snapshots пустой:
  → последние 40 сообщений

Фильтр: только role='user' и role='assistant' (без system)
Формат для клерка: [{role, content}] — plain text, без tool_calls
```

> Snapshot сейчас не реализован (C1.5), поэтому на практике всегда берём последние 40 сообщений. Но код должен проверять Chat.snapshots — когда C1.5 будет готов, заработает автоматически.

### Сохранение

`ProjectTask.outputSummary` — **текстовое поле** (уже есть в схеме). Сохраняем `JSON.stringify(TaskSummary)`. При чтении — `JSON.parse()`.

> Поле уже `text` в БД. Можно хранить JSON-строку. Альтернатива — менять на jsonb, но это лишняя миграция. JSON.stringify достаточно.

---

## Часть 3: Проверка Профессором

### Когда вызывается

```
task.needsReview === true AND project.professorEnabled === true
```

Оба условия должны выполняться. `needsReview` устанавливает Профессор при планировании (поле в planJson). `professorEnabled` — toggle в настройках проекта (по умолчанию true).

### Функция

```typescript
// lib/ai/professors/task-reviewer.ts

async function reviewTask({
  passport: { name: string, description: string, context: string },
  taskDescription: { title: string, goal: string, expectedOutput: string },
  outputSummary: string,        // результат суммаризатора
  artifacts: { name: string, type: string, contentPreview: string }[],
}): Promise<ProfessorVerdict>

interface ProfessorVerdict {
  verdict: 'approved' | 'issues' | 'critical';
  shortSummary: string;        // 2-3 предложения для UI
  fullAnalysis: string;        // Markdown для «Подробнее»
  issues: {
    severity: 'minor' | 'major' | 'critical';
    description: string;
    suggestion: string;
  }[];
}
```

### Модель

`process.env.PROFESSOR_MODEL || 'gemini-3-pro'` — уже существующий env variable. Та же модель что и для планирования.

### Промпт

Файл: `lib/prompts/professors/task-review.md`

Placeholder на основе контракта из MVP_ROLES_AND_CONTRACTS.md §2.3.

### Сохранение

`ProjectTask.professorVerdict` — **jsonb** (уже есть в схеме). Сохраняем объект ProfessorVerdict напрямую.

### Zod-валидация

Zod-схемы для обоих ответов (суммаризатор и профессор). Паттерн из B1 (professor-types.ts): строгие типы + lenient parsing + fallback.

```typescript
// lib/ai/task-completion-types.ts

const taskSummarySchema = z.object({
  summary: z.string(),
  keyDecisions: z.array(z.string()).default([]),
  createdArtifacts: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).default([]),
  openQuestions: z.array(z.string()).default([]),
});

const professorVerdictSchema = z.object({
  verdict: z.enum(['approved', 'issues', 'critical']),
  shortSummary: z.string(),
  fullAnalysis: z.string().default(''),
  issues: z.array(z.object({
    severity: z.enum(['minor', 'major', 'critical']),
    description: z.string(),
    suggestion: z.string(),
  })).default([]),
});
```

---

## Часть 4: Обвязка (статусы, разблокировка, навигация)

### Разблокировка зависимых задач

При status → `done`:

```typescript
// lib/db/queries.ts

async function completeTask({ taskId, projectId, outputSummary, verdict? }) {
  // 1. Обновить текущую задачу
  await db.update(projectTask)
    .set({ 
      status: verdict ? (verdict.verdict === 'approved' ? 'done' : 'issues') : 'done',
      outputSummary: JSON.stringify(outputSummary),
      professorVerdict: verdict || null,
      updatedAt: new Date()
    })
    .where(eq(projectTask.id, taskId));

  // 2. Найти зависимые задачи
  const allTasks = await getProjectTasksByProjectId(projectId);
  const completedTask = allTasks.find(t => t.id === taskId);
  const dependentTasks = allTasks.filter(t => 
    t.status === 'locked' && 
    t.dependsOn?.includes(completedTask.orderIndex)
  );

  // 3. Для каждой зависимой: проверить все ли зависимости выполнены
  const doneTasks = allTasks.filter(t => t.status === 'done');
  const doneIndexes = new Set(doneTasks.map(t => t.orderIndex));
  
  const unlocked = [];
  for (const dep of dependentTasks) {
    const allDepsMet = dep.dependsOn.every(idx => doneIndexes.has(idx));
    if (allDepsMet) {
      await db.update(projectTask)
        .set({ status: 'pending', updatedAt: new Date() })
        .where(eq(projectTask.id, dep.id));
      unlocked.push(dep);
    }
  }

  // 4. Проверить завершение проекта
  const updatedTasks = await getProjectTasksByProjectId(projectId);
  const allDone = updatedTasks.every(t => t.status === 'done');
  if (allDone) {
    await updateProjectPhase(projectId, 'completed');
  }

  return { unlocked, projectCompleted: allDone };
}
```

### Доработка (после issues)

```
POST /api/projects/[id]/tasks/[taskId]/reopen

Guard: task.status === 'issues'
Action: status → 'in_progress'
Result: пользователь возвращается в чат, продолжает работу
```

### Принятие с замечаниями

```
POST /api/projects/[id]/tasks/[taskId]/accept

Guard: task.status === 'issues'
Action: status → 'done' + разблокировка зависимых
```

### Обновление TaskSidebar

TaskSidebar уже отображает статусы. После завершения задачи нужен **revalidation** — либо `router.refresh()`, либо SWR mutate. Рекомендация: после POST .../complete — клиент вызывает `router.refresh()` для обновления серверных данных + локально обновляет UI через state.

### Обновление Менеджера

Менеджер уже получает `<task_statuses>` в контексте (реализовано в B2). После завершения задачи — его контекст автоматически обновится при следующем сообщении (данные из БД). Ничего делать не нужно.

### Phase → completed

Когда все задачи `done` → `project.phase = 'completed'`. CompletedState (компонент уже существует как placeholder в `phase-states/`) показывает итог проекта.

---

## Файловая структура (новое)

```
lib/ai/
├── clerks/
│   └── task-summarizer.ts          # функция summarizeTask()
├── professors/
│   └── task-reviewer.ts            # функция reviewTask()
└── task-completion-types.ts        # Zod-схемы + TypeScript типы

lib/prompts/
├── clerks/
│   └── task-summarizer.md          # промпт клерка (NEW)
└── professors/
    ├── planning.md                 # существующий
    └── task-review.md              # промпт проверки (NEW)

app/(chat)/api/projects/[id]/tasks/[taskId]/
├── chat/route.ts                   # существующий (C1)
├── unlock/route.ts                 # существующий (C1)
├── complete/route.ts               # NEW — завершение задачи
├── reopen/route.ts                 # NEW — доработка после issues
└── accept/route.ts                 # NEW — принять с замечаниями

components/projects/
├── task-chat.tsx                    # существующий → добавить кнопку завершения в header
├── task-completion-card.tsx         # NEW — карточка результата в чате
└── task-sidebar.tsx                 # существующий → обновление статусов

lib/db/queries.ts                   # completeTask(), reopenTask(), acceptTask()
```

---

## DB изменения

**Нет новых таблиц. Нет миграций.** Все нужные поля уже есть:
- `ProjectTask.outputSummary` (text) — для JSON-строки суммаризатора
- `ProjectTask.professorVerdict` (jsonb) — для вердикта
- `ProjectTask.status` (pgEnum) — все нужные статусы уже определены
- `Project.phase` — 'completed' уже в enum

---

## Гибкость и точки изменений

| Что может измениться | Где менять | Сложность |
|---|---|---|
| Текст/тон промпта суммаризатора | `task-summarizer.md` | Замена файла |
| Текст/тон промпта проверки | `task-review.md` | Замена файла |
| Модель суммаризатора | env `SUMMARIZER_MODEL` | Одна строка |
| Модель профессора | env `PROFESSOR_MODEL` | Уже есть |
| Количество сообщений для суммаризации | Константа в `task-summarizer.ts` | Одна строка |
| Дизайн completion card | `task-completion-card.tsx` | Один компонент |
| Логика разблокировки | `completeTask()` в queries.ts | Одна функция |
| Добавить асинхронную проверку | Вынести Профессора из complete в отдельный job | Рефакторинг одного endpoint |

---

## Порядок реализации (для Claude Code)

Рекомендуемая последовательность:

1. **Типы и схемы** — `task-completion-types.ts` (Zod + TypeScript)
2. **Промпты** — `task-summarizer.md` + `task-review.md` (placeholder)
3. **Клерк-суммаризатор** — `task-summarizer.ts` (функция + вызов AI)
4. **Профессор-ревьюер** — `task-reviewer.ts` (функция + вызов AI)
5. **DB queries** — `completeTask()`, `reopenTask()`, `acceptTask()`
6. **API endpoints** — `complete/route.ts`, `reopen/route.ts`, `accept/route.ts`
7. **UI: кнопка завершения** — в header task-chat.tsx
8. **UI: completion card** — `task-completion-card.tsx`
9. **UI: интеграция** — вставка карточки в чат, обновление TaskSidebar
10. **Тест: полный цикл** — создать задачу → поработать → завершить → проверить → следующая

---

## Ограничения MVP

- Проверка Профессором **синхронная** — пользователь ждёт (30-60 сек). Spinner + текст «Профессор проверяет...».
- Snapshot (C1.5) ещё нет — суммаризатор берёт последние 40 сообщений.
- `outputSummary` хранится как JSON-строка в text-поле (не jsonb). Работает, но при рефакторинге можно мигрировать.
- CompletedState (все задачи выполнены) — базовая реализация. Полная версия с итогом проекта — отдельное ТЗ.
- Completion card не персистится как отдельное сообщение в БД — рендерится по status задачи при загрузке чата.
