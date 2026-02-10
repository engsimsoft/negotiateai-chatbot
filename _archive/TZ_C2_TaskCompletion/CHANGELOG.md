# Changelog ТЗ-C2: TaskCompletion

> История изменений в рамках этого ТЗ.
> После завершения — переносится в главный CHANGELOG.md

---

## Сессия 5 — 2026-02-10

### Added
- `components/projects/phase-states/completed-state.tsx` — полноценная реализация вместо заглушки: список завершённых задач с ссылками, счётчик, кликабельные карточки
- `lib/ai/tools/read-project-file.ts` — **новый tool** `readProjectFile` для Эксперта: чтение файлов проекта по имени из manifest, текст + fallback по расширению, бинарные → описание из metadata, лимит 30K символов
- `lib/db/queries.ts` — `getProjectFileByName({ projectId, name })` — новый query для поиска файла по имени

### Changed
- `components/projects/task-chat.tsx` — добавлен `useRouter` + `router.refresh()` после `handleComplete` для обновления TaskSidebar
- `components/projects/project-work-area.tsx` — передача `projectId` и `projectTasks` в CompletedState
- `lib/ai/tools/chat-tools.ts` — добавлен `projectId?` в params, `readProjectFile` включается при `isProjectChat && projectId`, добавлен в `getActiveToolNames`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — передача `projectId` в `getStandardTools`
- `app/(chat)/api/chat/route.ts` — передача `projectId` в `getStandardTools` для project chats

### Fixed
- `readProjectFile` — файлы с MIME `application/octet-stream` (например `.md`) теперь определяются как текстовые по расширению

### Files
```
components/projects/phase-states/completed-state.tsx (переписан)
components/projects/task-chat.tsx (модификация — router.refresh)
components/projects/project-work-area.tsx (модификация — props для CompletedState)
lib/ai/tools/read-project-file.ts (новый)
lib/ai/tools/chat-tools.ts (модификация — readProjectFile + projectId)
lib/db/queries.ts (модификация — getProjectFileByName)
app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts (модификация — projectId)
app/(chat)/api/chat/route.ts (модификация — projectId)
```

### Commits
- `742cc07` feat(tz-c2): sidebar revalidation + completed-state UI
- `6f77226` feat: add readProjectFile tool for Expert to read project files
- `dade724` fix: readProjectFile detects text files by extension fallback

---

## Сессия 4 — 2026-02-10

### Added
- `components/projects/task-completion-card.tsx` — три варианта карточки (success/issues/critical), раскрываемые детали с max-height прокруткой, кнопки Доработать/Принять/Следующая/К проекту

### Changed
- `components/projects/task-chat.tsx` — кнопка «Завершить задачу» в header, AlertDialog подтверждения, spinner «Обработка...», вызов POST .../complete, отображение completion card, локальный state management (currentStatus, completionData), callbacks для reopen/accept
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — передача allTasks в TaskChat, isReadonly для done+issues

### Fixed
- Баг: развёрнутая секция "Подробнее" занимала весь экран без возможности свернуть → добавлен max-h-[40vh] + кнопка "Свернуть"

### Files
```
components/projects/task-completion-card.tsx (новый)
components/projects/task-chat.tsx (модификация — полная переработка +170 строк)
app/(task)/projects/[id]/tasks/[taskId]/page.tsx (модификация — +2 строки)
```

### Commits
- `d94974c` feat(tz-c2): complete button + completion card UI

---

## Сессия 3 — 2026-02-10

### Added
- `lib/db/queries.ts` — 3 новые функции: `completeTask()`, `reopenTask()`, `acceptTask()` + внутренний хелпер `unlockDependentsAndCheckCompletion()`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts` — POST endpoint: summarize → review → complete
- `app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts` — POST endpoint: issues → in_progress
- `app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts` — POST endpoint: issues → done + unlock

### Files
```
lib/db/queries.ts (модификация — +190 строк)
app/(chat)/api/projects/[id]/tasks/[taskId]/complete/route.ts (новый)
app/(chat)/api/projects/[id]/tasks/[taskId]/reopen/route.ts (новый)
app/(chat)/api/projects/[id]/tasks/[taskId]/accept/route.ts (новый)
```

### Commits
- `0e13078` feat(tz-c2): complete/reopen/accept API endpoints + DB queries

---

## Сессия 2 — 2026-02-10

### Added
- `lib/ai/task-completion-types.ts` — Zod-схемы (taskSummarySchema, professorVerdictSchema) + TypeScript типы + хелперы
- `lib/prompts/clerks/task-summarizer.md` — system prompt клерка-суммаризатора
- `lib/prompts/professors/task-review.md` — system prompt профессора-ревьюера
- `lib/ai/clerks/task-summarizer.ts` — функция summarizeTask() (generateText + Zod-парсинг + fallback)
- `lib/ai/professors/task-reviewer.ts` — функция reviewTask() (generateText + XML-парсинг + Zod-валидация + fallback)

### Files
```
lib/ai/task-completion-types.ts (новый)
lib/ai/clerks/task-summarizer.ts (новый)
lib/ai/professors/task-reviewer.ts (новый)
lib/prompts/clerks/task-summarizer.md (новый)
lib/prompts/professors/task-review.md (новый)
```

### Commits
- `bfac683` feat(tz-c2): types, schemas, and prompts for task completion
- `615436a` feat(tz-c2): summarizeTask and reviewTask AI functions

---

## Сессия 1 — 2026-02-10

### Added
- Создана папка `specs/TZ_C2_TaskCompletion/` со всеми файлами по шаблону
- SPEC.md — ссылки на ТЗ и промпты PE
- ANALYSIS.md — полный анализ кодовой базы, 6 вопросов, ответы получены
- ROADMAP.md — 6 этапов, оценка 3-4 сессии
- HANDOFF.md — передача для следующей сессии

### Files
```
specs/TZ_C2_TaskCompletion/SPEC.md
specs/TZ_C2_TaskCompletion/ANALYSIS.md
specs/TZ_C2_TaskCompletion/ROADMAP.md
specs/TZ_C2_TaskCompletion/CHANGELOG.md
specs/TZ_C2_TaskCompletion/HANDOFF.md
specs/TZ_C2_TaskCompletion/TZ_C2_TaskCompletion.md (от пользователя)
specs/TZ_C2_TaskCompletion/CLERK_SUMMARIZER.md (от PE)
specs/TZ_C2_TaskCompletion/PROFESSOR_REVIEW.md (от PE)
```
