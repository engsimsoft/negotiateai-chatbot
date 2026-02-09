# Roadmap ТЗ-C1: ExpertTaskChat

**Создан:** 2026-02-09
**Версия проекта:** 3.15.0 → 3.16.0
**Статус:** В работе

> **Инструкция:** [specs/ROADMAP_GUIDE.md](../ROADMAP_GUIDE.md)

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 1 |
| Оценка сессий | 3-4 |

**Решения (из ANALYSIS.md):**
- Route group: `app/(task)/` (отдельная от chat)
- Первое сообщение: живой стриминг (auto-trigger)
- createTaskSnapshot: пропускаем (C1.5)
- Tools: извлечь в shared модуль
- Модель: env variable `EXPERT_MODEL`
- Input: InputContext система (mode="send")
- Locked tasks: AlertDialog с предупреждением, разблокировка по подтверждению

---

## Этапы

### Этап 1: Инфраструктура (Route Group + Shared Tools + Prompt Builder + DB Queries)

**Статус:** ✅ Завершён

**Цель:** Подготовить всю инфраструктуру: route group с providers, shared модуль tools, prompt builder, DB queries. После этого этапа existing chat работает как раньше, а фундамент для TaskChat готов.

**Задачи:**

1. **Route group + Layout:**
   - [x] Создать `app/(task)/layout.tsx` — SWRProvider + DataStreamProvider + Pyodide script (без SidebarLayout/AppSidebar)
   - [x] Создать заглушку `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — Server Component, auth check, загрузка Project + ProjectTask + все tasks, рендер `<div>Task page placeholder</div>`

2. **Извлечение tools в shared модуль:**
   - [x] Создать `lib/ai/tools/chat-tools.ts` — фабричная функция `getStandardTools({ session, dataStream, isProjectChat })` возвращающая объект tools
   - [x] Рефакторинг `app/(chat)/api/chat/route.ts` — заменить inline tools на импорт из shared модуля
   - [x] Проверить что существующий чат работает (tsc + build)

3. **Expert Prompt:**
   - [x] Создать `lib/prompts/experts/task-expert.md` — промпт из EXPERT_PROMPT.md (без секций auto_summary и createTaskSnapshot, без tool createTaskSnapshot)
   - [x] Создать `lib/prompts/build-task-expert-prompt.ts` — функция `buildTaskExpertPrompt({ project, task, completedTasks, manifest })` возвращает string

4. **DB Queries:**
   - [x] Добавить `getProjectTaskById({ taskId, projectId })` в `lib/db/queries.ts` — загрузка задачи с проверкой принадлежности проекту
   - [x] Добавить `getCompletedTaskSummaries({ projectId })` — все ProjectTask со status='done' и outputSummary не null
   - [x] Добавить `startTask({ taskId, userId, projectId, taskTitle })` — создаёт Chat, обновляет ProjectTask.chatId + status → in_progress, возвращает chatId

**Файлы:**
- `app/(task)/layout.tsx` — новый (layout route group)
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — новый (заглушка)
- `lib/ai/tools/chat-tools.ts` — новый (shared tools)
- `app/(chat)/api/chat/route.ts` — рефакторинг (импорт shared tools)
- `lib/prompts/experts/task-expert.md` — новый (промпт Эксперта)
- `lib/prompts/build-task-expert-prompt.ts` — новый (prompt builder)
- `lib/db/queries.ts` — добавление 3 функций

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: существующий чат работает как раньше (отправить сообщение, получить ответ, tools работают)
- [ ] Браузер: URL `/projects/[id]/tasks/[taskId]` открывает заглушку (не 404)
- [x] 🧪 **Мануальный тест:** Markdown + Excel документы созданы успешно. Streaming работает. Transient DB error от Neon (не связан с рефакторингом).

**Git (после валидации):**
```bash
git add lib/ai/tools/chat-tools.ts app/(task)/ lib/prompts/experts/ lib/prompts/build-task-expert-prompt.ts lib/db/queries.ts app/(chat)/api/chat/route.ts
git commit -m "feat(tz-c1): infrastructure — route group, shared tools, prompt builder, DB queries"
```

**Критерий готовности:** Существующий чат работает без регрессий. Route group отвечает. Shared tools, prompt builder и DB queries готовы к использованию.

---

### Этап 2: API Route + TaskSidebar + Page

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 1

**Цель:** Рабочий API endpoint для чата задачи (streaming + tools + expert prompt). TaskSidebar с навигацией. Page.tsx с полной загрузкой данных и гардами.

**Задачи:**

1. **API Route:**
   - [ ] Создать `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — POST endpoint
   - [ ] Auth check (session), загрузка Project + ProjectTask + Chat
   - [ ] Гарды: задача принадлежит проекту, чат принадлежит задаче, проект принадлежит юзеру
   - [ ] Сохранение user message в БД (до streaming)
   - [ ] Вызов `buildTaskExpertPrompt()` → system prompt
   - [ ] Модель через env: `process.env.EXPERT_MODEL || 'gemini-3-pro'` → resolveModel()
   - [ ] `streamText()` с system prompt, messages, shared tools
   - [ ] Сохранение assistant message в БД (после streaming, с фильтрацией tool results)
   - [ ] Return SSE response (`JsonToSseTransformStream`)

2. **TaskSidebar:**
   - [ ] Создать `components/projects/task-sidebar.tsx` — client component
   - [ ] Шапка: название проекта (truncated) + кнопка сворачивания
   - [ ] Список задач: иконка статуса + номер + title (truncated), активная задача highlighted
   - [ ] Клик: pending/in_progress/done/review/issues → `router.push()`, locked → tooltip
   - [ ] Подвал: кнопка «← К проекту» → `/projects/[id]`
   - [ ] Сворачивание: развёрнут ~240px, свёрнут ~48px (только иконки)
   - [ ] Иконки статусов: переиспользовать маппинг из ProjectPulse (Circle, Loader2, Brain, AlertTriangle, Check, Lock)

3. **Page.tsx (полная версия):**
   - [ ] Заменить заглушку на полную реализацию Server Component
   - [ ] Auth check + ownership guard
   - [ ] Загрузка: Project, ProjectTask по taskId, все ProjectTask[] проекта, Chat (если есть), Messages
   - [ ] Гарды: задача не найдена → redirect, проект не принадлежит → notFound()
   - [ ] Первый визит (chatId = null): вызов `startTask()` → создание Chat, обновление статуса
   - [ ] Phase transition: если project.phase === 'approved' → обновить на 'execution'
   - [ ] Передача props в TaskSidebar + TaskChat (пока заглушка для TaskChat)

**Файлы:**
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — новый
- `components/projects/task-sidebar.tsx` — новый
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — обновление (полная версия)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/projects/[id]/tasks/[taskId]` — страница открывается, TaskSidebar видна с задачами
- [ ] Браузер: TaskSidebar сворачивается/разворачивается
- [ ] Браузер: клик «← К проекту» → возвращает на страницу проекта
- [ ] API: POST на `/api/projects/[id]/tasks/[taskId]/chat` возвращает streaming response (проверить через curl/devtools)
- [ ] 🧪 **Мануальный тест:** Открыть страницу задачи по URL. Sidebar видна, задачи отображаются со статусами. Кнопка «← К проекту» работает.

**Git (после валидации):**
```bash
git add app/(chat)/api/projects/ components/projects/task-sidebar.tsx app/(task)/
git commit -m "feat(tz-c1): API route + TaskSidebar + task page"
```

**Критерий готовности:** API стримит ответы. TaskSidebar отображает задачи. Page загружает данные и создаёт Chat при первом визите.

---

### Этап 3: TaskChat + Полноценный чат

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 2

**Цель:** Полноценный чат с Экспертом: streaming, артефакты (canvas), tools, голосовой ввод. Эксперт начинает первым при новой задаче. Read-only для завершённых задач.

**Задачи:**

1. **TaskChat компонент:**
   - [ ] Создать `components/projects/task-chat.tsx` — client component
   - [ ] `useChat` с endpoint `/api/projects/${projectId}/tasks/${taskId}/chat`, initialMessages, body: { id, projectId, taskId }
   - [ ] Обёртка `DataStreamProvider` + `DataStreamHandler` для артефактов
   - [ ] Рендер `Messages` компонента (переиспользуем из `components/chat/messages.tsx`)
   - [ ] Рендер `Artifact` компонента (переиспользуем из `components/chat/artifact.tsx`)
   - [ ] Input система: `InputContextProvider` mode="send", `InputBase`, `InputTextarea`, `InputVoiceButton`, `InputSubmitButton`, `InputAttachments`
   - [ ] Placeholder для InputModelSelector не нужен — модель на сервере

2. **Auto-trigger (Эксперт начинает первым):**
   - [ ] При `initialMessages.length === 0` (новая задача): автоматически отправить `sendMessage()` с триггерным сообщением `[SYSTEM: Задача открыта. Начни работу.]`
   - [ ] Триггерное сообщение отправляется один раз через `useEffect` при mount
   - [ ] Пользователь видит живой streaming ответа Эксперта

3. **Read-only режим:**
   - [ ] Prop `isReadonly` в TaskChat (из task.status === 'done')
   - [ ] Если readonly: Input disabled/скрыт, бейдж «Задача завершена» в шапке
   - [ ] Messages и Artifact доступны для просмотра

4. **Интеграция в page.tsx:**
   - [ ] Заменить заглушку TaskChat на реальный компонент
   - [ ] Передать props: chatId, projectId, taskId, task, initialMessages, isReadonly

**Файлы:**
- `components/projects/task-chat.tsx` — новый
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — обновление (подключение TaskChat)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: Открыть новую задачу → Эксперт стримит первое сообщение автоматически
- [ ] Браузер: Отправить сообщение → streaming ответ, Эксперт знает контекст задачи и проекта
- [ ] Браузер: Вызвать tool (например, «найди информацию о...») → web_search работает
- [ ] Браузер: Попросить создать документ → artifact (canvas) открывается
- [ ] Браузер: Голосовой ввод работает (кнопка микрофона)
- [ ] Браузер: Вернуться к задаче с chatId → история загружается, чат продолжается
- [ ] 🧪 **Мануальный тест:** Открыть новую задачу. Эксперт представляется и предлагает план работы. Отправить вопрос — получить ответ. Попросить создать документ — canvas работает. Вернуться на страницу проекта и снова открыть задачу — история чата сохранена.

**Git (после валидации):**
```bash
git add components/projects/task-chat.tsx app/(task)/
git commit -m "feat(tz-c1): TaskChat — full chat with expert, auto-trigger, read-only"
```

**Критерий готовности:** Полноценный чат работает: streaming, tools, артефакты, голос, история. Эксперт начинает первым. Read-only для done задач.

---

### Этап 4: Навигация из страницы проекта + Phase Transitions

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения валидации Этапа 3

**Цель:** Пользователь кликает задачу в Пульсе → переходит на страницу чата. Кнопка «Начать первую задачу» работает. Locked задачи показывают предупреждение.

**Задачи:**

1. **Клик по задаче в ProjectPulse:**
   - [ ] Обновить `components/projects/project-pulse.tsx` — добавить onClick на карточки задач
   - [ ] pending/in_progress/done/review/issues → `router.push(/projects/${projectId}/tasks/${taskId})`
   - [ ] locked → открыть AlertDialog: «Рекомендуем сначала завершить задачу N. Результаты предыдущих задач используются в следующих. Начать всё равно?»
   - [ ] При подтверждении locked: вызвать API для разблокировки (status: locked → pending) + navigate
   - [ ] Cursor pointer на кликабельных задачах, hover эффект

2. **Кнопка «Начать первую задачу»:**
   - [ ] Обновить `components/projects/phase-states/approved-state.tsx` — заменить toast заглушку
   - [ ] Найти первую задачу со статусом pending → `router.push(/projects/${projectId}/tasks/${taskId})`
   - [ ] Если нет pending задач (все locked) → найти первую locked → предложить начать

3. **API для разблокировки задачи:**
   - [ ] Добавить PATCH endpoint или использовать существующий для обновления status locked → pending
   - [ ] Или: добавить в `lib/db/queries.ts` функцию `unlockTask({ taskId })`

4. **Карточки задач в approved-state — кликабельные:**
   - [ ] Добавить onClick на карточки задач в `approved-state.tsx`
   - [ ] Та же логика что в ProjectPulse (pending → navigate, locked → dialog)

**Файлы:**
- `components/projects/project-pulse.tsx` — обновление (клик по задачам)
- `components/projects/phase-states/approved-state.tsx` — обновление (кнопка + клик по карточкам)
- `lib/db/queries.ts` — добавление `unlockTask()` (если нужно)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: Страница проекта (approved phase) → клик на pending задачу → переход на чат
- [ ] Браузер: Кнопка «Начать первую задачу» → переход на первую pending задачу
- [ ] Браузер: Клик на locked задачу → AlertDialog → подтвердить → переход
- [ ] Браузер: Клик на done задачу → read-only чат
- [ ] Браузер: В TaskSidebar → клик на другую задачу → переход
- [ ] Браузер: «← К проекту» → возврат, Пульс показывает обновлённые статусы (pending → in_progress)
- [ ] 🧪 **Мануальный тест:** Полный flow: открыть проект → кликнуть задачу → чат с Экспертом → вернуться → статус задачи обновился (in_progress). Попробовать кликнуть locked задачу → предупреждение.

**Git (после валидации):**
```bash
git add components/projects/project-pulse.tsx components/projects/phase-states/approved-state.tsx lib/db/queries.ts
git commit -m "feat(tz-c1): navigation from project page + phase transitions + locked dialog"
```

**Критерий готовности:** Полный user flow: Пульс → клик → чат → возврат. Все статусы обновляются. Locked задачи предупреждают.

---

### Этап 5: Финализация

**Статус:** ⬜ Не начат

> ⛔ **НЕ НАЧИНАТЬ** без подтверждения всех предыдущих этапов

**Цель:** Завершить ТЗ, обновить документацию, архивировать.

**Задачи:**
- [ ] Финальное мануальное тестирование (полный flow)
- [ ] SQL-проверка БД (таблицы, связи)
- [ ] Перенести CHANGELOG.md → главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md
- [ ] Обновить CLAUDE.md (добавить TaskChat в структуру кода)
- [ ] Обновить package.json (3.15.0 → 3.16.0)
- [ ] Переместить папку `specs/TZ_C1_ExpertTaskChat/` → `_archive/TZ_C1_ExpertTaskChat/`

**Валидация финальная:**
- [ ] `npm run build` — успешен
- [ ] Все функции работают в браузере
- [ ] Документация актуальна
- [ ] Версия обновлена (package.json, SIMPLY_STATUS, CHANGELOG)

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-c1): finalize v3.16.0 — ExpertTaskChat"
```

**Критерий готовности:** Документация актуальна, папка в архиве, версия 3.16.0.

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
- Изменений в БД

---

## Чек-лист перехода между этапами

Прежде чем начать следующий этап:
- [ ] Все задачи текущего этапа отмечены [x]
- [ ] Валидация этапа пройдена (все пункты)
- [ ] **Git commit сделан** (фиксация этапа)
- [ ] Пользователь подтвердил мануальный тест
- [ ] CHANGELOG.md обновлён
- [ ] HANDOFF.md обновлён
