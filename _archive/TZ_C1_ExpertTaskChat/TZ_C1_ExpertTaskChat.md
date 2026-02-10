# ТЗ-C1: Эксперт + чат задачи + изоляция контекста

**Версия:** 1.0  
**Дата:** 2026-02-09  
**Этап:** C (Выполнение задач)  
**Зависит от:** B2 (ProjectTask, статусы, Пульс)  
**Результат:** Пользователь кликает задачу → открывается полноценный чат с Экспертом

---

## Что делаем и зачем

Пользователь утвердил план, видит задачи в Пульсе. Сейчас кнопка «Начать задачу» — заглушка (toast). Нужно: клик по задаче → полноценный чат с AI-экспертом, который знает контекст проекта и текущую задачу.

Это ключевая фаза — здесь пользователь впервые получает реальную работу от системы.

---

## Архитектурное решение

**Отдельная страница** `/projects/[id]/tasks/[taskId]` с полноценным чатом.

Почему не переключение рабочей области на странице проекта:
- Чат с артефактами (canvas) требует полной ширины экрана
- Существующая инфраструктура чата (streaming, tools, артефакты) работает как полноценная страница
- Canvas делит экран пополам (чат + артефакт) — добавлять третью колонку (Пульс) = тесно

**Переиспользуем существующие компоненты** чата, не копируем и не пишем с нуля:

| Что | Откуда | Как |
|-----|--------|-----|
| Messages, PreviewMessage | `components/chat/messages.tsx`, `message.tsx` | Props от нового `useChat` |
| Все elements/* | `elements/response.tsx`, `tool.tsx`, `code-block.tsx` и т.д. | Как есть |
| Artifact (canvas) | `components/chat/artifact.tsx` | Props от нового `useChat` |
| DataStreamProvider + Handler | `components/chat/data-stream-*` | Обёртка на новой странице |
| Input система | `components/input/*` | mode="send", без изменений |
| PreviewAttachment | `components/chat/preview-attachment.tsx` | Как есть |
| MessageReasoning | `components/chat/message-reasoning.tsx` | Как есть |

**Создаём новое:**

| Что | Зачем |
|-----|-------|
| **TaskLayout** | Layout страницы: TaskSidebar + контент (вместо AppSidebar) |
| **TaskSidebar** | Компактный sidebar: задачи проекта со статусами + «← К проекту» |
| **TaskChat** | Оркестратор (~250 строк vs 500 в chat.tsx): useChat + props дочерним |
| **API route** | `/api/projects/[id]/tasks/[taskId]/chat/route.ts` — свой prompt builder |
| **buildTaskExpertPrompt()** | System prompt: passport + manifest + task + previousSummaries |

---

## 1. Страница и роутинг

### Файл: `app/(chat)/projects/[id]/tasks/[taskId]/page.tsx`

Server component. Загружает данные, передаёт клиентскому компоненту.

**Что загружает:**
- Project (passport, manifest, phase)
- ProjectTask по taskId (title, description, goal, input, expectedOutput, tools, status, chatId)
- Все ProjectTask[] проекта (для sidebar)
- Chat (если chatId есть — возобновляем, если null — создаём новый)
- Messages существующего чата (если есть)

**Гарды:**
- Задача не найдена → redirect на страницу проекта
- Задача locked → redirect на страницу проекта (с toast предупреждением)
- Проект не принадлежит пользователю → 404

**При первом открытии задачи (chatId = null):**
1. Создать Chat в БД (projectId, title = task.title)
2. Обновить ProjectTask.chatId → новый Chat.id
3. Обновить ProjectTask.status: pending → in_progress
4. Если project.phase !== 'execution' → обновить на 'execution'

### URL: `/projects/[id]/tasks/[taskId]`

Навигация:
- Из Пульса (страница проекта): клик на задачу со статусом pending/in_progress → переход
- Из TaskSidebar: клик на другую задачу → переход (если не locked)
- Кнопка «← К проекту» → `/projects/[id]`

---

## 2. TaskLayout

### Файл: `app/(chat)/projects/[id]/tasks/layout.tsx`

Свой layout для чатов задач. **Не использует** `app/(chat)/layout.tsx` с AppSidebar.

Структура:
```
┌──────────────┬─────────────────────────────────────────┐
│ TaskSidebar  │              Content                     │
│ (сворач.)    │     (page.tsx → TaskChat)                │
│              │                                          │
│ ✅ Задача 1  │     Чат + Артефакты (canvas)             │
│ 🔄 Задача 2  │                                          │
│ 🔒 Задача 3  │                                          │
│              │                                          │
│ ← Проект    │     [Поле ввода]                          │
└──────────────┴─────────────────────────────────────────┘
```

TaskSidebar сворачивается до иконок (паттерн из существующего SidebarLayout). При открытом артефакте (canvas) sidebar автоматически сворачивается.

---

## 3. TaskSidebar

### Файл: `components/projects/task-sidebar.tsx`

Компактный sidebar только с задачами проекта.

**Содержимое:**

**Шапка:**
- Название проекта (truncated)
- Кнопка сворачивания

**Список задач:**
- Каждая задача: иконка статуса + номер + title (truncated)
- Активная задача выделена (accent color)
- Клик по pending/in_progress/done → переход на `/projects/[id]/tasks/[taskId]`
- Клик по locked → tooltip «Сначала завершите задачу N»
- done-задачи: переход в read-only режим чата

**Подвал:**
- Кнопка «← К проекту» → `/projects/[id]`

**Иконки статусов** — те же что в ProjectPulse (переиспользуем маппинг):
- `pending` → Circle
- `in_progress` → Loader2 (animate-spin)
- `review` → Brain
- `issues` → AlertTriangle  
- `done` → Check (green)
- `locked` → Lock (muted)

**Сворачивание:**
- Развёрнут: ~240px, иконка + номер + title
- Свёрнут: ~48px, только иконка статуса
- Toggle кнопка в шапке
- Keyboard shortcut (тот же что для основного sidebar)

---

## 4. TaskChat — оркестратор

### Файл: `components/projects/task-chat.tsx`

Client component. Аналог `chat.tsx`, но проще — без:
- Professor pipeline
- Auto-naming (название = task.title)
- Model tier selection (модель определяется на сервере)
- Retry logic с переключением моделей

**Что делает:**
1. Инициализирует `useChat` с endpoint `/api/projects/[id]/tasks/[taskId]/chat`
2. Оборачивает в `DataStreamProvider`
3. Рендерит `Messages` + `Artifact` + Input-систему
4. Подключает `DataStreamHandler` для обработки артефактов

**Props от page.tsx:**
```typescript
interface TaskChatProps {
  chatId: string;
  projectId: string;
  taskId: string;
  task: ProjectTask;           // текущая задача
  initialMessages: Message[];  // если возобновляем чат
}
```

**useChat конфигурация:**
```typescript
useChat({
  id: chatId,
  api: `/api/projects/${projectId}/tasks/${taskId}/chat`,
  initialMessages,
  body: {
    id: chatId,
    projectId,
    taskId,
  },
  // стандартные обработчики onFinish, onError
})
```

**Input система:**
```tsx
<InputContextProvider provider="google" mode="send" onSubmit={handleSend}>
  <InputBase>
    <InputContent>
      <InputTextarea placeholder="Спросите эксперта..." />
    </InputContent>
    <InputToolbar>
      <InputToolbarLeft>
        <InputAttachments onAttach={handleAttach} />
      </InputToolbarLeft>
      <InputToolbarRight>
        <InputVoiceButton />
        <InputSubmitButton />
      </InputToolbarRight>
    </InputToolbar>
  </InputBase>
</InputContextProvider>
```

Примечание: InputModelSelector не нужен — модель определяется на сервере конфигом роли.

---

## 5. API Route

### Файл: `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

POST endpoint. Обрабатывает сообщения чата задачи.

**Логика:**
1. Авторизация (session check)
2. Загрузка Project, ProjectTask, Chat
3. Гарды: задача принадлежит проекту, чат принадлежит задаче
4. Сохранение user message в БД
5. Построение system prompt → `buildTaskExpertPrompt()`
6. Вызов `streamText()` с промптом и tools
7. Сохранение assistant message в БД
8. Return streaming response

**Модель:** определяется серверным конфигом (env/config), не клиентом.
- Dev: Gemini 3 Pro (как в основном чате)
- Prod: Anthropic Claude Sonnet (по конфигу роли)

**Tools:** те же что в основном chat route:
- createDocument, updateDocument
- webSearch
- parseExcel
- getCurrentDate, getWeather
- requestSuggestions, loadSkill

Переиспользовать определения tools из существующего route (вынести в shared если ещё не вынесены).

---

## 6. System Prompt — buildTaskExpertPrompt()

### Файл: `lib/prompts/build-task-expert-prompt.ts`

Собирает system prompt для Эксперта задачи.

**Структура промпта:**

```
[Промпт Эксперта от PE]           ← placeholder, файл lib/prompts/experts/task-expert.md
                                      (подключим когда PE передаст)

<project_passport>
  name: ...
  description: ...
  context: ...
</project_passport>

<project_manifest>                  ← только рабочие папки, без личных
  files: [{ name, description, folder, type }]
</project_manifest>

<current_task>
  order: N
  title: ...
  description: ...
  goal: ...
  input: ...
  expectedOutput: ...
  tools: [...]
</current_task>

<previous_tasks_summaries>          ← резюме завершённых задач (если есть)
  <task order="1" title="...">
    summary: ...
  </task>
</previous_tasks_summaries>
```

**Откуда берём данные:**
- passport → `Project.context` + `Project.name` + `Project.description`
- manifest → `Project.manifestJson` (фильтр: только type='work')
- currentTask → `ProjectTask` по taskId
- previousSummaries → все ProjectTask с status='done' у которых outputSummary не null

**Placeholder промпт Эксперта** (до получения от PE):
```markdown
Ты — эксперт, работающий над конкретной задачей в рамках проекта.
Твоя цель — выполнить задачу качественно, опираясь на контекст проекта.
Веди диалог с пользователем: уточняй, предлагай варианты, используй инструменты.
Говори на русском языке.
```

---

## 7. Обновление существующих компонентов

### 7.1 Страница проекта — клик по задаче

**Файлы:** `components/projects/project-pulse.tsx`, `components/projects/phase-states/approved-state.tsx`

Сейчас: клик на задачу → toast заглушка.  
Нужно: клик на задачу → `router.push(/projects/${projectId}/tasks/${taskId})`.

Логика клика:
- `pending` или `in_progress` → переход
- `done` → переход (read-only)
- `review` или `issues` → переход (продолжение работы)
- `locked` → показать предупреждение: «Рекомендуем сначала завершить задачу N. Начать всё равно?» → при подтверждении: переход + разблокировка (status: locked → in_progress)

### 7.2 Кнопка «Начать первую задачу»

**Файл:** `components/projects/phase-states/approved-state.tsx`

Сейчас: toast заглушка.  
Нужно: найти первую задачу со статусом pending → `router.push(...)`.

### 7.3 Phase transitions

**Файл:** `lib/db/queries.ts`

Добавить:
- `startTask(taskId)` — создаёт Chat, обновляет chatId и status → in_progress
- `getTaskWithProject(taskId, projectId)` — загрузка задачи с проверкой принадлежности
- `getCompletedTaskSummaries(projectId)` — резюме done-задач для контекста Эксперта

---

## 8. Read-only режим для завершённых задач

Когда пользователь кликает на done-задачу — открывается тот же чат, но:
- Поле ввода заблокировано (disabled) или скрыто
- Сообщения отображаются как обычно
- Артефакты доступны для просмотра
- В шапке: бейдж «Задача завершена ✅»

Определяется по `task.status === 'done'` — передаётся как prop `isReadonly` в TaskChat.

---

## 9. Что НЕ входит в это ТЗ

| Что | Почему | Когда |
|-----|--------|-------|
| Авто-итог (snapshot) | Отдельная универсальная механика | C1.5 |
| Завершение задачи (кнопка + суммаризация) | Отдельное ТЗ с Клерком-суммаризатором | C2 |
| Проверка Профессором | Отдельное ТЗ | C2 |
| Промпт Эксперта от PE | Будет подключен отдельно | По готовности |
| Новые tools (Perplexity, Plus AI и т.д.) | Подключаются после интерфейса | Отдельные ТЗ |
| Мобильная адаптация TaskSidebar | Отдельная задача | D-этап |

---

## 10. Результат

После реализации:
- Пользователь кликает задачу в Пульсе → переход на страницу чата задачи
- Полноценный чат: streaming, артефакты (canvas), tools, вложения
- Sidebar слева: задачи проекта со статусами, сворачиваемый
- Эксперт знает контекст: паспорт проекта, manifest, текущую задачу, резюме предыдущих
- Статусы обновляются: pending → in_progress при первом открытии
- Возврат на страницу проекта: кнопка в sidebar
- Переключение между задачами: клик в sidebar

**Версия после реализации:** 3.16.0

---

## Вопросы к Claude Code (при реализации)

1. Можно ли вынести определения tools из `api/chat/route.ts` в shared-модуль, чтобы переиспользовать в новом route? Или проще скопировать?
2. Нужен ли отдельный `useArtifact()` scope для task-чата, или существующий SWR-стейт работает глобально по chatId?
3. Layout nesting: `app/(chat)/projects/[id]/tasks/layout.tsx` не конфликтует с `app/(chat)/layout.tsx`? Нужно ли выносить tasks в отдельную route group?
