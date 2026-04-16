# ТЗ-MaxOutputTokensAudit — audit явного `maxOutputTokens` во всех `generateText`/`streamText`/`streamObject`/`generateObject` вызовах

**Статус:** Хвост, Medium impact (предотвратительная мера после hot-fix d9d3488)
**Создано:** 2026-04-16 (сессия ТЗ-XAI-4 Этап 4, финализация)
**Источник:** Hot-fix plan/route.ts (d9d3488) обнаружил что default max_tokens из catalog (128K Opus) = timeout-bomb для non-streaming routes
**Связано с:** [specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md § 4.2](../Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md#L331), [TZ_ProfessorPlanStreaming.md](TZ_ProfessorPlanStreaming.md), [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts)

---

## Симптом

В проекте используется два подхода к `maxOutputTokens` во вызовах AI SDK:

1. **Явный** (хорошо): `maxOutputTokens: 8192` или подобное — явное указание под размер output задачи
2. **Неявный** (опасно): параметр не передан → `@ai-sdk/*` подставляет model capability max из catalog

Model capability defaults сейчас:
- **Opus 4.6:** 128 000 tokens (поднято Anthropic 2026-04-12 с 32K → 128K)
- **Sonnet 4.6:** 64 000 tokens
- **Haiku 4.5:** 64 000 tokens
- **Grok 4.1 Fast / 4.20:** 131 072 tokens

**Проблема для non-streaming (`generateText`, `generateObject`):**

Anthropic требует streaming для `max_tokens > 21333` ([docs.anthropic.com/en/api/errors#long-requests](https://docs.anthropic.com/en/api/errors#long-requests)). Non-streaming запрос с 128K запрашиваемым max → весь ответ накапливается на сервере Anthropic до одного финального chunk → **не укладывается в 60s default fetch timeout** → `UND_ERR_SOCKET: other side closed` → 3× retry → 180s fail.

**Уже эмпирически наблюдалось:** `plan/route.ts` с Opus 4.6 без `maxOutputTokens` 3× timeout в ТЗ-XAI-4 сессии. Tactical фикс — `maxOutputTokens: 16000` (d9d3488). Root cause — **отсутствие явной декларации**.

**Проблема для streaming (`streamText`, `streamObject`):**

Streaming не имеет timeout проблемы, но отсутствие явного cap всё равно создаёт риски:
- Race condition: модель может продолжать писать пока не упрётся в model max (128K) → избыточная стоимость и latency
- Truncation surprise: пользователь не видит предупреждение о чрезмерном output
- Observability gap: в audit metadata не видно planned output size

---

## Scope audit

**Call sites с `generateText`/`streamText`/`generateObject`/`streamObject` (by grep):**

**Уже с явным `maxOutputTokens` (known good):**
- [lib/podcast/script-generator.ts:139](../../lib/podcast/script-generator.ts#L139) — `4096`
- [lib/meeting/meeting-pipeline.ts](../../lib/meeting/meeting-pipeline.ts) — `8192` (meeting summary)
- [lib/briefing/briefing-section-author.ts:192](../../lib/briefing/briefing-section-author.ts#L192) — `8192`
- [lib/briefing/briefing-author.ts:214](../../lib/briefing/briefing-author.ts#L214) — `maxTokens` (dynamic)
- [app/(chat)/api/projects/[id]/plan/route.ts:196](../../app/(chat)/api/projects/[id]/plan/route.ts#L196) — `16000` (tactical)

**Требует проверки (может быть implicit):**
- `lib/briefing/briefing-filter.ts`
- `lib/ai/vision-ocr.ts`
- `lib/ai/tools/chat-tools.ts`
- `lib/ai/professors/task-reviewer.ts`
- `lib/ai/professor-pipeline.ts`
- `lib/ai/memory/profile.ts`
- `lib/ai/memory/consolidate.ts` (если есть)
- `lib/ai/memory/extract.ts` (если есть)
- `lib/ai/clerks/task-summarizer.ts`
- `lib/ai/tools/request-suggestions.ts` (streamObject)
- `artifacts/text/server.ts`
- `artifacts/markdown/server.ts`
- `artifacts/excel/server.ts`
- `artifacts/presentation-reveal/server.ts`
- `artifacts/presentation-pptx/server.ts`
- `app/(chat)/api/chat/route.ts` (main)
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/assistant/ben/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
- `app/(chat)/api/projects/[id]/generate-summary/route.ts`
- `app/(chat)/api/projects/[id]/analyze-file/route.ts`
- `app/(chat)/api/chat/[id]/generate-title/route.ts`
- `app/(chat)/actions.ts`

**Итого: ~20 call sites требуют audit.**

---

## Рекомендованная recommended cap table

| Задача | Taskid | Cap | Обоснование |
|---|---|---|---|
| Автонейминг чата | `util:title` | **64** | 1-2 слов, ≤ 32 chars |
| Project summary | `util:project-summary` | **500** | 2-3 параграфа |
| Artifact suggestions | `util:artifact-suggestions` | **1024** | streamObject массив |
| File analyzer | `clerk:file-analyzer` | **2048** | JSON summary |
| Task summary | `clerk:task-summary` | **2048** | Multiline summary |
| Memory extract | `memory:extract` | **4096** | structured JSON facts |
| Briefing filter | `briefing:filter` | **1024** | JSON list IDs |
| Briefing author | `briefing:author` | **4096-8192** (dynamic) | уже dynamic ✓ |
| Briefing section | `briefing:section` | **8192** | уже явный ✓ |
| Podcast script | внутренний taskId | **4096** | уже явный ✓ |
| Meeting summary | `meeting:summary` | **8192** | уже явный ✓ |
| Professor planning | `professor:planning` | **16000** (temp) / `streamText` без cap (long-term) | tactical фикс d9d3488, см. [TZ_ProfessorPlanStreaming.md](TZ_ProfessorPlanStreaming.md) |
| Professor review | `professor:review` | **8192** | Analysis text |
| Professor pipeline synth | `professor:pipeline-synthesize` | **16000** | long-form synthesis |
| Vision OCR | `vision:ocr` | **4096** | OCR text |
| Simply chat / expertise / create | `simply-chat*`, `expertise`, `create` | **streaming, без cap** | free-form, streamText |
| Artifact handlers | `artifact:*` | **16384** | документы могут быть большие |
| Service chats | `service-chat:*` | **4096** | conversational |

Cap-ы можно держать в одном месте: `lib/ai/task-assignments.ts` рядом с DEFAULT_TASK_MODELS (или отдельный `DEFAULT_MAX_OUTPUT_TOKENS` map), чтобы call site брал `getMaxOutputTokensForTask(taskId)`.

---

## Варианты реализации

### Вариант A — ручной audit каждого call site, явное значение inline

**За:** просто, видно в коде.
**Против:** дублирование, расхождение с SSOT, следующий ТЗ-миграции этих 20 call sites не вспомнит, что уже стоит.

### Вариант B — `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` + getter

**За:** SSOT в task-assignments.ts, getter типобезопасный.
**Против:** требует обновления call sites через getter.

### Вариант C — расширение `getModel(taskId)` чтобы возвращать `{ model, defaultOutput }`

**За:** тот же паттерн что и модель-резолв, нельзя забыть.
**Против:** меняет сигнатуру `getModel`, большой дифф.

**Рекомендация автора ТЗ:** **Вариант B**. Getter `getMaxOutputTokensForTask(taskId: TaskId): number` в `task-assignments.ts`, call sites делают `{ model, maxOutputTokens: getMaxOutputTokensForTask("task-id") }`. Минимальный impact, единая правда.

---

## Acceptance criteria

- [ ] `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` добавлен в [task-assignments.ts](../../lib/ai/task-assignments.ts) со значениями из recommended cap table
- [ ] `getMaxOutputTokensForTask(taskId)` getter экспортирован из [getModel.ts](../../lib/ai/getModel.ts)
- [ ] Все ~20 call sites `generateText`/`streamText`/`generateObject`/`streamObject` в `app/` и `lib/` обновлены на `maxOutputTokens: getMaxOutputTokensForTask("<taskId>")`
- [ ] `plan/route.ts` tactical `maxOutputTokens: 16000` либо заменён на getter, либо удалён вместе с [TZ_ProfessorPlanStreaming.md](TZ_ProfessorPlanStreaming.md) (переход на streamText)
- [ ] `npx tsc --noEmit` 0 ошибок
- [ ] `npm run build` успешен
- [ ] Мануальный smoke test: 3 критичных пути (chat reply, briefing generation, professor planning) без regressions
- [ ] [specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md § 4.2](../Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md#L331) обновлён с финальной таблицей

---

## НЕ в scope

- Вопрос «должна ли модель отвечать длиннее/короче» — продуктовое решение Владельца, этот ТЗ только про техническую явность
- Переход generateText → streamText — это [TZ_ProfessorPlanStreaming.md](TZ_ProfessorPlanStreaming.md), отдельно
- Streaming UX (progressive display) — отдельный хвост

---

## Оценка

**1 сессия:**
- Audit ~20 файлов, grep + inline check (30-45 минут)
- `DEFAULT_MAX_OUTPUT_TOKENS` + getter (15 минут)
- Обновление call sites (1-1.5 часа)
- Build + smoke test (30 минут)
- Documentation update (15 минут)
