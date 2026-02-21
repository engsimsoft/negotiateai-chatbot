# Roadmap ТЗ-BF1: BriefingUIRefactor

**Создан:** 2026-02-21
**Версия проекта:** 3.38.0 → 3.39.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 5 ✅ |
| Сессий (оценка) | 2-3 |

**Скоуп (после анализа):**
- ~~Пункт 1 (Fixed sidebar)~~ — уже реализован, пропускаем
- ~~Пункт 2 (Аудит цветов)~~ — уже чисто (grep = 0), пропускаем
- Пункт 3 (savedBriefingTopics) — новая таблица + миграция
- Пункт 4 (TTL) — удаление старых брифингов при генерации
- Пункт 5 (UI закладка) — Bookmark на секциях + API
- Пункт 6 (Sidebar рефакторинг) — новая структура + просмотр сохранённых тем
- Удаление маршрута `/briefing/[date]` — согласовано с архитектором

---

## Этап 1: БД + API (savedBriefingTopics + TTL)

**Статус:** ✅ Завершён

**Цель:** Создать таблицу savedBriefingTopics, CRUD-запросы, API endpoints, TTL-логику удаления старых брифингов.

**Задачи:**
- [x] Добавить таблицу `savedBriefingTopics` в `lib/db/schema.ts` (схема из ТЗ, `briefingDate` → `briefingGeneratedAt: timestamp`)
- [x] Создать миграцию `0035_saved-briefing-topics.sql` (вручную, drizzle-kit interactive не работает в CLI)
- [x] Применить миграцию `npx drizzle-kit push --force`
- [x] Добавить CRUD-запросы в `lib/db/queries.ts`:
  - `saveBriefingTopic({ userId, topicId, topicName, emoji, title, content, sources, briefingGeneratedAt })`
  - `getSavedBriefingTopics({ userId })` — sorted by savedAt desc
  - `deleteSavedBriefingTopic({ id, userId })` — с проверкой владельца
- [x] Добавить query `deleteOldBriefingHistory({ userId })` — DELETE all briefingHistory WHERE userId = ?
- [x] Создать API `app/(chat)/api/briefing/topics/save/route.ts`:
  - POST — сохранить тему (body: topicId, topicName, emoji, title, content, sources, briefingGeneratedAt)
  - DELETE — удалить тему (?id=xxx)
- [x] Создать API `app/(chat)/api/briefing/topics/saved/route.ts`:
  - GET — список сохранённых тем пользователя
- [x] Добавить TTL-логику в `app/(chat)/api/briefing/generate/route.ts`:
  - Перед Step 1 (`saveBriefingHistory({status: "generating"})`) — вызвать `deleteOldBriefingHistory({ userId })`
- [x] Добавить тип `SavedBriefingTopicClient` в `lib/briefing/briefing-types.ts` (client-safe)

**Файлы:**
- `lib/db/schema.ts` — + таблица savedBriefingTopics
- `lib/db/queries.ts` — + 4 новых query (saveBriefingTopic, getSavedBriefingTopics, deleteSavedBriefingTopic, deleteOldBriefingHistory)
- `lib/briefing/briefing-types.ts` — + тип SavedBriefingTopic
- `app/(chat)/api/briefing/topics/save/route.ts` — **новый** (POST/DELETE)
- `app/(chat)/api/briefing/topics/saved/route.ts` — **новый** (GET)
- `app/(chat)/api/briefing/generate/route.ts` — + TTL delete
- `drizzle/XXXX_migration.sql` — миграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: `SELECT COUNT(*) FROM "SavedBriefingTopics"` — таблица существует (0 rows)
- [x] API routes отвечают (307 auth redirect — корректно)
- [x] 🧪 Мануальный тест: /briefing работает без изменений — ОК

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts lib/briefing/briefing-types.ts app/(chat)/api/briefing/topics/ app/(chat)/api/briefing/generate/route.ts drizzle/
git commit -m "feat(tz-bf1): savedBriefingTopics table + CRUD API + TTL logic"
```

**Критерий готовности:** Таблица в БД, API работают, при генерации старые брифинги удаляются.

---

## Этап 2: UI закладка на секциях

**Статус:** ✅ Завершён

**Цель:** Кнопка Bookmark на каждой секции статьи. Клик → сохранить/удалить тему. Toast уведомления.

**Задачи:**
- [x] Загрузить saved topics при открытии страницы брифинга (server component → Promise.all)
- [x] Добавить кнопку `Bookmark` (lucide-react) в `ArticleSection` (`briefing-article-view.tsx`):
  - Расположение: правая часть заголовка `<h2>`, рядом с emoji + topicName
  - Состояние: outline (не сохранено) / fill-primary (сохранено)
  - Match: по `topicId` из массива saved topics
- [x] Обработчик клика:
  - Не сохранено → POST `/api/briefing/topics/save` → добавить в локальный state → toast «Тема сохранена»
  - Сохранено → DELETE `/api/briefing/topics/save?id=xxx` → убрать из state → toast «Тема удалена»
- [x] Прокинуть savedTopics state через `BriefingIssueContent` → `BriefingArticleView` → `ArticleSection`

**Файлы:**
- `components/briefing/briefing-article-view.tsx` — + Bookmark кнопка в ArticleSection
- `components/briefing/briefing-issue-content.tsx` — + savedTopics state, fetch, прокидывание
- `app/(dashboard)/briefing/page.tsx` — + загрузка saved topics (server-side)

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: иконка Bookmark видна на каждой секции
- [x] Браузер: клик → toast + иконка меняется
- [x] Браузер: перезагрузка → сохранённые темы помечены
- [x] 🧪 Мануальный тест пользователем — подтверждён

**Git (после валидации):**
```bash
git add components/briefing/briefing-article-view.tsx components/briefing/briefing-issue-content.tsx app/(dashboard)/briefing/page.tsx
git commit -m "feat(tz-bf1): bookmark button on briefing sections"
```

**Критерий готовности:** Закладка работает end-to-end (save/delete/persist/display).

---

## Этап 3: Рефакторинг sidebar + просмотр сохранённых тем + удаление [date]

**Статус:** ✅ Завершён

**Цель:** Новая структура sidebar (ТЕКУЩИЙ ВЫПУСК + СОХРАНЁННЫЕ). Клик по сохранённой теме → main area показывает содержимое. Удаление мёртвого маршрута [date].

**Задачи:**
- [x] Рефакторинг `SidebarContent` в `briefing-sidebar.tsx`:
  - Заменить «Сегодня» → «Текущий выпуск»
  - Убрать секцию «Прошлые выпуски» (удалить history prop)
  - Добавить секцию «Сохранённые» (показывать только если есть): emoji + title (truncate) + дата «21 фев»
  - У каждой сохранённой темы — иконка ✕ для удаления
- [x] Прокинуть `savedTopics` в `BriefingSidebar` и `BriefingSidebarMobile`
- [x] Добавить callback `onSelectSavedTopic(topic)` — при клике по сохранённой теме
- [x] Lift savedTopics + selectedSavedTopic state to `BriefingPageClient` (shared desktop + mobile)
- [x] В `BriefingIssueContent` — получает `selectedSavedTopic` через props:
  - Если null → показывать `BriefingArticleView` (текущий выпуск) как обычно
  - Если заполнен → показывать `SavedTopicView` (заменяет main area)
- [x] Создать компонент `SavedTopicView` в `briefing-article-view.tsx`:
  - Кнопка «← Назад к выпуску» (сбрасывает selectedSavedTopic)
  - Рендер: emoji + topicName + заголовок
  - MarkdownViewer для content
  - Sources (collapsible)
  - Кнопка «Удалить из сохранённых»
- [x] Добавить confirm при «Сгенерировать» (AlertDialog):
  - Текст: «Текущий брифинг будет заменён. Сохранённые темы останутся.»
  - Отмена / Сгенерировать
  - Только если hasArticle=true (нет confirm для пустого состояния)
- [x] Обновить типы `BriefingSidebarProps` — убрать history, добавить savedTopics + onSelectSavedTopic + onDeleteSavedTopic + hasArticle
- [x] Удалить маршрут `app/(dashboard)/briefing/[date]/page.tsx` (мёртвый из-за TTL + нет ссылок)
- [x] Удалить `getBriefingByDate` из `lib/db/queries.ts` (больше нигде не используется)
- [x] Убрать history loading из `app/(dashboard)/briefing/page.tsx` (limit 10 → 1)
- [x] Убрать `historyItems`, `currentDate` props из `BriefingPageClient`

**Файлы:**
- `components/briefing/briefing-sidebar.tsx` — рефакторинг SidebarContent, новые props, AlertDialog
- `components/briefing/briefing-article-view.tsx` — + SavedTopicView компонент
- `components/briefing/briefing-issue-content.tsx` — упрощён (selectedSavedTopic через props, SavedTopicView)
- `components/briefing/briefing-page-client.tsx` — lift savedTopics state, убраны history props
- `app/(dashboard)/briefing/page.tsx` — убрана загрузка history, limit 1
- `app/(dashboard)/briefing/[date]/page.tsx` — **удалён**
- `lib/db/queries.ts` — удалён `getBriefingByDate`

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: sidebar показывает «Текущий выпуск» + «Сохранённые»
- [ ] Браузер: клик по сохранённой теме → main area заменяется
- [ ] Браузер: «← Назад к выпуску» → возврат
- [ ] Браузер: удаление из sidebar работает (✕)
- [ ] Браузер: «Сгенерировать» → confirm dialog
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/briefing/ app/(dashboard)/briefing/ lib/db/queries.ts
git commit -m "feat(tz-bf1): sidebar refactor + saved topics view + remove [date] route"
```

**Критерий готовности:** Sidebar показывает новую структуру, просмотр сохранённых тем работает, confirm при генерации, [date] маршрут удалён.

---

## Этап 4: Очистка (merged into Этап 3)

**Статус:** ✅ Объединён с Этапом 3

Все задачи Этапа 4 были выполнены в рамках Этапа 3:
- [x] Удалить `app/(dashboard)/briefing/[date]/page.tsx` — ✅ (Этап 3)
- [x] Удалить `getBriefingByDate` из `lib/db/queries.ts` — ✅ (Этап 3)
- [x] Убрать `historyItems`/`currentDate` props из `BriefingPageClient` — ✅ (Этап 3)
- [x] `BriefingHistoryItem` — помечен @deprecated в sidebar, используется только в документации

---

## Этап 5: Финализация

**Статус:** ✅ Завершён

**Цель:** Документация, версия, архив.

**Задачи:**
- [x] ⛔ Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — чеклист
- [x] Финальное мануальное тестирование (пользователь): полный flow — подтверждено
- [x] SQL проверка БД:
  - `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;` — ✅ SavedBriefingTopics присутствует
  - `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'SavedBriefingTopics';` — ✅ 10 колонок
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (структура кода — новые файлы, убрать [date])
- [x] Обновить `package.json` → 3.39.0
- [x] Обновить `docs/architecture.md` (новая таблица SavedBriefingTopics)
- [x] ⛔ Верификация docs против кода (Правило 5):
  - `CLAUDE.md` → пути файлов актуальны (убран briefing/[date], добавлены topics/save, topics/saved)
  - `docs/design-system.md` → карта страниц (убран /briefing/[date])
- [x] `npm run build` — успешен (после очистки .next cache)
- [x] Переместить `specs/TZ_BF1_BriefingUIRefactor/` → `_archive/`

**Валидация этапа:**
- [x] `npm run build` — успешен
- [x] Документация актуальна и верифицирована
- [x] Все функции работают в браузере (подтверждено пользователем)

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-bf1): finalize v3.39.0 — BriefingUIRefactor"
```

**Критерий готовности:** Документация обновлена, тесты пройдены, ТЗ в архиве.
