# Roadmap ТЗ-А4: Страница выпуска брифинга

**Создан:** 2026-02-20
**Версия проекта:** 3.31.0 → 3.32.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 (3 разработка + финализация) |
| Текущий этап | 3 |
| Сессий (оценка) | 1-2 |

---

## Принятые решения (из ANALYSIS.md)

| # | Решение |
|---|---------|
| 1 | `BriefingHeader` НЕ удалять — лендинг зависит. Создать новый `BriefingIssueHeader` |
| 2 | Извлечь `SourceCard`, `ArticleSection` из `BriefingActivePage` → переиспользовать |
| 3 | `MarkdownViewer` + `Collapsible` (shadcn) — уже в проекте |
| 4 | `getBriefingByDate` — timezone-aware фильтр (диапазон дат по timezone из settings, fallback `Europe/Moscow`) |
| 5 | Множественные выпуски за день → показывать последний |
| 6 | Повторная генерация разрешена, кнопка в sidebar (НЕ header) |
| 7 | Responsive → Sheet для sidebar на мобильных |
| 8 | Header → `article.title` напрямую |
| 9 | История → limit 10, без пагинации |
| 10 | `ListDetailPage` НЕ использовать — другой UX-паттерн |

---

## Этап 1: Article View — компоненты центральной области

**Статус:** ✅ Завершён

**Цель:** Все компоненты для отображения статьи готовы. Можно проверить на `/briefing` без sidebar.

**Задачи:**
- [x] Создать `components/briefing/briefing-issue-header.tsx` — header с `article.title`, кнопкой ⚙️ → `/briefing/setup`, кнопкой ← Dashboard, `UserMenu`
- [x] Создать `components/briefing/briefing-player-placeholder.tsx` — sticky заглушка плеера ("Скоро: аудиоподкаст")
- [x] Создать `components/briefing/briefing-source-card.tsx` — карточка источника (извлечь из `BriefingActivePage:146-171`, добавить tier badge на русском)
- [x] Создать `components/briefing/briefing-article-view.tsx` — рендер статьи: intro, sections с `MarkdownViewer` + `Collapsible` sources, outro, meta. Каждая секция с `id={section.topicId}` для скролла
- [x] Интегрировать в `/briefing/page.tsx` — заменить `<BriefingActivePage>` на новые компоненты (пока без sidebar, только article view на полную ширину)

**Файлы:**
- `components/briefing/briefing-issue-header.tsx` — **НОВЫЙ**
- `components/briefing/briefing-player-placeholder.tsx` — **НОВЫЙ**
- `components/briefing/briefing-source-card.tsx` — **НОВЫЙ** (из BriefingActivePage)
- `components/briefing/briefing-article-view.tsx` — **НОВЫЙ**
- `app/(dashboard)/briefing/page.tsx` — **ИЗМЕНИТЬ** (подключить новые компоненты)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер `/briefing`: header с title и ⚙️, заглушка плеера, статья с collapsible sources, meta
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/briefing/briefing-issue-header.tsx components/briefing/briefing-player-placeholder.tsx components/briefing/briefing-source-card.tsx components/briefing/briefing-article-view.tsx app/\(dashboard\)/briefing/page.tsx
git commit -m "feat(tz-a4): article view components — header, player placeholder, source card, article view"
```

**Критерий готовности:** `/briefing` показывает статью с новым header, collapsible sources, player placeholder.

---

## Этап 2: Sidebar + Layout

**Статус:** ✅ Завершён

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

**Цель:** Sidebar с навигацией по темам + история выпусков. Двухколоночный layout. Responsive Sheet.

**Задачи:**
- [x] Добавить `getBriefingByDate({ userId, date, timezone? })` в `lib/db/queries.ts` — timezone-aware фильтр по диапазону дат, fallback `Europe/Moscow`, `ORDER BY generatedAt DESC LIMIT 1`
- [x] Создать `components/briefing/briefing-sidebar.tsx`:
  - Блок "Сегодня": "Полный брифинг" (скролл в начало) + список тем `{emoji} {topicName}` с active state
  - Блок "Прошлые выпуски": список дат → ссылки `/briefing/[date]`, текущий подсвечен
  - Внизу: кнопка "Сгенерировать" + ссылка "Настройки" → `/briefing/setup`
- [x] Создать layout-обёртку: sidebar (w-64, hidden на mobile) + article area (flex-1, scroll)
- [x] Responsive: Sheet для sidebar на мобильных (гамбургер-кнопка в header)
- [x] Обновить `/briefing/page.tsx` — загружать history (limit: 10), передать в sidebar

**Файлы:**
- `lib/db/queries.ts` — **ИЗМЕНИТЬ** (+`getBriefingByDate`)
- `components/briefing/briefing-sidebar.tsx` — **НОВЫЙ**
- `app/(dashboard)/briefing/page.tsx` — **ИЗМЕНИТЬ** (layout + sidebar + history)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер `/briefing`: sidebar слева с темами + история, article справа
- [ ] Клик по теме в sidebar — smooth scroll к секции
- [ ] Mobile: sidebar скрыт, доступен через Sheet
- [ ] Кнопка "Сгенерировать" в sidebar работает
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/db/queries.ts components/briefing/briefing-sidebar.tsx app/\(dashboard\)/briefing/page.tsx
git commit -m "feat(tz-a4): briefing sidebar — topic nav, history, generate, responsive sheet"
```

**Критерий готовности:** Двухколоночный layout работает, sidebar навигирует по секциям, история отображается, mobile Sheet работает.

---

## Этап 3: Маршрут `/briefing/[date]` + Scroll spy + Cleanup

**Статус:** ✅ Завершён

**Цель:** Новый маршрут для конкретного выпуска, scroll spy для active state в sidebar, удаление устаревшего кода.

**Задачи:**
- [x] Создать `app/(dashboard)/briefing/[date]/page.tsx` — Server Component: auth, парсинг `date` (YYYY-MM-DD), `getBriefingByDate`, 404/redirect если нет выпуска, рендер тех же компонентов что и `/briefing`
- [x] Добавить IntersectionObserver scroll spy: секции с `id={topicId}` обновляют active state в sidebar. `rootMargin` с учётом header (56px) + player placeholder (~60px)
- [x] Удалить `components/briefing/briefing-active-page.tsx` — полностью заменён новыми компонентами
- [x] Проверить: лендинг (`BriefingPage` + `BriefingHeader`) работает без изменений

**Файлы:**
- `app/(dashboard)/briefing/[date]/page.tsx` — **НОВЫЙ**
- `components/briefing/briefing-issue-content.tsx` — **НОВЫЙ** (клиентская обёртка с activeSectionId state)
- `components/briefing/briefing-article-view.tsx` — **ИЗМЕНИТЬ** (добавить IntersectionObserver callback)
- `app/(dashboard)/briefing/page.tsx` — **ИЗМЕНИТЬ** (использовать BriefingIssueContent)
- `components/briefing/briefing-active-page.tsx` — **УДАЛИТЬ**

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер `/briefing/[date]` (с реальной датой): показывает конкретный выпуск
- [ ] Браузер `/briefing/2099-01-01` (несуществующая дата): redirect на `/briefing`
- [ ] Scroll spy: при скролле активная тема в sidebar обновляется
- [ ] Лендинг `/briefing` (для юзера без профиля): работает без изменений
- [ ] Нет битых импортов (удалённый `BriefingActivePage`)
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/\(dashboard\)/briefing/\[date\]/page.tsx components/briefing/briefing-article-view.tsx components/briefing/briefing-sidebar.tsx
git rm components/briefing/briefing-active-page.tsx
git commit -m "feat(tz-a4): date route, scroll spy, cleanup BriefingActivePage"
```

**Критерий готовности:** `/briefing/[date]` работает, scroll spy работает, старый код удалён, лендинг не сломан.

---

## Этап 4: Финализация

**Статус:** ✅ Завершён

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь)
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (новые компоненты, маршруты)
- [x] Обновить `docs/design-system.md` (карта страниц — `/briefing/[date]`)
- [x] Обновить `package.json` (версия 3.32.0)
- [ ] Переместить `specs/TZ_A4_BriefingIssuePage/` → `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Все функции работают в браузере
- [x] Документация актуальна

**Git (после валидации):**
```bash
git commit -m "docs(tz-a4): finalize v3.32.0 — briefing issue page"
```

```bash
git add _archive/TZ_A4_BriefingIssuePage/
git commit -m "chore(tz-a4): archive completed spec → _archive/"
```
