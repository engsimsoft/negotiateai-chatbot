# Roadmap ТЗ-DV2: Дашборд V2

**Создан:** 2026-02-16
**Версия проекта:** 3.23.0 → 3.24.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 8 (1, 2, 3, 4A, 4B, 4C, 4D, 5, 6) |
| Текущий этап | 4B |
| Сессий (оценка) | 5-6 |

**Принятые решения (от архитектора):**
- `chatMode` — varchar с Zod-валидацией (не pgEnum)
- `selectedChatModel` — убираем из API, заменяем на `chatMode`
- Аватар — оставляем SparklesIcon (SVG логотип позже)
- ToolsSection — удаляем вместе с HelpersSection
- Greeting — одинаковый для всех режимов (PE настроит позже)
- Badge chatMode в истории — да, эмодзи (🔍/✨) рядом с названием

**Решения сессии 4 (обновление ТЗ v2.0):**
- Вместо простых карточек-ссылок — полноценные страницы `/expertise`, `/create`
- ListDetailPage — composition подход (layout-shell + render props, НЕ generics)
- `/projects` переводить на list-detail (единый паттерн)
- Flow создания: вариант B — redirect `/chat?mode=...`, чат при первом сообщении
- `/chats` — все непроектные чаты (вариант A, единый архив)
- Sidebar — не трогать, не добавлять новые пункты
- Этап 4 разбит на 4A/4B/4C/4D с валидацией после каждого

---

## Этап 1: Удаление экосистемы помощников

**Статус:** ✅ Завершён

**Цель:** Полностью убрать мёртвый код помощников. После этого этапа проект компилируется без helper-зависимостей.

**Задачи:**
- [x] Удалить директорию `lib/helpers/` (4 файла: index.ts, types.ts, presets.ts, server.ts)
- [x] Удалить директорию `app/(chat)/helpers/` (3 страницы)
- [x] Удалить директорию `app/(chat)/api/helpers/` (2 routes)
- [x] Удалить `components/glavnaya/helpers-section.tsx`
- [x] Удалить экспорт HelpersSection из `components/glavnaya/index.ts`
- [x] Удалить ToolsSection с дашборда (`components/glavnaya/tools-section.tsx` + экспорт)
- [x] Убрать import + рендер HelpersSection и ToolsSection из `app/(dashboard)/dashboard/page.tsx`
- [x] Убрать helperId props из `components/chat.tsx`
- [x] Убрать helperId props из `components/chat-header.tsx` (включая helper breadcrumb)
- [x] Убрать helper case из `components/app-sidebar.tsx` (SidebarContext, getSidebarContext, getNewChatUrl, getContextTitle)
- [x] Убрать helper case из `components/sidebar-history.tsx` (API endpoint switch)
- [x] Убрать helperId из `app/(chat)/api/chat/schema.ts` (postRequestBodySchema)
- [x] Убрать helperId из `app/(chat)/api/chat/route.ts` (saveChat и любые references)
- [x] Убрать helper-функции из `lib/db/queries.ts` (getHelpersByUserId, getHelperById, saveHelper, updateHelper, deleteHelperById, getChatsByHelperId, helperId в saveChat)
- [x] Убрать helper table и helperId из `lib/db/schema.ts` (НЕ удалять колонку из БД пока — только из Drizzle schema)
- [x] Убрать импорты helper/Helper из всех затронутых файлов
- [x] Убрать комментарий про helpers в `components/sidebar-layout.tsx`

**Файлы (удаление):**
- `lib/helpers/` — весь каталог
- `app/(chat)/helpers/` — весь каталог
- `app/(chat)/api/helpers/` — весь каталог
- `components/glavnaya/helpers-section.tsx`

**Файлы (модификация):**
- `components/glavnaya/index.ts` — убрать экспорт
- `app/(dashboard)/dashboard/page.tsx` — убрать import + рендер
- `components/chat.tsx` — убрать helper props
- `components/chat-header.tsx` — убрать helper props + breadcrumb
- `components/app-sidebar.tsx` — убрать helper case
- `components/sidebar-history.tsx` — убрать helper case
- `app/(chat)/api/chat/schema.ts` — убрать helperId
- `app/(chat)/api/chat/route.ts` — убрать helperId references
- `lib/db/queries.ts` — убрать 6 helper-функций + helperId в saveChat
- `lib/db/schema.ts` — убрать helper table + helperId поле

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/dashboard` открывается без ошибок, секции помощников и инструментов нет
- [x] Браузер: обычный чат работает (отправка сообщения)
- [x] Браузер: sidebar без ошибок
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "chore(tz-dv2): remove helpers ecosystem and tools section"
```

**Критерий готовности:** Проект компилируется, ни одного упоминания helper/Helper в рабочем коде (кроме миграций и архива). Дашборд показывает только проекты.

---

## Этап 2: chatMode — схема, миграция, API

**Статус:** ✅ Завершён

**Цель:** Добавить `chatMode` в БД и API. Сервер определяет модель по chatMode. Существующие чаты получают `chatMode: 'chat'` по умолчанию.

**Задачи:**
- [x] Добавить `chatMode` varchar в Chat table (`lib/db/schema.ts`): `varchar("chatMode", { length: 20 }).notNull().default("chat")`
- [x] Создать DB-миграцию: `npx drizzle-kit generate` → проверить SQL
- [x] Применить миграцию: `npm run db:migrate`
- [x] Проверить миграцию через MCP: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Chat'`
- [x] Обновить `postRequestBodySchema` в `app/(chat)/api/chat/schema.ts`: убрать `selectedChatModel`, добавить `chatMode: z.enum(['chat', 'expertise', 'create']).default('chat')`
- [x] Создать конфиг chatMode → model mapping (`lib/ai/chat-mode-config.ts`)
- [x] Обновить `saveChat()` в `lib/db/queries.ts` — принимать и сохранять chatMode
- [x] Обновить `app/(chat)/api/chat/route.ts` — chatMode routing, модель по getModelForChatMode()
- [x] Обновить `components/chat.tsx` — отправлять chatMode вместо selectedChatModel
- [x] Добавить chatMode в partial select queries (getChatsByUserId, getChatsByProjectId)

**Файлы (новые):**
- `lib/ai/chat-mode-config.ts` — конфигурация режимов

**Файлы (модификация):**
- `lib/db/schema.ts` — chatMode поле
- `lib/db/queries.ts` — saveChat обновление
- `app/(chat)/api/chat/schema.ts` — chatMode вместо selectedChatModel
- `app/(chat)/api/chat/route.ts` — chatMode routing
- `components/chat.tsx` — chatMode вместо model state

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: `SELECT "chatMode" FROM "Chat" LIMIT 5` — колонка существует, default 'chat'
- [x] Браузер: отправить сообщение в чат — работает, chatMode сохраняется
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dv2): add chatMode field and server-side model routing"
```

**Критерий готовности:** Чаты создаются с chatMode, модель определяется на сервере. API не принимает selectedChatModel.

---

## Этап 3: Промпты и Tools по chatMode

**Статус:** ✅ Завершён

**Цель:** Две новые composer-функции (заглушки), tools routing по chatMode.

**Задачи:**
- [x] Добавить `composeExpertisePrompt()` в `lib/prompts/builder/composer.ts`:
  - Внутри вызывает `composeChatPrompt(context)`
  - Хардкодит `model: 'claude-sonnet'`
- [x] Добавить `composeCreatePrompt()` в `lib/prompts/builder/composer.ts`:
  - Внутри вызывает `composeChatPrompt(context)`
  - Хардкодит `model: 'claude-sonnet'`
- [x] Обновить `composeChatPrompt()` — default model → `'claude-haiku'` (было `'claude-sonnet'`)
- [x] Добавить экспорты в `lib/prompts/builder/index.ts`:
  - `buildExpertisePrompt()` и `buildCreatePrompt()` high-level функции
  - Re-export composers
- [x] Обновить `lib/prompts/server.ts` — экспорт новых builders
- [x] Обновить `lib/prompts/index.ts` — client-safe типы не нужны (composers — server-only)
- [x] Расширить `getStandardTools()` в `lib/ai/tools/chat-tools.ts`:
  - Добавить `chatMode: ChatMode` (optional, backward compat через `isProjectChat`)
  - Фильтрация tools по chatMode config (все режимы = null = все tools, зарезервировано)
- [x] Обновить `getActiveToolNames()` аналогично
- [x] Интегрировать в `app/(chat)/api/chat/route.ts`:
  - По chatMode вызывать соответствующий builder (buildChatPrompt / buildExpertisePrompt / buildCreatePrompt)
  - Передавать chatMode в getStandardTools

**Файлы (модификация):**
- `lib/prompts/builder/composer.ts` — две новые функции
- `lib/prompts/builder/index.ts` — экспорты
- `lib/prompts/server.ts` — экспорты
- `lib/ai/tools/chat-tools.ts` — chatMode routing
- `lib/ai/chat-mode-config.ts` — tools config
- `app/(chat)/api/chat/route.ts` — интеграция

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: обычный чат (chatMode=chat) → модель Haiku (dev-badge подтверждён)
- [x] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dv2): add expertise/create composers and chatMode-based tools"
```

**Критерий готовности:** Три режима чата с разными моделями и конфигурацией tools. Промпты — заглушки, готовые к замене PE.

---

## Этап 4A: Карточки на дашборде + убрать селектор модели

**Статус:** ✅ Завершён

**Цель:** Три карточки-лаунчера на дашборде. Убрать ProjectsSection. Убрать модельный селектор. Обработка `?mode=` query param в чате.

**Задачи:**
- [x] Создать `components/glavnaya/mode-cards-section.tsx` — три карточки:
  - Экспертиза (🔍) — «Точные ответы с проверкой фактов» → `/expertise`
  - Создать (✨) — «Презентации, отчёты, изображения» → `/create`
  - Проекты (📁) — «Сложная работа с вашими данными» → `/projects`
  - Дизайн: Паттерн A (`hover:border-primary hover:shadow-sm transition-all`)
  - Grid: расширяемый (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- [x] Обновить `components/glavnaya/index.ts` — экспорт ModeCardsSection, убрать ProjectsSection
- [x] Удалить `components/glavnaya/projects-section.tsx`
- [x] Обновить `app/(dashboard)/dashboard/page.tsx`:
  - Заменить ProjectsSection на ModeCardsSection
  - Оставить ChatHistoryCard и getGeneralChatsCount
- [x] Убрать `InputModelSelector` из `components/input/compact-input.tsx`
- [x] Обработать `?mode=` query param в `app/(chat)/chat/page.tsx`:
  - Читать `searchParams.mode` → передавать `initialChatMode` в Chat
- [x] Оставить dev-badge модели под аватаркой AI (не трогать)

**Файлы (новые):**
- `components/glavnaya/mode-cards-section.tsx`

**Файлы (модификация):**
- `components/glavnaya/index.ts` — экспорт
- `app/(dashboard)/dashboard/page.tsx` — ModeCardsSection вместо ProjectsSection
- `components/input/compact-input.tsx` — убрать InputModelSelector
- `app/(chat)/chat/page.tsx` — `?mode=` → `initialChatMode`

**Файлы (удаление):**
- `components/glavnaya/projects-section.tsx`

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/dashboard` — 3 карточки вместо ProjectsSection
- [x] Браузер: клик «Экспертиза» → `/expertise` (404 — ок, страница в 4C)
- [x] Браузер: клик «Проекты» → `/projects`
- [x] Браузер: нет модельного селектора в поле ввода
- [x] Браузер: `/chat?mode=expertise` → чат с chatMode=expertise (Sonnet в dev-badge)
- [x] 🧪 Мануальный тест пользователем

**Git:**
```bash
git commit -m "feat(tz-dv2): dashboard mode cards + remove model selector"
```

**Критерий готовности:** Карточки на дашборде, нет селектора модели, `?mode=` работает.

---

## Этап 4B: ListDetailPage — универсальный layout-shell

**Статус:** ✅ Завершён

**Цель:** Извлечь из `/chats` универсальный composition-компонент ListDetailPage. Рефакторить `/chats` на его основе.

**Архитектура:** Composition подход — layout-shell + render props (НЕ generics).

ListDetailPage отвечает за:
- Header (← Dashboard, заголовок, счётчик, кнопка создания, UserMenu)
- Двухколоночный layout (список слева w-80/lg:w-96, детали справа flex-1)
- Empty state (иконка + текст + кнопка создания)
- Mobile: правая колонка скрыта (`hidden md:block`)

Содержимое списка и правой панели — через props.

**Задачи:**
- [x] Создать `components/list-detail/list-detail-page.tsx`
- [x] Создать `components/list-detail/index.ts` — экспорты
- [x] Рефакторить `components/chats/chats-page-content.tsx`:
  - Заменить ручной layout на `<ListDetailPage>`
  - ChatList → `listContent`, ChatDetailPanel → `detailContent`
  - State/handlers остаются в chats-page-content
- [x] Удалить orphaned `components/chats/chats-empty-state.tsx` (встроено в ListDetailPage)
- [x] Проверить что `/chats` работает идентично
- [x] Убрать селектор модели из обычных чатов (multimodal-input.tsx)
- [x] Добавить dev-badge модели в проектные чаты (task chat route)

**Файлы (новые):**
- `components/list-detail/list-detail-page.tsx`
- `components/list-detail/index.ts`

**Файлы (модификация):**
- `components/chats/chats-page-content.tsx` — использовать ListDetailPage
- `components/chats/index.ts` — убрать экспорт ChatsEmptyState
- `components/multimodal-input.tsx` — скрыть ModelSelectorCompact для !isProjectChat
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — data-model-info

**Файлы (удаление):**
- `components/chats/chats-empty-state.tsx` — заменён emptyState prop в ListDetailPage

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] Браузер: `/chats` — выглядит и работает идентично (list + detail, delete, star)
- [x] 🧪 Мануальный тест пользователем

**Git:** commit `71735a0`

**Критерий готовности:** ListDetailPage создан, `/chats` работает через него. Селектор модели убран из обычных чатов.

---

## Этап 4C: Страницы /expertise и /create

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4B

**Цель:** Две новые страницы на базе ListDetailPage. Чаты фильтруются по chatMode. Кнопка создания → `/chat?mode=...`.

**Задачи:**
- [ ] Добавить `getChatsByModeWithStats()` в `lib/db/queries.ts`:
  - Фильтр: `chatMode = :mode AND projectId IS NULL`
  - Формат: тот же что getGeneralChatsWithStats (id, title, summary, createdAt, isStarred, isRenamed, messageCount)
- [ ] Создать общий клиентский компонент `components/chats/mode-chats-page.tsx`:
  - Props: `mode`, `title`, `createLabel`, `createMode`, `emptyIcon`, `emptyTitle`, `emptyDescription`, `initialChats`
  - Использует ListDetailPage + ChatList + ChatDetailPanel
  - Кнопка создания → `router.push('/chat?mode=${createMode}')`
- [ ] Создать `app/(dashboard)/expertise/page.tsx`:
  - Server Component: auth + getChatsByModeWithStats('expertise')
  - Рендерит ModeChatsPage с конфигурацией Экспертизы
- [ ] Создать `app/(dashboard)/create/page.tsx`:
  - Server Component: auth + getChatsByModeWithStats('create')
  - Рендерит ModeChatsPage с конфигурацией Создать
- [ ] Рефакторить `/chats` через mode-chats-page (если выгодно) или оставить как есть

**Файлы (новые):**
- `app/(dashboard)/expertise/page.tsx`
- `app/(dashboard)/create/page.tsx`
- `components/chats/mode-chats-page.tsx`

**Файлы (модификация):**
- `lib/db/queries.ts` — getChatsByModeWithStats()

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/expertise` — страница с empty state + кнопка «+ Новая экспертиза»
- [ ] Браузер: `/create` — аналогично
- [ ] Браузер: кнопка «+» → `/chat?mode=expertise` → чат с Sonnet
- [ ] Браузер: дашборд → «Экспертиза» → `/expertise` (работает)
- [ ] Браузер: `/chats` — все непроектные чаты без изменений
- [ ] 🧪 Мануальный тест пользователем

**Git:**
```bash
git commit -m "feat(tz-dv2): add /expertise and /create pages with ListDetailPage"
```

**Критерий готовности:** Страницы работают, создание чатов ведёт в правильный chatMode.

---

## Этап 4D: Рефакторинг /projects на ListDetailPage

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4C

**Цель:** Перевести `/projects` с grid-карточек на двухколоночный list-detail layout. Единый паттерн.

**Задачи:**
- [ ] Создать `components/projects/project-list-item.tsx`:
  - Элемент списка: иконка, название, мета (задачи, файлы, последняя активность)
  - Контекстное меню: переименовать, удалить (паттерн из ChatListItem)
  - Selected state
- [ ] Создать `components/projects/project-detail-panel.tsx`:
  - Детали: название, описание, фаза, задачи, файлы, дата
  - «Открыть проект →» → `/projects/[id]`
  - Действия: переименовать, удалить
- [ ] Создать `components/projects/projects-page-content.tsx`:
  - Клиентский компонент с ListDetailPage
  - State: selectedProjectId, projects list
  - Handlers: delete, rename (из ProjectCard)
  - Кнопка «+ Новый проект» → `/projects/new`
- [ ] Рефакторить `app/(dashboard)/projects/page.tsx`:
  - Server Component → ProjectsPageContent
- [ ] Удалить `components/projects/project-card.tsx` (если больше не используется)

**Файлы (новые):**
- `components/projects/project-list-item.tsx`
- `components/projects/project-detail-panel.tsx`
- `components/projects/projects-page-content.tsx`

**Файлы (модификация):**
- `app/(dashboard)/projects/page.tsx` — рефакторинг

**Файлы (возможное удаление):**
- `components/projects/project-card.tsx`
- `components/projects/create-project-dialog.tsx` — проверить использование

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/projects` — двухколоночный layout (список + детали)
- [ ] Браузер: клик на проект → правая панель с деталями
- [ ] Браузер: «Открыть проект →» → `/projects/[id]`
- [ ] Браузер: «+ Новый проект» → `/projects/new`
- [ ] Браузер: переименование и удаление работают
- [ ] 🧪 Мануальный тест пользователем

**Git:**
```bash
git commit -m "feat(tz-dv2): refactor /projects to ListDetailPage layout"
```

**Критерий готовности:** `/projects` на ListDetailPage, все действия работают.

---

## Этап 5: AI = Simply + chatMode badge в истории

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4D

**Цель:** AI называется Simply в UI. В истории чатов виден тип чата (badge).

**Задачи:**
- [ ] Оставить SparklesIcon (SVG логотип позже)
- [ ] Проверить все места где AI называется "Claude" в UI — заменить на "Simply"
- [ ] В `lib/ai/models.ts` — обновить `name` (если используется в UI)
- [ ] Добавить chatMode badge в sidebar history (`components/sidebar-history-item.tsx`):
  - `expertise` → 🔍, `create` → ✨, `chat` → без badge
- [ ] Добавить chatMode badge в списках ListDetailPage (ChatListItem):
  - 🔍 / ✨ рядом с названием
- [ ] Убедиться что queries возвращают chatMode

**Файлы (модификация):**
- `components/message.tsx` — минимальные изменения
- `lib/ai/models.ts` — названия
- `components/sidebar-history-item.tsx` — badge
- `components/chats/chat-list-item.tsx` — badge
- `lib/db/queries.ts` — chatMode в select

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: AI не называется "Claude" нигде
- [ ] Браузер: dev-badge модели — сохранён
- [ ] Браузер: sidebar — эмодзи у expertise/create чатов
- [ ] 🧪 Мануальный тест пользователем

**Git:**
```bash
git commit -m "feat(tz-dv2): rebrand AI to Simply + chatMode badges"
```

**Критерий готовности:** AI = Simply. Badge в истории.

---

## Этап 6: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 5

**Цель:** Финальная проверка, DB-cleanup, документация, версия.

**Задачи:**
- [ ] DB-миграция: удалить `helperId` из Chat и таблицу `Helper`
- [ ] Создать и применить миграцию
- [ ] SQL-проверка
- [ ] Финальное тестирование:
  - Дашборд: 3 карточки-инструмента
  - Каждая карточка → страница list-detail
  - Кнопка создания → чат с правильным chatMode
  - `/chats` — все непроектные чаты
  - `/expertise`, `/create` — отфильтрованные
  - `/projects` — list-detail
  - Нет селектора модели
  - AI = Simply + badge
  - Бен работает
  - Проекты (внутренние) работают
- [ ] Обновить `CHANGELOG.md`
- [ ] Обновить `SIMPLY_STATUS.md`
- [ ] Обновить `CLAUDE.md` (ListDetailPage, новые страницы, текущий этап)
- [ ] Обновить `package.json` → 3.24.0
- [ ] Обновить `docs/ai-chats-map.md` — chatMode + страницы
- [ ] Обновить `docs/architecture.md` — ListDetailPage
- [ ] Обновить `docs/design-system.md` — /expertise, /create
- [ ] Переместить `specs/TZ_DV2_DashboardV2/` → `_archive/`

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: нет Helper, нет helperId, есть chatMode
- [ ] Документация актуальна
- [ ] 🧪 Финальный мануальный тест

**Git:**
```bash
git commit -m "feat(tz-dv2): finalize Dashboard V2 v3.24.0"
```

**Критерий готовности:** Всё работает, документация обновлена, ТЗ в архиве, версия 3.24.0.
