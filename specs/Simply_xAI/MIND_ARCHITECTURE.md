# MIND — Архитектура памяти Simply

**Живой документ.** Обновляется при каждом изменении MIND pipeline или thresholds. Единый источник правды для всех ТЗ серии Simply_xAI и последующих работ с памятью.

**Назначение:**
- Reference — понять что происходит с памятью пользователя в Simply, без перебора кода
- Testing harness — какие параметры временно крутить для быстрых тестов
- Journal — отслеживать изменения маппингов модель↔задача по мере миграции

**Последняя major ревизия: ТЗ-COMPACTION-UNIFY (v3.95.0, 2026-04-20).**
Per-turn extract (taskId `memory:extract`, промпт `extract.md`, функции `extractFactsFromMessages` / `extractAndStoreFacts`) удалён. Extract запускается только внутри compaction cycle через `prepareMessagesWithCompaction` — на подмножестве сообщений, уходящих в summary (Mem0 best practice 2026 «memory formation before summarization»). Все пороги считаются от `SIMPLY_CONTEXT_LIMIT = 200_000` — константы `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT/HARD`, `EXTRACT_PAUSE_MS` удалены из кода. Полное обоснование: [ADR 054](../../docs/decisions/054-single-strategy-compaction.md).

**Правка 2026-04-21: ТЗ-MindConsolidationTriggers v2.** Mini-consolidation (`miniConsolidateUserMemory`, константы `MINI_CONSOLIDATION_THRESHOLD` / `MINI_RECENT_FACTS_LIMIT`) удалена — дублировала full-проход без преимуществ. Триггер consolidation стал двойным: мгновенный (`storedCount >= 10` на одном compaction) **ИЛИ** накопительный (`factsSinceConsolidation + storedCount >= 15`, константа `CONSOLIDATION_THRESHOLD_CUMULATIVE`). Счётчик `factsSinceConsolidation` реанимирован — обнуляется при запуске `consolidateUserMemory`. Обоснование дизайна (Mem0 v3, Letta sleep-time compute, Dream gate) — [specs/_backlog/TZ_MindConsolidationTriggers.md](../_backlog/TZ_MindConsolidationTriggers.md) (v2).

**Правка 2026-04-21: ТЗ-MindOnVisit (v3.96.0).** Добавлен on-visit trigger через Next.js `after()` API — обработка хвостов памяти после ответа пользователю с дебаунсом 30 минут (`MIND_CHECK_DEBOUNCE_MS`). Cron (`memory-profile`) расширен на все 4 chat-режима (раньше только simply). Пользователь сам выбирает стратегию обработки в настройках памяти ([memory-section.tsx](../../components/settings/memory-section.tsx)): `'always'` (on-visit + cron, дефолт) / `'on-visit'` (только при визитах) / `'cron'` (только ночью). Хранится в `memory_settings.factExtractionStrategy`. Источник: `specs/_archive/TZ_MindOnVisit/SPEC.md`.

---

## 1. Картина за 2 минуты

```
             Пользовательский диалог
                      │
                      ▼
          ┌──────────────────────────┐
          │  Сохранение в Message_v2 │
          └────────────┬─────────────┘
                       │
                       │ Все chatMode (simply/expertise/create/project)
                       ▼
     ┌──────────────────────────────────────┐
     │ На каждом turn handler вызывает:    │
     │   prepareMessagesWithCompaction(...) │
     │                                      │
     │ Если usage < 50% SIMPLY_CONTEXT_LIMIT │
     │ → action=noop, MIND не трогается     │
     │                                      │
     │ Если usage ≥ 50% → middleware:       │
     │  1. split = buildVerbatimWindow()    │
     │  2. batchExtractFacts(split.toCompact)│
     │  3. generateCompactionSummary(...)   │
     └──────────────┬───────────────────────┘
                    │
                    ▼
     ┌───────────────────────────────────┐
     │   ЭТАП 1: EXTRACT                 │
     │   batchExtractFacts (one call)    │
     │   → Grok 4.1 Fast non-reasoning   │
     │   → taskId: memory:extract-batch  │
     └──────────────┬────────────────────┘
                    ▼
     ┌───────────────────────────────────┐
     │   ЭТАП 2: EMBED                   │
     │   Voyage 4 → 1024-dim vector      │
     │   (pgvector cosine)               │
     └──────────────┬────────────────────┘
                    ▼
     ┌───────────────────────────────────┐
     │   ЭТАП 3: DEDUP                   │
     │   Уровень 1: cosine ≥ 0.55        │
     │   Уровень 2: LLM verify           │
     │   → супер-дубликат superseded     │
     └──────────────┬────────────────────┘
                    ▼
     ┌───────────────────────────────────┐
     │   Сохранение в memory_entry       │
     │   incrementFactsSinceConsolidation│
     └──────────────┬────────────────────┘
                    │
       ┌────────────┴──────────────────────┐
       │ storedCount ≥ 10 ?                 │
       │  ИЛИ                                │
       │ factsSinceConsolidation +          │
       │   storedCount ≥ 15 ?               │
       └───────┬──────────┬─────────────────┘
               │ да       │ нет
               ▼          │
     ┌─────────────────┐  │
     │ ЭТАП 4:         │  │
     │ CONSOLIDATE     │  │
     │ full review     │  │
     │ (сброс счётчика)│  │
     └────────┬────────┘  │
              │           │
              │ ≥ 10 изменений?
              ▼           │
     ┌─────────────────┐  │
     │ ЭТАП 5: PROFILE │  │
     │ Narrative text  │  │
     │ → upsertProfile │  │
     └─────────────────┘  │
                          │
                          ▼
                       (ждём следующего цикла)
```

---

## 2. Кто и когда триггерит extract — по режиму и стратегии

После ТЗ-MindOnVisit (2026-04-21) extract запускается **тремя независимыми путями**. Все используют один фильтр `Message.extractedAt IS NULL` — кто первый обработал, помечает поле, остальные эти сообщения уже не видят. Конфликта нет.

| Триггер | Когда срабатывает | На каких режимах | Зависит от `factExtractionStrategy` |
|---|---|---|---|
| **Compaction middleware** | При заполнении контекста ≥50% (100K токенов из 200K) | simply / expertise / create / project | НЕТ — работает всегда |
| **On-visit (`after()` после ответа)** | На каждое сообщение пользователя, с дебаунсом 30 минут | simply / expertise / create / project | ДА — пропускается при стратегии `'cron'` |
| **Ночной cron** (`/api/cron/memory-profile`, 03:00 МСК) | Раз в сутки, для сообщений старше 24 часов | simply / expertise / create / project | ДА — пропускается при стратегии `'on-visit'` |

**Стратегии `factExtractionStrategy` (выбираются пользователем в настройках памяти):**

| Стратегия | Compaction | On-visit | Cron | Для кого |
|---|---|---|---|---|
| `'always'` (дефолт) | ✅ | ✅ | ✅ | Большинство — память всегда свежая, double safety net |
| `'on-visit'` | ✅ | ✅ | ❌ | Нерегулярные пользователи: 0 затрат когда не пользуются |
| `'cron'` | ✅ | ❌ | ✅ | Те кто не хочет фоновой работы во время сессий |

**Сервисные чаты** (ben, project-creation, …) — НЕ пишут в MIND, ни одним триггером.

### Связанные модули

- [lib/ai/compaction/prepare-messages.ts](../../lib/ai/compaction/prepare-messages.ts) — compaction middleware
- [lib/ai/memory/on-visit.ts](../../lib/ai/memory/on-visit.ts) — `processStaleFactsOnVisit` + дебаунс
- [app/api/cron/memory-profile/route.ts](../../app/api/cron/memory-profile/route.ts) — ночной cron
- [components/settings/memory-section.tsx](../../components/settings/memory-section.tsx) — UI выбора стратегии

**Важно для тестов:** в Simply короткая беседа compaction не триггерит, но **on-visit (при стратегиях `'always'` и `'on-visit'`) подбирает её сразу после ответа**. То есть факты появляются в памяти при следующем заходе/сообщении, не нужно ждать 60% заполнения как раньше.

### ⚠️ Known behavior: задержка извлечения на одно сообщение (Simply Chat)

**Наблюдение:** факт из сообщения N попадает в MIND при отправке сообщения N+1, не сразу после N. Владимир подтвердил (2026-04-14) что это давно так и не баг.

**Причина** ([chat/route.ts:734](../../app/(chat)/api/chat/route.ts#L734)): `batchExtractFacts` вызывается **до** `saveMessages` в том же request handler'е. Это значит что `messagesFromDb` загружается в начале обработки запроса и содержит состояние до сохранения текущего сообщения. Текущая пара user↔assistant ещё не в БД, когда batch extract получает свой input. Фактически каждый extract цикл обрабатывает сообщения предыдущих ходов:

| Ход | Что обрабатывает batch extract |
|---|---|
| msg1 | `[]` (ничего нет в БД) |
| msg2 | msg1 pair |
| msg3 | msg2 pair |
| msg4 | msg3 pair |
| msg5 | msg4 pair |

Для пользователя это выглядит как «отправил факт, он появился в `/context` только после следующего сообщения».

**Почему это не меняем:** перенос `batchExtractFacts` после `saveMessages` потребует перестройки request pipeline — сохранение messages происходит в `onFinish` streamText, который срабатывает после завершения стрима ответа. Extract тоже можно было бы положить туда, но тогда теряется fire-and-forget гарантия во время стриминга. Текущий one-message lag — приемлемый компромисс.

**Для тестов:** просто отправить N+1 сообщение после того как хотим убедиться что N-й факт обработан. Или переключиться на `expertise`/`create` где extract работает per-message на `onFinish`.

---

## 3. Маппинг задач на модели (актуальное состояние)

После ТЗ-COMPACTION-UNIFY (v3.95.0) — 4 memory-задачи резолвятся через `task-assignments.ts`:

| Task ID | Default model | Провайдер | Что делает | Override через |
|---|---|---|---|---|
| `memory:extract-batch` | `grok-4-1-fast-non-reasoning` | xAI | **Единственный extract-таск.** Batch-извлечение из пачки ~20-50 сообщений, вызывается из `prepareMessagesWithCompaction` на `split.toCompact` | `/dev/models` |
| `memory:dedup-verify` | `grok-4-1-fast-non-reasoning` | xAI | LLM-проверка дубликатов (бинарное решение over top-5 cosine-кандидатов) | `/dev/models` |
| `memory:consolidate` | `grok-4-1-fast-non-reasoning` | xAI | Ревизия фактов (merge/supersede/remove) | `/dev/models` |
| `memory:profile` | `grok-4-1-fast-non-reasoning` | xAI | Narrative profile generation | `/dev/models` |
| **Embeddings** | `voyage-4` | Voyage AI (не в registry, raw fetch) | 1024-dim векторы для pgvector | — |

**Принцип (ТЗ-COMPACTION-UNIFY):** все 4 memory-задачи — механические (batch extract, dedup, consolidate, profile) на рабочей лошадке Grok 4.1 Fast non-reasoning. Mission-critical per-turn extract на Grok 4.20 reasoning удалён — индустриальный консенсус 2026 (Mem0 default `gpt-5-mini`, Google ADK `gemini-2.5-flash`) подтверждает: extraction — структурная задача, не нужен reasoning.

**Важно:** все defaults — **стартовые точки**, не финальный выбор. Любой из этих 5 taskId можно переключить через [/dev/models](../../app/(dashboard)/dev/models/page.tsx) без правки кода и коммитов. Использовать для A/B тестирования разных моделей на конкретных задачах памяти.

---

## 4. Промпты — адреса всех файлов

### Промпты MIND-задач (LLM system prompts для memory:*)

| Task ID | Промпт-файл | Комментарий |
|---|---|---|
| `memory:extract-batch` | [lib/prompts/memory/extract-batch.md](../../lib/prompts/memory/extract-batch.md) | Единственный extract-промпт после ТЗ-COMPACTION-UNIFY. Читается при старте модуля в [extract.ts](../../lib/ai/memory/extract.ts) |
| `memory:consolidate` | [lib/prompts/memory/consolidate.md](../../lib/prompts/memory/consolidate.md) | Читается в [consolidate.ts](../../lib/ai/memory/consolidate.ts) |
| `memory:profile` | [lib/prompts/memory/profile.md](../../lib/prompts/memory/profile.md) | Читается в [profile.ts](../../lib/ai/memory/profile.ts) |
| `memory:dedup-verify` | ⚠️ **Inline в коде** (нет отдельного файла) | Определён прямо в [extract.ts → verifyDuplicatesWithLLM](../../lib/ai/memory/extract.ts). Backlog: вынести в `lib/prompts/memory/dedup-verify.md` |

> Промпт `memory:extract` (per-message extraction) и файл `lib/prompts/memory/extract.md` **удалены** в ТЗ-COMPACTION-UNIFY (v3.95.0) — см. шапку документа.

### Промпты chat-режимов (system prompt для самой беседы — влияет на что попадёт в память как источник)

Все три chatMode (`simply`, `expertise`, `create`) **используют один composer** через `composeChatPrompt(context, chatMode)`:

| chatMode | Entry function | Assembly из файлов |
|---|---|---|
| `simply` | `buildChatPrompt(context)` → `composeChatPrompt(context, 'simply')` | `core/base.md` + `core/safety.md` + `core/russian-market.md` + `core/formatting.md` + `chat/simply-chat.md` + user context + skills metadata |
| `expertise` | `buildExpertisePrompt(context)` → `composeChatPrompt(context, 'expertise')` | Тот же стек что у simply, но с инжекцией `<current_mode>expertise</current_mode>` |
| `create` | `buildCreatePrompt(context)` → `composeChatPrompt(context, 'create')` | Тот же стек, с `<current_mode>create</current_mode>` |
| `project:expert:*` | `buildTaskExpertPrompt(...)` — отдельный builder | [lib/prompts/experts/task-expert.md](../../lib/prompts/experts/task-expert.md) + project/task/manifest context |

**Ключевые prompt-файлы:**
- [lib/prompts/chat/simply-chat.md](../../lib/prompts/chat/simply-chat.md) — основной ролевой промпт (Simply Chat + Expertise + Create share it)
- [lib/prompts/core/base.md](../../lib/prompts/core/base.md) — базовая персона / инструкции
- [lib/prompts/core/safety.md](../../lib/prompts/core/safety.md) — safety guardrails
- [lib/prompts/core/russian-market.md](../../lib/prompts/core/russian-market.md) — российский контекст
- [lib/prompts/core/formatting.md](../../lib/prompts/core/formatting.md) — правила форматирования
- [lib/prompts/experts/task-expert.md](../../lib/prompts/experts/task-expert.md) — Expert для задач проектов

**Composer entry-point:** [lib/prompts/builder/composer.ts](../../lib/prompts/builder/composer.ts) функции `composeChatPrompt`, `composeExpertisePrompt`, `composeCreatePrompt`.

---

## 5. Параметры — с указанием файлов и когда крутить

| Параметр | Production default | Файл | Что контролирует | Когда крутить для теста |
|---|---|---|---|---|
| `SIMPLY_CONTEXT_LIMIT` | `200_000` | [context-limits.ts](../../lib/ai/context-limits.ts) | **Единая база всех % порогов** — Compaction, виджет, extract trigger. | Для E2E тестов compaction можно временно понизить до 10_000 (см. §6). |
| `COMPACTION_THRESHOLD_SOFT` | `0.5` (50%) | [context-limits.ts](../../lib/ai/context-limits.ts) | Порог срабатывания middleware (extract → compact) | Не меняется |
| `COMPACTION_THRESHOLD_HARD` | `0.85` (85%) | [context-limits.ts](../../lib/ai/context-limits.ts) | Observability-only: различение `action=compact` vs `action=truncate` в логах | Не меняется |
| `COMPACTION_VERBATIM_WINDOW_TOKENS` | `40_000` | [context-limits.ts](../../lib/ai/context-limits.ts) | Сколько токенов истории сохраняется дословно после сжатия | Для теста: 200-500 (см. §6) |
| `COMPACTION_SUMMARY_TARGET_TOKENS` | `3_000` | [context-limits.ts](../../lib/ai/context-limits.ts) | Target размер summary (hard cap 4096 в task-assignments) | Для теста: 300-500 |
| `SNAPSHOT_THRESHOLD` | `0.7` (70%) | [context-limits.ts](../../lib/ai/context-limits.ts) | Legacy от Snapshot fallback — к MIND отношения не имеет | — |
| `MAX_BATCH_MESSAGES` | `50` | [extract.ts](../../lib/ai/memory/extract.ts) | Лимит сообщений per batch extract call | Не трогать |
| `MAX_BATCH_FACTS` | `30` | [extract.ts](../../lib/ai/memory/extract.ts) | Кап на факты per batch extract | Не трогать |
| `DEDUP_CANDIDATE_THRESHOLD` | `0.55` | [extract.ts](../../lib/ai/memory/extract.ts) | Cosine similarity threshold для dedup кандидатов (уровень 1) | Если шум в памяти: поднять до 0.65; если пропуски дубликатов: снизить до 0.5 |
| `CONSOLIDATION_THRESHOLD_CUMULATIVE` | `15` | [context-limits.ts](../../lib/ai/context-limits.ts) | Накопительный триггер consolidation: запуск когда `factsSinceConsolidation + storedCount >= 15` | ⚡ Для теста: `2` |
| `MIND_CHECK_DEBOUNCE_MS` | `30 * 60 * 1000` (30 мин) | [context-limits.ts](../../lib/ai/context-limits.ts) | Дебаунс on-visit: повторная проверка хвостов памяти не чаще раза в 30 мин на пользователя | Для теста: `60 * 1000` (1 мин) |
| `factExtractionStrategy` (per-user, БД) | `'always'` (дефолт) | [memory_settings](../../lib/db/schema.ts), [memory-section.tsx](../../components/settings/memory-section.tsx) | Стратегия пользователя: `'always'` (on-visit + cron) / `'on-visit'` / `'cron'` | Меняется в UI (Настройки → Память) |
| `FULL_CONSOLIDATION_MAX_FACTS` | `200` | [consolidate.ts](../../lib/ai/memory/consolidate.ts) | Кап на full consolidation (ночная ревизия) | Не трогать |
| `MAX_ACTIONS_PER_CALL` | `20` | [consolidate.ts](../../lib/ai/memory/consolidate.ts) | Кап на действия per LLM call | Не трогать |
| `MAX_FACTS_FOR_PROFILE` | `300` | [profile.ts](../../lib/ai/memory/profile.ts) | Кап фактов для генерации профиля | Не трогать |

> Константы `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT/HARD`, `EXTRACT_PAUSE_MS`, `MAX_FACTS_PER_EXTRACTION` **удалены** в ТЗ-COMPACTION-UNIFY (v3.95.0) — см. шапку документа.

**Когда меняем значение — записываем в § «Журнал изменений» ниже.**

---

## 6. Тест-сценарии

### Сценарий A — Быстрый E2E тест MIND через compaction в Simply Chat

**Что проверяется:** весь MIND pipeline end-to-end через привычный chat flow. После ТЗ-COMPACTION-UNIFY extract срабатывает только внутри compaction cycle — значит нужно спровоцировать compaction.

**Временные изменения в [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts) (⚠️ НЕ коммитить):**
```ts
export const SIMPLY_CONTEXT_LIMIT = 10_000;            // было 200_000
export const COMPACTION_VERBATIM_WINDOW_TOKENS = 200;  // было 40_000
export const COMPACTION_SUMMARY_TARGET_TOKENS = 300;   // было 3_000
```

**Шаги:**
1. Применить правки выше.
2. Перезапустить dev (`rm -rf .next/cache && npm run dev`) — HMR для server-side ненадёжен.
3. Открыть `/simply` или `/expertise`, отправить 3-5 коротких сообщений с фактами:
   - «Я работаю над Simply, мигрирую модели на xAI»
   - «Пью эспрессо по утрам»
4. Ожидаемое в логах (на 3-4 сообщении):
   - `[Compaction] chat=... action=compact tokens={...}`
   - `[MIND] Batch extract started: N messages`
   - `[MIND] Batch extract: M facts from N messages`
   - `[Compaction] pre-compact-extract={processed:N, extracted:M, stored:K}`
   - `[Compaction] Summary generated: ~Y tokens`
5. Проверка в UI: виджет контекста → блок «📦 Разговор сжат».
6. Проверка в `/context` → новые факты в соответствующих категориях.
7. **ОБЯЗАТЕЛЬНО:** вернуть production defaults → снова `rm -rf .next/cache && npm run dev`.

### Сценарий B — ⚠️ Удалён в ТЗ-COMPACTION-UNIFY

Per-message extract (taskId `memory:extract`) удалён — отдельного сценария «быстрый extract одним сообщением» больше нет. Extract срабатывает только в составе compaction cycle — см. Сценарий A.

### Сценарий C — Тест consolidation

**Временное изменение в [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts):**
```ts
export const CONSOLIDATION_THRESHOLD_CUMULATIVE = 2;  // было 15
```

**Шаги:**
1. Запустить сценарий A чтобы вызвать batch extract
2. Ожидаемое при накоплении ≥2 фактов (через один или два compaction-цикла): `[MIND] Batch extract: triggering consolidation (stored=..., cumulative=...)` → `[MemoryConsolidate] Done for user ...`
3. Вернуть дефолт `15`

### Сценарий D — Тест profile generation

**Через код:** импортировать `generateUserProfile(userId)` из `lib/ai/memory/profile.ts` и вызвать вручную в одноразовом скрипте. Или дождаться event chain: `batchExtractFacts` → consolidation → если `totalChanged ≥ 10` → `generateUserProfile` (автоматически).

---

## 7. Чеклист восстановления production defaults

После любого теста обязательно сверить с этой таблицей. Если какая-то строка в коде не совпадает — **вернуть** перед коммитом.

| Параметр | Должно быть | Где проверить |
|---|---|---|
| `SIMPLY_CONTEXT_LIMIT` | `200_000` | [context-limits.ts](../../lib/ai/context-limits.ts) |
| `COMPACTION_THRESHOLD_SOFT` | `0.5` | [context-limits.ts](../../lib/ai/context-limits.ts) |
| `COMPACTION_THRESHOLD_HARD` | `0.85` | [context-limits.ts](../../lib/ai/context-limits.ts) |
| `COMPACTION_VERBATIM_WINDOW_TOKENS` | `40_000` | [context-limits.ts](../../lib/ai/context-limits.ts) |
| `COMPACTION_SUMMARY_TARGET_TOKENS` | `3_000` | [context-limits.ts](../../lib/ai/context-limits.ts) |
| `CONSOLIDATION_THRESHOLD_CUMULATIVE` | `15` | [context-limits.ts](../../lib/ai/context-limits.ts) |

Команда проверки:
```bash
grep -E "SIMPLY_CONTEXT_LIMIT|COMPACTION_THRESHOLD|COMPACTION_VERBATIM|COMPACTION_SUMMARY_TARGET|CONSOLIDATION_THRESHOLD_CUMULATIVE" lib/ai/context-limits.ts
```

---

## 8. Наблюдаемость — как понять что MIND работает

**Лог-маркеры (в порядке появления):**

| Стадия | Лог-строка | Откуда |
|---|---|---|
| Retrieve при входящем сообщении | `[MemoryRetrieve] Found N facts, injecting M (Xms)` | [chat/route.ts](../../app/(chat)/api/chat/route.ts) |
| Trigger batch extract | `[MIND] Batch extract triggered: X% of context used ...` | [chat/route.ts:755](../../app/(chat)/api/chat/route.ts#L755) |
| Batch extract начало | `[MIND] Batch extract started: N messages for user ...` | [extract.ts:285](../../lib/ai/memory/extract.ts#L285) |
| Batch extract результат | `[MIND] Batch extract: N facts from M messages (Xms)` | [extract.ts:352](../../lib/ai/memory/extract.ts#L352) |
| Per-message extract | `[MemoryExtract] Extracted N facts for user ... (Xms)` | [extract.ts:159](../../lib/ai/memory/extract.ts#L159) |
| Dedup confirmed | `[MemoryDedup] LLM confirmed duplicate: ...` | [extract.ts:484](../../lib/ai/memory/extract.ts#L484) |
| Supersede existing | `[MemoryExtract] Superseded "..." → "..." (similarity: X)` | [extract.ts:572](../../lib/ai/memory/extract.ts#L572) |
| Consolidate done | `[MemoryConsolidate] Done for user ...: reviewed=N, superseded=M, merged=K, removed=L (Xms)` | [consolidate.ts:190](../../lib/ai/memory/consolidate.ts#L190) |
| Profile generated | `[MemoryProfile] Generated for user ...: N facts → M tokens, $X (Xms)` | [profile.ts:152](../../lib/ai/memory/profile.ts#L152) |

**UI-точки:**
- `/context` dashboard — список всех активных фактов по категориям, preview Opus-профиля
- DevPanel (при `SIMPLY_DEV_MODE=true`) — Memory section с similarity scores и token usage

---

## 9. Схема БД

**Таблицы:**
- `memory_entry` (PostgreSQL + pgvector)
  - `id`, `userId`, `content`, `embedding` (1024-dim), `category`, `confidence`
  - `sourceType` (`simply` / `expertise` / `create` / `project`), `sourceChatId`, `sourceProjectId`
  - `supersededBy` (self-ref для замены дубликатов), `source` (`extracted` / `manual`)
  - `metadata` (jsonb — reserved для будущих extensions)
  - `createdAt`, `updatedAt`
- `memory_settings` — per-user
  - `memoryEnabled` (bool) — глобальный toggle
  - `factsSinceConsolidation` (int) — накопительный счётчик для cumulative-триггера consolidation (порог `CONSOLIDATION_THRESHOLD_CUMULATIVE = 15`)
  - `lastConsolidatedAt` (timestamp)
- `user_profile_summary` — narrative Opus-профиль
  - `content`, `factCount`, `tokenCount`, `costUsd`, `modelId`, `createdAt`

**Миграции:**
- `0048_memory-entry.sql` — pgvector extension + memory_entry
- `0049_memory-settings-and-profile.sql` — memory_settings + user_profile_summary
- `0050_save-fact-source.sql` — source column
- `0051_memory-metadata.sql` — metadata jsonb column
- `0052_extract-at-column.sql` — extractedAt в Message_v2 (mark as processed by batch extract)

---

## 10. Журнал изменений архитектуры MIND

Append-only. Новые записи сверху.

- **2026-04-20 (v3.95.0, ТЗ-COMPACTION-UNIFY)** — унификация управления памятью чата:
  - Per-turn extract удалён (`memory:extract` taskId, функции `extractFactsFromMessages` / `extractAndStoreFacts`, промпт `extract.md`, константа `MEMORY_EXTRACT_TASK`)
  - Per-turn pipeline в expertise/create/project handler'ах удалён (~50 строк кода)
  - Extract теперь запускается **внутри** `prepareMessagesWithCompaction` на `split.toCompact` (Mem0 best practice 2026)
  - Все пороги от `SIMPLY_CONTEXT_LIMIT = 200_000` — константы `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT/HARD`, `EXTRACT_PAUSE_MS` удалены. Закрыт backlog-долг `TZ_UnifyContextThresholdBase`.
  - Виджет контекста переведён на ту же базу (`lib/usage.ts`)
  - Полное обоснование: [ADR 054](../../docs/decisions/054-single-strategy-compaction.md)
- **2026-04-14 (v3.89.0, ТЗ-XAI-2)** — переключение 5 memory-задач на xAI:
  - `memory:extract` → `grok-4.20-0309-non-reasoning` (было `claude-sonnet-4-6`)
  - `memory:extract-batch` → `grok-4-1-fast-non-reasoning` (было `MiniMax-M2.7`)
  - `memory:dedup-verify` → `grok-4-1-fast-non-reasoning` (было `claude-haiku-4-5-20251001`)
  - `memory:consolidate` → `grok-4-1-fast-non-reasoning` (было `MiniMax-M2.7`)
  - `memory:profile` → `grok-4-1-fast-non-reasoning` (было `MiniMax-M2.7`)
  - Бонус-рефакторинг: `batchExtractFacts` и `runConsolidation` переписаны с legacy `generateText + JSON.parse + Zod` workaround на native `generateObject` (workaround был нужен только для MiniMax Anthropic-compat, xAI поддерживает structured outputs нативно — verified 2026-04-14)
- **2026-04-14 (v3.88.0, ТЗ-XAI-1)** — создана эта архитектурная инфраструктура; MIND не менялся
- **2026-04-11 (v3.78.0, ТЗ-ExtractCompression)** — добавлен `batchExtractFacts`, Simply Chat переключён с per-message extract на batch-at-threshold
- **2026-04-09 (v3.76.0, ТЗ-SlidingWindow)** — возвращён sliding window для стабильного cost
- **2026-04-07 (v3.72.0, ТЗ-RAG2)** — consolidation + profile generation добавлены
- **2026-04-06 (v3.71.0, ТЗ-RAG1)** — extract + retrieve MVP
- **2026-04-05 (v3.70.0, ТЗ-RAG0)** — инфраструктура MIND (pgvector, Voyage, схема)

---

## 11. Правило обновления

Любое ТЗ которое трогает MIND (thresholds, таски, модели, логику стадий, схему БД) **обязано** обновить этот документ:
- В § 10 добавить запись в журнал
- В таблицах § 3 и § 5 обновить затронутые строки
- В § 1 перерисовать схему если стадии поменялись

Иначе документ устареет и перестанет быть source of truth.
