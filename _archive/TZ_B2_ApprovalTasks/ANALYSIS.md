# Анализ ТЗ-B2: Утверждение плана + ProjectTask + Пульс

## Резюме

Превращаем абстрактный план Профессора в конкретные задачи в БД. Кнопка «Утвердить план» → backend создаёт `ProjectTask[]` из `planJson` → phase = `approved` → Пульс и рабочая область показывают реальные задачи со статусами. Менеджер получает статусы задач в контексте.

## Что изучено

| Файл | Статус | Что важно |
|------|--------|-----------|
| `lib/db/schema.ts` | Прочитан | Нет `ProjectTask` таблицы, нет cascade delete (ручное в `queries.ts`) |
| `planning-state.tsx` | Прочитан | Кнопка «Утвердить план» — `disabled` с `Lock` иконкой и tooltip |
| `approved-state.tsx` | Прочитан | Заглушка — зелёная галка + текст |
| `project-pulse.tsx` | Прочитан | При `planning` показывает задачи из `planJson`, при `execution` — из `Chat[]` |
| `project-work-area.tsx` | Прочитан | Switch по phase, передаёт `planJson` в `PlanningState` |
| `professor-types.ts` | Прочитан | `ProfessorTask` schema: order, title, description, goal, input, expectedOutput, dependencies, tools, needsReview |
| `service-chat/route.ts` | Прочитан | Manager получает plan context, stub для `approved` mode |
| `lib/db/queries.ts` | Прочитан | `deleteProjectById` — ручной каскад (chats→streams→votes→messages→files→folders→project) |
| Legacy tasks route | **Не найден** | Нет `/api/projects/[id]/tasks` — конфликта не будет |

## Вопросы для уточнения

### 1. Partial планы — можно утверждать?

`planJson.status` бывает `complete` и `partial` (с caveats). Кнопка «Утвердить план» должна работать для обоих? Или только для `complete`?

**Моя рекомендация:** Разрешить для обоих — partial план уже содержит задачи, пользователь видит caveats и сознательно решает утвердить.

### 2. «Начать первую задачу» — поведение заглушки?

ТЗ говорит: «заглушка до C1». Варианты:
- **(A)** Toast «Скоро — в следующем обновлении»
- **(B)** Меняет phase на `execution` (подготовка к C1)
- **(C)** Disabled кнопка как была у «Утвердить план»

**Моя рекомендация:** (A) Toast — простейший вариант, не меняет state.

### 3. Confirmation dialog при утверждении?

ТЗ: «Можно добавить, но не обязательно на MVP». Делаем?

**Моя рекомендация:** Да, простой `AlertDialog` — «Утвердить план из N задач?» Это одна минута работы и защита от случайного клика.

### 4. Enum статусов — pgEnum или varchar?

В текущей схеме `phase` = `varchar(20)`, `taskStatus` на Chat = `varchar(20)`. Для `ProjectTask.status` делать:
- **(A)** `pgEnum` (строгая типизация на уровне БД)
- **(B)** `varchar(20)` (консистентно с остальной схемой)

**Моя рекомендация:** (A) pgEnum — для новой таблицы лучше сразу сделать строго. Drizzle поддерживает это нативно.

### 5. Пульс — переключение между planJson и ProjectTask

Сейчас Пульс в `planning` phase показывает задачи из `planJson`. После утверждения (phase = `approved`) нужно показывать `ProjectTask[]` из БД. Данные приходят с сервера через page.tsx?

**Моя рекомендация:** Да — `ProjectTask[]` загружаются в `page.tsx` (Server Component) и пробрасываются через `project-page-layout → project-pulse`. При `planning` — из `planJson`, при `approved+` — из `ProjectTask[]`.

## Потенциальные риски

- **Миграция БД:** Новая таблица `ProjectTask` с FK и enum — нужно аккуратно с Neon (проверить что миграция не ломает prod)
- **Race condition при утверждении:** Двойной клик может создать дубли задач — нужен guard (проверка что `ProjectTask` ещё не существуют)
- **Cascade delete:** Нужно добавить удаление `ProjectTask` в `deleteProjectById` — иначе не удалятся проекты с задачами

## Зависимости

- **ТЗ-B1 ✅** — `planJson`, `planReport`, `PlanningState UI`, `phase transitions`
- **professor-types.ts** — `ProfessorTask` schema (поля для маппинга)
- **Drizzle ORM** — миграция для новой таблицы

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

Чёткое ТЗ, понятная архитектура, все точки интеграции известны. 1 сессия.
