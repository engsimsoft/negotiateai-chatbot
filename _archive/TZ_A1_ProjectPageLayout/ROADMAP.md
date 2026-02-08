# Roadmap ТЗ-A1: Новая страница проекта — Layout

**Создан:** 2026-02-08
**Версия проекта:** 3.11.0 → 3.12.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 3 |
| Сессий (оценка) | 3-5 |

---

## Этап 1: Миграция БД + Schema

**Статус:** ✅ Завершён

**Цель:** Добавить колонку `phase` в таблицу Project. Подготовить фундамент для фазовой системы.

**Задачи:**
- [ ] Добавить `phase` в `lib/db/schema.ts` (varchar(20), default 'setup')
- [ ] Создать миграцию Drizzle (`npx drizzle-kit generate` + `npx drizzle-kit migrate`)
- [ ] Проверить миграцию на базе через MCP SQL-запрос

**Файлы:**
- `lib/db/schema.ts` — добавить колонку phase
- `lib/db/migrations/XXXX_*.sql` — автогенерация миграции

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: `SELECT phase FROM "Project" LIMIT 5` — возвращает 'setup' для всех существующих проектов
- [ ] 🧪 Мануальный тест: подтвердить что колонка phase существует и дефолт корректный

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/migrations/
git commit -m "feat(tz-a1): add phase column to Project table"
```

**Критерий готовности:** Колонка `phase` существует в БД, все существующие проекты имеют значение 'setup'.

---

⛔ НЕ НАЧИНАТЬ Этап 2 без подтверждения Этапа 1

---

## Этап 2: ProjectPageLayout + Header

**Статус:** ✅ Завершён

**Цель:** Создать каркас двухколоночного layout и чистый header. Заменить текущую разметку страницы проекта.

**Задачи:**
- [ ] Создать `components/projects/project-page-layout.tsx` — клиентский layout-компонент
  - Двухколоночный: Pulse slot (~300px sticky) + WorkArea slot (flex-1)
  - Полноэкранный (без max-w-960px)
  - Пульс: sticky left, независимый скролл (`overflow-y-auto`, `h-[calc(100vh-3.5rem)]`)
  - Поддержка push-drawer через состояние (margin-right для WorkArea)
- [ ] Новый header в page.tsx:
  - Слева: ← Главная / 📂 {project.name} (breadcrumbs)
  - Справа: кнопка [👤 Менеджер] (пока без функционала)
  - Без кнопки "Настроить"
- [ ] Переписать `app/(dashboard)/projects/[id]/page.tsx` — использовать ProjectPageLayout
  - Передавать Пульс и WorkArea как children/slots
  - Пока вставить placeholder-ы вместо реальных секций
- [ ] Удалить использование ProjectActions из page.tsx

**Файлы:**
- `components/projects/project-page-layout.tsx` — новый
- `app/(dashboard)/projects/[id]/page.tsx` — переписать

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/projects/[id]` — двухколоночная структура, header чистый (breadcrumbs слева, кнопка Менеджера справа)
- [ ] Браузер: Пульс скроллится независимо от WorkArea
- [ ] 🧪 Мануальный тест: открыть любой проект, проверить layout и header

**Git (после валидации):**
```bash
git add components/projects/project-page-layout.tsx app/(dashboard)/projects/[id]/page.tsx
git commit -m "feat(tz-a1): two-column layout and clean header"
```

**Критерий готовности:** Страница проекта отображается в двухколоночном layout с корректным header. Placeholder-ы на месте Пульса и WorkArea.

---

⛔ НЕ НАЧИНАТЬ Этап 3 без подтверждения Этапа 2

---

## Этап 3: Пульс (левая панель)

**Статус:** ⬜ Не начат

**Цель:** Рефакторинг Пульса в навигационную панель с тремя сворачиваемыми секциями: План, Файлы, Паспорт.

**Задачи:**
- [ ] Рефакторинг `project-pulse.tsx` — контейнер трёх секций (сворачиваемых через Collapsible)
- [ ] Секция "📋 План" (раскрыта по умолчанию):
  - Список задач (чатов) со статусами (not_started / in_progress / done)
  - Иконки статусов, клик → навигация в чат задачи
  - Счётчик задач в заголовке секции
- [ ] Секция "📁 Файлы":
  - Адаптированный ProjectFilesCard под ширину ~300px
  - Кнопка загрузки файлов
  - Папки и файлы (текущий функционал)
- [ ] Секция "⚙️ Паспорт":
  - Сворачиваемые подсекции: Название, Описание, Контекст
  - ProjectMeta (дата создания, счётчики) — компактно внизу секции
  - Убрать табы — простые сворачиваемые блоки
- [ ] Мобильный: bottom sheet с кнопкой-триггером в header (иконка бургера или пульс)

**Файлы:**
- `components/projects/project-pulse.tsx` — рефакторинг (основной)
- `components/projects/project-passport.tsx` — рефакторинг (убрать табы → сворачиваемые секции)
- `components/projects/project-files-card.tsx` — адаптация ширины

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: три секции видны в левой панели, все сворачиваются/разворачиваются
- [ ] Браузер: задачи отображаются со статусами, клик ведёт в чат
- [ ] Браузер: файлы загружаются, папки работают
- [ ] Браузер: паспорт показывает описание, контекст, мета-данные
- [ ] Браузер (мобильный): bottom sheet работает
- [ ] 🧪 Мануальный тест: развернуть/свернуть секции, загрузить файл, кликнуть по задаче

**Git (после валидации):**
```bash
git add components/projects/project-pulse.tsx components/projects/project-passport.tsx components/projects/project-files-card.tsx
git commit -m "feat(tz-a1): pulse panel with collapsible sections"
```

**Критерий готовности:** Левая панель полностью функциональна — все три секции работают, данные отображаются, мобильная версия есть.

---

⛔ НЕ НАЧИНАТЬ Этап 4 без подтверждения Этапа 3

---

## Этап 4: Рабочая область (WorkArea) + Фазы

**Статус:** ⬜ Не начат

**Цель:** Создать рабочую область с рендерингом контента по фазе проекта. Реализовать авто-переход setup → documents.

**Задачи:**
- [ ] Создать `components/projects/project-work-area.tsx` — switch по phase
- [ ] Создать компоненты фаз в `components/projects/phase-states/`:
  - `welcome-state.tsx` (setup/documents) — иконка, текст «Добро пожаловать», кнопки «Загрузить файлы» / «Начать планирование»
  - `planning-state.tsx` (planning) — заглушка «Планирование в разработке»
  - `approved-state.tsx` (approved) — заглушка «План утверждён»
  - `execution-state.tsx` (execution) — сетка карточек задач (чатов) с навигацией + кнопка «Новая задача»
  - `completed-state.tsx` (completed) — заглушка «Проект завершён»
- [ ] Авто-переход setup → documents: при загрузке страницы если phase='setup' — обновить в БД на 'documents' (server action или API)
- [ ] Добавить query `updateProjectPhase` в `lib/db/queries.ts`
- [ ] Передать phase из page.tsx в WorkArea

**Файлы:**
- `components/projects/project-work-area.tsx` — новый
- `components/projects/phase-states/welcome-state.tsx` — новый
- `components/projects/phase-states/planning-state.tsx` — новый
- `components/projects/phase-states/approved-state.tsx` — новый
- `components/projects/phase-states/execution-state.tsx` — новый
- `components/projects/phase-states/completed-state.tsx` — новый
- `lib/db/queries.ts` — добавить updateProjectPhase
- `app/(dashboard)/projects/[id]/page.tsx` — передать phase, авто-переход

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: WorkArea показывает контент по фазе проекта
- [ ] Браузер: при первом открытии нового проекта (phase=setup) → автоматически обновляется на documents
- [ ] Браузер: ExecutionState показывает карточки задач с навигацией
- [ ] SQL: `SELECT phase FROM "Project" WHERE id='...'` — корректное значение после авто-перехода
- [ ] 🧪 Мануальный тест: создать новый проект → открыть → проверить авто-переход, проверить заглушки фаз

**Git (после валидации):**
```bash
git add components/projects/project-work-area.tsx components/projects/phase-states/ lib/db/queries.ts app/(dashboard)/projects/[id]/page.tsx
git commit -m "feat(tz-a1): work area with phase rendering"
```

**Критерий готовности:** Рабочая область рендерит контент по phase. Авто-переход setup → documents работает. ExecutionState показывает задачи.

---

⛔ НЕ НАЧИНАТЬ Этап 5 без подтверждения Этапа 4

---

## Этап 5: ManagerDrawer

**Статус:** ⬜ Не начат

**Цель:** Создать push-drawer Менеджера (каркас без AI). Кнопка в header открывает drawer, рабочая область сжимается.

**Задачи:**
- [ ] Создать `components/projects/manager-drawer.tsx`:
  - Push-поведение: drawer справа (~400px), WorkArea сжимается (не overlay)
  - Header: аватар + «Менеджер проекта» + кнопка закрытия (X)
  - Зона сообщений: заглушка — текст о будущей функциональности
  - Зона действий: зарезервирован пустой блок (~60-80px)
  - Поле ввода: disabled, placeholder «Скоро здесь можно будет общаться с Менеджером»
  - Анимация открытия/закрытия (transition)
- [ ] Интегрировать в ProjectPageLayout — состояние open/close, передача в layout для push-эффекта
- [ ] Кнопка [👤 Менеджер] в header → toggle drawer
- [ ] Мобильный: bottom sheet (через vaul или аналогичный)

**Файлы:**
- `components/projects/manager-drawer.tsx` — новый
- `components/projects/project-page-layout.tsx` — интеграция push-drawer
- `app/(dashboard)/projects/[id]/page.tsx` — состояние drawer

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: нажать «Менеджер» → drawer открывается справа, WorkArea сжимается
- [ ] Браузер: закрыть drawer → WorkArea восстанавливается
- [ ] Браузер: drawer содержит header, заглушку сообщений, зону действий, disabled поле ввода
- [ ] Браузер: анимация плавная
- [ ] Браузер (мобильный): bottom sheet работает
- [ ] 🧪 Мануальный тест: открыть/закрыть drawer несколько раз, проверить push-эффект

**Git (после валидации):**
```bash
git add components/projects/manager-drawer.tsx components/projects/project-page-layout.tsx app/(dashboard)/projects/[id]/page.tsx
git commit -m "feat(tz-a1): manager drawer with push behavior"
```

**Критерий готовности:** Drawer открывается/закрывается, сжимает рабочую область, показывает каркас Менеджера.

---

⛔ НЕ НАЧИНАТЬ Этап 6 без подтверждения Этапа 5

---

## Этап 6: Очистка + Финализация

**Статус:** ⬜ Не начат

**Цель:** Удалить неиспользуемые компоненты, обновить документацию, финальная проверка всего функционала.

**Задачи:**
- [ ] Удалить `components/projects/project-actions.tsx`
- [ ] Удалить `components/projects/manager-card.tsx`
- [ ] Удалить `components/projects/new-task-card.tsx`
- [ ] Удалить `components/projects/task-history-card.tsx`
- [ ] Обновить `components/projects/index.ts` — убрать экспорты удалённых компонентов
- [ ] Grep по проекту — убедиться что нет импортов удалённых компонентов
- [ ] SQL-проверка БД: таблицы, колонки, данные
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Обновить главный `CHANGELOG.md`
- [ ] Обновить `SIMPLY_STATUS.md`
- [ ] Обновить `CLAUDE.md` (если менялась структура)
- [ ] Обновить `package.json` (версия 3.12.0)
- [ ] Переместить папку `specs/TZ_A1_ProjectPageLayout/` → `_archive/`

**Файлы:**
- Удаление: `project-actions.tsx`, `manager-card.tsx`, `new-task-card.tsx`, `task-history-card.tsx`
- `components/projects/index.ts` — обновить экспорты
- `CHANGELOG.md`, `SIMPLY_STATUS.md`, `CLAUDE.md`, `package.json` — обновить

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Grep: нет импортов удалённых компонентов
- [ ] SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Project'` — phase присутствует
- [ ] Браузер: полный прогон — проект открывается, Пульс работает, WorkArea по фазам, Drawer, мобильный
- [ ] 🧪 Финальный мануальный тест: все сценарии
- [ ] Документация актуальна

**Git (после валидации):**
```bash
git add -A
git commit -m "feat(tz-a1): cleanup and finalize project page layout (v3.12.0)"
```

**Критерий готовности:** Build проходит, нет сломанных импортов, страница проекта полностью работает в новом layout, документация обновлена, ТЗ в архиве.

---

## Порядок и зависимости

```
Этап 1 (БД) → Этап 2 (Layout) → Этап 3 (Пульс) → Этап 4 (WorkArea) → Этап 5 (Drawer) → Этап 6 (Очистка)
```

**Каждый этап строго:**
1. Код
2. `npx tsc --noEmit` — 0 ошибок
3. `npm run build` — успешен
4. Git commit
5. Запросить мануальный тест
6. ⛔ СТОП — ждать подтверждения
