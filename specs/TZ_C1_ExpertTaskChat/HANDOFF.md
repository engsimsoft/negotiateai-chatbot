# Передача сессии ТЗ-C1: ExpertTaskChat

**Последнее обновление:** 2026-02-10
**Сессия:** 4 (Разработка — Этап 3 завершён)
**Фаза:** Разработка (Этап 3 ✅ → Этап 4 следующий)

---

## Статус этапов

- [x] Этап 1: Инфраструктура (Route Group + Shared Tools + Prompt Builder + DB Queries)
- [x] Этап 2: API Route + TaskSidebar + Page
- [x] Этап 3: TaskChat + Полноценный чат
- [ ] Этап 4: Навигация из страницы проекта + Phase Transitions
- [ ] Этап 5: Финализация

**Git:**
- `6140746` feat(tz-c1): infrastructure — route group, shared tools, prompt builder, DB queries
- `7b87468` feat(tz-c1): API route + TaskSidebar + task page
- `63d5216` feat(tz-c1): TaskChat — full chat with expert, auto-trigger, artifacts

---

## Следующая сессия: начни с

1. Прочитай этот файл (HANDOFF.md)
2. Прочитай ROADMAP.md → **Этап 4** (детальные задачи)
3. **Первая задача:** Обновить `components/projects/project-pulse.tsx` — добавить onClick на карточки задач

**Порядок Этапа 4:**
1. Клик по задаче в ProjectPulse → `router.push(/projects/${projectId}/tasks/${taskId})`
2. Locked задачи → AlertDialog с предупреждением + разблокировка
3. Кнопка «Начать первую задачу» в approved-state.tsx → navigate
4. API/query для разблокировки (`unlockTask`)
5. Валидация: `npx tsc --noEmit` + `npm run build` + мануальный тест

---

## Что сделано в сессиях 3–4

**Этап 2 — завершён:**
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — POST endpoint (streaming + tools + expert prompt)
- `components/projects/task-sidebar.tsx` — Sidebar со списком задач, сворачивание, tooltips, навигация
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — Полная реализация: auth, guards, startTask, phase transition

**Этап 3 — завершён:**
- `components/projects/task-chat.tsx` — Полноценный чат: useChat, Messages, Artifact, MultimodalInput, auto-trigger, read-only
- `app/(task)/layout.tsx` — Добавлен SidebarProvider (для Artifact useSidebar context)
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — Интеграция TaskChat вместо placeholder

**Валидация:**
- `tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- Мануальный тест — Эксперт стримит, диалог работает, артефакты создаются ✅

---

## Ключевые решения

1. **Route group:** `app/(task)/` — отдельная от `(chat)`, layout без AppSidebar но с SidebarProvider
2. **Эксперт первым:** Auto-trigger `sendMessage()` при `initialMessages.length === 0` — `[SYSTEM: Задача открыта. Начни работу.]`
3. **createTaskSnapshot:** Пропускаем (C1.5)
4. **Tools:** `lib/ai/tools/chat-tools.ts` — `getStandardTools({ session, dataStream, isProjectChat: true })`
5. **Модель:** `process.env.EXPERT_MODEL || 'gemini-3-pro'`
6. **Transport:** `DefaultChatTransport` с custom API path `/api/projects/${projectId}/tasks/${taskId}/chat`
7. **Artifact:** Работает через SidebarProvider в layout + SWR-based useArtifact hook

---

## Критичные детали для Этапа 4

**Файлы для обновления:**
- `components/projects/project-pulse.tsx` — добавить onClick на карточки ProjectTask
- `components/projects/phase-states/approved-state.tsx` — кнопка «Начать первую задачу» → navigate
- `lib/db/queries.ts` — добавить `unlockTask({ taskId })`

**ProjectPulse (строки 260-282):** Карточки ProjectTask — сейчас `<div>`, нужен onClick:
- pending/in_progress/done/review/issues → `router.push(/projects/${projectId}/tasks/${taskId})`
- locked → AlertDialog: «Рекомендуем сначала завершить задачу N. Начать всё равно?»
- При подтверждении locked: unlock (status: locked → pending) + navigate

**approved-state.tsx:** Кнопка «Начать первую задачу» — найти первую pending задачу → navigate

**Важно:** ProjectPulse — "use client". Можно использовать `useRouter` + `useState` для AlertDialog.

---

## Файлы в работе (Этап 4)

| Файл | Статус | Примечание |
|------|--------|------------|
| `components/projects/project-pulse.tsx` | Обновить | onClick на карточки задач |
| `components/projects/phase-states/approved-state.tsx` | Обновить | Кнопка + клик по карточкам |
| `lib/db/queries.ts` | Добавить | `unlockTask()` |

---

## Блокеры / Вопросы

Нет блокеров. Можно приступать к Этапу 4.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```
