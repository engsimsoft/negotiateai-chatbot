# Changelog ТЗ_CachePipelineMetrics v2.0

> Локальный changelog ТЗ. Заполняется по мере работы.

---

## Сессия 1 — 2026-04-13 (создание ТЗ + аудит)

### Создано

- `SPEC.md` — v2.0 объединённый (поглотил backlog/TZ_UsageLoggingCoverage). Создан в сессии финализации ТЗ-UnfreezePipelines (commit `6c8dbf6`)
- `ANALYSIS.md` — полный аудит 38 `getModel()` call-sites + 4 открытых вопроса для Этапа 0
- `ROADMAP.md` — 6 этапов с чек-листами, правилами паттерна, валидацией per-task
- `HANDOFF.md` — мост для следующей сессии, порядок чтения, critical первые шаги
- `CHANGELOG.md` — этот файл

### Ключевые находки аудита (полные детали в ANALYSIS.md)

**Покрытие logUsage:** 95% (36 из 38 call-sites) — Approach A (ручная инструментация) достаточен, Approach B (middleware wrapper) был бы overkill.

**Конкретные gaps:**
- 🔴 **`lib/ai/tools/request-suggestions.ts`** — streamObject без logUsage (только missing call-site)
- ⚠️ **`lib/ai/professor-pipeline.ts`** — использует `saveAiUsageLog` напрямую, не через `logUsage` helper. Нужен audit покрытия полей (Этап 0 Audit #2)

**Конкретные hardcode bugs:**
- 🟡 **`lib/podcast/script-generator.ts`** — `cacheReadTokens: 0` + `as any` в двух местах (logUsage call + trace block). Ручной аккумулятор `totalPromptTokens` не знает про cache fields
- 🟡 **`lib/briefing/briefing-author.ts:762`** — fallback trace с promptPreview `"(map-reduce)"`. Вероятно dead code от rejected TZ_MapReduceBriefing — нужно подтвердить в Этапе 0 Audit #1 и **удалить, если dead**

**Не bugs (оставляем):**
- `lib/briefing/research-engine.ts` — Perplexity sonar-pro не имеет prompt caching, `cacheReadTokens: 0` математически корректно. Добавим комментарий-объяснение в Этапе 4
- `lib/podcast/tts-gemini.ts` — Gemini TTS per-character pricing, `as any` легитимный escape hatch для non-token providers. Комментарий в Этапе 4

**Cache breakpoints — где:**
- briefing-author.ts `generateArticle` (Фаза 1.1)
- briefing-author.ts `generateIntroOutro` (Фаза 1.2)
- briefing-section-author.ts `generateSection` (Фаза 1.3)
- podcast/script-generator.ts `generateScript` (Фаза 1.4) — **зависит от Audit #3** (generateText + cacheControl compat)
- briefing-filter.ts — **пропускаем** (one-shot, кэш без профита)

### Решения принятые в этой сессии

1. **Approach A** (manual instrumentation) — подтверждён, не Approach B
2. **briefing-filter cache** — отложен (пересматриваем только если окажется что filter вызывается в циклах)
3. **briefing-author fallback** — dead code assumption (подтверждение через Audit #1 в следующей сессии)
4. **Perplexity/Gemini hardcodes** — не bug, оставляем + JSDoc объяснения
5. **professor-pipeline** — не трогаем логику, только audit coverage

### Оценка effort

Первоначально в SPEC: 3-4 сессии. После аудита: **2-3 сессии**. Экономия 1 сессия за счёт точного знания scope.

### Не сделано в этой сессии

- Этап 0 (Pre-flight + 4 audit) — следующая сессия
- Все Этапы реализации — следующая сессия

---

## Сессия 2 — 2026-04-13 (продолжение работы)

### Этап 0: Pre-flight + audit — ✅ ЗАВЕРШЁН

**Baseline:**
- git status: чистый после v3.86.1 + OpenRouter backlog commit
- tsc: 0 ошибок
- build: уже прогонялся в прошлых сессиях, пропускаем

**Audit #1 — briefing-author fallback (line 758-770) — DEAD CODE ✅**
- Grep `generateArticleMapReduce` → **1 hit, только в определении функции** (line 639). Callers нет
- Функция `generateArticleMapReduce` — код от rejected `TZ_MapReduceBriefing` (память проекта: Map-Reduce + MiniMax streaming несовместимы из-за socket reuse bug)
- **Решение: удалить всю функцию `generateArticleMapReduce` целиком в Этапе 2** (140+ строк dead code). Hardcode fallback уходит вместе с ней
- Это cardinal solution, не заплатка на hardcode

**Audit #2 — professor-pipeline.ts — ПОЛНОЕ ПОКРЫТИЕ ✅**
- 3 фазы (analyze/execute/synthesize), каждая вызывает `saveAiUsageLog` напрямую через `...extractUsageFields(result.usage)`
- `extractUsageFields` возвращает 5 полей: `inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, thinkingTokens` — всё что нужно для billing
- Кост считается через `calcCostUsd(modelId, usage)` — валидный path
- **Решение: НЕ трогать**. Паттерн отличается от `logUsage()` wrapper'а, но функционально эквивалентен. Унификация без причины = костыль

**Audit #3 — generateText + providerOptions cacheControl — СОВМЕСТИМО ✅**
- Чтение `app/(chat)/api/chat/route.ts:991-1000` (актуальный working паттерн из TZ-CacheAudit):
  ```ts
  {
    role: "system" as const,
    content: systemPromptText,
    providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
  }
  ```
- `providerOptions` ставится на уровне message (не content part). AI SDK v6 `ModelMessage` тип допускает его для любой роли
- `streamText` и `generateText` разделяют один и тот же options тип (`CallSettings`) — `providerOptions` работает одинаково
- **Решение: использовать единый паттерн для всех 4 файлов, включая podcast generateText**

**Audit #4 — util:artifact-suggestions taskId — СУЩЕСТВУЕТ ✅**
- Найдено в `lib/ai/task-assignments.ts:68` (type union) и line 137 (default: `claude-sonnet-4-6`)
- Добавление в новый ТЗ не требуется, можно сразу вызывать `logUsage`

### Обновлённый scope Этапа 1 после audit

4 файла, 4 edits. Паттерн единый для всех:

```ts
// БЫЛО:
streamText({
  model: ...,
  system: SYSTEM_PROMPT + INSTRUCTION,
  prompt: userMessage,
  ...
})

// СТАНЕТ:
streamText({
  model: ...,
  messages: [
    {
      role: "system",
      content: SYSTEM_PROMPT + INSTRUCTION,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    {
      role: "user",
      content: userMessage,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
  ],
  ...
})
```

Без runtime guard на провайдер — `providerOptions.anthropic.*` безопасно игнорируется не-Anthropic-compat моделями (MiniMax после v3.85.0 через Anthropic-compat режим поддерживает, OpenRouter игнорирует без ошибки).

### Этап 1: Cache breakpoints — ✅ ЗАВЕРШЁН (commit 6f1c238, позже частично откачен)

- [x] briefing-author generateArticle (откачен в Этапе 5)
- [x] briefing-author generateIntroOutro (удалён с dead Map-Reduce в Этапе 2)
- [x] briefing-section-author (откачен в Этапе 5)
- [x] podcast script-generator (**✅ ОСТАЛСЯ** — empirical validated, 30% savings)

### Этап 2: Dead code removal + hardcode fix — ✅ ЗАВЕРШЁН (commit eb13153)

- [x] Удалён generateArticleMapReduce (137 строк) + 5 helpers + локальные схемы (363 строки total) от rejected TZ_MapReduceBriefing
- [x] Disjoint accumulator в podcast/script-generator через extractUsageForPricing()
- [x] Удалён `as any` cast в logUsage call
- [x] Trace block с реальными cache fields вместо хардкодов

### Этапы 3+4: Full coverage + JSDoc — ✅ ЗАВЕРШЕНЫ (commit b00fe56)

- [x] logUsage в lib/ai/tools/request-suggestions.ts через waitUntil
- [x] professor-pipeline.ts НЕ трогаем (полное покрытие подтверждено Audit #2)
- [x] JSDoc inputTokens warning в lib/db/schema.ts
- [x] Комментарий Perplexity в research-engine.ts (not a bug)
- [x] Комментарий Gemini TTS в tts-gemini.ts (not a bug)

### Этап 5: Empirical E2E validation — ✅ ЗАВЕРШЁН (commit 98727c1)

**Manual smoke tests пользователем:**
- briefing generation → без регрессий
- podcast 2 темы (simply_news + vibe-coding) → без регрессий
- per-section refresh → работает

**SQL validation (`ai_usage_log` за 30 мин):**

| chatMode | inputTokens | cacheRead | cacheWrite | costUsd |
|---|---|---|---|---|
| podcast:script (cold) | 2823 | 0 | **2823** | 0.0020 |
| podcast:script (hit) | 4125 | **2646** | 1479 | 0.0024 |
| briefing:section-author | 4525 | 0 | 0 | 0.0029 |
| briefing:author | 4768 | 0 | 0 | 0.0065 |

**Ключевые выводы:**
1. **podcast:script cache работает** — 64% прочитано из кэша на втором вызове. Реальная экономия ~30% на multi-topic.
2. **briefing:author/section cache НЕ сработал** — MiniMax не создал блок. Причина вторична: daily frequency (24h) >> 5min TTL, всё равно бесполезно.

**Владельческое решение:** откатить cache в briefing, оставить в podcast. Принцип **frequency audit перед cache optimization** теперь зафиксирован в ADR 051.

Rollback commit `98727c1` содержит полный откат briefing-specific cache changes.

### Этап 6: Финализация — ✅ ЗАВЕРШЁН (v3.87.0)

- [x] ADR 051 — docs/decisions/051-pipeline-observability-and-targeted-caching.md
- [x] CHANGELOG.md [3.87.0] — Added/Changed/Fixed/Removed/Documentation/Empirical data
- [x] SIMPLY_STATUS.md — раздел ТЗ-CachePipelineMetrics с 3 lessons learned
- [x] CLAUDE.md — версия + добавлено в «Завершены»
- [x] ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md раздел 9 — закрыт полностью
- [x] package.json 3.86.1 → 3.87.0
- [x] Локальный CHANGELOG ТЗ обновлён
- [ ] Перенос specs/TZ_CachePipelineMetrics → _archive/ (в финальном release commit)

### Финальная сводка

**Коммиты (5 → 1 release):**
- `c089842` docs: сессия 1
- `6f1c238` feat: Этап 1 cache breakpoints (позже частично откачено)
- `eb13153` refactor: Этап 2 dead code + disjoint accumulator
- `b00fe56` feat: Этапы 3+4 coverage + JSDoc
- `98727c1` refactor: откат briefing cache (empirical correction)

**Метрики:**
- Cache breakpoints в финале: 1 pipeline (podcast/script-generator)
- Хардкодов `cacheReadTokens: 0 as any`: 0 (legit non-token оставлены с JSDoc)
- Непокрытых getModel() call-sites: 0 (был 1)
- Dead code удалено: 363 строки
- ADR: 1 (ADR 051)
- Сессий: 2 (было запланировано 2-3)
