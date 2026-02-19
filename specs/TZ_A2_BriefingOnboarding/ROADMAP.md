# Roadmap ТЗ-A2: Briefing Onboarding

**Создан:** 2026-02-20
**Версия проекта:** 3.29.0 → 3.30.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 5 |
| Текущий этап | 2 |
| Сессий (оценка) | 3-4 |

---

## Этап 1: БД + Queries + Промпт-файлы

**Статус:** ✅ Завершён

**Цель:** Подготовить фундамент — новая таблица BriefingTopics, новые queries, разместить промпт-файлы, добавить модель claude-sonnet-4-6 в providers.

**Задачи:**
- [x] Добавить таблицу `BriefingTopics` в `lib/db/schema.ts` (userId, topicId, topicName, emoji, orderIndex, createdAt)
- [x] Создать и применить Drizzle миграцию (`npm run db:migrate`)
- [x] Добавить queries в `lib/db/queries.ts`:
  - `getBriefingTopics(userId)` → BriefingTopic[]
  - `addBriefingTopic({ userId, topicId, topicName, emoji, orderIndex })` → BriefingTopic
  - `deleteAllBriefingTopicsByUser(userId)` → void
  - `deleteAllBriefingSourcesByUser(userId)` → void
- [x] Обновить default `generationTime` в `upsertBriefingSettings` с "06:00" на "07:00"
- [x] Положить промпт `briefing-onboarding.md` в `lib/prompts/service-chats/` (из приложенного файла briefing-onboarding-v2.md, + инструкции для updateBriefingPreview)
- [x] Положить mode injection `briefing-onboarding-mode-injection.md` в `lib/prompts/service-chats/` (адаптировано: убран Handlebars, оставлен как справочный документ для prompt builder)
- [x] Добавить модель `claude-sonnet-4-6` в `lib/ai/providers.ts` как отдельный entry (НЕ менять alias `claude-sonnet`)

**Файлы:**
- `lib/db/schema.ts` — новая таблица BriefingTopics
- `lib/db/queries.ts` — 4 новых query + обновление default generationTime
- `lib/prompts/service-chats/briefing-onboarding.md` — новый
- `lib/prompts/service-chats/briefing-onboarding-mode-injection.md` — новый (справочный)
- `lib/ai/providers.ts` — новый model entry
- `lib/db/migrations/0032_briefing-topics.sql` — миграция
- `lib/db/migrations/meta/_journal.json` — запись миграции

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [x] SQL: `SELECT table_name FROM information_schema.tables WHERE table_name = 'BriefingTopics';` — таблица существует
- [x] SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'BriefingTopics';` — 7 колонок верные
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/queries.ts lib/prompts/service-chats/briefing-onboarding.md lib/prompts/service-chats/briefing-onboarding-mode-injection.md lib/ai/providers.ts drizzle/
git commit -m "feat(tz-a2): DB migration + prompts + claude-sonnet-4-6 model"
```

**Критерий готовности:** Таблица BriefingTopics в production БД, все queries компилируются, промпт-файлы на месте, модель claude-sonnet-4-6 доступна в providers.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 1

---

## Этап 2: Backend — service-chat расширение

**Статус:** ✅ Завершён

**Цель:** Добавить контекст `"briefing-onboarding"` в service-chat API: prompt builder, tools (updateBriefingPreview + saveBriefingProfile + deepResearch + fetchUrl), model routing, maxDuration, stepCount.

**Задачи:**
- [x] Добавить `"briefing-onboarding"` в тип `ServiceChatContext` и `requestSchema` (+ поле `briefingMode`)
- [x] Поднять `maxDuration` с 60 до 120 (глобальный ceiling)
- [x] Сделать `stepCountIs` динамическим по контексту (8 для briefing-onboarding, 3 для остальных)
- [x] Добавить `getModelId()` case: `"briefing-onboarding"` → `"claude-sonnet-4-6"`
- [x] Реализовать `buildBriefingOnboardingPrompt()`:
  - Загрузка шаблона из .md при старте модуля
  - Подстановка `{{USER_CONTEXT}}` — паттерн Secretary (XML, пустые поля пропускать)
  - Подстановка `{{DATE}}` — текущая дата ISO
  - Подстановка `{{YEAR}}` — текущий год
  - Подстановка `{{MODE_INJECTION}}`:
    - mode "create" → статический XML-блок
    - mode "edit" → программная сборка строки с текущими topics/sources из БД (как Manager `buildFirstContactMode()`)
- [x] Добавить case в `buildSystemPrompt()` → `buildBriefingOnboardingPrompt()`
- [x] Определить tool `updateBriefingPreview`:
  - Zod schema: `{ topics: [{ topicId, topicName, emoji }], sources: [{ topicId, sourceName, sourceUrl, rssUrl?, fetchMethod, sourceLanguage, tier }], settings?: { timezone?, language?, maxItems? } }`
  - execute: return `{ success: true, preview: input }` (только для клиентского отображения, не пишет в БД)
- [x] Определить tool `saveBriefingProfile`:
  - Та же Zod schema что у updateBriefingPreview
  - execute: `upsertBriefingSettings()` + `deleteAllBriefingTopicsByUser()` + `addBriefingTopic()` × N + `deleteAllBriefingSourcesByUser()` + `addBriefingSource()` × N + `isActive: true`
  - return `{ success: true, topicsCount, sourcesCount }`
- [x] Подключить `deepResearch({ defaultDepth: "pro" })` и `fetchUrl` через прямой импорт
- [x] Инструкции для `updateBriefingPreview` уже в промпте briefing-onboarding.md (секция tools_usage)

**Файлы:**
- `app/(chat)/api/service-chat/route.ts` — основные изменения
- `lib/prompts/service-chats/briefing-onboarding.md` — возможные правки для упоминания updateBriefingPreview

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Проверка в браузере: POST `/api/service-chat` с `context: "briefing-onboarding"` возвращает streaming response (через curl или dev tools)
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/(chat)/api/service-chat/route.ts lib/prompts/service-chats/
git commit -m "feat(tz-a2): briefing-onboarding service-chat context + tools"
```

**Критерий готовности:** API принимает context "briefing-onboarding", строит промпт с mode injection, вызывает tools, сохраняет профиль в БД.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 2

---

## Этап 3: Frontend — split layout + чат

**Статус:** ✅ Завершён

**Цель:** Заменить заглушку `/briefing/setup` на split layout: Server Component (auth, mode detection) + Client Component (чат с AI, live preview).

**Задачи:**
- [x] Переписать `app/(dashboard)/briefing/setup/page.tsx`:
  - Server Component: auth guard, определение mode (getBriefingSettings → isActive? → "edit" : "create"), загрузка userProfile
  - Передать props в BriefingSetupClient
- [x] Создать `app/(dashboard)/briefing/setup/briefing-setup-client.tsx`:
  - Split layout (паттерн project-creation-client.tsx): aside (lg:block, 400px) + main
  - Header: ← Назад на /briefing, "Настройка брифинга", UserMenu
  - State: `preview` (topics[], sources[], settings), `isSaved`
  - Transport: DefaultChatTransport → `/api/service-chat`, body: { context, briefingMode, userProfile }
  - useChat hook с greeting
  - extractPreviewUpdate() — отслеживание tool results `updateBriefingPreview` и `saveBriefingProfile` в message parts (паттерн processedIdsRef)
  - Success screen после saveBriefingProfile: кнопка "Сгенерировать первый брифинг" → POST /api/briefing/generate → redirect /briefing
- [x] Создать `app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx`:
  - Отображение тем с emoji и источниками под каждой темой
  - Tier badge для источников
  - Настройки мелким шрифтом внизу (язык, maxItems)
  - Состояние "пусто" (placeholder текст)
- [x] Создать `app/(dashboard)/briefing/setup/components/briefing-chat-panel.tsx`:
  - ScrollArea + сообщения + input (паттерн ProjectChatPanel)
  - Typing indicator (Loader2 spinner)
  - Auto-scroll к низу при новых сообщениях
- [x] Создать `components/service-chat/configs/briefing-onboarding.ts`:
  - Reference config с id, title, icon, model, greeting
- [x] Обновить `components/service-chat/configs/index.ts` — экспорт нового конфига

**Файлы:**
- `app/(dashboard)/briefing/setup/page.tsx` — переписать
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — новый
- `app/(dashboard)/briefing/setup/components/briefing-profile-preview.tsx` — новый
- `app/(dashboard)/briefing/setup/components/briefing-chat-panel.tsx` — новый
- `components/service-chat/configs/briefing-onboarding.ts` — новый
- `components/service-chat/configs/index.ts` — экспорт

**Валидация этапа:**
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `npm run build` — успешен
- [ ] Браузер: `/briefing/setup` показывает split layout (не заглушку)
- [ ] Браузер: AI отвечает на первое сообщение, deepResearch вызывается
- [ ] Браузер: превью обновляется при updateBriefingPreview
- [ ] Браузер: мобильная версия — только чат (preview скрыт)
- [ ] 🧪 Мануальный тест пользователем: полный flow create mode

**Git (после валидации):**
```bash
git add app/(dashboard)/briefing/setup/ components/service-chat/configs/
git commit -m "feat(tz-a2): briefing setup split layout + chat UI"
```

**Критерий готовности:** Полный flow: лендинг → setup → AI-беседа → deepResearch → live preview → save → success card → генерация → redirect.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 3

---

## Этап 4: Edit mode + edge cases + polish

**Статус:** ⬜ Не начат

**Цель:** Mode "edit" с загрузкой текущего профиля, edge cases (ошибки deepResearch, повторный визит), polish.

**Задачи:**
- [ ] Mode "edit" в Server Component: загрузить текущие topics + sources из БД, передать в client
- [ ] Mode "edit" в Client Component: показать текущий профиль в preview при загрузке
- [ ] Mode "edit" в prompt builder: программная сборка mode injection с текущими темами/источниками
- [ ] Обновить лендинг `/briefing`: если settings существуют и isActive — НЕ показывать лендинг, показывать последний выпуск (или заглушку "нет выпусков") + кнопку "Настройки" → `/briefing/setup`
- [ ] Edge case: deepResearch ошибка → промпт уже содержит fallback инструкцию, проверить что UI не ломается
- [ ] Edge case: пустые ответы от AI → graceful handling
- [ ] Loading state кнопки "Сгенерировать первый брифинг" (POST `/api/briefing/generate` может быть долгим)
- [ ] Доступность: focus management, keyboard navigation в split layout

**Файлы:**
- `app/(dashboard)/briefing/setup/page.tsx` — загрузка topics/sources для edit
- `app/(dashboard)/briefing/setup/briefing-setup-client.tsx` — edit mode state
- `app/(chat)/api/service-chat/route.ts` — edit mode injection builder
- `app/(dashboard)/briefing/page.tsx` — условный рендер (лендинг vs выпуск)
- `components/briefing/briefing-page.tsx` — возможные изменения

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/briefing/setup` в mode "edit" — текущие темы/источники показаны в preview
- [ ] Браузер: `/briefing` для юзера с профилем — не показывает лендинг
- [ ] Браузер: deepResearch timeout — UI не ломается, AI продолжает диалог
- [ ] 🧪 Мануальный тест пользователем: edit mode + повторный визит

**Git (после валидации):**
```bash
git add app/(dashboard)/briefing/ app/(chat)/api/service-chat/route.ts components/briefing/
git commit -m "feat(tz-a2): edit mode + briefing page routing + edge cases"
```

**Критерий готовности:** Оба режима (create/edit) работают, лендинг не показывается повторно, edge cases обработаны.

---

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 4

---

## Этап 5: Финализация

**Статус:** ⬜ Не начат

**Цель:** Документация, проверка БД, финальное тестирование, обновление версии.

**Задачи:**
- [ ] SQL-проверка БД:
  - `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
  - `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'BriefingTopics';`
  - `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'BriefingSettings';`
- [ ] Финальное мануальное тестирование:
  - Create mode: полный flow от лендинга до генерации
  - Edit mode: изменение тем/источников
  - Повторный визит на /briefing
  - Мобильная версия
- [ ] Обновить главный `CHANGELOG.md` (из локального CHANGELOG)
- [ ] Обновить `SIMPLY_STATUS.md` — ТЗ-A2 завершён
- [ ] Обновить `CLAUDE.md`:
  - Добавить briefing setup компоненты в структуру кода
  - Обновить текущий этап
  - Добавить BriefingTopics в описание БД
- [ ] Обновить `package.json` — версия 3.30.0
- [ ] Обновить `docs/ai-chats-map.md` — новый service-chat контекст briefing-onboarding
- [ ] Обновить `docs/architecture.md` — таблица BriefingTopics, новая модель
- [ ] Переместить папку `specs/TZ_A2_BriefingOnboarding/` → `_archive/`

**Валидация этапа:**
- [ ] `npm run build` — успешен
- [ ] Production URL работает (если деплой)
- [ ] Документация актуальна
- [ ] 🧪 Финальный мануальный тест пользователем

**Git (после валидации):**
```bash
git add -A
git commit -m "docs(tz-a2): finalize v3.30.0 — briefing onboarding"
```

**Критерий готовности:** Все функции работают, БД проверена, документация актуальна, ТЗ в архиве.
