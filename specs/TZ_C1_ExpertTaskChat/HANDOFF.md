# Передача сессии ТЗ-C1: ExpertTaskChat

**Последнее обновление:** 2026-02-10
**Сессия:** 2 (Разработка — Этап 1 завершён)
**Фаза:** Разработка (Этап 1 ✅ → Этап 2 следующий)

---

## Статус этапов

- [x] Этап 1: Инфраструктура (Route Group + Shared Tools + Prompt Builder + DB Queries)
- [ ] Этап 2: API Route + TaskSidebar + Page
- [ ] Этап 3: TaskChat + Полноценный чат
- [ ] Этап 4: Навигация из страницы проекта + Phase Transitions
- [ ] Этап 5: Финализация

**Git:** `feat(tz-c1): infrastructure — route group, shared tools, prompt builder, DB queries` (коммит 6140746)

---

## Следующая сессия: начни с

1. Прочитай этот файл (HANDOFF.md)
2. Прочитай ROADMAP.md → **Этап 2** (детальные задачи)
3. **Первая задача:** Создать API route `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

**Порядок Этапа 2:**
1. API Route — POST endpoint для чата задачи (streaming + tools + expert prompt)
2. TaskSidebar — client component со списком задач и навигацией
3. Page.tsx — заменить заглушку на полную реализацию (auth + guards + startTask + phase transition)
4. Валидация: `npx tsc --noEmit` + `npm run build` + мануальный тест

---

## Что сделано в сессии 2

**Этап 1 — полностью завершён:**

Новые файлы (5):
- `app/(task)/layout.tsx` — Layout без Sidebar (SWRProvider + DataStreamProvider + Pyodide)
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — Заглушка с auth check + data loading
- `lib/ai/tools/chat-tools.ts` — Shared tools factory: `getStandardTools()` + `getActiveToolNames()`
- `lib/prompts/experts/task-expert.md` — Ядро промпта Эксперта (без auto_summary/createTaskSnapshot)
- `lib/prompts/build-task-expert-prompt.ts` — Builder: passport + manifest + task + summaries → string

Изменённые файлы (2):
- `app/(chat)/api/chat/route.ts` — 9 tool-импортов заменены на 1 shared import (строка 29, строки 418-421)
- `lib/db/queries.ts` — 3 новые функции в конце файла (~строки 2310-2410)

**Валидация:**
- `tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- Мануальный тест — чат работает, Markdown + Excel документы создаются ✅
- Transient DB error от Neon (не связан с рефакторингом, не воспроизводится) ℹ️

---

## Что сделано в сессии 1

- Создана структура `specs/TZ_C1_ExpertTaskChat/` (8 файлов)
- Изучены 3 документа ТЗ: SPEC, EXPERT_PROMPT, MVP_ROLES_AND_CONTRACTS
- Изучена кодовая база: chat route, chat.tsx, schema.ts, queries.ts, project-pulse.tsx, approved-state.tsx
- ANALYSIS.md: 7 вопросов → все ответы получены
- ROADMAP.md: 5 этапов детально спланированы

---

## Ключевые решения

1. **Route group:** `app/(task)/` — отдельная от `(chat)`, свой layout без AppSidebar
2. **Эксперт первым:** Auto-trigger `sendMessage()` при `initialMessages.length === 0` (только первый визит)
3. **createTaskSnapshot:** Пропускаем полностью (C1.5)
4. **Tools:** Извлечены в `lib/ai/tools/chat-tools.ts` — фабрика `getStandardTools({ session, dataStream, isProjectChat })`
5. **Модель:** Env variable `EXPERT_MODEL` с fallback на `gemini-3-pro`
6. **Input:** InputContext система (mode="send"), без multimodal-input, без ModelSelector
7. **Locked tasks:** AlertDialog, разблокировка по подтверждению (locked → pending → navigate)

---

## Критичные детали для Этапа 2

**Shared tools (уже готовы):**
- `getStandardTools({ session, dataStream, isProjectChat })` — возвращает объект tools для `streamText()`
- `getActiveToolNames(isProjectChat)` — возвращает `ToolName[]` для `experimental_activeTools`
- Для TaskChat: `isProjectChat = true` (readDocument исключается, project docs в context)

**Expert prompt builder (уже готов):**
- `buildTaskExpertPrompt({ project, task, completedTasks, manifest })` из `lib/prompts/build-task-expert-prompt.ts`
- Возвращает `string` (system prompt)
- `completedTasks` = `getCompletedTaskSummaries({ projectId })` из queries.ts

**DB queries (уже готовы):**
- `getProjectTaskById({ taskId, projectId })` — загрузка задачи с проверкой принадлежности
- `getCompletedTaskSummaries({ projectId })` — done задачи с outputSummary
- `startTask({ taskId, userId, projectId, taskTitle })` — создаёт Chat, линкует к task, status → in_progress, возвращает chatId

**Паттерн API route (из chat/route.ts, ~775 строк):**
- `createUIMessageStream()` + `JsonToSseTransformStream()` → SSE
- User message сохраняется ДО streaming (`saveMessages`)
- Assistant messages сохраняются ПОСЛЕ streaming (в `onFinish`)
- Tool results фильтруются при сохранении (кроме createDocument/updateDocument)
- `createStreamId()` создаётся перед streaming

**Chat.tsx (reference для TaskChat, ~503 строк):**
- `useChat` с `DefaultChatTransport` + кастомным `prepareSendMessagesRequest`
- Отправляет ТОЛЬКО последнее сообщение (`request.messages.at(-1)`)
- Для TaskChat: НЕ нужна retry логика (`retryableFetch`)

**Page.tsx (reference: `app/(dashboard)/projects/[id]/page.tsx`):**
- Server Component, `auth()`, `getProjectById`, ownership guard
- `Promise.all` для параллельных DB запросов
- Phase transition: `updateProjectPhase()` при первом визите

---

## Файлы в работе (Этап 2)

| Файл | Статус | Примечание |
|------|--------|------------|
| `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` | Новый | POST endpoint |
| `components/projects/task-sidebar.tsx` | Новый | Client component |
| `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` | Обновить | Заменить заглушку на полную версию |

---

## Документы для чтения в начале сессии

| Приоритет | Документ | Зачем |
|-----------|----------|-------|
| 1 | Этот HANDOFF.md | Контекст передачи |
| 2 | ROADMAP.md → Этап 2 | Задачи, файлы, валидация |
| 3 | `app/(chat)/api/chat/route.ts` (строки 136-663) | Паттерн для API route |
| 4 | `components/projects/project-pulse.tsx` | Иконки статусов для TaskSidebar |

**НЕ читать:** _archive/, MVP_ROLES_AND_CONTRACTS.md, TZ_C1_ExpertTaskChat.md, EXPERT_PROMPT.md (уже в task-expert.md)

---

## Блокеры / Вопросы

Нет блокеров. Все вопросы разрешены. Можно приступать к Этапу 2.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```
