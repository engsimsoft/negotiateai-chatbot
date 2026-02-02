# Дорожная карта: ТЗ-02 — Dashboard + Sidebar + Роутинг

## Цель

Создать Dashboard как новую точку входа и реструктуризировать навигацию:
- Dashboard (`/dashboard`) — панель инструментов без sidebar
- Sidebar с вертикальными вкладками (Search, Chats, Projects)
- Чистое разделение layout-ов (с sidebar / без sidebar)
- Подготовка к ТЗ-03 (Проекты)

**Детали:** См. [TZ_02_DASHBOARD_SIDEBAR_ROUTING.md](TZ_02_DASHBOARD_SIDEBAR_ROUTING.md)

## Текущий статус

- **Этап:** ТЗ-02 — ✅ ЗАВЕРШЁН
- **Прогресс:** 56/56 задач (100%)
- **Предыдущий:** ТЗ-NEW-01 (v3.0.0) ✅

### ~~БЛОКЕР~~ ✅ РЕШЕНО: Tabs при сворачивании sidebar

**Проблема:** При сворачивании sidebar табы тоже исчезали.

**Решение:** `components/sidebar-layout.tsx` — табы рендерятся ВНЕ компонента Sidebar в отдельном fixed div. CSS variable `--sidebar-left-offset` в `sidebar.tsx` для позиционирования.

**Дополнительно исправлено:**
- Modal drawer — корректная работа при смене desktop/mobile (removed snapPoints, fixed height)
- Ben intro bubble — speech bubble для онбординга новых пользователей
- `useMediaQuery` — возвращает `null` во время SSR

---

## Архитектурные решения

| Вопрос | Решение | Причина |
|--------|---------|---------|
| Sidebar tabs UI | Вертикальные иконки слева | По образцу Claude.ai, удобнее |
| Settings без sidebar | Отдельный route group | Чистое разделение, меньше условий |
| Редирект `/` | Server-side в page.tsx | Проще, не нужен middleware |
| Header навигация | Home иконка + текст | Вместо логотипа Simply в header |

---

## Этапы реализации

### Фаза 1: Структура route groups (8 задач) ✅

**Цель:** Разделить layout-ы на "с sidebar" и "без sidebar".

#### Route groups:
- [x] **1.1** Создать `app/(dashboard)/layout.tsx` — layout без sidebar
- [x] **1.2** Создать `app/(dashboard)/page.tsx` — redirect на `/dashboard`
- [x] **1.3** Создать `app/(dashboard)/dashboard/page.tsx` — страница Dashboard
- [x] **1.4** Переместить `app/(chat)/settings/` → `app/(dashboard)/settings/`
- [x] **1.5** Обновить `app/(chat)/page.tsx` — redirect на `/dashboard`
- [x] **1.6** Создать общие провайдеры для обоих layout-ов

#### Настройка layout без sidebar:
- [x] **1.7** `app/(dashboard)/layout.tsx` с SWRProvider
- [x] **1.8** Settings работает без sidebar

---

### Фаза 2: Dashboard page (10 задач) ✅

**Цель:** Создать Dashboard с карточками инструментов.

#### Компоненты Dashboard:
- [x] **2.1** Создать `components/dashboard/index.ts` — экспорты
- [x] **2.2** Создать `components/dashboard/dashboard-header.tsx` — header для Dashboard
- [x] **2.3** Создать `components/dashboard/greeting.tsx` — приветствие с именем
- [x] **2.4** Создать `components/dashboard/tool-card.tsx` — карточка инструмента
- [x] **2.5** Создать `components/dashboard/tools-grid.tsx` — сетка карточек
- [x] **2.6** Создать `components/dashboard/ben-hint.tsx` — подсказка Бена

#### Интеграция:
- [x] **2.7** Обновить `app/(dashboard)/dashboard/page.tsx` — собрать компоненты
- [x] **2.8** Добавить карточку "Чат" (💬) — ведёт на `/chat`
- [x] **2.9** Добавить карточку "Проекты" (📁) — заблокирована, метка "Скоро"
- [x] **2.10** Стилизация: крупные карточки, hover эффекты

---

### Фаза 3: Sidebar с вкладками (12 задач) ✅

**Цель:** Переделать sidebar с вертикальными tabs (Search, Chats, Projects).

#### Компоненты:
- [x] **3.1** Создать `components/sidebar-tabs.tsx` — вертикальные иконки
- [x] **3.2** ~~Создать `components/sidebar-tab-content.tsx`~~ — не нужен, используем условный рендер
- [x] **3.3** Создать `components/sidebar-search.tsx` — Search tab (заглушка)
- [x] **3.4** ~~Создать `components/sidebar-chats.tsx`~~ — используем существующий SidebarHistory
- [x] **3.5** Создать `components/sidebar-projects.tsx` — Projects tab (заглушка "Скоро")

#### Интеграция в AppSidebar:
- [x] **3.6** Обновить `components/app-sidebar.tsx` — добавить tabs layout
- [x] **3.7** State для активной вкладки (default: 'chats')
- [x] **3.8** Переключение контента при клике на tab
- [x] **3.9** Tooltip на hover для каждой иконки

#### Стилизация:
- [x] **3.10** Ширина tabs полоски: ~48px
- [x] **3.11** Активный tab: подсветка фона
- [x] **3.12** Hover эффекты на иконках

**✅ РЕШЕНО:** `components/sidebar-layout.tsx` — табы рендерятся вне Sidebar, CSS variable `--sidebar-left-offset`

---

### Фаза 4: Header адаптация (6 задач) ✅

**Цель:** Адаптировать header под разные routes.

#### Dashboard Header:
- [x] **4.1** `components/dashboard/dashboard-header.tsx` с Simply, Ben, User menu

#### Chat Header:
- [x] **4.2** Обновить `components/chat-header.tsx`:
  - Home иконка → `/dashboard`
  - SidebarToggle
  - [📝] Prompt-agent trigger
  - [❓] Ben trigger

#### Навигация:
- [x] **4.3** Home везде ведёт на `/dashboard`
- [x] **4.4** [+ Новый чат] ведёт на `/chat`
- [x] **4.5** Модальные помощники работают (📝 ❓)
- [x] **4.6** User menu работает

---

### Фаза 5: Финальные правки (6 задач) ✅

**Цель:** Полировка, тестирование, документация.

#### Чистка:
- [x] **5.1** Удалить неиспользуемые импорты
- [x] **5.2** Удалить `components/sidebar-with-tabs.tsx` (не используется)
- [x] **5.3** TypeScript типы проверены

#### Адаптивность:
- [x] **5.4** Mobile: Dashboard корректно отображается
- [x] **5.5** Mobile: Sidebar открывается/закрывается
- [x] **5.6** Production build успешен

---

### Фаза 6: Тестирование (8 задач) ✅

- [x] **6.1** `npm run build` — без ошибок
- [x] **6.2** `npm run lint` — без ошибок
- [x] **6.3** Сценарий: Роутинг
- [x] **6.4** Сценарий: Dashboard
- [x] **6.5** Сценарий: Sidebar tabs
- [x] **6.6** Сценарий: Навигация
- [x] **6.7** Сценарий: Помощники — modal drawer responsive fix
- [x] **6.8** Сценарий: Chat работает

---

### Фаза 7: Документация (6 задач) ✅

- [x] **7.1** Обновить `SIMPLY_STATUS.md`
- [x] **7.2** Обновить `CHANGELOG.md`
- [x] **7.3** Обновить `CLAUDE.md`
- [x] **7.4** Проверить все docs/
- [x] **7.5** Переместить ТЗ в `_archive/`
- [x] **7.6** Git tag финальный

---

## Ключевые файлы

### Созданы ✅:

```
app/(dashboard)/
├── layout.tsx                    ✅
├── page.tsx                      ✅
├── dashboard/
│   └── page.tsx                  ✅
└── settings/
    └── page.tsx                  ✅ (перенесено)

components/dashboard/
├── index.ts                      ✅
├── dashboard-header.tsx          ✅
├── greeting.tsx                  ✅
├── tool-card.tsx                 ✅
├── tools-grid.tsx                ✅
└── ben-hint.tsx                  ✅

components/
├── sidebar-layout.tsx            ✅ NEW: Tabs вне Sidebar
├── sidebar-tabs.tsx              ✅
├── sidebar-search.tsx            ✅
└── sidebar-projects.tsx          ✅

components/modal-assistants/ben/
└── intro-bubble.tsx              ✅ NEW: Speech bubble для онбординга
```

### Изменены ✅:

```
app/(chat)/page.tsx               ✅ Redirect на /dashboard
app/(chat)/layout.tsx             ✅ Без settings
components/app-sidebar.tsx        ✅ Tabs layout внутри
components/chat-header.tsx        ✅ Home → /dashboard, Ben intro bubble
components/ui/sidebar.tsx         ✅ CSS variable --sidebar-left-offset
components/modal-assistants/assistant-drawer.tsx  ✅ Responsive fix
hooks/use-media-query.ts          ✅ Returns null during SSR
```

### Удалены:

```
components/sidebar-with-tabs.tsx  ✅ Удалён (неудачная попытка)
```

---

## Критерии готовности

### Must have:
- [x] `/` редиректит на `/dashboard`
- [x] `/dashboard` отображает карточки инструментов (без sidebar)
- [x] `/settings` без sidebar
- [x] `/chat` и `/chat/[id]` с sidebar
- [x] Sidebar с вертикальными tabs (Search, Chats, Projects)
- [x] Tab Chats показывает историю чатов
- [x] Tab Projects показывает заглушку "Скоро"
- [x] Карточка "Чат" ведёт на `/chat`
- [x] Карточка "Проекты" заблокирована
- [x] Home ведёт на `/dashboard`
- [x] Существующий функционал чата работает
- [x] Модальные помощники работают (responsive fix)
- [x] Production build успешен

### Блокеры:
- [x] **Табы остаются видимыми при сворачивании sidebar** — ✅ РЕШЕНО (sidebar-layout.tsx)

### Nice to have:
- [ ] Поиск по чатам работает (не заглушка) — отложено на ТЗ-03
- [x] Анимация переключения tabs
- [x] Подсказка Бена контекстная (для новых пользователей) — intro-bubble.tsx

---

**Создано:** 2026-02-02
**Обновлено:** 2026-02-02
**Статус:** ✅ ЗАВЕРШЁН
