# Передача сессии ТЗ-B1: Профессор (планирование)

**Дата:** 2026-02-09
**Сессия:** 4

## Статус этапов
- [x] Этап 1: Фундамент (БД + промпт + queries) ✅
- [x] Этап 2: Backend endpoint POST /plan ✅
- [x] Этап 3: UI — PlanningState (три состояния) ✅
- [x] Этап 4: Интеграция (Пульс + Менеджер + polish) ✅
- [ ] Этап 5: Финализация ← СЛЕДУЮЩИЙ

## Следующая сессия: начни с
1. Прочитай ROADMAP.md — Этап 5
2. Мануальный тест: E2E flow (создание проекта → план → Пульс → Менеджер)
3. Обновить `CHANGELOG.md`, `SIMPLY_STATUS.md`, `CLAUDE.md`, `package.json` → v3.14.0
4. Git commit для Этапа 4
5. Git commit для Этапа 5 (финализация)
6. Переместить `specs/TZ_B1_ProfessorPlanning/` → `_archive/`

## Что сделано в Этапе 4
- `components/projects/project-pulse.tsx` — новые props: `phase`, `planJson`
  - Planning phase + planJson.tasks → нумерованный список задач (order + title) в кружках
  - Planning phase без planJson → "🧠 Анализ проекта..." с animate-pulse
  - Другие фазы → прежнее поведение (tasks из чатов со статусами)
  - Счётчик: isPlanning ? planTasks.length : tasks.length
- `app/(dashboard)/projects/[id]/page.tsx` — передаёт `phase={currentPhase}` и `planJson` в ProjectPulse
- `app/(chat)/api/service-chat/route.ts` — `buildFirstContactMode()`:
  - При наличии planJson (status complete/partial): генерирует `<professor_plan>` блок с tasks, risks, recommendations
  - `professor_enabled` = true/false на основе наличия плана
  - Обновлены `<mode_instructions>`: Менеджер знает о плане, ссылается на конкретные задачи/риски, не пересказывает целиком
- `project-page-layout.tsx` — не потребовал изменений (pulse передаётся как ReactNode)
- Валидация: `tsc --noEmit` = 0 ошибок, `npm run build` = успешен

## Ключевые решения
- **Pulse plan display**: В planning phase показываем задачи из planJson (не из чатов). Круглый badge с номером + truncated title.
- **Manager plan context**: Plan данные инжектируются в XML-блоки `<professor_plan>` → `<tasks>`, `<risks>`, `<recommendations>`. Менеджер может ссылаться на конкретные задачи.
- **No layout changes needed**: Pulse получает planJson через page.tsx → ProjectPulse props, layout не изменён.

## Ключевые файлы
- `app/(chat)/api/projects/[id]/plan/route.ts` — endpoint Профессора
- `components/projects/phase-states/planning-state.tsx` — UI планирования
- `components/projects/project-pulse.tsx` — Пульс с превью задач
- `components/projects/project-work-area.tsx` — роутинг по фазам
- `components/projects/project-page-layout.tsx` — layout + event listener
- `app/(dashboard)/projects/[id]/page.tsx` — Server Component, передаёт planJson + phase
- `app/(chat)/api/service-chat/route.ts` — Manager prompt с plan context
- `lib/ai/professor-types.ts` — типы + Zod
- `lib/prompts/professors/planning.md` — промпт Профессора

## Блокеры / Вопросы
- Мануальный тест ожидает подтверждения пользователя
