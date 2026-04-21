# Анализ ТЗ-MindDeepConsolidation

**Дата:** 2026-04-21
**Автор анализа:** Claude Code
**Зависимость:** ТЗ-MindOnVisit (v3.96.0) — закрыт ✅

---

## Резюме

Добавить ночной cron `/api/cron/memory-deep-consolidate` на отдельной модели, который будет «причёсывать» базу MIND-фактов: ловить тонкие повторы, противоречия, устаревшие факты — которые `memory:consolidate` на Grok 4.1 Fast в hot path пропускает. Переиспользовать существующую инфраструктуру `consolidateUserMemory` + `applyConsolidationActions`.

---

## Изученная документация (Правило 1)

Research через subagent (2026-04-21). Подтверждена публичная документация по tiered memory consolidation в AI-агентах.

| Источник | Находка |
|---|---|
| [Mem0 OSS v2→v3 migration](https://docs.mem0.ai/migration/oss-v2-to-v3) | ADD-only в hot path подтверждён. UPDATE/DELETE/NOOP — в периодической консолидации. Детали частоты и модели НЕ опубликованы. |
| [Mem0 Dream gate changelog](https://docs.mem0.ai/changelog/highlights) | Упоминание «automatic memory consolidation during idle periods» без технических деталей. |
| [Letta sleep-time compute](https://docs.letta.com/guides/agents/architectures/sleeptime) ⭐ | **Самый проработанный источник.** Две ключевые рекомендации: (1) модель — Haiku-класс, «memory consolidation doesn't require expensive reasoning»; (2) race condition → `last_processed_message_id` cursor. |
| [Letta forum best practices](https://forum.letta.com/t/sleeptime-agents-for-memory-consolidation-best-practices-guide/154) | Cadence: dedup на каждом прогоне, light consolidation на session-end, full reorganization еженедельно, hierarchical rollups ежемесячно. |
| [Zep/Graphiti arxiv 2501.13956](https://arxiv.org/html/2501.13956v1) | Bi-temporal model с `t_valid` / `t_invalid` timestamps. LLM (gpt-4o-mini) инвалидирует конфликтующие edges, НЕ удаляет. |

**Ключевой вывод:** публичной документации мало, Letta — единственный источник конкретных best practices. Mem0 v3 и Dream gate — маркетинг без технических деталей.

**Красные флаги (2026):**
1. **Информационные потери при консолидации** — суммаризация уничтожает факты, которые нельзя восстановить из промежуточного summary. Митигация: никакого `remove` без supersede-reference.
2. **Race condition hot vs background** — если hot path пишет факт пока cron работает — факт может попасть в устаревший снимок и быть удалён. Митигация: snapshot `WHERE created_at < run_start_timestamp`.
3. **Over-consolidation** — слишком частое full reorganization теряет гранулярность фактов (Letta forum прямое предупреждение).
4. **Стоимость reasoning-модели** на спящих пользователях — diminishing returns. Митигация: фильтр активности.
5. **Ложноположительный supersede** без temporal metadata не различает «устарел» от «дополнен».

---

## Рекомендации разработчика (Код-ревью ТЗ)

> Ниже — технические рекомендации на основе research и анализа кодовой базы.
> Каждая рекомендация требует согласования с владельцем.

### ✅ Согласен с ТЗ

- **Scope пункт 1** (новый taskId `memory:deep-consolidate`) — OK, SSOT-паттерн совпадает с [task-assignments.ts:156-159](lib/ai/task-assignments.ts#L156-L159).
- **Scope пункт 2** (новый промпт `lib/prompts/memory/deep-consolidate.md`) — OK.
- **Scope пункт 3** (`deepConsolidateUserMemory()` с реюзом `applyConsolidationActions`) — OK, инфраструктура в [consolidate.ts:186-262](lib/ai/memory/consolidate.ts#L186-L262) прямо параметризуется.
- **Scope пункт 4** (отдельный cron) — OK, подтверждаю что встраивать в `memory-profile` плохо (разные модели, длительность, логика).
- **Что НЕ делаем** — согласен, hot path не трогаем.

### ⚠️ Рекомендую изменить / дополнить

| # | Было (ТЗ) | Рекомендация | Обоснование |
|---|-----------|--------------|-------------|
| 1 | Модель по умолчанию: **reasoning** (Grok 4.2 / Sonnet / Opus на A/B) | Предлагаю default **Grok 4.20 reasoning** (в production как «Зал», бесплатный А/B через `/dev/models` — ничего не докачиваем) | Цитата владельца в TZ источнике: «продуманной модели умной до Grok 4.2» → reasoning по запросу. НО: Letta прямо говорит что consolidation не требует reasoning (Haiku хватает) — поэтому через `/dev/models` A/B-сравнить с Claude Haiku 4.5 сразу после запуска. Если разницы нет — даунгрейдим для экономии. |
| 2 | Фильтр: «все **или** только активные за неделю» | **Активные за 24 часа** (фильтр `factsUpdatedSince > NOW() - 24h`) | Research Letta: «too often is expensive, has diminishing returns». Если у пользователя нет новых фактов за сутки — background-консолидировать нечего, reasoning-токены сгорают впустую. 24h жёстче 7d, но с ежедневным cron'ом ничего не теряем — спящий пользователь попадёт в прогон в первый же день активности. |
| 3 | Schedule: 02:00 МСК (за час до `memory-profile` в 03:00) | **01:00 МСК (22:00 UTC)** — за 2 часа до memory-profile (00:00 UTC = 03:00 МСК) | 1ч gap мало: если у активного юзера много фактов — deep-consolidate может не успеть до запуска profile. 2ч запас безопаснее. |
| 4 | Действия: merge / supersede / remove (как в текущем `applyConsolidationActions`) | Добавить **`rephrase`** (компрессия длинного факта в более точный короткий — БЕЗ потери id) | Research: Letta использует rephrase для hierarchical rollups. Пример: факт «Пользователь упомянул что его жена Юлия работает в отделе продаж розничной сети продуктов в Москве» → rephrase → «Жена пользователя Юлия — продажи, ритейл, Москва». Без rephrase такие факты не чинятся: merge требует второй факт, supersede требует новый факт-замены. **Но:** это расширяет scope — нужно обсудить, оставить на follow-up ТЗ или включить сейчас. |
| 5 | В ТЗ не упомянут race condition | Добавить **snapshot-based filter**: `WHERE memory_entry.created_at < run_start_ts` | Letta pattern: cursor защищает от обработки фактов, добавленных во время работы cron. Простая реализация — снимок timestamp при старте cron, фильтр в запросе на чтение фактов. Иначе: hot path extract пишет факт → deep-consolidate видит его, считает дублем к старому, делает supersede → теряем только что созданный факт. |
| 6 | В ТЗ acceptance criteria упоминают `[cron/memory-deep-consolidate] user=... model=... actions={merged:N, superseded:M, removed:K}` | Добавить в лог: (a) `reviewed:N` (сколько фактов посмотрели), (b) `ratioPercent` (% изменённых), (c) `durationMs`, (d) `usdCost` (Grok reasoning дорогой) | Метрики ROI из research (analogы Letta / Zep DMR): без `ratioPercent` нельзя отследить когда модель перестаёт приносить пользу. Без `usdCost` — нельзя принять решение о даунгрейде. |

### ❓ Требует уточнения (вопросы владельцу)

1. **Rephrase включаем в scope ТЗ или выносим?** — аргумент «за»: это 1 extra action type в JSON schema + строка в промпте, реально +0.1 сессии. Аргумент «против»: раздувает scope, можно наблюдать 2 недели на merge/supersede/remove, потом делать follow-up ТЗ. **Моя рекомендация: включить сейчас**, потому что без rephrase промпт deep-consolidate почти не отличается от обычного consolidate — ценность ТЗ падает.

2. **A/B план после запуска** — через сколько дней сравниваем Grok 4.20 reasoning vs Claude Haiku 4.5? Нужен хотя бы 1 прогон на 5+ активных пользователях. Предлагаю: после 7 дней production смотрим `ratioPercent` + `usdCost` per action в `ai_usage_log` → если Haiku находит ≥80% изменений за ≤40% цены — даунгрейдим. Это не задача ТЗ, а follow-up проверка; но критерий зафиксируем в HANDOFF.md.

3. **Метрика «активные за 24ч»** — какое поле использовать?
   - Вариант A: `memorySettings.factsUpdatedSince > NOW() - 24h` — удобно, уже есть в schema.
   - Вариант B: JOIN с `Message_v2.createdAt` — точнее «пользователь был в чате за 24ч», но тяжёлый запрос.
   - Рекомендую A — `factsUpdatedSince` обновляется при каждом insert факта, то есть = «был ли extract за 24ч». Если фактов не было — консолидировать нечего, вариант A семантически даже корректнее.

---

## Потенциальные риски

| Риск | Митигация |
|---|---|
| Cron не успевает за maxDuration Vercel (240с) при большом числе активных юзеров | `p-limit(3)` concurrency + лог durationMs per user; если падает — разбиваем по батчам userId в итерациях |
| LLM delete хороший факт | Запрет `remove` без supersededById в промпте + валидация в applyConsolidationActions (отвергать remove-actions без reason) |
| Race condition с hot-path consolidate (≥10 triggered) | Snapshot-фильтр по `created_at < run_start_ts` в запросе чтения фактов |
| Usage-лог не видит deep-consolidate отдельно от consolidate | `chatMode: "memory:deep-consolidate"` в `logUsage()` — отдельная метка |
| Двойной запуск cron (Vercel retry + ручной) | Проверка `lastDeepConsolidatedAt > NOW() - 12h` на старте — skip если недавно прогонялся |

---

## Зависимости

- **Satisfied:** ТЗ-MindOnVisit (v3.96.0) — `factExtractionStrategy`, on-visit tails extraction
- **Затронутые компоненты:**
  - [lib/ai/memory/consolidate.ts](lib/ai/memory/consolidate.ts) — новая функция `deepConsolidateUserMemory`, параметризация `runConsolidation` по taskId
  - [lib/ai/task-assignments.ts](lib/ai/task-assignments.ts) — новый `memory:deep-consolidate`
  - [lib/prompts/memory/deep-consolidate.md](lib/prompts/memory/deep-consolidate.md) — новый промпт (NEW)
  - [app/api/cron/memory-deep-consolidate/route.ts](app/api/cron/memory-deep-consolidate/route.ts) — новый cron (NEW)
  - [lib/db/queries.ts](lib/db/queries.ts) — новая `getUsersForDeepConsolidation({ activeWithinHours: 24 })` (аналог `getUsersForMemoryProfile`)
  - [lib/db/schema.ts](lib/db/schema.ts) — новая колонка `memorySettings.lastDeepConsolidatedAt` (миграция)
  - [vercel.json](vercel.json) — новый cron entry 22:00 UTC
  - [docs/ai-chats-map.md](docs/ai-chats-map.md) — новый taskId в карте
  - [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — отразить new memory task (строка MIND)
  - [CHANGELOG.md](CHANGELOG.md) — финализация
  - [package.json](package.json) — версия 3.96.0 → 3.97.0

**Миграция БД:** нужна — колонка `lastDeepConsolidatedAt` timestamp nullable. `npm run build` запускает `tsx lib/db/migrate` ⛔ — предупредить владельца ДО build.

---

## Оценка сложности

- [x] **Простое (0.5-1 сессия)** — подтверждаю оценку ТЗ. Переиспользуем 80% инфраструктуры `consolidateUserMemory`.

Разбивка:
- Этап A (код): taskId + model-catalog запись + промпт + функция — ~20% сессии
- Этап B (cron + миграция): route + schema + query + vercel.json — ~30% сессии
- Этап C (валидация): tsc → build (с миграцией) → мануальный прогон через `/dev/models` override → SQL-проверка `ai_usage_log` — ~30% сессии
- Финализация: docs + CHANGELOG + SIMPLY_STATUS + 1 коммит — ~20% сессии

---

## Acceptance criteria (уточнённые vs ТЗ)

1. ✅ Новый taskId `memory:deep-consolidate` в `/dev/models` для A/B
2. ✅ Лог `[cron/memory-deep-consolidate] user=... model=... reviewed=N actions={merged, superseded, removed, rephrased} ratioPercent=X%`
3. ✅ `ai_usage_log` фиксирует RUB per run с `chatMode="memory:deep-consolidate"`
4. ✅ Snapshot-защита от race condition (`created_at < run_start_ts`)
5. ✅ Skip-защита: `lastDeepConsolidatedAt > NOW() - 12h` → skip user
6. ✅ Schedule 22:00 UTC = 01:00 МСК (2ч gap перед memory-profile в 00:00 UTC)

---

## Требуется решение владельца ПЕРЕД переходом к ROADMAP

1. **Rephrase action** — включить в scope сейчас (моя рекомендация) или отложить на follow-up?
2. **Фильтр активности** — `factsUpdatedSince > NOW() - 24h` (моя рекомендация) или 7 дней как в исходном ТЗ?
3. **Schedule** — 01:00 МСК / 22:00 UTC (моя рекомендация, 2ч gap) или 02:00 МСК / 23:00 UTC как в ТЗ?
4. **Модель default** — Grok 4.20 reasoning подтверждаешь, или сразу стартуем на Claude Haiku 4.5 (Letta рекомендация)?

После ответов создаю ROADMAP.md и стартую Фазу 2.
