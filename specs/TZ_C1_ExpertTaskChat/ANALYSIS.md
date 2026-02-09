# Анализ ТЗ-C1: ExpertTaskChat

**Дата анализа:** 2026-02-09

---

## Резюме

Клик по задаче в Пульсе → переход на отдельную страницу `/projects/[id]/tasks/[taskId]` с полноценным чатом Эксперта. Новая страница: TaskSidebar (список задач) + TaskChat (streaming чат с tools и canvas). Эксперт получает контекст проекта, текущую задачу и резюме предыдущих задач. Переиспользуем существующие компоненты чата (Messages, Artifact, Input, DataStream).

---

## Вопросы для уточнения

> Ответь на эти вопросы перед началом разработки

### 1. **[Routing / Layout]:** Куда помещать route group?

ТЗ предлагает `app/(chat)/projects/[id]/tasks/[taskId]/page.tsx`. Но `app/(chat)/layout.tsx` оборачивает всё в `SidebarLayout` с `AppSidebar` — а TaskChat нужен **TaskSidebar** вместо AppSidebar.

**Варианты:**
- **(A) Отдельная route group `app/(task)/`** — свой layout с DataStreamProvider + SWRProvider + TaskSidebar, без AppSidebar. Чистое разделение, никаких конфликтов.
- **(B) Условный sidebar в `(chat)/layout.tsx`** — определяем по URL, какой sidebar показывать. Сложнее, связывает логику.
- **(C) CSS override** — скрываем AppSidebar и показываем TaskSidebar. Хак.

**Моя рекомендация:** Вариант (A) — чистое разделение. Route: `app/(task)/projects/[id]/tasks/[taskId]/page.tsx`.

### 2. **[UX]:** Эксперт начинает первым — как реализовать?

EXPERT_PROMPT говорит: «Эксперт начинает первым». При создании чата нужно чтобы первое сообщение было от AI, не от пользователя.

**Варианты:**
- **(A) Auto-trigger**: При первом открытии задачи (chatId = null) → создаём Chat → отправляем триггер-сообщение `[SYSTEM: Задача открыта. Начни работу.]` → backend генерирует ответ → сохраняем как первое сообщение. Пользователь видит уже готовый ответ Эксперта.
- **(B) Streaming на открытии**: Создаём Chat → клиент автоматически вызывает `sendMessage()` с пустым/триггерным сообщением → Эксперт стримит ответ в реальном времени. Пользователь видит процесс генерации.
- **(C) Pre-built welcome**: Заранее создаём статичное приветствие на основе task.title/description. Без AI-генерации.

**Моя рекомендация:** Вариант (B) — живой стриминг при открытии. Пользователь видит как Эксперт «думает» и отвечает. Естественнее.

### 3. **[Scope]:** createTaskSnapshot — реализуем или нет?

EXPERT_PROMPT подробно описывает tool `createTaskSnapshot` (авто-итог при заполнении контекстного окна). Но ТЗ-C1 раздел 9 говорит: «Авто-итог (snapshot) — Отдельная универсальная механика — C1.5».

**Варианты:**
- **(A) Полностью пропустить** — не включаем в промпт, не реализуем tool. Секция `<auto_summary>` и `createTaskSnapshot` убираются из промпта.
- **(B) Промпт оставить, tool — заглушка** — промпт содержит инструкции, но tool логирует и возвращает success без реального сохранения. Подготовка к C1.5.
- **(C) Минимальная реализация** — tool сохраняет snapshot в поле ProjectTask, но без системных сигналов и fallback-клерка.

**Моя рекомендация:** Вариант (A) для чистоты. Подключим полностью в C1.5 вместе с системными сигналами.

### 4. **[Tools]:** Как переиспользовать tools из chat route?

Сейчас все tools (createDocument, updateDocument, webSearch, parseExcel и т.д.) определены inline в `app/(chat)/api/chat/route.ts`. Новый route нуждается в тех же tools.

**Варианты:**
- **(A) Извлечь в shared модуль** — `lib/ai/tools/chat-tools.ts`, экспортирует фабричную функцию `getChatTools(options)`. Оба route импортируют. Чище, но рефакторинг.
- **(B) Скопировать и упростить** — скопировать определения tools в новый route, убрав ненужное. Быстрее, но дублирование.

**Моя рекомендация:** Зависит от объёма. Если tools занимают < 100 строк — (B) быстрее. Если больше — (A) оправдано. (Нужно проверить объём.)

### 5. **[Модель]:** Как выбирать модель Эксперта?

ТЗ: Dev = Gemini 3 Pro, Prod = Claude Sonnet. Клиент не выбирает.

**Варианты:**
- **(A) Environment variable** — `EXPERT_MODEL_ID=gemini-3-pro` в .env.local, `claude-sonnet-4-5-20250929` в Vercel.
- **(B) Конфиг в `lib/ai/providers.ts`** — `expertModel: process.env.NODE_ENV === 'production' ? 'claude-sonnet' : 'gemini-3-pro'`.
- **(C) Хардкод** — Gemini 3 Pro сейчас, поменяем при деплое.

**Моя рекомендация:** Вариант (A) — гибкость через env. Согласуется с существующим подходом в проекте.

### 6. **[Input]:** MultimodalInput vs InputContext система?

Существующий `chat.tsx` использует `multimodal-input.tsx` (с retries, delay detection, usage display). ТЗ предлагает InputContext систему (InputBase + InputTextarea + toolbar). InputContext — новее и проще, но не имеет retry/delay логики.

Для TaskChat retry/delay скорее всего не нужны (задача меньше основного чата). Верно ли это?

### 7. **[Locked tasks]:** Разблокировка по подтверждению?

ТЗ раздел 7.1: клик по locked задаче → диалог «Рекомендуем сначала завершить задачу N. Начать всё равно?» → при подтверждении: переход + разблокировка (status: locked → in_progress).

Это значит пользователь может нарушить порядок задач. **Это ОК?** Или locked = строго заблокировано?

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Layout конфликт (chat layout → AppSidebar вместо TaskSidebar) | Высокая | Блокер | Отдельная route group (вопрос 1) |
| Рефакторинг tools может сломать основной чат | Средняя | Высокое | Тщательная проверка + tsc после изменений |
| Server Component с side effects (создание Chat при первом открытии) | Средняя | Среднее | Вынести в Server Action или API call |
| useChat + DataStreamHandler совместимость с другим API endpoint | Низкая | Среднее | Тестирование streaming на ранних этапах |
| Canvas/Artifact state leak между task-чатами | Низкая | Среднее | Проверить scope useArtifact по chatId |

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-B2 завершён (ProjectTask, статусы, Пульс)
- [x] Промпт Эксперта от PE (EXPERT_PROMPT.md — получен)
- [ ] Ответы на вопросы выше

**Затронутые компоненты (существующие):**
- `components/projects/project-pulse.tsx` — клик по задаче → навигация
- `components/projects/phase-states/approved-state.tsx` — кнопка «Начать задачу»
- `lib/db/queries.ts` — новые queries (startTask, getTaskWithProject, getCompletedTaskSummaries)
- `lib/db/schema.ts` — возможно расширение (если нужны индексы)
- `app/(chat)/api/chat/route.ts` — если извлекаем tools в shared

**Новые файлы:**
- `app/(task)/projects/[id]/tasks/[taskId]/page.tsx` — страница задачи
- `app/(task)/projects/[id]/tasks/layout.tsx` — layout с TaskSidebar
- `app/(task)/layout.tsx` — root layout route group (providers)
- `components/projects/task-sidebar.tsx` — sidebar задач
- `components/projects/task-chat.tsx` — оркестратор чата
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — API endpoint
- `lib/prompts/build-task-expert-prompt.ts` — сборка system prompt
- `lib/prompts/experts/task-expert.md` — промпт Эксперта

---

## Оценка

- [ ] Простое (1-2 сессии)
- [x] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Основная сложность — routing/layout (нужна новая route group), API route (streaming + tools), и prompt builder. Компоненты чата переиспользуются. ~3-4 сессии: 1) routing + layout + sidebar, 2) TaskChat + API route, 3) prompt builder + навигация из Pulse, 4) полировка + read-only.

---

## Ответы на вопросы

> Заполнено 2026-02-09

1. **[Routing]:** **(A) Отдельная route group `app/(task)/`** — чистое разделение, без хаков.
2. **[Эксперт первым]:** **(B) Живой стриминг** — автоматический запрос при первом открытии (chatId был null). Только при первом открытии, не при возврате.
3. **[createTaskSnapshot]:** **(A) Пропустить полностью** — ни tool, ни упоминание в промпте. Отдельно в C1.5.
4. **[Tools]:** **Извлечь в shared модуль** — два route с одними tools, дублирование гарантирует рассинхрон. Правильная инвестиция.
5. **[Модель]:** **(A) Env variable** — `EXPERT_MODEL` с fallback на Gemini. Тот же паттерн что `PROFESSOR_MODEL`.
6. **[Input]:** **InputContext система** — `components/input/` в режиме `send`. Без multimodal-input, без ModelSelector.
7. **[Locked tasks]:** **AlertDialog с предупреждением** — «Рекомендуем сначала завершить задачу N. Начать всё равно?» → при подтверждении: locked → in_progress + переход. Предупреждаем, не блокируем.
