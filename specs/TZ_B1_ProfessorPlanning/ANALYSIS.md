# Анализ ТЗ-B1: Профессор (планирование) + UI прогресса

**Дата:** 2026-02-09
**Источники:** SPEC.md, PROFESSOR_PLANNING.md (PE-промпт), MVP_ROLES_AND_CONTRACTS.md (концепт)

---

## Резюме

Реализовать полный цикл планирования проекта:
1. **Backend:** Новый endpoint `POST /api/projects/[id]/plan` — загружает промпт Профессора, формирует контекст (паспорт + manifest + tools + userAnswers), вызывает AI-модель, парсит structured output, сохраняет `planJson` + `planReport` в БД.
2. **Промпт:** Файл `lib/prompts/professors/planning.md` — PE-промпт уже готов (PROFESSOR_PLANNING.md).
3. **UI:** Полная реализация `planning-state.tsx` (сейчас заглушка) — три состояния: прогресс → вопросы → план.
4. **Пульс:** Обновить секцию "План" для отображения задач из planJson.
5. **БД:** Миграция — добавить `planJson` и `planReport` в таблицу Project.

---

## Что уже есть в коде

| Компонент | Статус | Файл |
|-----------|--------|------|
| Таблица Project | Есть, но **без** planJson/planReport | `lib/db/schema.ts` |
| Phase = 'planning' | Поддерживается | `phase` field, WorkArea switch |
| planning-state.tsx | **Заглушка** (placeholder text) | `components/projects/phase-states/planning-state.tsx` |
| Кнопка "Начать планирование" | Есть, меняет phase → 'planning' | `welcome-state.tsx` |
| Clerk analyzer (паттерн) | Рабочий reference | `api/projects/[id]/analyze-file/route.ts` |
| professor-pipeline.ts | Другая задача (streaming reasoning) | `lib/ai/professor-pipeline.ts` |
| Professor progress UI | Есть (для pipeline) | `components/projects/professor-progress.tsx` |
| Модель Gemini 3 Pro | Доступна | `lib/ai/providers.ts` |
| Менеджер prompt | Есть, с mode injection | `lib/prompts/service-chats/project-manager.md` |
| Директория professors/ | **Не существует** | `lib/prompts/professors/` |

---

## Вопросы для уточнения

### Q1: Три варианта ответа vs два в ТЗ

PE-промпт (PROFESSOR_PLANNING.md) определяет **три** варианта ответа:
- `"needs_input"` — вопросы (блокер)
- `"complete"` — полный план
- `"partial"` — план с оговорками (caveats)

ТЗ (SPEC.md) описывает только **два** UI-состояния:
- Вопросы (planJson.questions)
- План (planJson.tasks)

**Вопрос:** Как обрабатывать `"partial"` в UI? Варианты:
- **(A)** Показывать как полный план + дополнительный блок с оговорками (caveats)
- **(B)** Показывать как вопросы (отбросить план, показать только caveats.question)
- **(C)** Показывать план + caveats как inline-предупреждения рядом с затронутыми задачами

**Рекомендую:** (A) — это соответствует философии PE-промпта "предпочитай план с оговорками над вопросами".

### Q2: Claude Opus через OpenRouter

ТЗ указывает: `dev: Gemini 3 Pro, prod: Claude Opus через OpenRouter`.

Текущее состояние: OpenRouter/Claude **временно отключены** (ADR 011, проблемы с file attachments). В `providers.ts` зарегистрированы только Gemini-модели.

**Вопрос:** Как реализовать выбор модели?
- **(A)** Сейчас только Gemini 3 Pro. OpenRouter добавим когда вернём мультипровайдер
- **(B)** Сразу подготовить env-variable `PROFESSOR_MODEL` с fallback на Gemini 3 Pro
- **(C)** Использовать model-tiers.ts (tier "professor" уже определён)

**Рекомендую:** (B) — env-variable дёшево, не ломает ничего, готовит инфраструктуру.

### Q3: Welcome state → план: кто инициирует POST /plan?

Текущий flow: кнопка "Начать планирование" → PATCH phase='planning' → router.refresh() → показывает PlanningState (заглушку).

**Вопрос:** Кто вызывает POST /plan?
- **(A)** Welcome state: кнопка → PATCH phase + POST /plan одновременно, PlanningState получает loading=true
- **(B)** PlanningState: при mount проверяет "planJson нет?" → автоматически вызывает POST /plan
- **(C)** Welcome state: кнопка → POST /plan (endpoint сам меняет phase), PlanningState получает результат

**Рекомендую:** (B) — чище разделение ответственности. PlanningState сам управляет своим lifecycle.

### Q4: Повторный вызов планирования

Если пользователь уже получил план, потом обновляет страницу — PlanningState видит planJson с tasks.

**Вопрос:** Можно ли пересоздать план?
- **(A)** Нет, план создаётся один раз (кнопка "Пересоздать" — в будущих ТЗ)
- **(B)** Да, добавить кнопку "Пересоздать план" рядом с "Утвердить"

**Рекомендую:** (A) — это явно вне scope B1 (ТЗ говорит: "Пересмотр Профессором — отложено").

### Q5: Кнопки "Утвердить" и "Обсудить"

ТЗ говорит: кнопки — **заглушки в B1**. Варианты:
- **(A)** Toast "Функция будет доступна в следующем обновлении"
- **(B)** Кнопки disabled с tooltip
- **(C)** Кнопка "Утвердить" = disabled, "Обсудить с Менеджером" = открывает Manager Drawer (он уже работает)

**Рекомендую:** (C) — Менеджер уже видит plan в контексте, пользователь может задать вопросы. Утвердить — disabled.

### Q6: Анимация прогресса — точные тайминги

ТЗ описывает 6 шагов анимации с интервалом ~10-15 секунд. Когда реальный ответ приходит — все шаги мгновенно завершаются.

**Вопрос:** Как точно настроить тайминги?
- **(A)** Фиксированные интервалы (10-12-10-12-15-15 сек) — всего ~74 сек
- **(B)** Ускоряющиеся интервалы (8-10-12-14-16-18 сек) — ~78 сек, имитирует "усложняющийся анализ"
- **(C)** Определить в коде, подобрать экспериментально

**Рекомендую:** (C) — зависит от реального времени ответа модели. Начнём с фиксированных 12 сек, скорректируем после тестов.

---

## Потенциальные риски

### R1: Время ответа модели (ВЫСОКИЙ)
Gemini 3 Pro для сложного structured output может отвечать 30-120 секунд. Если > 90 сек — пользователь может подумать что зависло.
**Митигация:** Анимация прогресса + текст "Это займёт 1-2 минуты". Можно добавить cancel button.

### R2: Парсинг ответа Профессора (СРЕДНИЙ)
PE-промпт использует формат `<plan_report>...<plan_json>...` (XML-теги с JSON внутри). Модель может вернуть невалидный JSON или нарушить структуру тегов.
**Митигация:** Robust парсер с regex для XML-тегов + Zod-валидация JSON + graceful error handling.

### R3: Размер system prompt (СРЕДНИЙ)
PE-промпт (~300 строк) + паспорт + manifest + tools = большой system prompt. Для проектов с 30+ файлами manifest может быть огромным.
**Митигация:** Проверить лимиты. При необходимости — сжать manifest до ключевых полей.

### R4: Миграция БД (НИЗКИЙ)
Добавление двух JSONB/TEXT колонок — безопасная операция. Neon поддерживает online schema changes.
**Митигация:** Стандартная миграция через Drizzle.

### R5: professor-pipeline.ts конфликт (НИЗКИЙ)
Существующий `professor-pipeline.ts` — это другая сущность (streaming reasoning pipeline для чатов). Новый endpoint Профессора — single-call structured output.
**Митигация:** Разделить чётко: pipeline = для чатов, `/plan` endpoint = для планирования. Разные файлы, разные паттерны.

---

## Зависимости

- **Промпт Профессора (PE):** Готов — файл `PROFESSOR_PLANNING.md` в папке ТЗ
- **Клерк-анализатор (паттерн):** Готов — `analyze-file/route.ts` как reference
- **Planning-state.tsx:** Заглушка есть — нужна полная реализация
- **Database migration:** Нужна до начала backend-работы

---

## Оценка сложности

- [x] Среднее (3-5 сессий)

**Обоснование:**
- Backend endpoint — 1 сессия (по паттерну клерка)
- DB migration + queries — 0.5 сессии
- Planning-state.tsx (три состояния + анимация) — 1.5 сессии
- Pulse integration + Manager context — 0.5 сессии
- Тестирование + отладка — 0.5 сессии
