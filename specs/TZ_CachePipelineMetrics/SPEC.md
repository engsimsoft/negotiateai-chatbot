# ТЗ_CachePipelineMetrics: Cache breakpoints + наблюдаемость в pipelines

**Версия ТЗ:** 1.0
**Дата:** 2026-04-13
**Автор:** Vladimir Sharandin
**Статус:** ⏸ **Заблокирован до завершения TZ_UnfreezePipelines**
**Целевая версия:** 3.86.0

---

## TL;DR

Распространить достижения ТЗ-CacheAudit (3-breakpoint cache strategy + правильный usage logging) на **pipelines** — briefing-author, briefing-section-author, briefing-filter, podcast/script-generator. Закрыть billing observability blind spot (сейчас pipelines пишут `cacheReadTokens: 0` через хардкод + `as any`). Ожидаемая экономия — порядка 50-70% на повторных вызовах внутри одной briefing/podcast сессии.

---

## Контекст

ТЗ-CacheAudit (v3.85.0) реализовал кэширование MiniMax только для **chat-routes** (`chat/route.ts` Simply Chat, `task-expert/route.ts`). **Pipelines не покрыты** — там нет ни одного `providerOptions.anthropic.cacheControl` breakpoint, и usage logging хардкодит `cacheReadTokens: 0` через `as any` cast.

Полный анализ — в `ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md` раздел 9 (после ТЗ-CacheAudit финализации).

**Блокер:** работа над pipeline-файлами невозможна пока в working tree висят uncommitted changes от замороженных ТЗ_MindArtifacts/SaveFactV2. Снимается ТЗ_UnfreezePipelines (предшествующий ТЗ).

---

## Цель

1. **Расставить cache breakpoints** в pipeline-вызовах (briefing, podcast) по тому же паттерну что в chat-routes
2. **Удалить хардкоды `cacheReadTokens: 0` + `as any`** в usage logging pipeline-файлов
3. **Заменить ручной аккумулятор** `totalPromptTokens += result.usage?.inputTokens` на правильный `extractUsageForPricing()` helper
4. **Валидировать** через `ai_usage_log` SQL что cache fields пишутся корректно после изменений
5. **Закрыть billing observability gap** — `/admin/cost-audit` начнёт показывать реальные цифры pipelines

---

## Scope (предварительный)

### В scope

**Файлы для расстановки cache breakpoints:**
- `lib/briefing/briefing-author.ts` (`generateArticle`)
- `lib/briefing/briefing-section-author.ts` (per-section)
- `lib/podcast/script-generator.ts` (multi-section script)
- (Опционально) `lib/briefing/briefing-filter.ts` — если профайлер покажет смысл

**Файлы для фикса usage logging:**
- `lib/podcast/script-generator.ts` (строки 97-98, 118-119, 162-171, 187-195)
- `lib/briefing/research-engine.ts` (строки 308-316)
- `lib/briefing/briefing-author.ts` (fallback trace, 762-763)
- `lib/briefing/briefing-section-author.ts` (проверить)
- `lib/briefing/briefing-filter.ts` (проверить)

### Вне scope

- `lib/briefing/research-engine.ts` основная логика — использует Perplexity, не Anthropic, к нему `cacheControl` не применим
- TTS pipeline (`lib/podcast/tts-gemini.ts`) — Gemini API не имеет `LanguageModelUsage` формата, отдельный кейс
- Memory extract pipeline (`lib/ai/memory/extract.ts`) — это часть RAG/MIND, отдельная зона
- Любые рефакторинги pipeline логики, не связанные с кэшированием

---

## Подход

### Фаза 1: Cache breakpoints

Применить тот же паттерн что в chat-routes (см. ADR 050):

1. **Breakpoint 1 — Static system prompt:** разделить prompt на static (cached) и dynamic (если есть)
2. **Breakpoint 2 — Tools:** через `withCacheControlOnLastTool()` если pipeline использует tools (вряд ли, но проверить)
3. **Breakpoint 3 — Last user content:** inline cacheControl на последнем content-part

Для briefing/podcast главный profit — Breakpoint 1: один большой system prompt (scriptwriter, briefing author) переиспользуется через несколько генераций секций подряд.

### Фаза 2: Usage logging fix

Удалить хардкоды и `as any`. Использовать существующий helper `extractUsageForPricing()` из `lib/ai/usage-utils.ts`.

```ts
// БЫЛО:
totalPromptTokens += result.usage?.inputTokens ?? 0;
totalCompletionTokens += result.usage?.outputTokens ?? 0;
// ...
logUsage({
  usage: {
    inputTokens: totalPromptTokens,
    outputTokens: totalCompletionTokens,
    cacheReadTokens: 0,   // хардкод
    cacheWriteTokens: 0,  // хардкод
  } as any,
});

// СТАНЕТ:
const total = {
  noCacheInputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
};

// В каждой итерации:
const fields = extractUsageForPricing(result.usage);
total.noCacheInputTokens += fields.noCacheInputTokens;
total.cacheReadTokens += fields.cacheReadTokens;
total.cacheWriteTokens += fields.cacheWriteTokens;
total.outputTokens += fields.outputTokens;
total.reasoningTokens += fields.reasoningTokens ?? 0;

// В конце:
logUsage({
  usage: {
    inputTokens: total.noCacheInputTokens + total.cacheReadTokens + total.cacheWriteTokens,
    outputTokens: total.outputTokens,
    totalTokens: /* sum */,
    inputTokenDetails: {
      cacheReadTokens: total.cacheReadTokens,
      cacheWriteTokens: total.cacheWriteTokens,
    },
    outputTokenDetails: {
      reasoningTokens: total.reasoningTokens,
    },
  } satisfies LanguageModelUsage,
});
```

### Фаза 3: Валидация

1. Запустить briefing pipeline через `/briefing/setup` (мануальный тест)
2. Запустить per-section refresh 3-5 раз подряд
3. SQL:

```sql
SELECT
  "createdAt"::timestamp(0) AS ts,
  "chatMode",
  "modelId",
  "inputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "costUsd"::numeric(10,6) AS cost
FROM "ai_usage_log"
WHERE "chatMode" LIKE 'briefing:%'
  AND "createdAt" > NOW() - INTERVAL '30 minutes'
ORDER BY "createdAt" DESC;
```

Ожидание: `cacheWriteTokens > 0` на cold start, `cacheReadTokens > 0` на subsequent calls в той же сессии.

4. Аналогично для podcast

5. Сравнить baseline через `/admin/cost-audit` (период «Последние 24 часа» до/после)

---

## Критерии готовности

1. ✅ Все pipelines из scope имеют breakpoints
2. ✅ Все хардкоды `cacheReadTokens: 0` + `as any` удалены
3. ✅ SQL `ai_usage_log` показывает non-zero cache fields для briefing/podcast
4. ✅ `/admin/cost-audit` показывает обновлённую разбивку по cache cost
5. ✅ `npx tsc --noEmit` → 0 ошибок
6. ✅ `npm run build` → успех
7. ✅ Мануальный тест briefing + podcast от пользователя → работает без регрессий
8. ✅ ADR 051 (Pipeline cache strategy) создан
9. ✅ Главный CHANGELOG.md обновлён [3.86.0]
10. ✅ Перенос в `_archive/`

---

## Связанные ТЗ

- **TZ-CacheAudit (v3.85.0, завершён):** реализовал кэш для chat-routes, оставил pipelines как технический долг
- **TZ_UnfreezePipelines (предшествующий, обязательный):** снимает блокер uncommitted в pipeline-файлах
- **ADR 049, ADR 050** — паттерны и обоснования для cache strategy

---

## Estimated effort

- **2-3 сессии** (после TZ_UnfreezePipelines)
  - Сессия 1: Фаза 1 (breakpoints) для briefing-author + briefing-section-author + smoke
  - Сессия 2: Фаза 2 (usage logging fix) для всех файлов + Фаза 3 (валидация)
  - Сессия 3: Финализация (ADR 051, CHANGELOG, перенос)

---

## Ожидаемое влияние

**Финансовое (после реализации):**
- Briefing per-section refresh (5 секций): ~25-30K input tokens cached → экономия $0.03-0.05 на сессию
- Podcast multi-topic generation (3-5 тем): ~6-12K input tokens cached → экономия $0.006-0.015 на сессию

**Cumulative за месяц** при текущем traffic: ориентировочно $20-40 экономии на cost MiniMax.

**Observability — главный эффект:**
- `/admin/cost-audit` начинает показывать **реальные** pipeline costs (сейчас занижение на 10-25%)
- DevPanel для briefing/podcast больше не лжёт
- Возможны принимать решения по optimization based on data, not guesses
