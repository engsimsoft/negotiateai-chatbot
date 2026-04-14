# MIND — Архитектура памяти Simply

**Живой документ.** Обновляется при каждом изменении MIND pipeline или thresholds. Единый источник правды для всех ТЗ серии Simply_xAI и последующих работ с памятью.

**Назначение:**
- Reference — понять что происходит с памятью пользователя в Simply, без перебора кода
- Testing harness — какие параметры временно крутить для быстрых тестов
- Journal — отслеживать изменения маппингов модель↔задача по мере миграции

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
         ┌─────────────┴──────────────┐
         │ chatMode === 'simply'?    │
         └──────┬──────────┬──────────┘
                │ да       │ нет (expertise/create/project)
                ▼          ▼
     ┌─────────────┐  ┌──────────────────────────┐
     │ Ничего НЕ   │  │ extractAndStoreFacts()   │
     │ делать сразу│  │ per-message, fire-&-forget│
     └──────┬──────┘  └────────────┬─────────────┘
            │                      │
            │ При 60%/80%          │ Сразу после finish
            │ заполнения контекста │
            ▼                      ▼
     ┌───────────────────────────────────┐
     │   ЭТАП 1: EXTRACT                 │
     │   batchExtractFacts (batch)       │
     │   extractFactsFromMessages (single)│
     │   → Grok (см. §4)                 │
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
       ┌────────────┴─────────────┐
       │ ≥ 10 фактов подряд?       │
       └───────┬──────────┬────────┘
               │ да       │ нет
               ▼          │
     ┌─────────────────┐  │
     │ ЭТАП 4:         │  │
     │ CONSOLIDATE     │  │
     │ mini (recent)   │  │
     │ или full (cron) │  │
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

## 2. Кто что вызывает — по chatMode

| chatMode | Per-message extract | Batch extract | Файл-триггер |
|---|---|---|---|
| **`simply`** | ❌ отключён (v3.77.0 ТЗ-MinimaxCleanup) | ✅ при 60%/80% контекста + пауза | [chat/route.ts:734](../../app/(chat)/api/chat/route.ts#L734), [chat/route.ts:1468](../../app/(chat)/api/chat/route.ts#L1468) |
| **`expertise`** | ✅ после каждого finish | ❌ | [chat/route.ts:1468](../../app/(chat)/api/chat/route.ts#L1468) |
| **`create`** | ✅ после каждого finish | ❌ | [chat/route.ts:1468](../../app/(chat)/api/chat/route.ts#L1468) |
| **`project:expert:*`** (Expert Task Chat) | ✅ после каждого finish | ❌ | [tasks/[taskId]/chat/route.ts:746](../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L746) |
| **Сервисные чаты** (ben, project-creation, ...) | ❌ | ❌ | — не пишут в MIND |
| **Cron (ночной)** | — | ✅ stale messages >24ч | [app/api/cron/memory-profile/route.ts](../../app/api/cron/memory-profile/route.ts) |

**Важно для тестов:** в Simply Chat обычная короткая беседа **не триггерит** MIND pipeline вообще. Чтобы проверить MIND end-to-end через Simply, нужно либо понизить пороги (см. §6), либо дойти до реального 60% заполнения, либо переключиться на `expertise`/`create` chatMode.

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

## 3. Маппинг задач на модели (актуальное состояние серии Simply_xAI)

После ТЗ-XAI-2 (v3.89.0) — 5 memory-задач резолвятся в xAI через `task-assignments.ts`:

| Task ID | Default model | Провайдер | Что делает | Override через |
|---|---|---|---|---|
| `memory:extract` | `grok-4.20-0309-non-reasoning` | xAI | Первичное извлечение фактов из одной пары user↔assistant. **Mission-critical звено** — на сильной модели (Grok 4.20) | `/dev/models` |
| `memory:extract-batch` | `grok-4-1-fast-non-reasoning` | xAI | Batch-извлечение из пачки ~50 сообщений (Extract-on-compression) | `/dev/models` |
| `memory:dedup-verify` | `grok-4-1-fast-non-reasoning` | xAI | LLM-проверка дубликатов (бинарное решение over top-5 cosine-кандидатов) | `/dev/models` |
| `memory:consolidate` | `grok-4-1-fast-non-reasoning` | xAI | Ревизия фактов (merge/supersede/remove) | `/dev/models` |
| `memory:profile` | `grok-4-1-fast-non-reasoning` | xAI | Narrative profile generation | `/dev/models` |
| **Embeddings** | `voyage-4` | Voyage AI (не в registry, raw fetch) | 1024-dim векторы для pgvector | — |

**Принцип split'а (ТЗ-XAI-2, 2026-04-14):** mission-critical задача (первичное извлечение) на сильной модели, механические задачи (batch/dedup/consolidate/profile) на рабочей лошадке. Экономия ~15× по сравнению с Sonnet ($3/$15) при сохранении качества основного звена.

**Важно:** все defaults — **стартовые точки**, не финальный выбор. Любой из этих 5 taskId можно переключить через [/dev/models](../../app/(dashboard)/dev/models/page.tsx) без правки кода и коммитов. Использовать для A/B тестирования разных моделей на конкретных задачах памяти.

---

## 4. Промпты — адреса всех файлов

### Промпты MIND-задач (LLM system prompts для memory:*)

| Task ID | Промпт-файл | Комментарий |
|---|---|---|
| `memory:extract` | [lib/prompts/memory/extract.md](../../lib/prompts/memory/extract.md) | Читается при старте модуля в [extract.ts:53](../../lib/ai/memory/extract.ts#L53) |
| `memory:extract-batch` | [lib/prompts/memory/extract-batch.md](../../lib/prompts/memory/extract-batch.md) | Читается в [extract.ts:62](../../lib/ai/memory/extract.ts#L62) |
| `memory:consolidate` | [lib/prompts/memory/consolidate.md](../../lib/prompts/memory/consolidate.md) | Читается в [consolidate.ts:41](../../lib/ai/memory/consolidate.ts#L41) |
| `memory:profile` | [lib/prompts/memory/profile.md](../../lib/prompts/memory/profile.md) | Читается в [profile.ts:36](../../lib/ai/memory/profile.ts#L36) |
| `memory:dedup-verify` | ⚠️ **Inline в коде** (нет отдельного файла) | Определён прямо в [extract.ts:464](../../lib/ai/memory/extract.ts#L464) — если понадобится менять, редактируем там. Backlog: вынести в `lib/prompts/memory/dedup-verify.md` |

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
| `CONTEXT_BUDGET` | `140_000` | [context-limits.ts:9](../../lib/ai/context-limits.ts#L9) | Sliding window: сколько токенов истории грузим в модель | Только для тестирования рабочего бюджета качества |
| `SIMPLY_CONTEXT_LIMIT` | `200_000` | [context-limits.ts:12](../../lib/ai/context-limits.ts#L12) | Знаменатель при расчёте `%` заполнения (используется в Extract trigger) | Почти никогда |
| `EXTRACT_THRESHOLD_SOFT` | `0.6` (60%) | [context-limits.ts:21](../../lib/ai/context-limits.ts#L21) | % заполнения для мягкого триггера batch extract (+ требует паузу) | ⚡ **Для теста: `0.001`** → любое сообщение триггерит |
| `EXTRACT_THRESHOLD_HARD` | `0.8` (80%) | [context-limits.ts:24](../../lib/ai/context-limits.ts#L24) | % заполнения для жёсткого триггера batch extract | ⚡ Для теста: `0.002` |
| `EXTRACT_PAUSE_MS` | `600_000` (10 мин) | [context-limits.ts:27](../../lib/ai/context-limits.ts#L27) | Пауза между сообщениями для мягкого триггера | ⚡ **Для теста: `0`** → пауза не требуется |
| `SNAPSHOT_THRESHOLD` | `0.7` (70%) | [context-limits.ts:15](../../lib/ai/context-limits.ts#L15) | Legacy от Snapshot fallback — к MIND отношения не имеет | — |
| `MAX_BATCH_MESSAGES` | `50` | [extract.ts:246](../../lib/ai/memory/extract.ts#L246) | Лимит сообщений per batch extract call | Не трогать |
| `MAX_BATCH_FACTS` | `30` | [extract.ts:249](../../lib/ai/memory/extract.ts#L249) | Кап на факты per batch extract | Не трогать |
| `MAX_FACTS_PER_EXTRACTION` | `10` | [extract.ts:101](../../lib/ai/memory/extract.ts#L101) | Кап на факты per single extract call | Не трогать |
| `DEDUP_CANDIDATE_THRESHOLD` | `0.55` | [extract.ts:98](../../lib/ai/memory/extract.ts#L98) | Cosine similarity threshold для dedup кандидатов (уровень 1) | Если шум в памяти: поднять до 0.65; если пропуски дубликатов: снизить до 0.5 |
| `MINI_CONSOLIDATION_THRESHOLD` | `20` | [extract.ts:47](../../lib/ai/memory/extract.ts#L47) | Каждые N фактов → mini-consolidation | ⚡ Для теста consolidation: `2` |
| `MINI_RECENT_FACTS_LIMIT` | `30` | [consolidate.ts:58](../../lib/ai/memory/consolidate.ts#L58) | Скольки фактов смотрит mini-consolidate | Не трогать |
| `FULL_CONSOLIDATION_MAX_FACTS` | `200` | [consolidate.ts:64](../../lib/ai/memory/consolidate.ts#L64) | Кап на full consolidation (ночная ревизия) | Не трогать |
| `MAX_ACTIONS_PER_CALL` | `20` | [consolidate.ts:61](../../lib/ai/memory/consolidate.ts#L61) | Кап на действия per LLM call | Не трогать |
| `MAX_FACTS_FOR_PROFILE` | `300` | [profile.ts:50](../../lib/ai/memory/profile.ts#L50) | Кап фактов для генерации профиля | Не трогать |

**Когда меняем значение — записываем в § «Журнал изменений» ниже.**

---

## 6. Тест-сценарии

### Сценарий A — Быстрый E2E тест MIND через Simply Chat

**Что проверяется:** весь MIND pipeline на Grok-моделях end-to-end через привычный Simply Chat flow, без переключения chatMode.

**Временные изменения в [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts):**
```ts
export const EXTRACT_THRESHOLD_SOFT = 0.001;  // было 0.6
export const EXTRACT_PAUSE_MS = 0;            // было 10 * 60 * 1000
```

**Шаги:**
1. Применить правки выше (⚠️ **НЕ коммитить**)
2. Hot reload dev-сервера автоматически подхватит (Next.js watch)
3. Открыть `/simply`, отправить 2-3 сообщения с фактами:
   - «Я работаю над Simply, мигрирую модели на xAI»
   - «Пью эспрессо по утрам»
4. Ожидаемое в логах:
   - `[MIND] Batch extract triggered: X% of context used ...`
   - `[MIND] Batch extract: N facts from M messages (Xms)`
   - `[MemoryDedup] LLM confirmed duplicate: ...` — если какой-то факт похож на другой
5. Проверка в UI: открыть `/context` → новые факты в соответствующих категориях
6. **ОБЯЗАТЕЛЬНО:** вернуть production defaults в context-limits.ts:
   ```ts
   export const EXTRACT_THRESHOLD_SOFT = 0.6;
   export const EXTRACT_PAUSE_MS = 10 * 60 * 1000;
   ```
7. Перезагрузить страницу `/simply` — убедиться что batch extract больше не триггерится

### Сценарий B — Тест per-message extract (expertise chatMode)

**Что проверяется:** `memory:extract` taskId (Grok 4.20) — единственное место где эта задача фактически запускается.

**Без правок кода:**
1. Дашборд → «Экспертиза» (или `/expertise` напрямую)
2. Отправить одно осмысленное сообщение с фактами
3. Ожидаемое в логах (сразу после finish):
   - `[MemoryExtract] Extracted N facts for user ... (Xms)`
   - `[MemoryExtract] Pipeline done: N extracted, M stored, K superseded`
4. Проверка в `/context`

### Сценарий C — Тест consolidation

**Временные изменения в [lib/ai/memory/extract.ts:47](../../lib/ai/memory/extract.ts#L47):**
```ts
const MINI_CONSOLIDATION_THRESHOLD = 2;  // было 20
```

**Шаги:**
1. Запустить сценарий A или B чтобы накопить ≥2 факта
2. Ожидаемое: после второго сохранённого факта — `[MemoryConsolidate] Done for user ...`
3. Вернуть дефолт `20`

### Сценарий D — Тест profile generation

**Через код:** импортировать `generateUserProfile(userId)` из `lib/ai/memory/profile.ts` и вызвать вручную в одноразовом скрипте. Или дождаться event chain: `batchExtractFacts` → consolidation → если `totalChanged ≥ 10` → `generateUserProfile` (автоматически).

---

## 7. Чеклист восстановления production defaults

После любого теста обязательно сверить с этой таблицей. Если какая-то строка в коде не совпадает — **вернуть** перед коммитом.

| Параметр | Должно быть | Где проверить |
|---|---|---|
| `CONTEXT_BUDGET` | `140_000` | [context-limits.ts:9](../../lib/ai/context-limits.ts#L9) |
| `SIMPLY_CONTEXT_LIMIT` | `200_000` | [context-limits.ts:12](../../lib/ai/context-limits.ts#L12) |
| `EXTRACT_THRESHOLD_SOFT` | `0.6` | [context-limits.ts:21](../../lib/ai/context-limits.ts#L21) |
| `EXTRACT_THRESHOLD_HARD` | `0.8` | [context-limits.ts:24](../../lib/ai/context-limits.ts#L24) |
| `EXTRACT_PAUSE_MS` | `10 * 60 * 1000` | [context-limits.ts:27](../../lib/ai/context-limits.ts#L27) |
| `MINI_CONSOLIDATION_THRESHOLD` | `20` | [extract.ts:47](../../lib/ai/memory/extract.ts#L47) |

Команда проверки:
```bash
grep -E "CONTEXT_BUDGET|SIMPLY_CONTEXT_LIMIT|EXTRACT_THRESHOLD|EXTRACT_PAUSE_MS" lib/ai/context-limits.ts
grep "MINI_CONSOLIDATION_THRESHOLD" lib/ai/memory/extract.ts
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
  - `factsSinceConsolidation` (int) — счётчик для mini-consolidation триггера
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
