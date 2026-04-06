# Roadmap ТЗ-RAG2: MIND Consolidation + Profile + UI

**Создан:** 2026-04-06
**Версия проекта:** 3.71.0 → 3.72.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 6 |
| Текущий этап | 1 |
| Сессий (оценка) | 3-5 |

**Решения архитектора (согласованы):**
1. Консолидация — гибрид: ночной batch cron (3:00 MSK) + event-triggered мини-консолидация каждые 20 новых фактов
2. Opus-профиль — >= 10 активных фактов + есть новые факты с последней генерации
3. UI — секция «Память» на `/settings`, не отдельная страница
4. `memory_settings` — отдельная таблица по паттерну `briefingSettings`
5. Мини-консолидация: триггер в extract.ts через waitUntil(), НЕ в chat/route.ts. Порог: 20 новых фактов

---

## Этап 1: DB — memory_settings + user_profile_summary

**Статус:** ✅ Завершён

**Цель:** Создать таблицы для настроек памяти и Opus-профиля. Добавить query-функции.

**Задачи:**
- [x] Добавить таблицу `memory_settings` в `lib/db/schema.ts` (userId UNIQUE, memoryEnabled boolean default true, factsUpdatedSince timestamp nullable, factsSinceConsolidation integer default 0, lastConsolidatedAt timestamp nullable, createdAt, updatedAt)
- [x] Добавить таблицу `user_profile_summary` в `lib/db/schema.ts` (userId UNIQUE, content text, factCount integer, tokenCount integer, costUsd numeric, modelId varchar, generatedAt timestamp)
- [x] Создать миграцию `lib/db/migrations/0049_memory-settings-and-profile.sql`
- [x] Применить миграцию: `npm run db:migrate`
- [x] Добавить query-функции в `lib/db/queries.ts`:
  - `getMemorySettings(userId)` — get or create default
  - `updateMemorySettings(userId, patch)` — partial update
  - `incrementFactsSinceConsolidation(userId)` — atomic increment + factsUpdatedSince
  - `getProfileSummary(userId)` — get latest profile
  - `upsertProfileSummary(userId, data)` — insert or update profile
  - `getUsersForMemoryProfile()` — users with memoryEnabled + >= 10 facts + factsUpdatedSince > generatedAt
- [x] Обновить `extractAndStoreFacts` в `lib/ai/memory/extract.ts` — после успешного upsert, вызывать `incrementFactsSinceConsolidation` (fire-and-forget)

**Файлы:**
- `lib/db/schema.ts` — +2 таблицы
- `lib/db/migrations/NNNN_memory-settings-and-profile.sql` — миграция
- `lib/db/queries.ts` — +5 query functions
- `lib/ai/memory/extract.ts` — +factsUpdatedSince update

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: `SELECT * FROM memory_settings LIMIT 1;` — таблица существует
- [ ] SQL: `SELECT * FROM user_profile_summary LIMIT 1;` — таблица существует
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/db/schema.ts lib/db/migrations/ lib/db/queries.ts lib/ai/memory/extract.ts
git commit -m "feat(tz-rag2): DB tables — memory_settings + user_profile_summary"
```

**Критерий готовности:** Обе таблицы в БД, query-функции работают, factsUpdatedSince обновляется при extract.

---

## Этап 2: Consolidation — полная + мини-ревизия фактов

**Статус:** ✅ Завершён

**Цель:** Два режима ревизии фактов Sonnet:
- **Полная** (`consolidateUserMemory`) — все активные факты, для ночного cron
- **Мини** (`miniConsolidateUserMemory`) — только последние N фактов vs существующие, для event-trigger

**Задачи:**
- [x] Создать промпт `lib/prompts/memory/consolidate.md` — инструкция для Sonnet: получает список фактов, возвращает actions (keep/merge/supersede/remove) с обоснованием. Единый промпт для обоих режимов (разница — в количестве фактов на входе)
- [x] Создать `lib/ai/memory/consolidate.ts`:
  - `consolidateUserMemory(userId)` — полная ревизия: загрузить ВСЕ активные факты → Sonnet generateObject → применить actions
  - `miniConsolidateUserMemory(userId)` — мини-ревизия: загрузить последние 30 фактов → Sonnet → применить actions. Сбросить `factsSinceConsolidation = 0` после успеха
  - Shared: `applyConsolidationActions(actions)` — применить merge/supersede/remove к БД
  - Zod-схема ответа: `{ actions: [{ factId, action: supersede|merge|remove, supersededById?, mergedContent?, reason }] }`
  - Cost logging: `memory:consolidate`
  - Return stats: `{ reviewed, merged, superseded, removed, durationMs }`
- [x] Обновить `lib/ai/memory/extract.ts` — после сохранения факта:
  - Инкремент `factsSinceConsolidation` в memory_settings
  - Если `factsSinceConsolidation >= 20` → `void miniConsolidateUserMemory(userId)` (fire-and-forget, не await)
  - Порог (20) — константа `MINI_CONSOLIDATION_THRESHOLD`
- [x] Обновить `lib/ai/memory/index.ts` — re-export consolidate

**Файлы:**
- `lib/prompts/memory/consolidate.md` — новый промпт
- `lib/ai/memory/consolidate.ts` — новый модуль
- `lib/ai/memory/extract.ts` — +инкремент счётчика + мини-консолидация триггер
- `lib/ai/memory/index.ts` — +re-export

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Ручной тест полной ревизии: через SQL проверить что actions применяются
- [ ] Ручной тест мини-ревизии: после 20 фактов счётчик сбрасывается, противоречия resolved
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/prompts/memory/consolidate.md lib/ai/memory/consolidate.ts lib/ai/memory/extract.ts lib/ai/memory/index.ts
git commit -m "feat(tz-rag2): Sonnet consolidation — full + mini review with event trigger"
```

**Критерий готовности:** Обе ревизии работают, мини-триггер срабатывает на пороге 20 фактов, usage логируется.

---

## Этап 3: Opus-профиль + Cron

**Статус:** ✅ Завершён

**Цель:** Ночной cron: консолидация (Sonnet) → профиль (Opus) → сохранение. Профиль инжектируется в system prompt.

**Задачи:**
- [x] Создать промпт `lib/prompts/memory/profile.md` — инструкция для Opus: получает все активные факты, генерирует нарративный профиль (800-1200 слов, русский)
- [x] Создать `lib/ai/memory/profile.ts`:
  - `generateUserProfile(userId)` — загрузить факты → Opus generateText → save to user_profile_summary
  - `getProfileBlock(userId)` — загрузить профиль из DB, вернуть как XML-блок
  - Cost logging: `memory:profile`
  - Return: `{ content, factCount, tokenCount, costUsd, durationMs }`
- [x] Создать `app/api/cron/memory-profile/route.ts` по паттерну `cron/briefing`:
  - CRON_SECRET auth
  - `getUsersForMemoryProfile()` — eligible users
  - Per user: `consolidateUserMemory()` → `generateUserProfile()`
  - p-limit(3), saveCronRunLog
  - maxDuration = 240
- [x] Обновить `vercel.json` — добавить cron: `"0 0 * * *"` (3:00 MSK / 0:00 UTC)
- [x] Обновить `app/(chat)/api/chat/route.ts` — перед memory retrieval:
  - Загрузить профиль: `getProfileBlock(userId)`
  - Инжектировать профиль ПЕРЕД `<memory>` блоком
  - Graceful degradation: profile load failure не ломает чат
- [x] Обновить `lib/ai/memory/index.ts` — re-export profile

**Файлы:**
- `lib/prompts/memory/profile.md` — новый промпт
- `lib/ai/memory/profile.ts` — новый модуль
- `app/api/cron/memory-profile/route.ts` — новый cron
- `vercel.json` — +cron entry
- `lib/ai/memory/retrieve.ts` — +getProfileBlock, profile injection
- `app/(chat)/api/chat/route.ts` — +profile inject
- `lib/ai/memory/index.ts` — +re-export

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] SQL: профиль сгенерирован для тестового пользователя (ручной вызов cron endpoint)
- [ ] Проверка: профиль видно в system prompt (через DevPanel → Prompt section)
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add lib/prompts/memory/profile.md lib/ai/memory/profile.ts app/api/cron/memory-profile/route.ts vercel.json lib/ai/memory/retrieve.ts app/\(chat\)/api/chat/route.ts lib/ai/memory/index.ts
git commit -m "feat(tz-rag2): Opus profile + nightly cron — two-layer context"
```

**Критерий готовности:** Cron генерирует профиль, профиль видно в DevPanel prompt, два слоя контекста работают.

---

## Этап 4: API памяти

**Статус:** ✅ Завершён

**Цель:** REST API для управления фактами и настройками памяти из UI.

**Задачи:**
- [x] Создать `app/(chat)/api/user/memory/route.ts`:
  - `GET` — список фактов (query params: category?, limit=50, offset=0). Возвращает: facts[], total, profile summary (date, factCount)
  - `DELETE` — body: `{ id: string }` удалить один факт. Или `{ all: true }` удалить все
- [x] Создать `app/(chat)/api/user/memory/settings/route.ts`:
  - `GET` — текущие настройки (memoryEnabled, profile date, fact count)
  - `PATCH` — обновить (memoryEnabled toggle)
- [x] Обновить `app/(chat)/api/chat/route.ts` — проверять memoryEnabled перед retrieve и extract:
  - isMemoryEnabled hoisted above createUIMessageStream (shared between execute + onFinish)
  - Dynamic import getMemorySettings, check memoryEnabled
  - Both retrieve (execute) and extract (onFinish) gated
- [x] Обновить `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогичная проверка memoryEnabled

**Файлы:**
- `app/(chat)/api/user/memory/route.ts` — новый API
- `app/(chat)/api/user/memory/settings/route.ts` — новый API
- `app/(chat)/api/chat/route.ts` — +memoryEnabled check
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — +memoryEnabled check

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] API тест: `GET /api/user/memory` — возвращает факты
- [ ] API тест: `DELETE /api/user/memory` с `{ id }` — удаляет факт
- [ ] API тест: `PATCH /api/user/memory/settings` с `{ memoryEnabled: false }` — отключает
- [ ] Проверка: с `memoryEnabled=false` retrieve и extract не вызываются
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add app/\(chat\)/api/user/memory/ app/\(chat\)/api/chat/route.ts app/\(chat\)/api/projects/
git commit -m "feat(tz-rag2): Memory API — facts CRUD + settings + memoryEnabled gate"
```

**Критерий готовности:** API полностью работает, memoryEnabled gate проверен.

---

## Этап 5: UI секция «Память» на /settings

**Статус:** ✅ Завершён

**Цель:** Пользователь видит что AI знает, может удалить факты, отключить/включить память.

**Задачи:**
- [x] Создать `components/settings/memory-section.tsx`:
  - Toggle «Извлечение фактов» (memoryEnabled) — SWR mutate
  - Opus-профиль: read-only блок, дата генерации, factCount. Если нет — "Профиль будет создан автоматически"
  - Список фактов: категория badge (цвет по категории), содержимое, дата, confidence%. Hover trash
  - Удаление факта: кнопка trash → DELETE API (hover reveal)
  - «Удалить всё» — AlertDialog confirm → DELETE API all
  - Статистика: N фактов
- [x] Обновить `app/(dashboard)/settings/settings-page.tsx`:
  - Добавить "memory" в Section type union
  - Добавить секцию в SECTIONS array (Brain icon из Lucide)
  - Добавить условный рендеринг MemorySection
- [x] Прочитать `docs/design-system.md` перед стилизацией — семантические токены, hover паттерны

**Файлы:**
- `components/settings/memory-section.tsx` — новый компонент
- `app/(dashboard)/settings/settings-page.tsx` — +секция "Память"

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm run build` — успешен
- [ ] Браузер: `/settings` → секция "Память" видна
- [ ] Браузер: toggle вкл/выкл работает
- [ ] Браузер: список фактов отображается с категориями
- [ ] Браузер: удаление одного факта работает
- [ ] Браузер: "Удалить всё" работает
- [ ] Браузер: профиль отображается (или placeholder)
- [ ] 🧪 Мануальный тест пользователем

**Git (после валидации):**
```bash
git add components/settings/memory-section.tsx app/\(dashboard\)/settings/settings-page.tsx
git commit -m "feat(tz-rag2): Memory UI — settings section with facts list + profile"
```

**Критерий готовности:** Пользователь может просматривать, удалять факты и управлять настройками памяти.

---

## Этап 6: Финализация

**Статус:** ⬜ Не начат

⛔ НЕ НАЧИНАТЬ без подтверждения Этапа 5

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать DOCUMENTATION_GUIDE.md → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный CHANGELOG.md
- [ ] Обновить SIMPLY_STATUS.md (RAG-2 ✅, версия 3.72.0)
- [ ] Обновить CLAUDE.md (MIND Memory section: +consolidate, +profile, +memory-section, +cron, +API)
- [ ] Обновить package.json (3.72.0)
- [ ] Обновить PHASES.md (RAG-2 ✅)

**Документация (по чеклисту — оценить каждый пункт):**
- [ ] ADR нужен? → Да: `docs/decisions/041-mind-consolidation-profile-architecture.md`
- [ ] docs/architecture.md нужно обновить? (новые таблицы, cron)
- [ ] docs/ai-chats-map.md нужно обновить? (Opus в cron)
- [ ] docs/ai-providers.md → Реестр конфигураций (Opus для профиля, Sonnet для консолидации)

**Верификация docs против кода (Правило 5):**
- [ ] `ai-providers.md` → Реестр конфигураций сверен с grep по коду
- [ ] `ai-chats-map.md` → код-блок myProvider совпадает с `providers.ts`
- [ ] `CLAUDE.md` → пути файлов и описания актуальны

**SQL-проверка БД:**
- [ ] `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;` — memory_settings, user_profile_summary
- [ ] `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'memory_settings';`
- [ ] `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_profile_summary';`

**Завершение:**
- [ ] Финальное мануальное тестирование (пользователь)
- [ ] Обновить RAG2_HANDOFF.md
- [ ] Переместить папку в _archive/ (вместе со всеми RAG файлами)

**Валидация:**
- [ ] `npm run build` — успешен
- [ ] Production URL работает (если деплой)
- [ ] Документация актуальна (проверено по чеклисту выше)
