# Roadmap ТЗ-BF2: SimplyNews

**Создан:** 2026-02-21
**Версия проекта:** 3.39.0 → 3.40.0
**Статус:** ✅ Завершён

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 5 (завершён) |
| Сессий (оценка) | 1 |

**Принятые решения (из ANALYSIS.md):**
- `lastSeenSimplyVersion` → таблица `User` (не `briefingSettings`)
- Regex-парсер frontmatter (без `gray-matter`)
- Инъекция = `BriefingArticleSection` (не raw markdown)
- `SimplyContentView` по паттерну `SavedTopicView`
- Неактивные пользователи видят simply-news на лендинге (вариант A)
- Убран кейс "нет тем → только simply-news" (не усложняем pipeline)

---

## Этап 1: Контент-файлы + утилиты + миграция

**Статус:** ✅ Готово

**Цель:** Создать markdown-файлы с контентом, утилиту чтения/парсинга frontmatter, добавить поле `lastSeenSimplyVersion` в таблицу `User`.

**Задачи:**
- [x] Переместить `specs/TZ_BF2_SimplyNews/simply-overview.md` → `lib/briefing/simply-overview.md`
- [x] Создать `lib/briefing/simply-news.md` — начальный контент с frontmatter (version: "3.39.0", hasUpdate: true, title, date)
- [x] Создать `lib/briefing/simply-news-utils.ts`:
  - `parseSimplyNewsFrontmatter(raw: string)` → `{ version, date, hasUpdate, title }`
  - `getSimplyNewsData()` → `{ meta, content }` (читает файл, парсит frontmatter, возвращает metadata + markdown body)
  - `getSimplyOverviewContent()` → `string` (читает simply-overview.md)
- [x] Добавить поле `lastSeenSimplyVersion: varchar("lastSeenSimplyVersion", { length: 20 })` в таблицу `User` (`lib/db/schema.ts`)
- [x] Создать и применить Drizzle-миграцию (0036_add-last-seen-simply-version.sql)
- [x] Добавить query `updateLastSeenSimplyVersion({ userId, version })` в `lib/db/queries.ts`

**Файлы:**
- `lib/briefing/simply-overview.md` — **MOVE** из specs
- `lib/briefing/simply-news.md` — **NEW** контент обновления
- `lib/briefing/simply-news-utils.ts` — **NEW** парсер + утилиты
- `lib/db/schema.ts` — + поле lastSeenSimplyVersion в User
- `lib/db/queries.ts` — + updateLastSeenSimplyVersion
- `drizzle/` — новая миграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'lastSeenSimplyVersion'` — поле существует
- [x] 🧪 Мануальный тест: нет (backend only, проверяем на следующих этапах)

**Git (после валидации):**
```bash
git add lib/briefing/simply-overview.md lib/briefing/simply-news.md lib/briefing/simply-news-utils.ts lib/db/schema.ts lib/db/queries.ts drizzle/
git commit -m "feat(tz-bf2): content files, frontmatter utils, DB migration"
```

**Критерий готовности:** Файлы читаются, frontmatter парсится, миграция применена.

---

## Этап 2: Sidebar секция «Simply» + SimplyContentView

**Статус:** ✅ Готово

**Цель:** Секция «Simply» в sidebar брифинга. Клик на пункты → SimplyContentView в article reader.

**Задачи:**
- [x] Создать `SimplyContentView` в `components/briefing/briefing-article-view.tsx` — по паттерну `SavedTopicView` (кнопка «← Назад к выпуску», MarkdownViewer, заголовок)
- [x] Обновить `BriefingSidebarProps` (`briefing-sidebar.tsx`) — добавить props + тип `SimplyContentType`
- [x] Добавить секцию «SIMPLY» в `SidebarContent` (`briefing-sidebar.tsx`) — после «Сохранённые», перед footer. Два пункта: «📋 Обзор платформы» (всегда), «🆕 Что нового» (только если simplyNewsVersion)
- [x] Обновить `BriefingIssueContentProps` (`briefing-issue-content.tsx`) — третий view mode в switch (article / savedTopic / simplyContent)
- [x] Обновить `BriefingPageClient` (`briefing-page-client.tsx`) — SimplyData type, state management, передача в sidebar и content
- [x] Обновить `app/(dashboard)/briefing/page.tsx` (Server Component) — загрузить simply-news metadata + content через `getSimplyNewsData()` + `getSimplyOverviewContent()`

**Файлы:**
- `components/briefing/briefing-article-view.tsx` — + SimplyContentView
- `components/briefing/briefing-sidebar.tsx` — + секция «Simply»
- `components/briefing/briefing-issue-content.tsx` — + третий view mode
- `components/briefing/briefing-page-client.tsx` — + simply state management
- `app/(dashboard)/briefing/page.tsx` — + загрузка simply data

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: на странице /briefing (с активным брифингом) в sidebar видна секция «Simply» с двумя пунктами
- [ ] Браузер: клик «📋 Обзор платформы» → контент отображается в article reader
- [ ] Браузер: клик «🆕 Что нового» → контент отображается в article reader
- [ ] Браузер: кнопка «← Назад к выпуску» возвращает к статье
- [ ] Браузер: мобильный sidebar (Sheet) тоже показывает секцию
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/briefing/ app/(dashboard)/briefing/page.tsx
git commit -m "feat(tz-bf2): sidebar Simply section + SimplyContentView"
```

**Критерий готовности:** Sidebar показывает секцию Simply, клик открывает контент, навигация работает.

---

## Этап 3: Индикатор на карточке дашборда + API seen

**Статус:** ✅ Готово

**Цель:** Бейдж/точка на BriefingCard при непрочитанном обновлении. PATCH API для отметки просмотра. Индикатор гаснет после просмотра.

**Задачи:**
- [x] Создать `app/(chat)/api/briefing/simply-news/seen/route.ts` — PATCH endpoint: обновить `User.lastSeenSimplyVersion` на текущую версию из simply-news.md
- [x] Обновить `BriefingCardProps` (`briefing-card.tsx`) — добавить prop `hasSimplyUpdate?: boolean`. Рендерить бейдж/точку на карточке (все 3 состояния: empty, ready, generating)
- [x] Обновить `ToolsSectionProps` (`tools-section.tsx`) — прокинуть `hasSimplyUpdate`
- [x] Обновить `app/(dashboard)/dashboard/page.tsx` — загрузить simply-news metadata + user.lastSeenSimplyVersion, вычислить `hasSimplyUpdate = hasUpdate && version !== lastSeenVersion`, передать в ToolsSection
- [x] Обновить `BriefingPageClient` (`briefing-page-client.tsx`) — при просмотре simply-news вызвать PATCH API для отметки просмотра (auto-mark on view)

**Файлы:**
- `app/(chat)/api/briefing/simply-news/seen/route.ts` — **NEW** PATCH endpoint
- `components/briefing/briefing-card.tsx` — + бейдж/точка индикатор
- `components/glavnaya/tools-section.tsx` — + prop hasSimplyUpdate
- `app/(dashboard)/dashboard/page.tsx` — + загрузка simply metadata + user version
- `components/briefing/briefing-page-client.tsx` — + auto-mark seen

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: на дашборде карточка брифинга показывает бейдж (т.к. user ещё не видел)
- [ ] Браузер: зайти в /briefing → кликнуть «Что нового» → вернуться на дашборд → бейдж исчез
- [ ] SQL: `SELECT "lastSeenSimplyVersion" FROM "User" WHERE id = '...'` — значение обновилось
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/(chat)/api/briefing/simply-news/ components/briefing/briefing-card.tsx components/glavnaya/tools-section.tsx app/(dashboard)/dashboard/page.tsx components/briefing/briefing-page-client.tsx
git commit -m "feat(tz-bf2): dashboard indicator + seen API"
```

**Критерий готовности:** Индикатор показывается на карточке, гаснет после просмотра.

---

## Этап 4: Инъекция в генерацию + лендинг

**Статус:** ✅ Готово

**Цель:** При генерации брифинга добавлять simply-news как последнюю секцию. На лендинге (для неактивных пользователей) показывать «Что нового».

**Задачи:**
- [x] Обновить `app/(chat)/api/briefing/generate/route.ts` — после `generateArticle()`, если `hasUpdate: true`, сформировать `BriefingArticleSection` из simply-news.md (topicId: `simply_news`, emoji: `🔔`, newsCount: 0, sources: []) и добавить в `article.sections` перед сохранением. Обновить `article.meta.topicsCount += 1`
- [x] Обновить `components/briefing/briefing-page.tsx` (лендинг) — добавить секцию «Что нового в Simply» внизу (перед CTA), если hasUpdate. Server Component читает simply-news data через `getSimplyNewsData()`
- [x] Обновить `app/(dashboard)/briefing/page.tsx` — для неактивных пользователей передать simply-news в лендинг

**Файлы:**
- `app/(chat)/api/briefing/generate/route.ts` — + инъекция секции
- `components/briefing/briefing-page.tsx` — + секция «Что нового» на лендинге
- `app/(dashboard)/briefing/page.tsx` — + props для лендинга

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: сгенерировать новый брифинг → последняя секция = «🔔 Что нового в Simply»
- [ ] Браузер: разлогиниться, зайти с юзером без active briefing → на лендинге видна секция «Что нового»
- [ ] 🧪 Мануальный тест пользователем (генерация + лендинг)

**Git (после валидации):**
```bash
git add app/(chat)/api/briefing/generate/route.ts components/briefing/briefing-page.tsx app/(dashboard)/briefing/page.tsx
git commit -m "feat(tz-bf2): generation injection + landing news section"
```

**Критерий готовности:** Сгенерированный брифинг содержит секцию Simply. Лендинг показывает новость.

---

## Этап 5: Финализация

**Статус:** ✅ Готово

**Цель:** Документация, версия, архивирование.

**Задачи:**
- [x] Финальное мануальное тестирование (пользователь) — полный flow
- [x] ⛔ Прочитать DOCUMENTATION_GUIDE.md — пройти по чеклисту
- [x] Обновить главный `CHANGELOG.md`
- [x] Обновить `SIMPLY_STATUS.md`
- [x] Обновить `CLAUDE.md` (секция Briefing — новые файлы, SimplyContentView)
- [x] Обновить `package.json` → 3.40.0
- [x] ⛔ Верификация docs против кода (Правило 5)
- [x] Переместить `specs/TZ_BF2_SimplyNews/` → `_archive/`

**Валидация:**
- [x] `npm run build` — успешен
- [x] Документация актуальна и верифицирована
- [x] Все критерии готовности из ТЗ выполнены:
  - [x] Файлы simply-overview.md и simply-news.md созданы
  - [x] Секция «Simply» в sidebar: обзор + что нового
  - [x] Article reader рендерит контент из markdown-файлов
  - [x] Индикатор на карточке дашборда при непрочитанном обновлении
  - [x] Индикатор гаснет после просмотра
  - [x] Новость Simply добавляется последней секцией при генерации
  - [x] Работает для пользователей без настроенного брифинга

**Git (после валидации):**
```bash
git add -A
git commit -m "chore(tz-bf2): finalize v3.40.0 — SimplyNews"
```
