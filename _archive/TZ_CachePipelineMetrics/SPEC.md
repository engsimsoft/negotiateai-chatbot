# ТЗ_CachePipelineMetrics: Cache breakpoints + full usage logging coverage в pipelines

**Версия ТЗ:** 2.0 (объединённый — поглощает backlog/TZ_UsageLoggingCoverage)
**Дата:** 2026-04-13 (v1.0), обновлён 2026-04-13 (v2.0 после слияния)
**Автор:** Vladimir Sharandin
**Статус:** ⬜ Готов к старту (working tree чист после ТЗ-UnfreezePipelines)
**Целевая версия:** 3.87.0

---

## TL;DR

Распространить достижения ТЗ-CacheAudit (3-breakpoint cache strategy + правильный usage logging) на **pipelines и фоновые вызовы**. Закрыть billing observability blind spot — сейчас `/admin/cost-audit` занижает pipeline-затраты на 10-25% (pipelines хардкодят `cacheReadTokens: 0` через `as any`), а вспомогательные вызовы `getModel()` (util:title, OCR, клерки, сервисные чаты) вообще не пишутся в `ai_usage_log`. После ТЗ: дашборд показывает реальные цифры, совпадающие с Anthropic/MiniMax Console с погрешностью <2%.

---

## Контекст и две волны проблемы

### Волна 1 — pipeline hardcodes (из ТЗ-CacheAudit)

ТЗ-CacheAudit реализовал кэширование MiniMax только для chat-routes. Pipelines остались без breakpoints и с хардкодом `cacheReadTokens: 0` + `as any` cast в usage logging. Полный анализ — `ANALYSIS_MIND_ARTIFACTS_SAVEFACT.md` раздел 9.

### Волна 2 — фоновые вызовы без logging (из TZ_LegacyChatCleanup Findings #2 #3)

В рамках TZ_LegacyChatCleanup пользователь сравнил Anthropic Console с нашим `ai_usage_log`:
- **Anthropic Console** показал: 141 127 input + 996 output для Haiku за тестовую сессию
- **Наш `ai_usage_log`**: 129 146 input + 535 output (5 строк, только из chat/route.ts)
- **Расхождение**: ~12K input + ~461 output (≈ 10%) — это «скрытые» вызовы Haiku из `util:title` (автонейминг), `vision:ocr`, `clerk:*`, `service-chat:*`

Плюс отдельная находка: поле `inputTokens` в `ai_usage_log` хранит **gross input** (всю сумму, включая cacheRead/cacheWrite), а соседние `cacheReadTokens` / `cacheWriteTokens` — это **разбивка того же значения**. Имя misleading, легко делать double counting в SQL.

### Почему две волны объединены в один ТЗ

Обе задачи трогают одни и те же pipeline-файлы (`briefing-author.ts`, `briefing-section-author.ts`, `briefing-filter.ts`, `podcast/script-generator.ts`) и касаются одной логической темы — «сделать pipeline billing честным». Раздельное выполнение привело бы к двум проходам по тем же файлам, двойному merge-риску, двум CHANGELOG entries, двум валидационным сессиям. Объединение в один проход — проще и чище.

---

## Цели

1. **Расставить cache breakpoints** в pipeline-вызовах (briefing, podcast) по тому же паттерну что в chat-routes
2. **Удалить хардкоды `cacheReadTokens: 0` + `as any`** в usage logging pipeline-файлов
3. **Заменить ручной аккумулятор** `totalPromptTokens += result.usage?.inputTokens` на правильный `extractUsageForPricing()` helper
4. **Покрыть все оставшиеся `getModel()` вызовы logging'ом**: util (автонейминг, summarization), OCR, clerks (file-analyzer, task-summarizer, snapshot-creator), service-chats (ben, project-creation, project-manager), memory extract/consolidate/profile
5. **Задокументировать `inputTokens`** как gross input через JSDoc-комментарий в `lib/db/schema.ts` (Finding #3, Вариант «а» — без миграции БД)
6. **Валидировать** через `ai_usage_log` SQL + `/admin/cost-audit` до/после
7. **Закрыть billing observability gap** — погрешность <2% vs Anthropic Console

---

## Scope

### Cache breakpoints (Фаза 1)

**В scope:**
- `lib/briefing/briefing-author.ts` (`generateArticle` + `generateIntroOutro`)
- `lib/briefing/briefing-section-author.ts` (per-section generation)
- `lib/podcast/script-generator.ts` (multi-section script generation)
- (Опционально) `lib/briefing/briefing-filter.ts` — если профайлер покажет смысл (one-shot на весь batch — кэш эффективен только если filter вызывается несколько раз подряд в одной сессии)

**Вне scope:**
- `lib/briefing/research-engine.ts` — использует Perplexity, `cacheControl` не применим
- `lib/podcast/tts-gemini.ts` — Gemini TTS не имеет `LanguageModelUsage` формата

### Usage logging fix (Фаза 2)

**Удалить хардкоды `cacheReadTokens: 0` + `as any`:**
- `lib/podcast/script-generator.ts` (строки ~97-98, 118-119, 162-171, 187-195)
- `lib/briefing/research-engine.ts` (строки ~308-316)
- `lib/briefing/briefing-author.ts` (fallback trace, ~762-763)
- `lib/briefing/briefing-section-author.ts` (проверить и поправить)
- `lib/briefing/briefing-filter.ts` (проверить и поправить)

Заменить на единый паттерн через `extractUsageForPricing()` helper из `lib/ai/usage-utils.ts`.

### Full logging coverage (Фаза 3)

**Инструментировать все `getModel()` вызовы, которые сейчас не пишут `ai_usage_log`:**

Кандидаты (каталогизировать в Этапе 0 через grep):
- `lib/ai/clerks/task-summarizer.ts` (Claude Haiku, после завершения задачи)
- `lib/ai/clerks/file-analyzer.ts` (Haiku, OCR + анализ файлов проекта)
- `lib/ai/clerks/snapshot-creator.ts` (Haiku, compaction fallback — **проверить живой ли**, см. backlog/TZ_CreateSnapshotAudit)
- `lib/prompts/build-task-expert-prompt.ts` — auto-title generation, util:title
- `app/(chat)/api/chat/[id]/generate-title/route.ts` — util:title + summary
- `app/(chat)/api/service-chat/route.ts` — ben, project-creation, project-manager
- `lib/ai/memory/extract.ts` — memory extraction (уже частично покрыт после UnfreezePipelines, перепроверить)
- `lib/ai/memory/consolidate.ts` — mini + full consolidation
- `lib/ai/memory/profile.ts` — Opus profile generation
- `lib/ai/professors/task-reviewer.ts` — task review pipeline
- `lib/meeting/meeting-pipeline.ts` — Deepgram + Claude summarization

**Архитектурное решение (требует обсуждения в Анализе):**

Два подхода:

**Подход A — Ручная инструментация каждого call-site.** Найти всех не-логирующих потребителей `getModel()`, добавить `logUsage({...})` через `waitUntil()`. Плюс: прозрачно, минимум магии. Минус: требует trade-off между копи-пастой (если много мест) и создания helper.

**Подход B — Model wrapper с auto-logging.** Создать `lib/ai/getModel-with-logging.ts` экспортирующий `getModelInstrumented(taskId, ctx)`. Возвращает обычную модель, но подключает middleware для логирования через AI SDK Provider Registry middleware API. Заменить `getModel(...)` → `getModelInstrumented(...)` в нужных местах. Плюс: единая точка, не забыть при будущих добавлениях. Минус: магия, требует понимания middleware API AI SDK v6.

**Решение в этапе ANALYSIS:** проверить сколько call-sites не логируют (через grep). Если ≤ 10 — Подход A. Если > 10 — Подход B.

### Inputtokens documentation (Фаза 4 — tiny)

`lib/db/schema.ts` — добавить JSDoc комментарий над `inputTokens` колонкой:

```ts
/**
 * WARNING: GROSS input tokens — включает cacheReadTokens и cacheWriteTokens.
 * НЕ складывать с cacheReadTokens/cacheWriteTokens в SQL-агрегациях (double counting!).
 * Для «токены без кэша» используй: inputTokens - cacheReadTokens - cacheWriteTokens
 */
```

Без миграции БД. Компилируется, никого не ломает.

---

## Подход

### Фаза 1 — Cache breakpoints

Применить паттерн из chat-routes (ADR 050):

1. **Breakpoint 1 — Static system prompt:** разделить на static (cached) и dynamic (если есть), cacheControl на static части
2. **Breakpoint 2 — Tools:** `withCacheControlOnLastTool()` если pipeline использует tools (вряд ли, но проверить)
3. **Breakpoint 3 — Last user content:** inline cacheControl на последнем content-part

Для briefing/podcast главный profit — Breakpoint 1: большой system prompt (scriptwriter, briefing author) переиспользуется через несколько генераций секций подряд в одной сессии.

### Фаза 2 — Usage logging fix (hardcode removal)

Удалить хардкоды и `as any`. Использовать существующий helper `extractUsageForPricing()`:

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

### Фаза 3 — Full logging coverage (новая из merge)

1. **Audit:** grep `getModel(` по проекту → список call-sites. Cross-reference с `grep 'logUsage(' → определить кто не логирует
2. **Решение архитектуры:** Подход A (ручная) или Подход B (middleware wrapper) на основе числа call-sites
3. **Реализация:** добавить logging во все непокрытые места
4. **Validation SQL:**

```sql
-- После тестовой сессии (30 минут активности)
SELECT
  "chatMode",
  COUNT(*) AS calls,
  SUM("inputTokens") AS in_tok,
  SUM("outputTokens") AS out_tok,
  SUM("costRub")::numeric(10,2) AS cost_rub
FROM "ai_usage_log"
WHERE "createdAt" > NOW() - INTERVAL '30 minutes'
GROUP BY "chatMode"
ORDER BY cost_rub DESC;
```

Ожидание: **все chatMode'ы присутствуют** (не только `simply:*` и `expertise:*`), включая `util:title`, `clerk:*`, `service:*`, `briefing:*`, `podcast:*`.

### Фаза 4 — Inputtokens docstring

Добавить JSDoc к `lib/db/schema.ts` колонке. Без миграции, просто documentation fix.

### Фаза 5 — Валидация end-to-end

1. **Pre-flight snapshot:** `SELECT SUM("costUsd") FROM ai_usage_log WHERE "createdAt" > NOW() - INTERVAL '24 hours';`
2. **Мануальные тесты:**
   - Запустить briefing pipeline через `/briefing/setup` (один полный выпуск)
   - Запустить per-section refresh 3-5 раз подряд в одной сессии (проверка кэша)
   - Сгенерировать multi-section podcast (3+ темы)
   - Simply Chat сессия с автонеймингом + OCR + memory extract + service-chat (Бен)
   - Создать проект + получить план от Профессора + завершить одну задачу (task-summarizer + task-reviewer)
3. **SQL сравнение:** выполнить Validation SQL (Фаза 3) → убедиться что все chatMode'ы присутствуют, `cacheWriteTokens > 0` на cold start briefing/podcast, `cacheReadTokens > 0` на subsequent calls
4. **Dashboard:** открыть `/admin/cost-audit` за «последние 24 часа», сравнить с pre-flight snapshot + с Anthropic Console
5. **Цель:** погрешность <2% vs провайдер console

---

## Критерии готовности

1. ✅ Все pipelines из Фазы 1 имеют cache breakpoints
2. ✅ Все хардкоды `cacheReadTokens: 0` + `as any` удалены (Фаза 2)
3. ✅ Все фоновые `getModel()` вызовы пишут `ai_usage_log` (Фаза 3)
4. ✅ `inputTokens` задокументирован через JSDoc (Фаза 4)
5. ✅ SQL validation: `ai_usage_log` содержит все chatMode'ы, `cacheReadTokens > 0` для повторных вызовов
6. ✅ `/admin/cost-audit` показывает цифры с погрешностью <2% vs Anthropic/MiniMax Console
7. ✅ `npx tsc --noEmit` → 0 ошибок
8. ✅ `npm run build` → успех
9. ✅ Мануальный тест всех основных флоу (briefing, podcast, simply chat, projects) → без регрессий
10. ✅ ADR 051 (Pipeline Cache & Observability Strategy) создан
11. ✅ Главный `CHANGELOG.md` обновлён [3.87.0]
12. ✅ Перенос в `_archive/`

---

## Связанные ТЗ

- **TZ-CacheAudit (v3.85.0, завершён)** — реализовал кэш для chat-routes, оставил pipelines как tech debt
- **TZ-UnfreezePipelines (v3.86.1, завершён)** — снял блокер uncommitted в pipeline-файлах, разблокировал этот ТЗ
- **TZ-LegacyChatCleanup (v3.86.0, завершён)** — Findings #2 #3 (usage logging gap) → влились сюда через merge
- **ADR 049, ADR 050** — паттерны cache strategy из ТЗ-CacheAudit
- **backlog/TZ_UsageLoggingCoverage** — **поглощён в v2.0**, файл удалён из backlog

---

## Estimated effort

- **3-4 сессии** (из-за merge)
  - **Сессия 1 (ANALYSIS):** grep всех `getModel()` call-sites + решение Подход A / B. Написать ROADMAP
  - **Сессия 2:** Фаза 1 (cache breakpoints) для briefing-author + briefing-section-author + smoke test
  - **Сессия 3:** Фаза 2 (hardcode fix) + Фаза 3 (full coverage) + Фаза 4 (JSDoc)
  - **Сессия 4:** Фаза 5 (валидация end-to-end) + финализация (ADR 051, CHANGELOG, перенос)

---

## Ожидаемое влияние

### Финансовое (после реализации Фазы 1)

- Briefing per-section refresh (5 секций): ~25-30K input tokens cached → экономия $0.03-0.05 на сессию
- Podcast multi-topic generation (3-5 тем): ~6-12K input tokens cached → экономия $0.006-0.015 на сессию
- **Cumulative за месяц** при текущем traffic: ориентировочно $20-40 экономии на MiniMax/Gemini

### Observability — главный эффект (после Фазы 2+3)

- `/admin/cost-audit` начинает показывать **реальные** pipeline costs (сейчас занижение 10-25%)
- **Фоновые вызовы становятся видимыми** — сейчас util:title, OCR, clerks, service-chats пропадают в чёрной дыре. После ТЗ: полная картина расходов
- DevPanel для briefing/podcast больше не лжёт
- Возможность принимать решения по оптимизации based on data, not guesses
- SQL-агрегации не делают double counting (`inputTokens` задокументирован как gross)

### Цель погрешности

< 2% расхождения между `SUM(ai_usage_log.costUsd)` и Anthropic/MiniMax Console за одинаковый период. Сейчас ~10% расхождение по Haiku (только вспомогательные вызовы) + неизвестно сколько по MiniMax (pipelines через хардкод).
