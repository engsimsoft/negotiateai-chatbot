# ТЗ-AISDKLayerHardening — укрепление слоя AI SDK invocations

**Статус:** Активно
**Создано:** 2026-04-17
**Серия:** Post-Simply_xAI hygiene (umbrella ТЗ для трёх связанных долгов)
**Источники (заготовки из `specs/_backlog/`):**
- `TZ_DevOverridesSideEffectImportAudit.md` — регистрация dev-overrides reader для всех backend routes
- `TZ_MaxOutputTokensAudit.md` — явный `maxOutputTokens` во всех AI call sites
- `TZ_ProfessorPlanStreaming.md` — перевод `plan/route.ts` на `streamText`

---

## Зачем это ТЗ

После закрытия серии Simply_xAI (v3.92.2, 2026-04-17) в `specs/_backlog/` осталось три связанных долга на уровне слоя AI SDK invocations. Они не критичны по-отдельности, но вместе образуют «пре-флайт гигиену» этого слоя:

1. **DevOverrides** — dev-панель `/dev/models` для 6+ routes молча не работает (side-effect импорт `model-overrides-node` отсутствует). Блокирует A/B тесты моделей.
2. **MaxOutputTokens** — ~20 AI call sites не декларируют `maxOutputTokens` явно. Hot-fix d9d3488 это уже ловил в `plan/route.ts` (timeout-bomb через неявный 128K). SSOT отсутствует, проблема может повториться для других routes.
3. **ProfessorPlanStreaming** — `plan/route.ts` работает на `generateText` с tactical cap 16000 под Anthropic 21333 threshold. Корневое решение — `streamText`, adaptive thinking требует streaming by design.

Связь: всё это один слой (backend AI invocations, файлы пересекаются: `plan/route.ts`, `getModel.ts`, ~20 routes). Делаем одним ТЗ с тремя этапами + gate после каждого, чтобы не ходить по одним файлам трижды.

---

## Scope

### В scope

**Этап 1 — DevOverrides register-on-boot:**
- Централизованная регистрация dev-overrides reader (`@/lib/ai/model-overrides-node`) через Next.js `instrumentation.ts` (option C из заготовки) либо через `getModel.ts` (option B) — решение в ANALYSIS
- Удаление hot-fix side-effect импортов из routes, которые добавлены в ТЗ-XAI-4 (plan + 3 briefing)
- ADR 048 update: зафиксировать новый паттерн регистрации
- Acceptance: dev-панель overrides работают для всех taskIds без per-route импорта

**Этап 2 — MaxOutputTokensAudit (SSOT + getter + ~20 call sites):**
- `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` в `lib/ai/task-assignments.ts`
- Getter `getMaxOutputTokensForTask(taskId)` в `lib/ai/getModel.ts`
- Обход ~20 call sites `generateText` / `streamText` / `generateObject` / `streamObject` → все проставляют явный `maxOutputTokens` через getter
- Значения из recommended cap table (см. TZ_MaxOutputTokensAudit.md) — стартовые, могут уточняться на этапе ревью ANALYSIS
- Acceptance: grep по `lib/` / `app/` не находит AI call site без явного `maxOutputTokens`

**Этап 3 — ProfessorPlanStreaming:**
- `app/(chat)/api/projects/[id]/plan/route.ts` переводится с `generateText` на `streamText`
- Tactical `maxOutputTokens: 16000` убирается (либо заменяется на getter значение — решение в ANALYSIS)
- Парсинг `<plan_report>` / `<plan_json>` продолжает работать с аккумулированным text
- `logUsage()` через `await stream.usage` (или аналогичный API v6)
- Adaptive thinking работает корректно (`thinking: { type: "adaptive" }` + high effort)
- Acceptance: генерация плана на проекте с 10+ задачами за < 60s без socket errors

### НЕ в scope

- Streaming response к клиенту (progressive UX для `/projects/[id]/plan`) — отдельный хвост
- Изменения моделей (professor:planning остаётся на Opus 4.6 / Grok 4.20)
- Переработка самого dev-overrides протокола (файл формат `.simply-dev-overrides.json`)
- Продуктовые решения о «должна ли модель отвечать длиннее/короче»
- Любые находки вне трёх этапов → в FINDINGS.md, не «заодно»

---

## Принципы выполнения (от владельца)

1. **Строго по WORKFLOW.** Gate после каждого этапа: `tsc` → `build` → мануальный тест → ОК → следующий этап.
2. **Официальная документация ДО всего остального** (Правило 1). Next.js instrumentation.ts, AI SDK v6 streamText/usage, Anthropic max_tokens streaming threshold, @ai-sdk/anthropic — всё через WebSearch/WebFetch в ANALYSIS.
3. **Никаких костылей и заплаток.** Только архитектурно правильные решения. Если по дороге видим закладку/костыль — в FINDINGS.md, не чинить «заодно».
4. **Находки вне scope — в FINDINGS.md СРАЗУ.** Не в голову, не в TodoWrite. Фикс отложенный.
5. **Порядок этапов зафиксирован:** 1 (DevOverrides) → 2 (MaxOutputTokens) → 3 (ProfessorPlanStreaming). Нельзя менять местами: этап 3 использует getter из этапа 2.

---

## Оценка

**~3-4 сессии суммарно:**
- Этап 1 (DevOverrides): 0.5 сессии
- Этап 2 (MaxOutputTokens): 1-1.5 сессии (основной объём, ~20 call sites)
- Этап 3 (ProfessorPlanStreaming): 1-1.5 сессии (streamText + парсер + smoke test)
- Финализация + docs: 0.5 сессии

---

## Связанные ADR / документы

- [ADR 048 — Dev Switchboard UI](../../docs/decisions/048-dev-switchboard-ui.md) — будет обновлён на этапе 1
- [SIMPLY_PROMPTS_AND_MODEL_CONFIG.md § 4.2](../Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md) — будет обновлён на этапе 2 с финальной таблицей cap-ов
- [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) — место для SSOT
- [lib/ai/getModel.ts](../../lib/ai/getModel.ts) — место для getter
- [plan/route.ts](../../app/(chat)/api/projects/[id]/plan/route.ts) — этап 3

---

## Acceptance criteria (umbrella)

- [ ] Этап 1: DevOverrides reader регистрируется централизованно, dev-панель работает для всех taskIds backend routes
- [ ] Этап 1: ADR 048 обновлён, side-effect импорты из hot-fix-ов убраны
- [ ] Этап 2: `DEFAULT_MAX_OUTPUT_TOKENS` SSOT в task-assignments.ts
- [ ] Этап 2: `getMaxOutputTokensForTask()` getter в getModel.ts
- [ ] Этап 2: ~20 call sites используют getter, grep подтверждает 100% покрытие
- [ ] Этап 3: plan/route.ts на streamText, tactical cap убран, adaptive thinking работает
- [ ] Этап 3: smoke test генерации плана за <60s без socket errors
- [ ] `npx tsc --noEmit` — 0 ошибок после каждого этапа
- [ ] `npm run build` — успешен после каждого этапа
- [ ] Мануальный тест владельцем подтверждён после каждого этапа
- [ ] Документация обновлена по Правилу 6 (ADR 048, SIMPLY_PROMPTS_AND_MODEL_CONFIG.md § 4.2, docs/architecture.md если добавлен instrumentation.ts)
