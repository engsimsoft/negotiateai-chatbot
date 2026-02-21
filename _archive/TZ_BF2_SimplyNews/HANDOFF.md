# Передача сессии ТЗ-BF2: SimplyNews

**Последнее обновление:** 2026-02-21
**Сессия:** 1 (анализ + планирование)

---

## Статус этапов

- [ ] Этап 1: Контент-файлы + утилиты + миграция ← НАЧАТЬ ЗДЕСЬ
- [ ] Этап 2: Sidebar секция «Simply» + SimplyContentView
- [ ] Этап 3: Индикатор на карточке дашборда + API seen
- [ ] Этап 4: Инъекция в генерацию + лендинг
- [ ] Этап 5: Финализация

---

## Следующая сессия: начни с

1. Прочитай этот HANDOFF.md
2. Прочитай `specs/TZ_BF2_SimplyNews/ROADMAP.md` → Этап 1 (детальные задачи)
3. **Первая задача:** Переместить `specs/TZ_BF2_SimplyNews/simply-overview.md` → `lib/briefing/simply-overview.md`
4. Создать `lib/briefing/simply-news.md` с frontmatter
5. Создать `lib/briefing/simply-news-utils.ts` (парсер + утилиты чтения)
6. Добавить `lastSeenSimplyVersion` в `User` таблицу (`lib/db/schema.ts`)
7. Миграция + query

---

## Что сделано в сессии 1

- Создана структура ТЗ (SPEC, ANALYSIS, CHANGELOG, HANDOFF)
- Проведён глубокий анализ кодовой базы — прочитаны все затронутые файлы:
  - `briefing-sidebar.tsx` — SidebarContent, секции «Текущий выпуск» + «Сохранённые» + footer
  - `briefing-card.tsx` — 3 состояния (empty/ready/generating), props: latestBriefing
  - `briefing-page-client.tsx` — savedTopics state, generation, view switching
  - `briefing-article-view.tsx` — ArticleSection, SavedTopicView, NoBriefingsYet
  - `briefing-issue-content.tsx` — activeSectionId, desktop sidebar + main switch
  - `briefing-page.tsx` — лендинг (промо, demo blocks, CTA)
  - `briefing/page.tsx` — Server Component: isActive routing, data loading
  - `generate/route.ts` — 4-step pipeline (connect → fetch → filter → write)
  - `briefing-types.ts` — BriefingArticle, BriefingArticleSection, SavedBriefingTopicClient
  - `schema.ts` — briefingSettings (без lastSeenSimplyVersion), User table
  - `dashboard/page.tsx` — getBriefingHistory → ToolsSection → BriefingCard
  - `tools-section.tsx` — grid с BriefingCard
  - `briefing-config.ts` — constants, models
  - `briefing-author.ts` — fs.readFileSync паттерн для .md
- Написан код-ревью с 4 рекомендациями (все приняты архитектором)
- Заданы 3 вопроса, получены ответы
- Создан ROADMAP (5 этапов)

---

## Ключевые решения

1. **`lastSeenSimplyVersion` → таблица `User`** (не `briefingSettings`) — briefingSettings нет у неактивных пользователей, а индикатор нужен для ВСЕХ
2. **Regex-парсер frontmatter** — без зависимости `gray-matter`, 4 поля (version, date, hasUpdate, title)
3. **`SimplyContentView`** — третий view mode по паттерну `SavedTopicView` в `briefing-article-view.tsx`
4. **Неактивные пользователи** — видят simply-news как секцию на лендинге (`briefing-page.tsx`)
5. **Кейс "нет тем → только simply-news"** — убран, не усложняем generate pipeline
6. **Инъекция = `BriefingArticleSection`** — не raw markdown, формируем typed объект с `topicId: "simply_news"`
7. **Файл `simply-overview.md`** уже готов — лежит в `specs/TZ_BF2_SimplyNews/simply-overview.md`, нужно переместить

---

## Файлы в работе

| Файл | Статус | Примечание |
|------|--------|------------|
| `specs/TZ_BF2_SimplyNews/simply-overview.md` | Готов | Контент написан, нужно переместить в lib/briefing/ |
| `lib/briefing/simply-news.md` | Не создан | Этап 1: frontmatter + контент обновления |
| `lib/briefing/simply-news-utils.ts` | Не создан | Этап 1: парсер + getSimplyNewsData() + getSimplyOverviewContent() |

---

## Блокеры / Вопросы

Нет. Все вопросы закрыты, план одобрен.

---

## Команды

```bash
npm run dev          # Dev сервер
npm run build        # Проверка сборки
npx tsc --noEmit     # Проверка TypeScript
npm run db:migrate   # Применить миграции
```
