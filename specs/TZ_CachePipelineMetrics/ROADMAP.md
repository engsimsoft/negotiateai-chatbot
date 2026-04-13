# Roadmap ТЗ_CachePipelineMetrics v2.0

**Создан:** 2026-04-13 (sessions 1, analysis phase)
**Версия проекта:** 3.86.1 → 3.87.0
**Статус:** ⬜ Не начат (Этап 0 ждёт старта следующей сессии)

---

## Обзор

| Метрика | Значение |
|---|---|
| Этапов | 6 |
| Текущий этап | — (Этап 0 не начат) |
| Сессий (оценка) | 2-3 |
| Тип | Feature + tech debt cleanup (observability + caching) |

**Блокер:** нет. Working tree чист после ТЗ-UnfreezePipelines v3.86.1.

---

## Главный принцип

Этот ТЗ **не вводит новых паттернов** — применяет существующие ADR 049/050 (валидированы в TZ-CacheAudit 2026-04-13) к pipeline-файлам. Любой соблазн «переизобрести» cache strategy → STOP, читать ADR 050 и копировать паттерн 1-в-1.

---

## Этап 0 — Pre-flight + audit

**Статус:** ⬜ Не начат

**Цель:** подтвердить baseline, закрыть 3 открытых вопроса из ANALYSIS.md перед написанием production кода.

**Задачи:**

- [ ] `git status` — baseline snapshot (должен быть чистый после v3.86.1 + OpenRouter backlog commit)
- [ ] `npx tsc --noEmit` — 0 ошибок (контрольный)
- [ ] `npm run build` — успех (контрольный)
- [ ] **Audit #1:** прочитать `lib/briefing/briefing-author.ts` полностью (строки ~540-900, охватывающие `generateIntroOutro` + fallback trace line 762). Определить:
  - Что такое этот fallback? Live path или dead code?
  - `git log -p lib/briefing/briefing-author.ts | head -200` — последние commits, связанные с fallback блоком
  - grep `"(map-reduce)"` по проекту — где ещё упоминается
  - Решение: удалить / починить / оставить с комментарием
- [ ] **Audit #2:** прочитать `lib/ai/professor-pipeline.ts` полностью (~200 строк). Определить:
  - Пишет ли `saveAiUsageLog` все поля (noCacheInput, cacheRead, cacheWrite, output, reasoning)?
  - Совпадает ли cost calculation с `logUsage` → `calculateCostRub`?
  - Решение: оставить как есть / унифицировать через `logUsage`
- [ ] **Audit #3:** проверить AI SDK v6 совместимость `providerOptions.anthropic.cacheControl` с `generateText` (не только `streamText`):
  - Быстрый тест: найти в доке `@ai-sdk/anthropic` или `ai` package
  - Если неясно → empirically test в микро-скрипте перед реализацией Фазы 1 для podcast
- [ ] **Audit #4:** прочитать `lib/ai/task-assignments.ts` — найти `util:artifact-suggestions` taskId, проверить что модель резолвится (не сирота)

**Валидация этапа:**
- [ ] Все 4 вопроса из ANALYSIS имеют конкретный ответ, зафиксированный в CHANGELOG
- [ ] TS/build чисто — на случай что audit прочитает что-то неожиданное
- [ ] Решения по fallback & professor-pipeline зафиксированы как «commit» / «unify» / «leave»

**Git:** не нужен (только чтение)

---

## Этап 1 — Phase 1: Cache breakpoints

**Статус:** ⬜ Не начат

**Цель:** расставить cache breakpoints по паттерну ADR 050 в pipeline-файлах. Без фикса логирования — это отдельная фаза.

**Правило рабочего паттерна:**

```ts
// Вместо:
streamText({
  model: getModel(TASK),
  system: SYSTEM_PROMPT + JSON_INSTRUCTION,
  prompt: userMessage,
  ...
})

// Используем:
streamText({
  model: getModel(TASK),
  messages: [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: SYSTEM_PROMPT + JSON_INSTRUCTION,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
      ],
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: userMessage,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
      ],
    },
  ],
  ...
})
```

**Задачи:**

- [ ] **1.1** `lib/briefing/briefing-author.ts` `generateArticle` (line 206-213) — расставить Breakpoint 1 (static system) + Breakpoint 3 (last user). **Tools не передаются** — Breakpoint 2 пропускаем
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] **1.2** `lib/briefing/briefing-author.ts` `generateIntroOutro` (line ~552 — проверить наличие streamText) — та же расстановка
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] **1.3** `lib/briefing/briefing-section-author.ts` `generateSection` (line 182-189) — та же расстановка
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] **1.4** `lib/podcast/script-generator.ts` `generateScript` (line 112-119):
  - **Зависит от Audit #3** (generateText + cacheControl compat)
  - Если compat OK → добавить Breakpoint 1 через messages[] вместо system-string
  - Если compat FAIL → переписать на streamText (`res.text`, `res.usage`). Решение по переписке — в комментарии коммита
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] **1.5** `lib/briefing/briefing-filter.ts` — **пропускаем** (решение из ANALYSIS: one-shot вызов, кэш без профита)
- [ ] **1.6** `npm run build` — успех

**Валидация этапа:**
- [ ] 4 файла изменены (author, intro-outro, section-author, script-generator)
- [ ] TS clean, build clean
- [ ] **Мануальный smoke briefing** — запустить генерацию одного брифинга через `/briefing/setup` → убедиться что статья создаётся (регрессии нет)
- [ ] **SQL проверка** (необязательно, можно в Этапе 5): `SELECT cacheWriteTokens, cacheReadTokens FROM ai_usage_log WHERE chatMode='briefing:author' ORDER BY createdAt DESC LIMIT 3` — cacheWriteTokens на первом вызове должен быть > 0

**Git:** commit `feat(tz-cachepipe): phase 1 — cache breakpoints в briefing-author, briefing-section-author, podcast script-generator`

---

## Этап 2 — Phase 2: Hardcode fix

**Статус:** ⬜ Не начат

**Цель:** удалить `cacheReadTokens: 0` + `as any` из реального production кода.

**Задачи:**

- [ ] **2.1** `lib/podcast/script-generator.ts` — заменить ручной аккумулятор `totalPromptTokens += usage?.inputTokens` на disjoint версию через `extractUsageForPricing(result.usage)` + накопление 4 полей (noCacheInput, cacheRead, cacheWrite, output)
- [ ] **2.2** `lib/podcast/script-generator.ts` — обновить `logUsage` вызов (line 171-188): передавать корректный `LanguageModelUsage` без `as any`, с правильным `inputTokenDetails`
- [ ] **2.3** `lib/podcast/script-generator.ts` — обновить trace block (line 190-217): использовать накопленные disjoint fields
- [ ] **2.4** `lib/briefing/briefing-author.ts` fallback trace (line 762):
  - **Зависит от Audit #1**
  - Если fallback dead → **удалить весь блок** (кардинальное решение, не заплатка)
  - Если live → заменить хардкод на реальные usage поля (аналогично 2.1)
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успех

**Валидация этапа:**
- [ ] grep `cacheReadTokens:\s*0` по `lib/briefing/` и `lib/podcast/` → **только legitimate non-token providers** (tts-gemini.ts, research-engine.ts если решили оставить)
- [ ] grep `as any` в том же scope → уменьшилось на 2-4 occurrences

**Git:** commit `refactor(tz-cachepipe): phase 2 — удалить хардкоды cacheReadTokens и as any в podcast/briefing pipelines`

---

## Этап 3 — Phase 3: Full logUsage coverage

**Статус:** ⬜ Не начат

**Цель:** закрыть 2 непокрытых call-site.

**Задачи:**

- [ ] **3.1** `lib/ai/tools/request-suggestions.ts`:
  - Забрать `result.usage` из `streamObject` (возможно через `result.usage` Promise после elementStream)
  - Добавить `waitUntil(logUsage({...}))` с chatMode `"tool:artifact-suggestions"` или аналогичным
  - Обработать случай когда session.user.id отсутствует (уже есть guard на line 81)
- [ ] **3.2** `lib/ai/professor-pipeline.ts`:
  - **Зависит от Audit #2**
  - Если Audit показал полное покрытие → **no changes**, только комментарий в коде о том что audit пройден + дата
  - Если audit показал gap → заменить `saveAiUsageLog` на `logUsage` (единый паттерн через usage-utils.ts)
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успех

**Валидация этапа:**
- [ ] grep `getModel\(` в repo + cross-reference с `logUsage\|saveAiUsageLog` → **38 из 38** имеют logging (except dev scripts)
- [ ] Ручной тест: открыть `/simply` → написать сообщение с triggering request-suggestions tool (нужно найти корректный триггер) → проверить `ai_usage_log` SQL → строка с `util:artifact-suggestions` или аналогом появилась

**Git:** commit `feat(tz-cachepipe): phase 3 — logUsage в request-suggestions + professor-pipeline audit`

---

## Этап 4 — Phase 4: Docstrings для gross/non-token pricing

**Статус:** ⬜ Не начат

**Цель:** зафиксировать неочевидные контракты через JSDoc.

**Задачи:**

- [ ] **4.1** `lib/db/schema.ts` — добавить JSDoc над `inputTokens` колонкой `ai_usage_log`:

  ```ts
  /**
   * WARNING: GROSS input tokens — includes cacheReadTokens and cacheWriteTokens.
   * DO NOT sum with cacheReadTokens/cacheWriteTokens in SQL aggregations (double counting!).
   *
   * To get "fresh input tokens only" in SQL:
   *   inputTokens - cacheReadTokens - cacheWriteTokens
   *
   * Reason: matches Anthropic Console "Total tokens in" field format — keeps billing
   * comparison clean.
   */
  inputTokens: ...
  ```

- [ ] **4.2** `lib/briefing/research-engine.ts` — добавить комментарий над `cacheReadTokens: 0` (line 308, 315):

  ```ts
  // Perplexity Sonar Pro has no prompt caching API — hardcoded 0 is mathematically correct.
  // sonar-pro model in model-catalog.ts has cachedInput: 0 / cacheWrite: 0 pricing.
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ```

- [ ] **4.3** `lib/podcast/tts-gemini.ts` — добавить комментарий над `as any` (line 86, 121):

  ```ts
  // Gemini TTS uses per-character pricing, not per-token. LanguageModelUsage is
  // required by logUsage signature but unused — real cost flows through
  // costUsdOverride below. `as any` is the documented escape hatch for non-token
  // providers (see lib/ai/usage-utils.ts:88).
  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as any,
  ```

- [ ] `npx tsc --noEmit` → 0 ошибок (только комментарии, не должно сломаться)

**Валидация:** —

**Git:** commit `docs(tz-cachepipe): phase 4 — JSDoc для inputTokens + комментарии non-token providers`

---

## Этап 5 — Phase 5: E2E validation

**Статус:** ⬜ Не начат

**Цель:** подтвердить что все изменения работают в production-подобном flow, **без регрессий** и **с наблюдаемой экономией кэша**.

**Задачи:**

- [ ] **5.1 Pre-flight snapshot:**
  ```sql
  SELECT
    SUM("costUsd")::numeric(10,4) AS total_cost_usd,
    COUNT(*) AS total_calls
  FROM "ai_usage_log"
  WHERE "createdAt" > NOW() - INTERVAL '24 hours';
  ```
  Запомнить baseline.

- [ ] **5.2 Briefing smoke test:**
  - Открыть `/briefing/setup` → создать тестовый брифинг на 3-5 топиков
  - Дождаться генерации
  - Проверить в UI: статья отображается корректно, секции есть, источники есть
  - SQL:
    ```sql
    SELECT "createdAt", "chatMode", "modelId",
           "inputTokens", "cacheReadTokens", "cacheWriteTokens", "costRub"
    FROM "ai_usage_log"
    WHERE "chatMode" LIKE 'briefing:%'
      AND "createdAt" > NOW() - INTERVAL '15 minutes'
    ORDER BY "createdAt" DESC;
    ```
    Ожидание: `cacheWriteTokens > 0` на **первом вызове briefing:author**, на последующих secitons (если briefing:section-author запускается в цикле) — `cacheReadTokens > 0`

- [ ] **5.3 Per-section refresh test (главный profit):**
  - Открыть созданный брифинг
  - Нажать ↻ на первой секции → дождаться обновления
  - Повторить ↻ на 2-3 секциях подряд в одной сессии
  - SQL то же что в 5.2 — `cacheReadTokens > 0` на повторных вызовах ожидается

- [ ] **5.4 Podcast smoke test:**
  - Из брифинга создать подкаст на 3 темы
  - Дождаться генерации (script + TTS)
  - Прослушать фрагмент (убедиться что не сломан)
  - SQL:
    ```sql
    SELECT ... WHERE "chatMode" LIKE 'podcast:%' ...
    ```
    Ожидание: `cacheWriteTokens > 0` на первой теме, `cacheReadTokens > 0` на второй-третьей

- [ ] **5.5 Control test (не должен сломаться):**
  - Simply Chat: отправить сообщение → проверить что работает (ТЗ-CacheAudit регрессия)
  - Task-expert: открыть проект → перейти в задачу → отправить сообщение в expert chat
  - `/admin/cost-audit` — открыть, сравнить с 5.1 snapshot

- [ ] **5.6 Request-suggestions test (Этап 3 GAP fix):**
  - Открыть артефакт (документ) → запросить suggestions через UI
  - SQL: `ai_usage_log` должен содержать новую строку с `util:artifact-suggestions` или аналогичным chatMode

- [ ] **5.7 Final SQL comparison:**
  ```sql
  SELECT "chatMode", COUNT(*), SUM("costRub")::numeric(10,2)
  FROM "ai_usage_log"
  WHERE "createdAt" > NOW() - INTERVAL '1 hour'
  GROUP BY "chatMode"
  ORDER BY 3 DESC;
  ```
  Сравнить распределение chatMode'ов с до-ТЗ состоянием. Должны появиться pipeline-chatMode'ы с ненулевыми cache fields + появиться `util:artifact-suggestions`.

**Валидация этапа:**
- [ ] Все 7 тестов прошли без регрессий
- [ ] Cache observability подтверждена SQL'ем (не визуально)
- [ ] `/admin/cost-audit` показывает консистентную картину

**Git:** не нужен (только наблюдение) или маленький docs commit с результатами теста

---

## Этап 6 — Финализация

**Статус:** ⬜ Не начат

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать `DOCUMENTATION_GUIDE.md` → пройти чек-лист.

**Задачи:**

- [ ] Прочитать `DOCUMENTATION_GUIDE.md`
- [ ] Создать **ADR 051** — `docs/decisions/051-pipeline-cache-and-observability.md` — паттерн применения 3-breakpoint strategy к pipelines + подход A vs B + рассмотренные альтернативы
- [ ] Обновить `CHANGELOG.md` — раздел [3.87.0] с Added/Changed/Fixed/Removed
- [ ] Обновить `SIMPLY_STATUS.md` — новый раздел `ТЗ-CachePipelineMetrics — ЗАВЕРШЁН (v3.87.0)` с метриками до/после (cost audit сравнение)
- [ ] Обновить `CLAUDE.md` — добавить ТЗ-CachePipelineMetrics в список «Завершены»
- [ ] Обновить `ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md` раздел 9 — отметить как полностью закрытый + ссылка на ADR 051
- [ ] Обновить `docs/ai-providers.md` — если cache breakpoints в pipelines нужно зафиксировать в провайдерской доке
- [ ] `package.json` версия 3.86.1 → 3.87.0
- [ ] Финальный мануальный smoke пользователем (главная, simply, briefing, projects)
- [ ] Перенос `specs/TZ_CachePipelineMetrics/` → `_archive/TZ_CachePipelineMetrics/` через `git mv`
- [ ] Финальный release commit:
  ```
  release(v3.87.0): финализация ТЗ-CachePipelineMetrics + перенос в _archive
  ```

**Документация (по чеклисту):**
- [ ] ADR 051 создан
- [ ] `docs/architecture.md` — обновить если изменилось что-то на уровне архитектуры (вероятно нет)
- [ ] `docs/ai-tools.md` — не меняется
- [ ] `docs/ai-chats-map.md` — проверить таблицы cache status для pipelines, обновить если нужно

**Валидация:**
- [ ] `npm run build` — успех
- [ ] Документация актуальна
- [ ] TS/build clean после финализации

---

## Принципы выполнения

### 1. Не изобретать новое — копировать ADR 050

При любом шаге в Фазе 1, если возникает желание «сделать иначе» — STOP, открыть ADR 050, скопировать паттерн. Новые архитектурные решения → отдельный ADR, не мимо ходом.

### 2. Валидация каждого этапа — отдельная

`npx tsc --noEmit` после **каждой задачи** внутри этапа, не только в конце. `npm run build` между этапами. Мануальный smoke после Этапа 1 (Cache breakpoints — самое рискованное).

### 3. При сомнении — STASH, не commit

Если по ходу Этапа 1 возникает сомнение «работает ли cache правильно» — не коммитить. Либо SQL-подтверждение, либо stash + откатить до следующей сессии.

### 4. Dead code — удалять, не обходить

Если Audit #1 подтвердит что fallback в briefing-author мёртв — **удалить**, не замазать хардкод. Это cardinal solution, соответствует принципу владельца «лучше потратить больше времени на исправление».

### 5. Мёртвые абстракции — не создавать

Если в Этапе 3 окажется, что professor-pipeline полностью покрыт — **не унифицировать** через logUsage только ради «единого паттерна». Работает — оставить. Унификация без функциональной причины = костыль.

---

## Готово к следующему ТЗ?

После завершения ТЗ_CachePipelineMetrics доступно:

1. **Билинг наблюдаемость 100%** — cost-audit dashboard показывает реальность
2. **Cache экономия в pipelines** — эмпирически подтверждённая через SQL
3. **Unified logging pattern** — все call-sites через `logUsage`, унаследованные гэпы закрыты
4. **Foundation для Raw-fetch switchboard** (Perplexity, Deepgram, Voyage, Gemini TTS overrides) — можно начинать как только cost tracking работает корректно
5. **Foundation для TZ_OpenRouterCostTracking** (backlog) — может стартовать параллельно или сразу после этого ТЗ
