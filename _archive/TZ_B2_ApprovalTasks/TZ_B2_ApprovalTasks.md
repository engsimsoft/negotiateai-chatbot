# ТЗ-B2: Утверждение плана + ProjectTask + Пульс

**Дата:** 2026-02-09  
**Фаза:** 3 (Утверждение)  
**Зависимости:** ТЗ-B1 ✅ (Профессор, planJson, PlanningState UI)  
**Источники:** MVP_ROLES_AND_CONTRACTS.md (контракт Менеджера — режим навигации), SIMPLY_ORCHESTRATION_BLUEPRINT.md (раздел 3, Фаза 3-4; раздел 5.2 ProjectTask)

---

## Что делаем

Пользователь видит план от Профессора и нажимает «Утвердить» → backend создаёт ProjectTask записи из planJson → phase переходит в 'approved' → Пульс показывает реальные задачи со статусами → рабочая область показывает карту задач.

**Это момент когда план становится работой.** Абстрактный анализ превращается в конкретные задачи с навигацией.

---

## БД: таблица ProjectTask (новая)

```sql
ProjectTask:
  id            uuid          PK, default gen_random_uuid()
  projectId     uuid          FK → Project, NOT NULL
  orderIndex    integer       NOT NULL (из task.order)
  title         varchar(500)  NOT NULL
  description   text          (подробное описание из плана)
  goal          text          (одно предложение — цель)
  input         text          (что нужно для начала)
  expectedOutput text         (что должно получиться)
  status        enum          NOT NULL, default 'locked'
  chatId        uuid          FK → Chat, NULLABLE (создаётся в C1)
  inputSummary  text          NULLABLE (резюме предыдущих — C2)
  outputSummary text          NULLABLE (резюме результата — C2)
  professorVerdict jsonb      NULLABLE (вердикт проверки — C2)
  dependsOn     integer[]     (массив orderIndex зависимостей)
  tools         text[]        (инструменты из плана)
  needsReview   boolean       default false
  createdAt     timestamp
  updatedAt     timestamp
```

**Статусы:** `locked | pending | in_progress | review | issues | done`

**Миграция:** Drizzle migration, добавить таблицу + FK. Обновить delete cascade проекта (уже починен в B1, добавить ProjectTask).

---

## Backend

### Endpoint: POST /api/projects/[id]/approve-plan

**Логика:**
1. Загрузить Project, проверить что planJson существует и содержит tasks
2. Создать ProjectTask[] из planJson.tasks:
   - orderIndex = task.order
   - title, description, goal, input, expectedOutput — из плана
   - dependsOn = task.dependencies (массив order номеров)
   - tools = task.tools
   - needsReview = task.needsReview
   - status: первая задача → `pending`, остальные → `locked`
3. Обновить Project.phase → `approved`
4. Вернуть созданные задачи

**Определение начальных статусов:**
- Задачи без зависимостей (dependencies = []) → `pending`
- Задачи с зависимостями → `locked`
- На MVP обычно только первая задача будет pending (строго последовательно)

### Endpoint: GET /api/projects/[id]/tasks

Возвращает ProjectTask[] отсортированные по orderIndex. Нужен для Пульса и рабочей области.

### Удаление старого tasks route

В A1 остался legacy tasks route. Если он конфликтует с новым — удалить. Если нет — оставить и удалить позже.

---

## UI

### 1. Кнопка «Утвердить план» — активация

В PlanningState (planning-state.tsx) кнопка «Утвердить план» сейчас disabled. Активируем:

**Клик → POST /approve-plan → переход на phase 'approved'.**

Можно добавить короткий confirmation: «Утвердить план из N задач? После утверждения начнётся работа.» — но не обязательно на MVP.

### 2. WorkArea: ApprovedState (новый компонент в phase-states/)

**Показывает карту задач после утверждения:**

```
✅ План утверждён — N задач

┌─────────────────────────────────────┐
│ 1  Анализ рынка и конкурентов      │
│    Понять конкурентную среду        │
│    🔍 web_search  🎓 проверка      │
│    ● Готова к работе                │
├─────────────────────────────────────┤
│ 2  Формирование услуг и цен        │
│    Определить линейку услуг         │
│    📄 file_generation               │
│    🔒 Зависит от задачи 1          │
├─────────────────────────────────────┤
│ 3  Финансовая модель               │
│    ...                              │
│    🔒 Зависит от задачи 2          │
└─────────────────────────────────────┘

[Начать первую задачу →]
```

**Карточка задачи содержит:**
- Номер + заголовок
- Цель (goal) — одна строка
- Иконки инструментов + badge «проверка» если needsReview
- Статус: «Готова к работе» (pending) или «Зависит от задачи N» (locked)

**Кнопка «Начать первую задачу»** — заглушка в B2. Реальный переход в чат задачи — ТЗ-C1. Кнопка может менять phase на `execution` или показывать toast «Скоро».

### 3. Пульс: реальные задачи

Секция «План» в project-pulse.tsx сейчас показывает превью из planJson. После утверждения — переключается на реальные ProjectTask из БД:

```
📋 План
├ ⬜ 1. Анализ рынка            (pending)
├ 🔒 2. Услуги и цены           (locked)
├ 🔒 3. Финансовая модель       (locked)
├ 🔒 4. Стратегия               (locked)
└ 🔒 5. Итоговая презентация    (locked)
```

**Визуал статусов:**
| Статус | Иконка | Цвет |
|---|---|---|
| pending | ⬜ (или кружок) | Нейтральный |
| locked | 🔒 | Серый |
| in_progress | 🔄 | Синий/активный |
| review | 🧠 | Пульсация |
| issues | ⚠️ | Жёлтый |
| done | ✅ | Зелёный |

Клик по задаче в Пульсе — на MVP ничего не делает (нет чата задачи). В C1 будет переход.

### 4. Менеджер — контекст навигации

Менеджер уже получает plan в контексте (B1). Теперь дополнительно нужно передавать taskStatuses если задачи существуют. Это подготовка к режиму «Навигация» из контракта.

В system prompt Менеджера при phase = 'approved':
```xml
<task_statuses>
  <task order="1" title="Анализ рынка" status="pending" />
  <task order="2" title="Услуги и цены" status="locked" />
  ...
</task_statuses>
```

---

## Phase transitions

```
planning (B1) → [Утвердить] → approved (B2) → [Начать задачу] → execution (C1)
```

B2 отвечает за переход planning → approved.

---

## Что НЕ входит в B2

- Открытие задачи / чат с Экспертом — C1
- Завершение задачи / резюме / проверка — C2
- Изменение статуса задачи (кроме начального) — C1
- Редактирование плана после утверждения — отложено
- Пересмотр плана Профессором — отложено

---

## Ожидаемый результат

1. Кнопка «Утвердить» активна, по клику создаёт задачи в БД
2. Phase переходит в 'approved'
3. Рабочая область показывает карту задач с номерами, целями, статусами
4. Пульс показывает реальные задачи из ProjectTask (не превью из planJson)
5. Менеджер получает статусы задач в контексте
6. Кнопка «Начать задачу» — заглушка до C1
