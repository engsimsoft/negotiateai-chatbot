# Roadmap ТЗ-B1: Профессор (планирование) + UI прогресса

**Создан:** 2026-02-09
**Версия проекта:** 3.13.0 → 3.14.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 4 |
| Сессий (оценка) | 3-5 |

**Решения из ANALYSIS.md:**
- Q1: `partial` → план + блок оговорок (не блокируем)
- Q2: Env-variable `PROFESSOR_MODEL` с fallback на Gemini 3 Pro
- Q3: PlanningState при mount сам вызывает POST /plan
- Q4: План один раз (пересмотр — будущие ТЗ)
- Q5: "Утвердить" disabled, "Обсудить" → Manager Drawer
- Q6: Тайминги анимации ~12 сек, корректируем по факту

---

## Этап 1: Фундамент (БД + промпт + queries)

**Статус:** ✅ Завершён

**Цель:** Подготовить БД и промпт Профессора — фундамент для endpoint и UI.

**Задачи:**
- [x] Добавить поля `planJson` (jsonb) и `planReport` (text) в таблицу Project в `lib/db/schema.ts`
- [x] Создать и применить миграцию Drizzle (`npm run db:migrate`)
- [x] Проверить миграцию через MCP SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Project' AND column_name IN ('planJson', 'planReport')`
- [x] Добавить query-функции в `lib/db/queries.ts`: `updateProjectPlan(id, planJson, planReport)`
- [x] Создать директорию `lib/prompts/professors/`
- [x] Создать файл `lib/prompts/professors/planning.md` — скопировать System Prompt из PE-документа (PROFESSOR_PLANNING.md)
- [x] Добавить типы для planJson в отдельный файл `lib/ai/professor-types.ts`: `ProfessorPlanJson`, `ProfessorTask`, `ProfessorRisk`, `ProfessorRecommendation`, `ProfessorCaveat` + Zod-схемы для парсинга

**Файлы:**
- `lib/db/schema.ts` — добавить planJson, planReport
- `lib/db/queries.ts` — добавить query-функции
- `lib/prompts/professors/planning.md` — новый (промпт PE)
- `lib/ai/professor-types.ts` — новый (типы + Zod-схемы)
- `drizzle/XXXX_migration.sql` — автогенерация

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: колонки planJson и planReport существуют в таблице Project
- [x] 🧪 Мануальный тест: npm run db:studio — убедиться что колонки видны

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts lib/prompts/professors/planning.md lib/ai/professor-types.ts drizzle/
git commit -m "feat(tz-b1): database + professor prompt + types"
```

**Критерий готовности:** Миграция применена, типы компилируются, промпт на месте.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: Backend endpoint POST /api/projects/[id]/plan

**Статус:** ✅ Завершён

**Цель:** Рабочий API, который принимает projectId, вызывает Профессора, парсит ответ, сохраняет в БД.

**Задачи:**
- [x] Создать `app/(chat)/api/projects/[id]/plan/route.ts` — POST endpoint
- [x] Реализовать загрузку промпта из .md файла (паттерн как в analyze-file)
- [x] Реализовать сборку user message: `<passport>`, `<manifest>`, `<tools>`, `<user_answers>` (XML-блоки)
- [x] Захардкодить `toolsManifest` для MVP (web_search, file_generation, file_analysis)
- [x] Реализовать вызов модели через `generateText()` с env-variable `PROFESSOR_MODEL` (fallback: gemini-3-pro)
- [x] Реализовать парсинг ответа: извлечь `<plan_report>` и `<plan_json>` из response, Zod-валидация JSON
- [x] Сохранить planJson + planReport в Project через updateProjectPlan()
- [x] Обработка ошибок: невалидный JSON, timeout, пустой ответ → graceful error response
- [x] Поддержка повторного вызова с userAnswers (для Q&A flow после needs_input)

**Файлы:**
- `app/(chat)/api/projects/[id]/plan/route.ts` — новый (основной endpoint)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер DevTools: POST /api/projects/[id]/plan вручную через fetch() — получить JSON-ответ с tasks или questions
- [x] SQL: planJson и planReport заполнены в Project после успешного вызова (проверено через MCP SQL)
- [x] 🧪 Мануальный тест: проект "AI-агентство" — status: partial, 6 задач, 3 риска, 1 caveat ✅

**Git (после валидации):**
```bash
git add app/(chat)/api/projects/[id]/plan/
git commit -m "feat(tz-b1): professor planning endpoint"
```

**Критерий готовности:** Endpoint возвращает структурированный план или вопросы, данные сохранены в БД.

---

⛔ НЕ НАЧИНАТЬ Этап 3 без подтверждения Этапа 2

---

## Этап 3: UI — PlanningState (три состояния)

**Статус:** ✅ Завершён

**Цель:** Полная реализация `planning-state.tsx` — пользователь видит прогресс, вопросы или готовый план.

**Задачи:**
- [x] Рефакторить `planning-state.tsx` (убрать заглушку): принимает props `projectId`, `planJson`, `planReport`
- [x] **Состояние 1 — Прогресс:** Анимация 6 шагов (аудит данных → ресурсы → декомпозиция → зависимости → риски → финализация). Каждый шаг появляется по таймеру (~12 сек). При получении реального ответа — все шаги мгновенно завершаются.
- [x] **Состояние 2 — Вопросы (status: needs_input):** Список вопросов с текстовыми полями + кнопка "Отправить ответы". При отправке → повторный POST /plan с userAnswers → снова прогресс.
- [x] **Состояние 3a — План готов (status: complete):** Карточки задач (order, title, goal, tools, needsReview). Блок рисков. Блок рекомендаций. Раскрываемый planReport (Markdown). Кнопки: "Утвердить" (disabled + tooltip) и "Обсудить с Менеджером" (→ открывает Manager Drawer).
- [x] **Состояние 3b — План с оговорками (status: partial):** Как 3a + дополнительный блок "⚠️ Профессор рекомендует уточнить" с caveats (затронутые задачи, проблема, последствия, вопрос).
- [x] Обновить `project-work-area.tsx`: передавать planJson и planReport в PlanningState
- [x] Подключить PlanningState к POST /plan: useEffect при mount → если planJson отсутствует → автоматический POST /plan → показать прогресс

**Файлы:**
- `components/projects/phase-states/planning-state.tsx` — полная переработка
- `components/projects/project-work-area.tsx` — обновить props для PlanningState

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: перейти в проект → план отображается из БД ✅
- [x] Браузер: обновить страницу — план виден без повторного запроса (данные из БД) ✅
- [ ] Браузер: если questions — видны поля ввода и кнопка (не протестировано — нет проекта со status needs_input)
- [x] Браузер: "Утвердить" = disabled, "Обсудить" = видна ✅
- [x] 🧪 Мануальный тест пользователем: план, оговорки, риски, рекомендации, отчёт, кнопки ✅

**Git (после валидации):**
```bash
git add components/projects/phase-states/planning-state.tsx components/projects/project-work-area.tsx
git commit -m "feat(tz-b1): planning state UI with progress animation"
```

**Критерий готовности:** Все три состояния визуально работают, данные берутся из API + БД.

---

⛔ НЕ НАЧИНАТЬ Этап 4 без подтверждения Этапа 3

---

## Этап 4: Интеграция (Пульс + Менеджер + polish)

**Статус:** ✅ Завершён

**Цель:** Пульс показывает задачи из плана, Менеджер знает о плане, UI отполирован.

**Задачи:**
- [x] Обновить `project-pulse.tsx` — секция "План": при phase='planning' и planJson.tasks — показать превью задач (номер + название), без статусов. При отсутствии планJson — показать "🧠 Анализ..." с анимацией.
- [x] Обновить `project-page-layout.tsx` (если нужно): не потребовалось — pulse передаётся как ReactNode из page.tsx
- [x] Обновить контекст Менеджера: в `buildFullManagerPrompt()` / mode injection — при наличии planJson добавить план в system prompt. Менеджер видит tasks, risks, recommendations.
- [x] Страница проекта (Server Component): передаёт planJson и phase в ProjectPulse
- [x] Edge cases: пустой manifest, пустой context → UI корректен (планJson может быть null)
- [x] Responsive: Pulse корректен на мобильной версии (bottom sheet)

**Файлы:**
- `components/projects/project-pulse.tsx` — обновить секцию "План"
- `components/projects/project-page-layout.tsx` — передать planJson
- `app/(dashboard)/projects/[id]/page.tsx` — загрузить planJson из БД
- `lib/prompts/service-chats/project-manager.md` или builder — обновить контекст Менеджера

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: Пульс показывает задачи из плана (номер + название) ✅
- [x] Браузер: Менеджер отвечает о плане осмысленно ✅
- [x] Браузер: мобильная версия — layout не ломается ✅
- [x] 🧪 Мануальный тест пользователем: E2E от создания проекта до просмотра плана в Пульсе ✅

**Git (после валидации):**
```bash
git add components/projects/project-pulse.tsx components/projects/project-page-layout.tsx app/(dashboard)/projects/[id]/page.tsx lib/prompts/
git commit -m "feat(tz-b1): pulse integration + manager context + polish"
```

**Критерий готовности:** Полный E2E flow работает, Пульс отражает план, Менеджер знает о плане.

---

⛔ НЕ НАЧИНАТЬ Этап 5 без подтверждения Этапа 4

---

## Этап 5: Финализация

**Статус:** ⬜ Не начат

**Цель:** Документация, версия, архивация.

**Задачи:**
- [ ] Финальное мануальное тестирование (пользователь): полный E2E flow
- [ ] SQL-проверка БД: таблицы, колонки, FK
- [ ] Обновить главный `CHANGELOG.md`
- [ ] Обновить `SIMPLY_STATUS.md`
- [ ] Обновить `CLAUDE.md` (добавить professors/, plan endpoint, planning-state)
- [ ] Обновить `package.json`: версия 3.14.0
- [ ] Переместить `specs/TZ_B1_ProfessorPlanning/` → `_archive/`

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Production URL работает (если деплой)
- [ ] Документация актуальна
- [ ] Все функции работают в браузере

**Git (после валидации):**
```bash
git add CHANGELOG.md SIMPLY_STATUS.md CLAUDE.md package.json
git commit -m "chore(tz-b1): finalize v3.14.0 — Professor Planning"
```

**Критерий готовности:** Документация обновлена, версия 3.14.0, ТЗ в архиве.
