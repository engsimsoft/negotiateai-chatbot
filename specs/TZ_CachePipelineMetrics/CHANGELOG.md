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

## Сессия 2 — TBD

### Этап 0: Pre-flight + audit

[ ] baseline git status / tsc / build
[ ] Audit #1 — briefing-author fallback dead/live
[ ] Audit #2 — professor-pipeline coverage
[ ] Audit #3 — generateText cacheControl compat
[ ] Audit #4 — util:artifact-suggestions taskId

### Этап 1: Cache breakpoints

[ ] briefing-author generateArticle
[ ] briefing-author generateIntroOutro
[ ] briefing-section-author
[ ] podcast script-generator (generateText or rewrite to streamText)

### Этап 2: Hardcode fix

[ ] podcast script-generator accumulator + logUsage + trace
[ ] briefing-author fallback (delete if dead, fix if live)

### Этап 3: Full coverage

[ ] request-suggestions logUsage
[ ] professor-pipeline (unify if needed per Audit #2)

### Этап 4: JSDoc

[ ] schema.ts inputTokens warning
[ ] research-engine.ts Perplexity comment
[ ] tts-gemini.ts non-token comment

### Этап 5: E2E validation

[ ] Briefing smoke + SQL
[ ] Per-section refresh test
[ ] Podcast smoke + SQL
[ ] Control: simply, task-expert
[ ] request-suggestions manual test

### Этап 6: Финализация

[ ] ADR 051
[ ] CHANGELOG [3.87.0]
[ ] SIMPLY_STATUS
[ ] CLAUDE.md
[ ] ANALYSIS_MIND_ARTIFACTS_SAVEFACT раздел 9 закрыт
[ ] package.json → 3.87.0
[ ] Финальный smoke пользователем
[ ] perенос в _archive
