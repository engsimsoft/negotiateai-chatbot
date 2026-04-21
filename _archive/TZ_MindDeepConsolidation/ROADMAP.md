# Roadmap ТЗ-MindDeepConsolidation

**Создан:** 2026-04-21
**Версия проекта:** 3.96.0 → 3.97.0
**Статус:** 🔄 В работе

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 0.5-1 |
| Миграция БД | Да (новая колонка `lastDeepConsolidatedAt`) |

**Правило 7 WORKFLOW:** коммиты на каждом этапе НЕ делаем. Один коммит в финализации.

**Принятые решения (ANALYSIS.md):**
- Модель default: `grok-4.20-0309-reasoning` (через `/dev/models` позже A/B с Haiku 4.5)
- Фильтр активности: `factsUpdatedSince > NOW() - 24h`
- Schedule: 01:00 МСК (22:00 UTC)
- Actions: merge / supersede / remove + **rephrase**
- Race condition защита: snapshot `created_at < run_start_ts`
- Idempotency защита: skip если `lastDeepConsolidatedAt > NOW() - 12h`

---

## Этап A: Инфраструктура (taskId + промпт + функция консолидации)

**Статус:** ⬜ Не начат

**Цель:** Завести `memory:deep-consolidate` как полноценный taskId в SSOT, написать промпт с 4 действиями (включая rephrase), параметризовать `runConsolidation` по taskId/prompt и добавить `deepConsolidateUserMemory()`.

**Задачи:**
- [ ] Добавить тип `"memory:deep-consolidate"` в `TaskId` union в [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts)
- [ ] Добавить запись `DEFAULT_TASK_MODELS["memory:deep-consolidate"] = "grok-4.20-0309-reasoning"` — панель `/dev/models` подхватит автоматически через `ALL_TASK_IDS`
- [ ] Добавить `maxOutputTokens` запись в `DEFAULT_TASK_MAX_OUTPUT_TOKENS` (8192 — reasoning требует запас, т.к. consolidation может возвращать 20 actions)
- [ ] Создать файл [lib/prompts/memory/deep-consolidate.md](lib/prompts/memory/deep-consolidate.md) — промпт с 4 действиями (merge / supersede / remove / **rephrase**), multi-step reasoning, temporal context, защита от false-positive remove
- [ ] Расширить `consolidationActionSchema` в [lib/ai/memory/consolidate.ts](lib/ai/memory/consolidate.ts): добавить `"rephrase"` в enum + поле `rephrasedContent?: string`
- [ ] Параметризовать `runConsolidation(userId, facts, { taskId, systemPrompt })` вместо хардкода `MEMORY_CONSOLIDATE_TASK`
- [ ] Расширить `applyConsolidationActions` — обработать `case "rephrase"`: для rephrase сохранить существующий id, просто обновить content через новую query-функцию `updateMemoryEntryContent(id, content, embedding)` — **без supersede/новый id, чтобы не терять историю references**
- [ ] Добавить `stats.rephrased` в `ConsolidationStats`
- [ ] Создать экспорт `deepConsolidateUserMemory(userId, runStartTs?)` — принимает опциональный timestamp для snapshot-фильтра; при отсутствии = `new Date()`
- [ ] Добавить query `updateMemoryEntryContent` в [lib/ai/memory/memory-queries.ts](lib/ai/memory/memory-queries.ts)

**Файлы:**
- `lib/ai/task-assignments.ts` — новый taskId, модель, maxOutputTokens
- `lib/prompts/memory/deep-consolidate.md` — NEW
- `lib/ai/memory/consolidate.ts` — параметризация, rephrase handler, deepConsolidateUserMemory
- `lib/ai/memory/memory-queries.ts` — updateMemoryEntryContent
- `lib/ai/memory/types.ts` или локально — расширение схемы actions (если выносим)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `ls /dev/models` визуально (после build) — строка `memory:deep-consolidate` появилась
- [ ] Коммит НЕ делаем (правило 7)

**Критерий готовности:** TaskId доступен, функция `deepConsolidateUserMemory` экспортируется, все actions (включая rephrase) отрабатывают в unit-логике `applyConsolidationActions`.

---

## Этап B: Cron + миграция БД + фильтр пользователей

**Статус:** ⬜ Не начат

**Цель:** Завести эндпоинт `/api/cron/memory-deep-consolidate`, миграцию БД для `lastDeepConsolidatedAt`, SQL-запрос «активные за 24ч» и регистрацию cron в vercel.json.

**Задачи:**
- [ ] Добавить колонку `lastDeepConsolidatedAt: timestamp` (nullable) в [lib/db/schema.ts](lib/db/schema.ts) `memorySettings`
- [ ] Сгенерировать миграцию: `npx drizzle-kit generate` (и проверить имя файла `lib/db/migrations/NNNN_*.sql`)
- [ ] Добавить функцию `getUsersForDeepConsolidation({ activeWithinHours = 24 })` в [lib/db/queries.ts](lib/db/queries.ts) — по образцу `getUsersForMemoryProfile`, с фильтрами:
  - `memoryEnabled = true`
  - `factsUpdatedSince > NOW() - interval '24 hours'`
  - `lastDeepConsolidatedAt IS NULL OR lastDeepConsolidatedAt < NOW() - interval '12 hours'`
  - `factCount >= 5` (нет смысла консолидировать базу из 2 фактов)
- [ ] Добавить функцию `markDeepConsolidated(userId, timestamp)` — обновляет `lastDeepConsolidatedAt`
- [ ] Создать [app/api/cron/memory-deep-consolidate/route.ts](app/api/cron/memory-deep-consolidate/route.ts):
  - CRON_SECRET проверка (как в memory-profile)
  - `maxDuration = 240`
  - `runStartTs = new Date()` (snapshot cursor)
  - `getUsersForDeepConsolidation({ activeWithinHours: 24 })`
  - `pLimit(3)` concurrency — обрабатывать юзеров параллельно но не всех сразу
  - Для каждого: `deepConsolidateUserMemory(userId, runStartTs)` → `markDeepConsolidated(userId, runStartTs)`
  - Лог в формате ТЗ: `[cron/memory-deep-consolidate] user=… model=… reviewed=N actions={merged,superseded,removed,rephrased} ratioPercent=X% durationMs=Y`
  - `saveCronRunLog` в конце (по образцу memory-profile)
- [ ] Обновить `runConsolidation` / `deepConsolidateUserMemory` — фильтровать факты `created_at < runStartTs` (snapshot race-condition protection)
- [ ] Добавить в [vercel.json](vercel.json) новый cron entry: `{"path": "/api/cron/memory-deep-consolidate", "schedule": "0 22 * * *"}` (22:00 UTC = 01:00 МСК)

**Файлы:**
- `lib/db/schema.ts` — новая колонка
- `lib/db/migrations/*.sql` — generated миграция
- `lib/db/queries.ts` — getUsersForDeepConsolidation, markDeepConsolidated
- `lib/ai/memory/memory-queries.ts` — getMemoryEntriesByUser с фильтром `beforeTs?` (если не поддерживается сейчас)
- `lib/ai/memory/consolidate.ts` — snapshot-фильтр передаётся дальше
- `app/api/cron/memory-deep-consolidate/route.ts` — NEW
- `vercel.json` — новый cron

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] ⚠️ **ПЕРЕД `npm run build`**: уведомить владельца — `tsx lib/db/migrate` накатит новую колонку в Neon
- [ ] После OK владельца: `npm run build` — успешен, миграция прошла
- [ ] SQL-проверка: `SELECT column_name FROM information_schema.columns WHERE table_name = 'memory_settings' AND column_name = 'lastDeepConsolidatedAt'` через `mcp__postgres__query` — колонка есть
- [ ] Коммит НЕ делаем (правило 7)

**Критерий готовности:** Миграция в БД прошла, cron-эндпоинт отвечает на GET с CRON_SECRET, route.ts компилируется.

---

## Этап C: Локальная валидация прогона + `/dev/models` A/B proof

**Статус:** ⬜ Не начат

**Цель:** Убедиться что прогон работает end-to-end: на локальном dev-сервере triggered руками, видим логи, видим UPDATE'ы в БД, можем переключить модель через `/dev/models`.

**Задачи:**
- [ ] `npm run dev` — dev server запущен
- [ ] Через browser `/dev/models` — проверить что строка `memory:deep-consolidate` с default `grok-4.20-0309-reasoning` видна
- [ ] Ручной прогон (локально, CRON_SECRET из `.env.local`):
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/memory-deep-consolidate
  ```
- [ ] Проверить логи в консоли — виден формат `[cron/memory-deep-consolidate] user=…`
- [ ] SQL-проверка через `mcp__postgres__query`:
  - `SELECT * FROM ai_usage_log WHERE chat_mode = 'memory:deep-consolidate' ORDER BY created_at DESC LIMIT 5` — usage логируется
  - `SELECT "userId", "lastDeepConsolidatedAt" FROM memory_settings WHERE "lastDeepConsolidatedAt" > NOW() - interval '1 hour'` — cursor обновился
  - `SELECT COUNT(*) FROM memory_entry WHERE "supersededBy" IS NOT NULL AND "updatedAt" > NOW() - interval '1 hour'` — действия применились
- [ ] A/B тест через `/dev/models`: переключить override на `claude-haiku-4-5-20251001` → повторный прогон → сравнить (a) кол-во actions, (b) durationMs, (c) usdCost в ai_usage_log
- [ ] Idempotency проверка: повторный прогон сразу после первого → пользователи должны быть отфильтрованы (`lastDeepConsolidatedAt < 12h`)

**Файлы:** изменений нет — только валидация.

**Валидация этапа:**
- [ ] `npx tsc --noEmit` — 0 ошибок (переспросить после любых fix)
- [ ] Логи cron'а совпадают с форматом ТЗ
- [ ] SQL-проверки пройдены
- [ ] 🧪 **Мануальный тест владельцем**: проверить страницу «Мой контекст» до/после прогона — видно ли очищенную память (merge/rephrase применились), ничего критичного не пропало

**Критерий готовности:** Прогон работает, логи и SQL показывают ожидаемое поведение, владелец подтвердил качество результата на своей памяти.

---

## Этап D: Финализация (один коммит, документация, архивация)

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать [DOCUMENTATION_GUIDE.md](../../DOCUMENTATION_GUIDE.md) — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] Прочитать `DOCUMENTATION_GUIDE.md`
- [ ] Обновить главный [CHANGELOG.md](../../CHANGELOG.md) — запись v3.97.0 c MindDeepConsolidation
- [ ] Обновить [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) — строка MIND, добавить упоминание deep-consolidate
- [ ] ⛔ `wc -l CLAUDE.md` → если > 220, STOP и доложить. **Не трогать CLAUDE.md** иначе.
- [ ] Обновить [package.json](../../package.json) — version 3.96.0 → 3.97.0

**Документация (по таблице Правила 6 WORKFLOW):**
- [ ] `docs/ai-chats-map.md` — триггер `task-assignments.ts` + `model-catalog.ts`. Добавить `memory:deep-consolidate` в карту задач, модель = Grok 4.20 reasoning
- [ ] `docs/architecture.md` — триггер новая колонка `pgTable`, новый endpoint. Добавить `memory:deep-consolidate` cron в Data Layer
- [ ] `docs/deployment.md` — триггер Vercel config + новая миграция. Добавить новый cron в список Vercel crons
- [ ] `docs/ai-agents.md` — триггер новый промпт в `lib/prompts/memory/`. Добавить `deep-consolidate.md` в список агентов
- [ ] ADR? — **Нужен**: `docs/decisions/055-tiered-memory-consolidation.md` (tiered hot/background паттерн + источник Letta + snapshot cursor pattern)

**FINDINGS / backlog:**
- [ ] Если создан `FINDINGS.md` — оформить значимые находки в `specs/_backlog/`
- [ ] Зафиксировать follow-up задачу **«A/B Haiku vs Grok 4.20 после 7 дней production»** в `_backlog/` с критерием: если Haiku находит ≥80% actions за ≤40% стоимости → даунгрейдить default

**Единый коммит (правило 7):**
```bash
git status
git add lib/ai/task-assignments.ts \
        lib/prompts/memory/deep-consolidate.md \
        lib/ai/memory/consolidate.ts \
        lib/ai/memory/memory-queries.ts \
        lib/db/schema.ts \
        lib/db/migrations/ \
        lib/db/queries.ts \
        app/api/cron/memory-deep-consolidate/route.ts \
        vercel.json \
        package.json \
        CHANGELOG.md \
        SIMPLY_STATUS.md \
        docs/ai-chats-map.md \
        docs/architecture.md \
        docs/deployment.md \
        docs/ai-agents.md \
        docs/decisions/055-tiered-memory-consolidation.md \
        specs/TZ_MindDeepConsolidation/ \
        specs/_backlog/README.md
git commit -m "feat(tz-mind-deep-consolidation): ночная консолидация памяти на Grok 4.20 reasoning"
```

**Архивация:**
- [ ] `mv specs/TZ_MindDeepConsolidation/ specs/_archive/TZ_MindDeepConsolidation/`

**Валидация:**
- [ ] `npm run build` — успешен (без новых миграций на этом этапе)
- [ ] Production deploy (если готовы) — Vercel подхватит новый cron
- [ ] Документация верифицирована против кода (grep-тесты из Правила 6)

**Критерий готовности:** Коммит создан, папка в архиве, документация отражает реальное состояние кода.

---

## ⛔ Gate-keeping

```
Этап A → tsc → (нет build, нет миграции) → ОК → СТОП → запрос OK владельца
Этап B → tsc → ПРЕДУПРЕДИТЬ ОБ auto-migration → build → SQL check → ОК → СТОП → запрос OK владельца
Этап C → tsc → локальный прогон + SQL → A/B сравнение → ОК → СТОП → запрос OK владельца
Этап D → финализация → 1 коммит → архив
```
