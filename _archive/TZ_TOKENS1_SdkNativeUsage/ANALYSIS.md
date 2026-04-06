# Анализ ТЗ-TOKENS1: SDK Native Usage Tracking

**Дата:** 2026-04-05
**Автор:** Senior Dev Review после разведки кодовой базы

---

## Резюме

Breaking refactor системы расчёта токенов и стоимости. Переход с самопальной формулы на стандартные поля AI SDK v6 `usage.inputTokenDetails.{noCacheTokens, cacheReadTokens, cacheWriteTokens}`. Цель — 100% совпадение с Anthropic Console, устойчивость к будущим изменениям провайдеров.

**Масштаб изменений:** 35+ файлов (8 критических ядерных + 28 callsites `logUsage` + DevPanel UI).

---

## Текущая архитектура (проблемная)

```
┌─── AI SDK v6 usage ───┐
│  inputTokens: TOTAL   │  ← SDK уже суммирует (fresh+cacheRead+cacheWrite)
│  inputTokenDetails:   │
│    noCacheTokens      │  ← ГОТОВОЕ ПОЛЕ, НО НЕ ИСПОЛЬЗУЕТСЯ
│    cacheReadTokens    │
│    cacheWriteTokens   │
│  outputTokenDetails:  │
│    reasoningTokens    │
└───────────────────────┘
           │
           ▼
    calculateCostRub() ────────────┐
    ┌──────────────────────────┐  │
    │ inputTokens:       TOTAL │  │  ← сборный (непрозрачно что внутри)
    │ cachedInputTokens: read  │  │
    │ cacheWriteTokens:  write │  │
    │ outputTokens:      out   │  │
    └──────────────────────────┘  │
           │                       │
           ▼                       │
    freshInput = inputTokens       │  ← ручная субтракция
               - cacheRead         │  ← хрупко
               - cacheWrite        │  ← при ошибке SDK — ломается
           │                       │
           ▼                       │
    cost = fresh×input             │
         + cacheRead×(0.1×input)   │
         + cacheWrite×(1.25×input) │
         + output×output           │
```

**Проблемы:**
1. **Ручная субтракция** — если AI SDK поменяет семантику `inputTokens` (total → fresh), код тихо сломается
2. **Непрозрачная структура `TokenUsageForPricing`** — поле `inputTokens` значит "total", но нигде не названо так
3. **Двойная логика в callsites** — каждый callsite сам извлекает поля из `inputTokenDetails`, повторяется 15+ раз
4. **`pipeline-trace.ts`** использует v5 legacy поля (`promptTokens`, `completionTokens`) — технический долг
5. **3 pipeline файла** (briefing-author, briefing-section-author, podcast) строят **fake usage** без cache-полей:
   ```typescript
   usage: { inputTokens: x, outputTokens: y, totalTokens } as any
   ```
   Это значит cache_read там вообще не биллится — весь input считается как fresh.

---

## Целевая архитектура

```
┌─── AI SDK v6 usage ───┐
│  inputTokenDetails:   │  ← SSOT
│    noCacheTokens      │
│    cacheReadTokens    │
│    cacheWriteTokens   │
│  outputTokenDetails:  │
│    reasoningTokens    │
│  outputTokens         │
└───────────────────────┘
           │
           ▼
    extractUsageForPricing(usage) ──────┐
           │                             │
           ▼                             │
    TokenUsageForPricing (explicit):     │
    ┌──────────────────────────────┐    │
    │ noCacheInputTokens: number   │    │  ← явно свежие
    │ cacheReadTokens: number      │    │  ← явно read
    │ cacheWriteTokens: number     │    │  ← явно write
    │ outputTokens: number         │    │
    │ reasoningTokens: number      │    │
    └──────────────────────────────┘    │
           │                             │
           ▼                             │
    calculateCostRub() — без субтракции: │
    cost = noCache × input               │
         + cacheRead × (0.10×input)      │
         + cacheWrite × (1.25×input)     │
         + (output+reasoning) × output   │
```

**Преимущества:**
- ✅ 0 ручных вычислений
- ✅ Типобезопасно — компилятор заставит передать все 4 поля
- ✅ Устойчиво — если SDK изменит `inputTokens`, наш код работает через `inputTokenDetails.*`
- ✅ Явные имена — `noCacheInputTokens` честно говорит что это
- ✅ Единый helper `extractUsageForPricing()` — DRY

---

## Рекомендации разработчика (Код-ревью)

### ✅ Согласен с ТЗ

- **R1-R4** — рефакторинг контракта `TokenUsageForPricing` с явными полями — правильно
- **R8** — валидация через прогон 7 типов чатов × 3 запроса — разумный объём
- **R9** — ADR обязателен, иначе через год кто-то "улучшит обратно"

### ⚠️ Рекомендую изменить

| # | В ТЗ | Рекомендация | Обоснование из кода |
|---|------|--------------|---------------------|
| 1 | R7: "либо добавить колонку `noCacheInputTokens`" | **НЕ менять DB schema.** Оставить `ai_usage_log.inputTokens` как total. Добавить виртуальное поле `freshInputTokens = inputTokens - cacheReadTokens - cacheWriteTokens` в API-ответах audit (если вообще нужно). | `app/api/admin/cost-audit/route.ts` агрегирует только `costUsd`. `inputTokens` в таблице нужен только для отображения. Миграция данных = риск, costUsd уже посчитан верно. |
| 2 | R5: переименовать `DebugStepData.inputTokens` → `noCacheInputTokens` | **Нужно, но аккуратно.** `DebugStepData` персистится в `localStorage` (dev-panel-provider.tsx). Старые записи сломаются. → Добавить защиту от undefined + мягкую миграцию (очистка localStorage при несовпадении схемы). | `components/dev-panel/onboarding-debug-provider.tsx` имеет `localStorage persistence`. Нужна version-key в localStorage. |
| 3 | (не в ТЗ) 3 pipeline файла строят fake usage без cache | **Добавить в scope.** `briefing-author.ts`, `briefing-section-author.ts`, `podcast/script-generator.ts` используют `{ inputTokens: x, outputTokens: y } as any` — теряют cache-поля. Нужно получать real usage из `result.usage` (SDK). | `lib/briefing/briefing-author.ts:215`, `lib/briefing/briefing-section-author.ts:181`, `lib/podcast/script-generator.ts:146` |
| 4 | (не в ТЗ) `pipeline-trace.ts` использует v5 legacy | **Добавить в scope.** `buildAiCallTrace()` читает `result.usage.promptTokens/completionTokens` — старые v5 поля. В SDK v6 их нет. Возможно уже сломано и даёт 0. | `lib/ai/pipeline-trace.ts:254-265` |

### ❓ Требует уточнения у архитектора

**Q1. Обратная совместимость старых DB записей:**
Старые записи в `ai_usage_log` имеют `inputTokens` как total (fresh+cache). Если мы НЕ меняем DB schema (моя рекомендация #1), то всё ок — данные валидны. Подтверждаем?

**Q2. Cost Audit Dashboard:**
Показывать ли разбивку по fresh/cache_read/cache_write в UI dashboard? Сейчас показывает только `costUsd` aggregates. Это отдельное TZ?

**Q3. Retention старых localStorage debug данных:**
При деплое нового формата `DebugStepData` — чистить старые localStorage или поддерживать оба? Предлагаю: version-key, при несовпадении — очистка.

---

## Потенциальные риски

### R1. Runtime ошибки от undefined полей
**Вероятность:** Средняя
**Импакт:** Критический (crash UI)
**Митигация:** default values везде через `?? 0`. Тесты на undefined usage.

### R2. Несоответствие seeded DebugStepData в localStorage
**Вероятность:** Высокая (все dev-пользователи)
**Импакт:** Низкий (только dev mode, self-healing)
**Митигация:** version-key в localStorage + очистка при несовпадении.

### R3. Поломка 28 callsites `logUsage`
**Вероятность:** Низкая (компилятор найдёт все)
**Импакт:** Критический (без логирования → потеря биллинга)
**Митигация:** Breaking change в типе `LogUsageInput` — TS не скомпилируется без обновления всех callsites.

### R4. Расхождение с Anthropic Console после рефакторинга
**Вероятность:** Низкая (формула стандартная)
**Импакт:** Критический (цель TZ не достигнута)
**Митигация:** Этап "Валидация" — 7 типов чатов, сверка вручную, допуск <1%.

### R5. Временная потеря данных в Cost Audit за период миграции
**Вероятность:** Нет (schema не меняем, data остаётся)
**Импакт:** Нет
**Митигация:** Не нужна — schema не меняется.

### R6. Забыли обновить fake-usage pipeline файлы
**Вероятность:** Средняя (нужно найти source result.usage)
**Импакт:** Средний (briefing/podcast pipeline продолжит работать, но cache тоже не будет биллиться — как сейчас)
**Митигация:** Явно вписано в scope (R3 выше), плюс grep проверка `{ inputTokens:.*totalTokens.*as any}`.

---

## Зависимости

**Что нужно до начала:**
- ✅ Дев-сервер работает (`npm run dev`)
- ✅ Anthropic Console доступ у пользователя
- ✅ `.env.local` с `SIMPLY_DEV_MODE=true`
- ✅ mcp__postgres__query для проверки БД

**Какие компоненты затронуты:**

**Ядро (8 файлов):**
- `lib/ai/providers.ts` (calculateCostRub, MODEL_PRICING_RUB, getStepCostRub)
- `lib/ai/tokenlens-catalog.ts` (calcCostUsd, calcStepCostRub)
- `lib/ai/usage-utils.ts` (extractUsageFields, logUsage, LogUsageInput) + **новый helper** `extractUsageForPricing`
- `lib/ai/debug-events.ts` (DebugStepData, DebugFinishData)
- `app/(chat)/api/chat/route.ts` (onStepFinish, onFinish)
- `app/(chat)/api/service-chat/route.ts` (onStepFinish, onFinish)
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (onStepFinish, onFinish)
- `lib/ai/pipeline-trace.ts` (buildAiCallTrace)

**UI (4 файла):**
- `components/dev-panel/dev-panel-provider.tsx` (DevPanelMessageData, localStorage migration)
- `components/dev-panel/sections/tokens-section.tsx`
- `components/dev-panel/sections/cost-breakdown-section.tsx`
- `components/dev-panel/dev-panel-footer.tsx`
- `components/dev-panel/onboarding-debug-provider.tsx` + `hooks/use-onboarding-debug.ts`

**Pipelines (6 файлов — fake usage fix):**
- `lib/briefing/briefing-filter.ts`
- `lib/briefing/briefing-author.ts`
- `lib/briefing/briefing-section-author.ts`
- `lib/briefing/research-engine.ts`
- `lib/podcast/script-generator.ts`
- `lib/meeting/meeting-pipeline.ts`

**Routes/utils с logUsage (остальные ~18 файлов):**
- `app/(chat)/actions.ts`
- `app/(chat)/api/assistant/ben/route.ts`
- `app/(chat)/api/projects/[id]/analyze-file/route.ts`
- `app/(chat)/api/projects/[id]/generate-summary/route.ts`
- `lib/ai/clerks/task-summarizer.ts`
- `lib/ai/clerks/snapshot-creator.ts`
- `lib/ai/professors/task-reviewer.ts`
- `lib/ai/professor-pipeline.ts` (3 callsites)
- `lib/ai/tools/deep-research.ts`
- `lib/ai/vision-ocr.ts` (2 callsites)
- `lib/podcast/tts-gemini.ts` (2 callsites, costUsdOverride)
- `lib/meeting/deepgram-transcribe.ts` (costUsdOverride)

**DB (НЕ меняем schema, но надо проверить):**
- `lib/db/schema.ts` — оставляем
- `lib/db/queries.ts` → `saveAiUsageLog` — оставляем
- Cost audit queries — без изменений

---

## Оценка сложности

- [x] **Сложное (5+ сессий)** — полный рефакторинг типа, затрагивает 35+ файлов

**Разбивка:**
- Сессия 1: Этапы 1-2 (базовый контракт + ядро)
- Сессия 2: Этапы 3-4 (routes + debug events)
- Сессия 3: Этап 5 (Dev Panel UI)
- Сессия 4: Этап 6 (Pipelines + fake usage fix)
- Сессия 5: Этапы 7-8 (Валидация + Финализация с ADR)

---

## Критические тест-кейсы (из TZ_AUDIT1)

**После каждого этапа (где возможно):**
- Отправить 1 сообщение в обычный чат → проверить токены в Dev Panel
- Сверить с Anthropic Console (при наличии)

**После завершения рефакторинга (Этап 7):**

| # | Тип чата | Модель | Кол-во запросов | Проверки |
|---|----------|--------|-----------------|----------|
| 1 | Обычный чат | Haiku 4.5 | 3 (1-й: cache_write, 2-3-й: cache_read) | DevPanel ₽ = Console $ |
| 2 | Экспертиза | Sonnet 4.6 | 3 | DevPanel ₽ = Console $ |
| 3 | Создание | Sonnet 4.6 | 3 | DevPanel ₽ = Console $ |
| 4 | Бен | Haiku 4.5 | 3 | DevPanel ₽ = Console $ |
| 5 | Менеджер проекта | Haiku 4.5 | 3 | DevPanel ₽ = Console $ |
| 6 | Брифинг (полный) | Sonnet 4.6 | 1 pipeline | DB логи по всем этапам |
| 7 | Meeting | Sonnet 4.6 | 1 короткая запись | DB логи transcribe+summarize |

**Допуск расхождения:** < 1% от Anthropic Console цифры.

---

## Выход

Пользователь согласовал анализ → переход к созданию ROADMAP.md.
