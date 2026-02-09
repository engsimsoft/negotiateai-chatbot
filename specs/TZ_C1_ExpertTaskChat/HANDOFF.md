# Передача сессии ТЗ-C1: ExpertTaskChat

**Последнее обновление:** 2026-02-10
**Сессия:** 3 (Разработка — Этап 2 завершён)
**Фаза:** Разработка (Этап 2 ✅ → Этап 3 следующий)

---

## Статус этапов

- [x] Этап 1: Инфраструктура (Route Group + Shared Tools + Prompt Builder + DB Queries)
- [x] Этап 2: API Route + TaskSidebar + Page
- [ ] Этап 3: TaskChat + Полноценный чат
- [ ] Этап 4: Навигация из страницы проекта + Phase Transitions
- [ ] Этап 5: Финализация

**Git Этап 1:** `feat(tz-c1): infrastructure — route group, shared tools, prompt builder, DB queries` (коммит 6140746)
**Git Этап 2:** Ожидает мануальный тест → коммит

---

## Следующая сессия: начни с

1. Прочитай этот файл (HANDOFF.md)
2. Прочитай ROADMAP.md → **Этап 3** (детальные задачи)
3. **Первая задача:** Создать `components/projects/task-chat.tsx`

**Порядок Этапа 3:**
1. TaskChat компонент — `useChat`, DataStreamProvider, Messages, Artifact, Input
2. Auto-trigger — `sendMessage()` при `initialMessages.length === 0`
3. Read-only режим — prop isReadonly, input disabled, badge
4. Интеграция в page.tsx — заменить placeholder на TaskChat
5. Валидация: `npx tsc --noEmit` + `npm run build` + мануальный тест

---

## Что сделано в сессии 3

**Этап 2 — полностью завершён (ожидает мануальный тест):**

Новые файлы (2):
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — POST endpoint для чата задачи (streaming + tools + expert prompt)
- `components/projects/task-sidebar.tsx` — Client component: список задач, сворачивание, навигация, tooltips

Обновлённые файлы (1):
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — Полная реализация: auth, guards, startTask, phase transition, TaskSidebar + TaskChat placeholder

**Валидация:**
- `tsc --noEmit` — 0 ошибок ✅
- `npm run build` — успешен ✅
- Мануальный тест — ожидается

---

## Что сделано в предыдущих сессиях

**Сессия 2 (Этап 1):** Route group `(task)`, shared tools, expert prompt builder, DB queries
**Сессия 1:** Анализ, планирование, ROADMAP

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

## Критичные детали для Этапа 3

**API route (уже готов):**
- POST `api/projects/[id]/tasks/[taskId]/chat` — streaming endpoint
- Body: `{ id: chatId, message, projectId, taskId }`
- Гарды: auth, project ownership, task belongs to project, chat belongs to task

**Page.tsx (уже готов):**
- Server Component с полной загрузкой данных
- `startTask()` при первом визите (создаёт Chat, status → in_progress)
- Phase transition: approved → execution
- Передаёт: `chatId`, `projectId`, `taskId`, `task`, `initialMessages`, `isReadonly` (всё готово для TaskChat props)

**TaskSidebar (уже готов):**
- Collapsed/expanded, tooltips для locked, навигация router.push
- Иконки статусов: Check, Loader2, Brain, AlertTriangle, Circle, Lock

**Reference files для TaskChat (Этап 3):**
- `components/chat/chat.tsx` — паттерн useChat, DataStreamProvider, Messages, Artifact
- `components/input/` — InputContext, InputBase, InputTextarea, InputVoiceButton
- `components/chat/messages.tsx` — Messages компонент (переиспользуем)
- `components/chat/artifact.tsx` — Artifact/Canvas компонент (переиспользуем)

---

## Файлы в работе (Этап 3)

| Файл | Статус | Примечание |
|------|--------|------------|
| `components/projects/task-chat.tsx` | Новый | Client component — useChat + Messages + Artifact + Input |
| `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` | Обновить | Заменить TaskChat placeholder на реальный компонент |

---

## Блокеры / Вопросы

Нет блокеров. Ожидается мануальный тест Этапа 2. Можно приступать к Этапу 3 после подтверждения.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
```
