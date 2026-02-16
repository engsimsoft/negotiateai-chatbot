# Roadmap ТЗ-DV2: Дашборд V2

**Создан:** 2026-02-16
**Версия проекта:** 3.23.0 → 3.24.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 4 |
| Сессий (оценка) | 3-4 |

**Принятые решения (от архитектора):**
- `chatMode` — varchar с Zod-валидацией (не pgEnum)
- `selectedChatModel` — убираем из API, заменяем на `chatMode`
- Аватар — оставляем SparklesIcon (SVG логотип позже)
- ToolsSection — удаляем вместе с HelpersSection
- Greeting — одинаковый для всех режимов (PE настроит позже)
- Badge chatMode в истории — да, эмодзи (🔍/✨) рядом с названием

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

## Этап 4: UI — карточки на дашборде + убрать селектор модели

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

**Цель:** Три карточки на дашборде. Клик на Экспертиза/Создать → новый чат с нужным chatMode. Убрать модельный селектор из UI.

**Задачи:**
- [ ] Создать `components/glavnaya/mode-cards-section.tsx` — три карточки:
  - Экспертиза (🔍) → redirect к `/chat?mode=expertise`
  - Создать (✨) → redirect к `/chat?mode=create`
  - Проекты (📁) → link к `/projects`
  - Дизайн по `docs/design-system.md` (hover: border-primary + shadow)
- [ ] Обновить `components/glavnaya/index.ts` — экспорт ModeCardsSection
- [ ] Интегрировать ModeCardsSection в `app/(dashboard)/dashboard/page.tsx` (под инпутом)
- [ ] Обновить главную страницу / роут для обработки `?mode=expertise|create` query param → создание чата с chatMode
- [ ] Убрать `InputModelSelector` из `components/input/compact-input.tsx` (или не рендерить)
- [ ] Убрать model badge из `components/chat-header.tsx` (если есть)
- [ ] Оставить dev-badge модели под аватаркой AI в `components/message.tsx` (уже есть, не трогать)

**Файлы (новые):**
- `components/glavnaya/mode-cards-section.tsx` — карточки режимов

**Файлы (модификация):**
- `components/glavnaya/index.ts` — экспорт
- `app/(dashboard)/dashboard/page.tsx` — интеграция карточек
- `components/input/compact-input.tsx` — убрать model selector
- `components/chat-header.tsx` — убрать model badge (если есть)
- `app/(chat)/page.tsx` или `app/(chat)/chat/page.tsx` — обработка query param mode

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/dashboard` показывает 3 карточки
- [ ] Браузер: клик "Экспертиза" → новый чат с chatMode=expertise (Sonnet в dev-badge)
- [ ] Браузер: клик "Создать" → новый чат с chatMode=create (Sonnet в dev-badge)
- [ ] Браузер: клик "Проекты" → страница /projects
- [ ] Браузер: нет модельного селектора в поле ввода
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dv2): dashboard mode cards + remove model selector UI"
```

**Критерий готовности:** Три карточки работают, переход в чат с правильным chatMode, нет селектора модели.

---

## Этап 5: AI = Simply + chatMode badge в истории

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

**Цель:** AI называется Simply в UI. В истории чатов виден тип чата (badge).

**Задачи:**
- [ ] Обновить аватар AI в `components/message.tsx` — заменить SparklesIcon на стилизованную "S" (или оставить SparklesIcon но добавить tooltip "Simply"). Решение: оставить SparklesIcon (архитектор подтвердил).
- [ ] Проверить все места где AI называется "Claude" в UI-компонентах — заменить на "Simply"
- [ ] В `lib/ai/models.ts` — обновить `name` полей: "Claude Sonnet" → "Simply Sonnet" (или убрать если нигде не используется в UI)
- [ ] Добавить chatMode badge в sidebar history (`components/sidebar-history-item.tsx`):
  - `expertise` → 🔍
  - `create` → ✨
  - `chat` → без badge (default)
- [ ] Добавить chatMode badge на странице `/chats` (`components/chats/chat-list-item.tsx`):
  - Аналогичные эмодзи рядом с названием
- [ ] Убедиться что Chat тип в queries возвращает chatMode для использования в UI

**Файлы (модификация):**
- `components/message.tsx` — аватар (минимальные изменения)
- `lib/ai/models.ts` — названия моделей
- `components/sidebar-history-item.tsx` — chatMode badge
- `components/chats/chat-list-item.tsx` — chatMode badge
- `lib/db/queries.ts` — chatMode в ответах (если не включён)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: AI не называется "Claude" нигде в чат-интерфейсе
- [ ] Браузер: dev-badge модели под аватаркой — сохранён
- [ ] Браузер: в sidebar-history чаты expertise/create имеют эмодзи-badge
- [ ] Браузер: на странице /chats — аналогично
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dv2): rebrand AI to Simply + chatMode badges in history"
```

**Критерий готовности:** AI везде = Simply. В истории чатов виден тип.

---

## Этап 6: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 5

**Цель:** Финальная проверка, DB-cleanup, документация, версия.

**Задачи:**
- [ ] DB-миграция: удалить колонку `helperId` из Chat и таблицу `Helper` (drop FK → drop column → drop table)
- [ ] Создать и применить миграцию
- [ ] SQL-проверка: таблицы, колонки, FK
- [ ] Финальное мануальное тестирование (пользователь):
  - Дашборд: 3 карточки
  - Каждая карточка → правильный чат
  - История: chatMode badge
  - Нет модельного селектора
  - AI = Simply
  - Проекты работают без изменений
  - Бен работает без изменений
- [ ] Обновить главный `CHANGELOG.md`
- [ ] Обновить `SIMPLY_STATUS.md`
- [ ] Обновить `CLAUDE.md` (структура кода, текущий этап)
- [ ] Обновить `package.json` → 3.24.0
- [ ] Обновить `docs/ai-chats-map.md` — убрать helpers, добавить chatMode
- [ ] Обновить `docs/architecture.md` — убрать helpers references
- [ ] Обновить `docs/design-system.md` — убрать helpers routes
- [ ] Переместить `specs/TZ_DV2_DashboardV2/` → `_archive/`

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: нет таблицы Helper, нет колонки helperId в Chat, есть chatMode
- [ ] Документация актуальна
- [ ] 🧪 Финальный мануальный тест пользователем

**Git (после валидации):**
```bash
git add [файлы]
git commit -m "feat(tz-dv2): finalize Dashboard V2 v3.24.0"
```

**Критерий готовности:** Всё работает, документация обновлена, ТЗ в архиве, версия 3.24.0.
