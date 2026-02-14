# Simply Design System — ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ

> Этот файл — единственный источник правды для визуального стиля Simply.
> Любой новый компонент, страница или модификация UI ОБЯЗАНЫ следовать этим правилам.
> Нарушение = баг.

---

## 1. Структура интерфейса

### 1.1 Layout Groups (Route Groups)

Приложение разделено на 4 route group, каждая со своим layout:

| Route Group | Layout файл | Назначение |
|-------------|-------------|------------|
| `(auth)` | — | Login, Register. Публичные страницы, без навигации |
| `(chat)` | `app/(chat)/layout.tsx` | Чаты. Sidebar с историей + user menu в footer |
| `(dashboard)` | `app/(dashboard)/layout.tsx` | Главная, проекты, настройки. Каждая страница — свой header |
| `(task)` | `app/(task)/layout.tsx` | Работа над задачей (Expert Chat). TaskSidebar слева |

### 1.2 Карта страниц и навигации

```
Root Layout (app/layout.tsx)
├── ThemeProvider + SessionProvider + Toaster
│
├── (auth) — БЕЗ навигации
│   ├── /login
│   └── /register
│
├── (chat) — AppSidebar (SidebarLayout)
│   │   Sidebar: SidebarHistory + SidebarUserNav (footer)
│   │   User Menu: ✅ (SidebarUserNav — avatar + dropdown)
│   │   Theme Toggle: ✅ (в dropdown SidebarUserNav)
│   │
│   ├── / → redirect → /dashboard
│   ├── /chat → новый чат
│   ├── /chat/[id] → существующий чат
│   ├── /projects/[id]/chat → чат проекта
│   ├── /projects/[id]/chat/[chatId] → чат проекта
│   └── /helpers/[id]/* → чаты помощника
│
├── (dashboard) — БЕЗ глобального sidebar
│   │   Каждая страница сама отвечает за свой header
│   │
│   ├── /dashboard → GlavnayaHeader
│   │   User Menu: ✅ (GlavnayaHeader — avatar + dropdown + Ben)
│   │   Theme Toggle: ✅ (в dropdown GlavnayaHeader)
│   │
│   ├── /settings → свой header (← Dashboard + "Настройки")
│   │   User Menu: ❌   Theme Toggle: ❌ (есть секция "Внешний вид")
│   │
│   ├── /projects → свой header (← Dashboard + "Проекты" + кнопка "Создать")
│   │   User Menu: ❌   Theme Toggle: ❌
│   │
│   ├── /projects/[id] → ProjectPageLayout (breadcrumbs + кнопка "Менеджер")
│   │   User Menu: ❌   Theme Toggle: ❌
│   │
│   ├── /chats → свой header
│   │   User Menu: ❌   Theme Toggle: ❌
│   │
│   └── /projects/new → создание проекта
│       User Menu: ❌   Theme Toggle: ❌
│
└── (task) — БЕЗ глобального sidebar
    │   SidebarProvider только для контекста Artifact
    │
    └── /projects/[id]/tasks/[taskId] → TaskSidebar + TaskChat
        User Menu: ❌   Theme Toggle: ❌
```

### 1.3 Существующие компоненты навигации

ЗАПРЕЩЕНО создавать новые компоненты навигации без анализа существующих.

| Компонент | Где используется | Что содержит |
|-----------|-----------------|--------------|
| `GlavnayaHeader` | `/dashboard` | Logo, Ben (?), User avatar + dropdown (Настройки, Тема, Выйти) |
| `SidebarUserNav` | `(chat)` sidebar footer | Avatar + dropdown (Настройки, Тема, Помощь, Выйти) |
| `AppSidebar` | `(chat)` layout | Logo, чат-история, SidebarUserNav |
| `TaskSidebar` | `(task)` страницы | Список задач проекта, навигация между задачами |
| `ProjectPageLayout` | `/projects/[id]` | Header (breadcrumbs + Менеджер), Pulse + WorkArea |

**Важно:** User dropdown с темой переключения уже реализован в двух компонентах:
1. `GlavnayaHeader` — для страницы /dashboard
2. `SidebarUserNav` — для чат-страниц с sidebar

При добавлении user menu на новые страницы — переиспользовать существующие компоненты или их паттерн.

### 1.4 Паттерн Header

Все страницы (dashboard) используют единый паттерн header:

```
sticky top-0 z-10|z-50  h-14  items-center  border-b  bg-background  px-4 lg:px-6|lg:px-8
```

- Слева: навигация назад (← + название родителя) + заголовок страницы
- Справа: действия страницы (кнопки, user menu)
- Высота: всегда `h-14`

---

## 2. Цвета

ЗАПРЕЩЕНО использовать:
- Любые хардкоженные hex-цвета (#fff, #333, #f5f5f5 и т.д.)
- Tailwind цвета напрямую: gray-*, slate-*, zinc-*, stone-*, neutral-*, blue-*, red-*, green-*
- Любые цвета, которых нет в списке ниже

ОБЯЗАТЕЛЬНО использовать ТОЛЬКО семантические токены:
- Фоны: bg-background, bg-card, bg-muted, bg-accent, bg-primary, bg-secondary, bg-destructive
- Текст: text-foreground, text-muted-foreground, text-card-foreground, text-primary-foreground
- Границы: border-border, border-input
- Фокус: ring-ring
- Статусы: text-success, text-warning, text-info, bg-success/10, bg-warning/10, bg-info/10

### Исключения (намеренные цвета)

Некоторые цвета используются осознанно и НЕ являются нарушением:

| Цвет | Где | Почему |
|------|-----|--------|
| `text-green-600` | StatusIcon (done) | Статус завершения задачи |
| `text-amber-600` | StatusIcon (issues) | Статус с замечаниями |
| `bg-black/50`, `bg-black/80` | Lightbox overlay | Стандартный оверлей для модалок поверх контента |
| `text-white` | Lightbox controls | Контролы поверх чёрного оверлея |
| Градиенты в `weather.tsx` | Виджет погоды | Тематические градиенты (sky, indigo, orange) |

---

## 3. Шрифты

- Заголовки страниц и секций (h1, h2): `font-serif` (Lora)
- Весь остальной UI: `font-sans` (Source Sans 3) — это дефолт, указывать не нужно
- Код: `font-mono` (JetBrains Mono)

Подключены через `app/fonts.ts` → CSS-переменные на `<html>`.

ЗАПРЕЩЕНО:
- Подключать другие шрифты
- Использовать font-family напрямую в style={{}}

---

## 4. Типографика

| Элемент | Класс | Weight |
|---------|-------|--------|
| Заголовок страницы | font-serif text-2xl font-semibold | 600 |
| Заголовок секции | font-serif text-xl font-semibold | 600 |
| Заголовок карточки | text-lg font-semibold | 600 |
| Основной текст | text-base | 400 |
| UI labels | text-sm font-medium | 500 |
| Мелкий текст | text-xs | 400 |
| Код | font-mono text-sm | 400 |

---

## 5. Hover-паттерны

Установлены два паттерна hover. Использовать ТОЛЬКО их:

### Паттерн A: Карточки с рамкой (border)

```
hover:border-primary hover:shadow-sm transition-all
```

Используется для кликабельных карточек, у которых уже есть `border`:
- `project-card.tsx` — карточки проектов на /dashboard
- `execution-state.tsx` — карточки задач в рабочей области
- `approved-state.tsx` — карточки задач после утверждения плана

### Паттерн B: Inline-элементы без рамки (sidebar/list)

```
rounded-lg hover:bg-muted/60 transition-all duration-150
```

Используется для элементов списков без собственной рамки:
- `task-sidebar.tsx` — задачи в боковой панели
- `project-pulse.tsx` — задачи в навигации Пульса

ЗАПРЕЩЕНО:
- Использовать `hover:bg-muted/50` (слишком слабый, не видно)
- Смешивать паттерны (border-hover на inline, bg-hover на карточках)

---

## 6. Тени

ТОЛЬКО эти тени (определены в globals.css):
- shadow-sm, shadow-md, shadow-lg, shadow-card

ЗАПРЕЩЕНО: Произвольные shadow-[...] значения.

---

## 7. Радиусы

Использовать стандартные: rounded-sm, rounded-md, rounded-lg, rounded-xl.
Базовый --radius: 0.625rem.

---

## 8. Статусы задач

| Статус | Фон | Текст | Иконка |
|--------|-----|-------|--------|
| pending | bg-muted | text-muted-foreground | Circle |
| in_progress | bg-info/10 | text-primary | Loader2 animate-spin |
| done | bg-success/10 | text-green-600 | Check |
| locked | bg-muted | text-muted-foreground/50 | Lock |
| review | bg-warning/10 | text-primary/70 | Brain |
| issues | — | text-amber-600 | AlertTriangle |
| error | bg-destructive/10 | text-destructive | AlertCircle |

---

## 9. Отступы карточек

- Карточки: p-4 или p-6 (выбрать один и придерживаться в контексте)
- Между секциями: space-y-4 или gap-4
- Внутри секций: space-y-2 или gap-2

---

## 10. Dark Mode

Каждый компонент ОБЯЗАН корректно работать в dark mode.
Не использовать bg-white — использовать bg-card.
Не использовать text-black — использовать text-foreground.

Палитра:
- Light: background `#FAF9F5` (тёплый крем), primary `#C97B5D` (терракот)
- Dark: background `#1C1B19` (тёплый тёмный), primary `#D4885F` (терракот ярче)

---

## 11. Правила при создании новых компонентов

1. **Не создавать дубликаты.** Перед созданием нового компонента — проверить, нет ли существующего с аналогичной функциональностью (см. раздел 1.3).
2. **Не добавлять фиксированные элементы (fixed/absolute) без анализа всех layout-ов.** Проверить, что элемент не конфликтует с существующей навигацией на ВСЕХ страницах, где он будет виден.
3. **Следовать паттерну header** (раздел 1.4) для всех страниц в группе (dashboard).
4. **Все цвета — через токены** (раздел 2). Без исключений.
5. **Hover — один из двух паттернов** (раздел 5). Без исключений.

---

## 12. Проверка перед коммитом

Перед завершением работы выполнить:
```bash
grep -rn "bg-gray\|text-gray\|border-gray\|bg-slate\|bg-zinc\|bg-stone\|bg-neutral\|bg-white\|text-black" --include="*.tsx" --include="*.ts" | grep -v "node_modules\|components/ui/"
```

Результат должен быть ПУСТЫМ (0 строк).
