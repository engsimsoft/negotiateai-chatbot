# Анализ ТЗ-А4: Страница выпуска брифинга

## Резюме

Заменить минимальный `BriefingActivePage` (из А3) полноценной страницей чтения: sidebar с навигацией по секциям + история выпусков, центральная область со статьёй (markdown + collapsible sources), заглушка плеера, новый маршрут `/briefing/[date]`.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Общая архитектура** — sidebar + article layout, два маршрута, shared компоненты. Чисто и логично.
- **`getBriefingByDate` query** — нужен, текущий `getBriefingHistory` не фильтрует по дате.
- **Collapsible sources** — правильное решение. Компонент `components/ui/collapsible.tsx` уже есть (shadcn/ui). Используем его.
- **IntersectionObserver для scroll spy** — стандартный паттерн, проблем не вижу.
- **Заглушка плеера** — простой компонент, ОК.
- **Маршрут `/briefing/[date]`** — логичная структура.

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|---------------------|
| 1 | "Удалить `BriefingHeader`" | **НЕ удалять, а модифицировать** или создать новый `BriefingIssueHeader`. `BriefingHeader` импортируется в `briefing-page.tsx` (лендинг, строка 4) И в `briefing-active-page.tsx`. ТЗ говорит "Что НЕ трогать: Лендинг" — но удаление `BriefingHeader` сломает лендинг. | `components/briefing/briefing-page.tsx:4` — `import { BriefingHeader }` |
| 2 | "Удалить `BriefingActivePage`" | **Не удалять сразу, а извлечь код.** Внутри есть готовые `ArticleSection`, `SourceCard`, `NoBriefingsYet` — ~100 строк рабочего кода. Рекомендую: вынести `SourceCard` → `briefing-source-card.tsx`, остальное переиспользовать в `BriefingArticleView`. После этого `BriefingActivePage` можно удалить. | `components/briefing/briefing-active-page.tsx:113-216` |
| 3 | "Markdown → React. Нужен рендерер" | **`MarkdownViewer` уже есть и настроен.** Файл `components/markdown-viewer.tsx` — обёртка над `react-markdown` + `remark-gfm` с полной стилизацией (prose, dark mode, все элементы). `BriefingActivePage` уже его использует (строка 125). Ничего нового добавлять не нужно. | `components/markdown-viewer.tsx`, `briefing-active-page.tsx:125` |
| 4 | "ListDetailPage" не упоминается, но wireframe похож | **НЕ использовать `ListDetailPage`.** Его API (itemCount, createButton, emptyState) заточен под list+detail (чаты, проекты). Briefing — это sidebar-навигация + article-reader. Другой UX-паттерн. Нужен custom layout (аналог `ProjectPageLayout`). | `components/list-detail/list-detail-page.tsx:22-42` — props несовместимы |
| 5 | ТЗ не упоминает timezone в `getBriefingByDate` | **Добавить timezone-aware фильтрацию.** `briefingHistory.generatedAt` — это `timestamp` (не date). Фильтр по дате `YYYY-MM-DD` нуждается в timezone — иначе выпуск, сгенерированный в 23:30 MSK, может попасть в "следующий день" в UTC. У пользователя есть `briefingSettings.timezone`. | `lib/db/schema.ts:462` — `generatedAt: timestamp("generatedAt")` |

### ❓ Решено (ответы архитектора 2026-02-20)

1. **Множественные выпуски за один день** → Показывать последний (`ORDER BY generatedAt DESC LIMIT 1`).

2. **Повторная генерация** → Разрешена. Создаётся новая запись, показывается последняя. Кнопку поставить в sidebar внизу, рядом с "Настройки" (НЕ в header).

3. **Responsive** → Sheet (паттерн из `RightSidebar`, `ManagerDrawer`). На мобильных без навигации выпуск неполноценный.

4. **Header** → Показывать `article.title` напрямую. Автор генерирует правильный формат, не дублируем логику.

5. **История** → 10 — финальное значение, без пагинации. Архив — задача для Фазы В.

---

## Потенциальные риски

- **Scroll spy + sticky header + sticky player placeholder** — три sticky-элемента на странице. IntersectionObserver `rootMargin` нужно калибровать с учётом суммарной высоты всех sticky-элементов (header 56px + player ~60px = ~116px offset). Иначе active-state в sidebar будет "прыгать".
- **Тип `briefingJson`** — в БД хранится как `jsonb`, в коде кастуется `as unknown as BriefingArticle` без валидации (`briefing-active-page.tsx:54`). Если формат изменится, сломается молча. Уже есть guard на `!article?.sections`, но рекомендую Zod-валидацию (схема `briefingArticleSchema` в `briefing-author.ts` уже существует).
- **SEO / performance** — статья рендерится на клиенте. Для SEO лучше SSR (Server Component). Но это не критично для dashboard-приложения за авторизацией.

---

## Зависимости

- **Компоненты:** `MarkdownViewer`, `UserMenu`, `Collapsible` (shadcn/ui) — всё в наличии.
- **DB query:** Новый `getBriefingByDate` — простое дополнение к `queries.ts`.
- **Пакеты:** Ничего нового не нужно. `react-markdown` ^10.1.0, `remark-gfm` ^4.0.1 уже установлены.
- **Типы:** `BriefingArticle`, `BriefingArticleSection`, `BriefingArticleSource`, `BriefingArticleMeta` — все в `lib/briefing/briefing-types.ts`.

---

## Оценка сложности

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Вся инфраструктура готова (типы, queries, markdown, collapsible). Основная работа — новые UI-компоненты + маршрут. Нет сложной бизнес-логики, нет новых API. ~80% кода — React-компоненты + CSS.
