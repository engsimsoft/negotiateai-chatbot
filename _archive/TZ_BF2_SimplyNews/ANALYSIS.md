# Анализ ТЗ-BF2: SimplyNews

**Дата анализа:** 2026-02-21

---

## Резюме

Встроенный канал коммуникации с пользователями через брифинг. Два markdown-файла в репозитории (обзор платформы + что нового), секция «Simply» в sidebar брифинга, индикатор на карточке дашборда, инъекция в генерацию. Без CMS, без БД для контента — файлы в коде.

---

## Рекомендации разработчика (Код-ревью)

> Ниже — технические рекомендации на основе глубокого анализа кодовой базы.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Markdown-файлы в репозитории** — ОК, отличный подход. В `briefing-author.ts:16-23` уже есть паттерн чтения `.md` через `fs.readFileSync(path.join(process.cwd(), ...))`. Переиспользуем.
- **Секция «Simply» в sidebar** — ОК, вписывается в существующую архитектуру `SidebarContent` (`briefing-sidebar.tsx:154-335`). Добавляется как третья группа после «Сохранённые».
- **Инъекция в генерацию** — ОК, pipeline в `generate/route.ts:198-225` формирует `BriefingArticle` через `generateArticle()`. Можно добавить секцию после генерации, перед сохранением.
- **Формат frontmatter** — ОК, простой (version, date, hasUpdate, title).

### ⚠️ Рекомендую изменить

| # | Было (ТЗ) | Рекомендация | Обоснование из кода |
|---|-----------|--------------|-------------------|
| 1 | `lastSeenSimplyVersion` в `briefingSettings` | **Хранить в таблице `User`** | `briefingSettings` существует только у пользователей с активным брифингом (`schema.ts:376-396`). Для остальных нет строки. ТЗ само говорит: "для пользователей без briefingSettings — считать что не видели". Это значит нам нужен отдельный механизм. Проще добавить `lastSeenSimplyVersion varchar(20)` в таблицу `User` (`schema.ts:24-36`) — она есть у всех. Одна миграция, простой запрос на дашборде. Если всё же в `briefingSettings` — придётся создавать строку settings ради одного поля (isActive=false), или делать отдельный SELECT + fallback. |
| 2 | Не указан парсер frontmatter | **Простой regex-парсер вместо `gray-matter`** | У нас 4 поля в frontmatter (version, date, hasUpdate, title). Добавлять зависимость `gray-matter` ради этого — overengineering. Напишу утилиту `parseSimplyNewsFrontmatter()` на 15 строк. |
| 3 | "Контент берётся напрямую из markdown-файла" (для инъекции) | **Инъекция = готовая `BriefingArticleSection`, не raw markdown** | Все секции в `BriefingArticle` имеют тип `BriefingArticleSection` (`briefing-types.ts:14-21`) с полями `topicId, topicName, emoji, content, newsCount, sources[]`. Сырой markdown не пройдёт тайп-чек. Рекомендую: читаем `.md`, формируем `BriefingArticleSection` с `topicId: "simply_news"`, `newsCount: 0`, `sources: []`. Тогда article reader рендерит через существующий `MarkdownViewer` без изменений. |
| 4 | Клик на sidebar items → article reader | **Новый view-mode по паттерну `SavedTopicView`** | Сейчас sidebar переключает между article и saved topic (`briefing-issue-content.tsx:69-85`). Добавим третий режим: `simplyContent` — рендерим markdown через `MarkdownViewer`. Это нативно вписывается в существующий `selectedSavedTopic` / `onBackToArticle` паттерн. Создаём `SimplyContentView` компонент аналогичный `SavedTopicView` (`briefing-article-view.tsx:262-330`). |

### ❓ Требует уточнения

1. **Пользователи без активного брифинга (critical)**

   Сейчас маршрутизация на `/briefing` (`briefing/page.tsx:24`):
   - `!settings?.isActive` → лендинг (`BriefingPage`)
   - `isActive` → выпуск/пустое состояние (`BriefingPageClient`)

   Лендинг (`briefing-page.tsx`) — это статичная промо-страница без sidebar. У неё нет sidebar-а, нет article reader-а.

   **Вопрос:** Где именно видит simply-news пользователь без активного брифинга?
   - **A)** На лендинге добавляем секцию «Что нового» (просто блок markdown внизу) — минимальные изменения
   - **B)** При клике на карточку с индикатором редиректим не на `/briefing`, а на `/briefing?view=news` — показываем отдельный простой layout с markdown
   - **C)** Показываем полный layout с sidebar (как для активных), но вместо выпуска — simply-news

   *Моя рекомендация:* **A** — минимальный скоуп, лендинг и так промотирует брифинг. Новость Simply органично дополнит его.

2. **"Если у пользователя нет своих тем — брифинг = только новость Simply"**

   В текущем коде (`generate/route.ts:164-167`) при отсутствии пользовательских тем используются дефолтные из каталога (`getTopicIds()`). То есть генерация всегда производит полный брифинг.

   **Вопрос:** Что конкретно имеется в виду?
   - **A)** При генерации: если нет настроенных тем, вместо fallback на дефолтные — только simply-news секция
   - **B)** Для пользователей, которые ВООБЩЕ не настраивали профиль (нет briefingSettings) — на странице `/briefing` показывать только simply-news

   *Моя рекомендация:* **B** — не трогаем пайплайн генерации (он работает, дефолтные темы — это фича). Просто показываем simply-news для неактивных пользователей.

3. **Поведение "Обзор платформы" для активных пользователей**

   В sidebar будет два пункта: «📋 Обзор платформы» и «🆕 Что нового». Клик → article reader.

   **Вопрос:** Когда пользователь кликнул на «📋 Обзор платформы», а потом кликнул на тему текущего выпуска в sidebar — нужно ли автоматически вернуться к статье? Или нужна кнопка «← Назад к выпуску» как в `SavedTopicView`?

   *Моя рекомендация:* Кнопка «← Назад к выпуску» как в SavedTopicView — это уже работающий паттерн.

---

## Потенциальные риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Миграция БД (новое поле) | Низкая | Среднее | Простой ALTER TABLE, nullable varchar — безопасно |
| `fs.readFileSync` в Server Component на каждый запрос | Низкая | Низкое | Файлы маленькие (~1KB), FS-кэш ОС. Или module-level кэш |
| Frontmatter парсинг — edge cases | Низкая | Низкое | Покроем тестами, формат контролируем сами |
| Sidebar перегружен (3 секции + footer) | Средняя | Низкое | Секция "Simply" компактная (2 пункта), визуально выделим |

---

## Зависимости

**Что нужно до начала:**
- [x] ТЗ-BF1 завершён (sidebar обновлён, savedTopics работают)
- [ ] Ответы на вопросы из раздела «Требует уточнения»

**Затронутые компоненты:**

| Файл | Изменения |
|------|-----------|
| `lib/db/schema.ts` | + `lastSeenSimplyVersion` в `User` (или `briefingSettings`) |
| `lib/db/queries.ts` | + `updateLastSeenSimplyVersion()` |
| `lib/briefing/simply-overview.md` | **NEW** — контент обзора платформы |
| `lib/briefing/simply-news.md` | **NEW** — текущее обновление с frontmatter |
| `lib/briefing/simply-news-utils.ts` | **NEW** — парсер frontmatter, утилиты чтения |
| `components/briefing/briefing-sidebar.tsx` | + секция «Simply» внизу |
| `components/briefing/briefing-card.tsx` | + индикатор (бейдж/точка) при hasUpdate |
| `components/briefing/briefing-page-client.tsx` | + state для simply-content view |
| `components/briefing/briefing-issue-content.tsx` | + третий view mode (simplyContent) |
| `components/briefing/briefing-article-view.tsx` | + `SimplyContentView` компонент |
| `app/(dashboard)/dashboard/page.tsx` | + загрузка simply-news metadata + lastSeenVersion |
| `app/(dashboard)/briefing/page.tsx` | + загрузка simply-news для non-active users |
| `app/(chat)/api/briefing/generate/route.ts` | + инъекция simply-news секции |
| `app/(chat)/api/briefing/simply-news/seen/route.ts` | **NEW** — PATCH для отметки просмотра |
| `components/glavnaya/tools-section.tsx` | + prop hasSimplyUpdate для BriefingCard |
| Drizzle migration | **NEW** — ALTER TABLE "User" ADD COLUMN |

---

## Оценка

- [x] Простое (1-2 сессии)
- [ ] Среднее (3-5 сессий)
- [ ] Сложное (5+ сессий)

**Обоснование:** Основная работа — UI (sidebar секция, индикатор, view mode). Бэкенд минимален: чтение файлов + одно поле в БД. Нет новых AI-моделей, нет сложной логики. 1 сессия при чётких ответах.

---

## Ответы на вопросы

> Заполнено архитектором 2026-02-21

1. **[Пользователи без активного брифинга]:** Вариант A — секция «Что нового» на лендинге. Не ломаем лендинг, добавляем ценность.
2. **[Нет своих тем]:** Убираем этот кейс. Если у пользователя нет тем, он не генерирует брифинг. Simply-news он видит на лендинге. Не усложняем generate pipeline.
3. **[Навигация обзор → выпуск]:** Да, «← Назад к выпуску» как в SavedTopicView. Тот же паттерн.
