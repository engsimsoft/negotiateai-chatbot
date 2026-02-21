# Roadmap ТЗ-BF3: BriefingSidebarRedesign

**Создан:** 2026-02-21
**Версия проекта:** 3.40.0 → 3.41.0
**Статус:** Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 3 |
| Текущий этап | 3 |
| Сессий (оценка) | 1 |

---

## Этапы

### Этап 1: Фирменный header + удаление дублей

**Статус:** ✅ Завершён

**Цель:** Добавить «S Simply» branding в сайдбар, убрать дублирование «Настройки», адаптировать header страницы.

**Задачи:**
- [x] Добавить фирменный header «S Simply» (Link → /dashboard) в `SidebarContent` компонент
- [x] Обернуть header в `shrink-0 border-b px-3 py-3` wrapper (отделить от scroll area)
- [x] Удалить кнопку «Настройки» из footer сайдбара (строки 395-401)
- [x] В `briefing-issue-header.tsx`: добавить `md:hidden` на `<Link href="/dashboard">` со стрелкой, чтобы на десктопе стрелка скрывалась
- [x] Превратить «Сгенерировать» в `Button variant="default"` с `w-full rounded-lg` (primary style)
- [x] Обновить padding footer: `px-3 py-4` для баланса с одной кнопкой

**Файлы:**
- `components/briefing/briefing-sidebar.tsx` — header, footer, удаление «Настройки»
- `components/briefing/briefing-issue-header.tsx` — стрелка `md:hidden`

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер (десктоп): «S Simply» видна вверху сайдбара, клик → /dashboard
- [x] Браузер (десктоп): стрелка ← в header скрыта
- [x] Браузер (десктоп): «Сгенерировать» — терракотовая кнопка
- [x] Браузер (десктоп): «Настройки» только в header (шестерёнка), не в сайдбаре
- [ ] Браузер (мобильный): стрелка ← в header видна *(проверится в Этапе 3)*
- [ ] Браузер (мобильный): Sheet-drawer показывает «S Simply» header *(проверится в Этапе 3)*
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/briefing/briefing-sidebar.tsx components/briefing/briefing-issue-header.tsx
git commit -m "feat(tz-bf3): branded header + primary generate button + remove settings dupe"
```

**Критерий готовности:** Сайдбар визуально соответствует фирменному стилю Simply (как чатовый сайдбар). Кнопка «Сгенерировать» выделяется. «Настройки» не дублируется.

---

### Этап 2: Папки по темам (Collapsible)

**Статус:** ✅ Завершён

**Цель:** Заменить группировку сохранённых тем с «по дате» на «папки по категориям» с Collapsible и localStorage.

**Задачи:**
- [x] Создать функцию `groupByTopic()` — группировка `SavedBriefingTopicClient[]` по `topicId`, сортировка папок по дате последнего `savedAt` DESC
- [x] Создать функцию `formatShortDate()` — `21 фев` (без времени, для элементов внутри папок)
- [x] Добавить state `expandedTopics: Set<string>` + инициализация из localStorage
- [x] Создать функцию `toggleTopic(topicId)` — toggle + persist в localStorage (ключ `briefing-sidebar-expanded-topics`)
- [x] Заменить рендер секции «Сохранённые»: Collapsible папки вместо плоских групп по дате
  - Папка: `ChevronRight/Down` + `emoji` + `topicName` + count badge
  - Элемент в папке: `formatShortDate(savedAt)` + `·` + `title` (truncate)
  - Hover: кнопка удаления `×` (как сейчас, `group-hover:opacity-100`)
  - Active state: `bg-primary/10 font-medium text-primary` при `selectedSavedTopicId === topic.id`
- [x] По умолчанию все папки свёрнуты (пустой Set при отсутствии в localStorage)
- [x] ТЗ-BF3: Исправить title — извлечение headline из `**bold**` в content (вместо дублирования topicName)
  - `briefing-page-client.tsx`: headline extraction при сохранении
  - `briefing-sidebar.tsx`: `getDisplayTitle()` fallback для уже сохранённых тем

**Файлы:**
- `components/briefing/briefing-sidebar.tsx` — groupByTopic(), Collapsible папки, localStorage state, getDisplayTitle()
- `components/briefing/briefing-page-client.tsx` — headline extraction при сохранении

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: сохранённые темы сгруппированы по категориям (папки с emoji + count)
- [x] Браузер: клик на папку раскрывает/сворачивает (ChevronDown/Right анимация)
- [x] Браузер: элементы внутри папки показывают `дата · заголовок`
- [x] Браузер: клик на элемент в папке открывает сохранённую тему
- [x] Браузер: hover показывает × для удаления
- [x] Браузер: перезагрузка страницы сохраняет состояние раскрытия папок
- [x] Браузер: пустые папки (0 элементов) не показываются
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/briefing/briefing-sidebar.tsx
git commit -m "feat(tz-bf3): collapsible topic folders for saved topics"
```

**Критерий готовности:** Сохранённые темы отображаются в collapsible папках по категориям. Состояние сохраняется в localStorage. Все интерактивные элементы (клик, hover, удаление) работают.

---

### Этап 3: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный CHANGELOG.md
- [x] Обновить SIMPLY_STATUS.md
- [x] Обновить CLAUDE.md (секция Briefing UI — обновить описание briefing-sidebar.tsx)
- [x] Обновить package.json (версия 3.41.0)
- [x] Переместить папку в _archive/

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна
- [x] Все функции работают в браузере

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-bf3): finalize docs + archive specs"
```

**Критерий готовности:** Документация обновлена, код в production-ready состоянии, ТЗ в архиве.
