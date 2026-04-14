# Анализ ТЗ-XAI-1 — Фундамент миграции на xAI

**Дата анализа:** 2026-04-14
**Версия проекта:** v3.87.5 → **v3.88.0** ✅
**Статус ТЗ:** ✅ Завершён 2026-04-14 (commit `ba9e928`)
**ТЗ:** [TZ-XAI-1.md](TZ-XAI-1.md) · [ROADMAP](ROADMAP.md) · [ROADMAP серии](../SIMPLY_XAI_ROADMAP.md)

---

## Итог (заполнено по завершении)

Все 3 этапа ROADMAP закрыты. Архитектор был прав в стратегии и декомпозиции серии, но ошибся в двух технических допущениях, которые мы сняли через аудит кода и продуктовую коррекцию Владимира:

1. **~60% ТЗ оказались no-op** — регистр/getModel/providers/CAPS_GROK уже сделаны в CoreRegistry (ТЗ-1) и DevSwitchboardUI (ТЗ-2). ТЗ-XAI-1 схлопнулось до 2 содержательных правок в каталоге + notes + документация
2. **Эмпирический тест контекстного окна отменён** — Владимир поймал что тест отвечал на неправильный вопрос. Вечный чат + Lost in the Middle делают размер провайдерского окна архитектурно иррелевантным. Защита контекста (sliding window + Extract-on-compression) нужна независимо
3. **R-5** и **R-6** зафиксированы для ТЗ-XAI-5 и ТЗ-XAI-3 соответственно — критические находки, которых в оригинальном ТЗ не было
4. Новая схема работы без внешнего архитектора зафиксирована в памяти и [SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md)

**Смоук-тест прошёл:** Владимир через активные dev overrides на `/dev/models` проверил оба режима Simply Chat под Grok (`grok-4-1-fast-non-reasoning` для текста, `grok-4-1-fast-reasoning` для режима «Думать»). TTFT 8-15ms, MIND retrieval работает, реплики сохраняются. Правки каталога не сломали резолвинг через registry.

---

---

## Изученная документация

Согласно правилу WORKFLOW #1 — перед любым анализом должна быть first-party документация.

### xAI / Grok (официальные)

| Источник | Что проверено |
|---|---|
| https://docs.x.ai/docs/models | Каталог моделей, pricing, modalities, structured outputs |
| https://docs.x.ai/developers/model-capabilities/text/reasoning | `reasoning_effort` не поддерживается для grok-4.1-fast и grok-4.20. Только multi-agent принимает `reasoning: low/medium/high/xhigh` (управляет числом агентов). Остальные рассуждают автоматически, usage содержит `reasoning_tokens` без конфигурации |
| https://docs.x.ai/docs/guides/structured-outputs | Structured outputs поддерживается **всеми** language моделями через `response_format json_schema`. Ограничения: не поддерживаются `minLength/maxLength/minItems/maxItems/minContains/maxContains`, `allOf`. Structured outputs **в связке с tools** — только для Grok 4 family |
| https://docs.x.ai/developers/model-capabilities/text/multi-agent | Multi-agent НЕ поддерживает client-side function calling. Только built-in (`web_search`, `x_search`) и remote MCP. Это критично для `expertise` — см. риск R-5 ниже |

### AI SDK v6 xAI provider

| Источник | Что проверено |
|---|---|
| https://ai-sdk.dev/providers/ai-sdk-providers/xai | `createXai()` поддерживает `streamText`, `generateText`, `generateObject`, `streamObject`, `generateImage`, tool calling. Provider options: `reasoningEffort`, `logprobs`, `topLogprobs`, `parallel_function_calling`, `searchParameters`. Responses API (`xai.responses()`) — отдельный namespace, не используется в ТЗ-XAI-1 |

### Официальные факты, критичные для ТЗ

1. **Context window: 2 000 000 tokens** для всех Grok 4.x моделей (grok-4.1-fast, grok-4.20, multi-agent). Каталог сейчас занижен до 256K/128K — это legacy «из осторожности» без эмпирической проверки (см. [specs/\_backlog/TZ_GrokContextWindowAudit.md](../../../specs/_backlog/TZ_GrokContextWindowAudit.md))
2. **Pricing для Grok 4.20 family:** $2.00 input / $6.00 output / $0.20 cached per 1M — каталог совпадает ✅
3. **Pricing для Grok 4.1 Fast:** $0.20 input / $0.50 output / $0.05 cached per 1M — каталог совпадает ✅
4. **cache_write** у xAI **нет** как отдельной строки в pricing — только input / output / cached. Каталог кладёт `cacheWrite: 0` — корректно, но нужен monitoring если xAI начнёт возвращать `cacheWriteTokens` в usage
5. **Max output tokens:** docs.x.ai эту цифру **не раскрывает**. Каталог держит 16 000 — догадка
6. **Structured outputs** поддерживаются нативно → `generateObject` через AI SDK должен работать на всех вариантах Grok 4.x (важно для будущего ТЗ-XAI-2)

---

## Резюме ТЗ-XAI-1

ТЗ заявляет «actualize registry + catalog + task-assignments» с условием **ноль изменений поведения**. Цель — подготовить инфраструктуру к переключению taskId в последующих ТЗ.

**Главный вывод моего аудита:** ТЗ написано примерно на 60% вхолостую — большая часть того, что оно предлагает, уже выполнено в предыдущих ТЗ (CoreRegistry, DevSwitchboardUI, ModelCatalogDocumentFlags). Реально остаётся **три содержательных вопроса и одна опасная недосказанность**.

---

## Аудит: что уже сделано, а что нет

### ✅ Уже в порядке — трогать не нужно

| Раздел ТЗ | Статус в коде | Файл |
|---|---|---|
| `registry.ts` — namespace `xai` через `createXai({ apiKey })` | ✅ Есть | [lib/ai/registry.ts:48-50](../../../lib/ai/registry.ts#L48) |
| `getModel()` резолвит `xai:*` через `PROVIDER_TO_REGISTRY` | ✅ Работает | [lib/ai/getModel.ts:91-101](../../../lib/ai/getModel.ts#L91) |
| `providers.ts` — pricing берётся из каталога, нет hardcoded per-provider | ✅ SSOT через `calculateCostRub` | [lib/ai/providers.ts:111-122](../../../lib/ai/providers.ts#L111) |
| `CAPS_GROK` preset существует | ✅ С `thinking: true` default + override для non-reasoning | [lib/ai/model-catalog.ts:151-167](../../../lib/ai/model-catalog.ts#L151) |
| 6 xAI записей в каталоге, modelId совпадает с docs.x.ai | ✅ | [lib/ai/model-catalog.ts:349-413](../../../lib/ai/model-catalog.ts#L349) |
| Pricing Grok 4.20 ($2/$6/$0.2) и 4.1 Fast ($0.2/$0.5/$0.05) | ✅ Совпадает с docs.x.ai | — |
| `RUB_PER_USD = 100` — отдельная константа под контролем владельца | ✅ | [lib/constants/pricing.ts](../../../lib/constants/pricing.ts) |
| Cache breakpoint логика провайдер-aware через `isAnthropicProtocolModel` | ✅ xAI уже обойдёт Anthropic `cacheControl` path | [app/(chat)/api/chat/route.ts:929-931](../../../app/(chat)/api/chat/route.ts#L929) |

**Вывод:** из 5 пунктов «что сделать» в ТЗ, п. 1 (registry), п. 4 (getModel), п. 5 (providers.ts) — **no-op**. ТЗ так и писал, но формулировки «проверить» создают иллюзию работы.

### ⚠️ Требует решения — не no-op

#### Q1. contextWindow у Grok 4.x: оставить 256K/128K или поднять до 2M?

Каталог сейчас ([model-catalog.ts:346-348](../../../lib/ai/model-catalog.ts#L346)):
```ts
// Context window: docs.x.ai reports 2M for all models, but this may be
// aspirational. Using conservative values (256K/128K) until confirmed via
// actual API testing. Re-check at next audit.
```

Это legacy «осторожный костыль», зафиксированный как follow-up в [specs/\_backlog/TZ_GrokContextWindowAudit.md](../../../specs/_backlog/TZ_GrokContextWindowAudit.md) — там предложен эмпирический тест стоимостью до ~$64 (или $6-10 при бинарном поиске).

**Почему это важно именно в ТЗ-XAI-1:**

- ТЗ-XAI-3 явно пишет: «Убрать Compaction API — не нужен при 2M окне» и «Пересчитать SIMPLY\_CONTEXT\_LIMIT». Эти решения **опираются** на контекст 2M. Если catalog говорит 256K, а route код считает «2M», два SSOT расходятся — это именно та проблема, которую CoreRegistry должен был убить
- `getContextWindow()` используется в token-budget calculations, DevPanel, context-limits

**Три варианта для обсуждения:**

| Вариант | Плюсы | Минусы |
|---|---|---|
| **A. Поднять до 2M** без эмпирического теста (trust docs.x.ai) | Единый SSOT, разблокирует ТЗ-XAI-3 сразу | Риск: если real limit ниже — в ТЗ-XAI-3 получим runtime 400 errors |
| **B. Провести эмпирический тест** в рамках ТЗ-XAI-1 | Доверяемое значение, закрываем backlog-ТЗ | ~$6-10 и 1 час работы не в SPEC |
| **C. Оставить 256K/128K** как сейчас | Zero-risk | ТЗ-XAI-3 упирается в расхождение, ТЗ-XAI-2 не сможет принимать разумные extract thresholds |

**Моя рекомендация:** вариант **B** — быстрый бинарный поиск (256K → 1M → 2M) стоит ~$6 и даёт эмпирическую истину для всех последующих ТЗ. Это займёт 30 минут и зафиксирует SSOT навсегда.

#### Q2. `maxOutput: 16000` у всех Grok — догадка

docs.x.ai эту цифру **не раскрывает публично**. AI SDK xAI provider также не фиксирует лимит. 16K — консервативная догадка из прошлого аудита.

- В briefing author / professor pipeline / create artifact мы иногда запрашиваем длинные ответы (8-12K output). 16K — впритык
- Если real limit 32K или 64K — мы искусственно ограничиваем себя в UI (progress bars, timeout heuristics)

**Рекомендация:** оставить 16K в ТЗ-XAI-1 (zero-risk), зафиксировать как риск для ТЗ-XAI-4 (briefing author — там это реально упирается).

#### Q3. `grok-4` DEPRECATED entry в каталоге — удалять сейчас или в ТЗ-XAI-6?

[model-catalog.ts:400-413](../../../lib/ai/model-catalog.ts#L400) содержит запись `grok-4` с notes «DEPRECATED — not in docs.x.ai models list. Pricing is an educated guess.» У неё **ноль потребителей** в `task-assignments.ts` (`grep` подтвердил).

**Рекомендация:** удалить **в ТЗ-XAI-1**. ТЗ-XAI-6 это «очистка MiniMax/OpenRouter» — включать туда ещё и мёртвый grok entry бессмысленно. Правило «ТЗ-XAI-1 = ноль изменений поведения» не нарушается: 0 потребителей → 0 поведения.

### 🚨 Опасная недосказанность в ТЗ

#### R-5. `expertise` → `grok-4.20-multi-agent-0309` работает НЕ по своему назначению

**Текущее состояние:**

- [task-assignments.ts:91](../../../lib/ai/task-assignments.ts#L91) назначает `expertise` на `grok-4.20-multi-agent-0309`
- [app/(chat)/api/chat/route.ts:1027](../../../app/(chat)/api/chat/route.ts#L1027) вызывает эту модель через `streamText()` с **client-side tools** (deepResearch, fetchUrl, ...)
- **xAI docs:** multi-agent variant **не поддерживает client-side function calling**. Только built-in tools + remote MCP
- **Следствие:** сейчас code либо игнорирует multi-agent поведение и работает как обычный Grok 4.20, либо tools молча игнорируются. `ai_usage_log` показывает **1 вызов за всю историю** — см. [BRAINSTORM\_GrokMultiAgent.md:67](../BRAINSTORM_GrokMultiAgent.md#L67). Это фича, которая формально есть, но фактически не активна

**Почему это критично именно для ТЗ-XAI-1:**

ROADMAP серии в ТЗ-XAI-5 пишет: «expertise → Grok 4.20 (с нашими tools через function calling)». Это фактически **молчаливая миграция с multi-agent на single-agent variant**. Ни SPEC ТЗ-XAI-1, ни ROADMAP не фиксируют это изменение как explicit decision. Без фиксации оно пройдёт под соусом «обновление pricing».

**Два варианта:**

| Вариант | Суть |
|---|---|
| **A. Зафиксировать** в ТЗ-XAI-1 комментарием в каталоге: «multi-agent не используется в production flow — expertise уйдёт на grok-4.20-0309-non-reasoning в ТЗ-XAI-5» | Честный след |
| **B. В ТЗ-XAI-1 переключить expertise уже сейчас** на `grok-4.20-0309-non-reasoning` | Нарушает «ноль изменений поведения», но де-факто поведение не меняется (раз multi-agent не активен) |

**Моя рекомендация: A** — это задача ТЗ-XAI-5, в ТЗ-XAI-1 просто фиксируем notes в каталоге и в ROADMAP пункт «XAI-5: явно переключить expertise с multi-agent на non-reasoning, обосновать». Иначе архитектурное решение теряется в коммите pricing update.

---

## Потенциальные риски

| # | Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|---|
| R-1 | Подъём contextWindow до 2M без теста — в ТЗ-XAI-3 получим 400 errors на реальных промптах | Средняя | Среднее | Эмпирический тест в рамках ТЗ-XAI-1 (Q1 вариант B) |
| R-2 | xAI начнёт возвращать `cacheWriteTokens` в usage — `calculateCostRub` умножит на 0 и занизит стоимость | Низкая | Низкое | Добавить `console.warn` в `extractUsageForPricing` при обнаружении; зафиксировать в backlog |
| R-3 | `maxOutput: 16_000` занижен — в ТЗ-XAI-4 briefing author обрежет статью | Низкая | Низкое | Риск для ТЗ-XAI-4, не для XAI-1 |
| R-4 | TS validation / build упадёт из-за aliasOf ссылок если удалить `grok-4` | Очень низкая | Низкое | `npx tsc --noEmit` после удаления |
| R-5 | Молчаливое переключение expertise с multi-agent на single-agent в XAI-5 без фиксации | **Высокая** | **Среднее** | Явный notes в каталоге + явный пункт в ROADMAP (рекомендация A выше) |
| R-6 | `isSimplyNonAnthropicModel` стрипает image/file parts для любого не-Anthropic. При переключении KITT на Grok — молча начнёт стрипать изображения, хотя Grok vision поддерживает | Высокая | Среднее | **В ТЗ-XAI-3 полностью убрать `isSimplyNonAnthropicModel` + связанные strip-функции, заменить на проверку `capabilities.vision` из каталога (SSOT)**. НЕ полагаться на «vision-маршрут → Haiku спасёт» — это хрупко. Решение: убрать причину, не симптом |

---

## Зависимости

**Что нужно до начала:**
- [ ] Ответ пользователя на Q1 (2M vs 256K vs эмпирический тест)
- [ ] Ответ пользователя на Q3 (удалять grok-4 сейчас или нет)
- [ ] Ответ пользователя на R-5 (фиксировать notes + ROADMAP-пункт про expertise/multi-agent)

**Затронутые компоненты:**
- [lib/ai/model-catalog.ts](../../../lib/ai/model-catalog.ts) — 6 xAI записей, обновить `contextWindow` + комментарии; возможно удалить `grok-4` entry
- [specs/Simply_xAI/SIMPLY_XAI_ROADMAP.md](../SIMPLY_XAI_ROADMAP.md) — добавить в ТЗ-XAI-5 explicit note про multi-agent → non-reasoning переключение
- [specs/_backlog/TZ_GrokContextWindowAudit.md](../../../specs/_backlog/TZ_GrokContextWindowAudit.md) — закрыть если делаем эмпирический тест

**НЕ затрагиваем (по правилу «ноль изменений поведения»):**
- registry.ts — no-op
- getModel.ts — no-op
- providers.ts — no-op
- task-assignments.ts — no-op
- chat/route.ts — no-op

---

## Оценка

- [x] **Простое (1 сессия)**

**Обоснование:**
- Реальный объём изменений: обновить 6 полей `contextWindow` в каталоге + комментарии + (опционально) удалить 1 deprecated entry + ROADMAP note
- Если делать эмпирический тест контекста — +30 минут на тест
- Валидация: `npm run build` + прогон `getModel(task)` для нескольких xAI taskId

---

## Вопросы для уточнения

> Ответь на эти вопросы перед началом разработки

1. **contextWindow (Q1):** Что делаем с 2M vs 256K? Варианты:
   - A. Поднять до 2M без теста (trust docs.x.ai)
   - **B. Эмпирический тест** (30 мин, ~$6-10) — закрываем backlog-ТЗ и фиксируем SSOT (**моя рекомендация**)
   - C. Оставить 256K/128K

2. **grok-4 deprecated entry (Q3):** Удалять в ТЗ-XAI-1 или оставить до ТЗ-XAI-6? Моя рекомендация — **удалить сейчас**, он мёртвый (0 потребителей).

3. **maxOutput (Q2):** Хочешь эмпирическую проверку потолка output tokens в рамках ТЗ-XAI-1, или оставить 16K как консервативное значение и разбираться только если в ТЗ-XAI-4 упрёмся?

4. **R-5 — expertise/multi-agent:** Зафиксировать explicit notes в каталоге + ROADMAP пункт для ТЗ-XAI-5? Или ты считаешь что multi-agent нужно пробовать активно через Responses API (это уже материал для ТЗ-XAI-MA-1 из «будущих расширений», но решение нужно сейчас)?

5. **R-6 — strip media для xAI:** Я обнаружил что в [chat/route.ts:919](../../../app/(chat)/api/chat/route.ts#L919) условие `isSimplyNonAnthropicModel` срабатывает для любого не-Anthropic провайдера и триггерит `stripMediaPartsForTextModel`. Когда в XAI-3 переключим Simply на Grok — это начнёт молча стрипать изображения, хотя Grok поддерживает vision. Добавить это в ROADMAP ТЗ-XAI-3 как явный пункт? (Не сейчас — но зафиксировать риск до того, как XAI-3 стартует.)

---

## Ответы на вопросы (получены 2026-04-14)

1. **Q1 contextWindow:** вариант **B — эмпирический тест**. Проводим в рамках ТЗ-XAI-1. Тест стоимостью ~$6-10 требует явного ОК пользователя перед запуском (см. ROADMAP Этап 1)
2. **Q2 grok-4 deprecated:** **удалить сейчас** в ТЗ-XAI-1. 0 потребителей
3. **Q3 maxOutput:** **оставить 16K**. Не тратим время на тест ради цифры
4. **R-5 expertise/multi-agent:** зафиксировать **notes в каталоге** (`multi-agent не используется через Chat Completions, XAI-5 переключит на grok-4.20-0309`) + добавить **explicit пункт в ROADMAP серии** (ТЗ-XAI-5). Multi-agent отложен в отдельную будущую ветку через Responses API (ТЗ-XAI-MA-1)
5. **R-6 strip media — КОРРЕКЦИЯ архитектора:** Не полагаться на маршрутизацию «vision → Haiku спасёт». Это хрупко, ломается при любом рефакторинге. **Правильное решение в ТЗ-XAI-3:** полностью убрать `isSimplyNonAnthropicModel` + все связанные strip-функции, заменить на проверку `capabilities.vision` из model-catalog (SSOT). Убирать причину, не симптом. Зафиксировано в [../SIMPLY_XAI_NOTES.md](../SIMPLY_XAI_NOTES.md) (2026-04-14)

---

## Дополнительная находка: будущие ТЗ уже выигрывают от этого анализа

Пока аудировал кодовую базу, нашёл несколько фактов, полезных для следующих ТЗ серии:

### Для ТЗ-XAI-2 (MIND pipeline)

- **Все 5 call sites** в MIND уже инвентаризированы ([lib/ai/memory/extract.ts](../../../lib/ai/memory/extract.ts), [consolidate.ts](../../../lib/ai/memory/consolidate.ts), [profile.ts](../../../lib/ai/memory/profile.ts)):
  - `extractFactsFromMessages` (memory:extract) — `generateObject` + Zod
  - `batchExtractFacts` (memory:extract-batch) — `generateText` + JSON.parse + Zod **(legacy MiniMax workaround — xAI поддерживает structured outputs натив, можно упростить)**
  - `verifyDuplicatesWithLLM` (memory:dedup-verify) — `generateObject` + Zod
  - `runConsolidation` (memory:consolidate) — `generateText` + JSON.parse **(тоже можно в native generateObject)**
  - `generateUserProfile` (memory:profile) — `generateText` prose (structured output не нужен)
- **Никаких `providerOptions.anthropic.*`, thinking, cacheControl не используется** в MIND pipeline → миграция механически безопасна
- Зафиксировать в ТЗ-XAI-2: **бонус** — два call sites можно рефакторить на native `generateObject`, убрать `JSON.parse` workaround

### Для ТЗ-XAI-3 (KITT)

- `isAnthropicProtocolModel` уже провайдер-aware — `cacheControl` не ломает xAI
- Но `isSimplyNonAnthropicModel` стрипает media — **сломает vision при переключении** (R-6)
- `providerMetadata.anthropic.iterations` (compaction debug) будет `undefined` под Grok — блок в `onFinish` [chat/route.ts:1159-1175](../../../app/(chat)/api/chat/route.ts#L1159) уже gracefully no-op (читает optional chaining), безопасно

### Для ТЗ-XAI-4 (utility/pipeline)

- `professor:review` использует `providerOptions.anthropic.thinking: { adaptive, effort: "high" }` ([lib/ai/professors/task-reviewer.ts:136](../../../lib/ai/professors/task-reviewer.ts#L136)) — при переключении убрать (Grok рассуждает автоматически)
- Briefing filter/author/section — все используют MiniMax workaround `generateText + JSON.parse + Zod` — под Grok можно native `generateObject`
- `podcast-script` ([lib/podcast/script-generator.ts:122](../../../lib/podcast/script-generator.ts#L122)) использует `cacheControl: ephemeral` на сообщениях — для Grok этот блок нужно обернуть в провайдер-проверку (как в chat/route.ts)

### Для ТЗ-XAI-5 (think/create/expertise)

- expertise сейчас указывает на multi-agent variant, но фактически работает как single-agent (R-5)
- create сейчас = MiniMax M2.7 (`task-assignments.ts:92`)

### Для ТЗ-XAI-6 (cleanup)

- `vercel-minimax-ai-provider` package — удалить из package.json
- Две функции: `stripLegacyOpenAICompatToolParts` (специфична для legacy OpenAI-compat MiniMax data в БД) и `stripMediaPartsForTextModel` (нужна если какая-то non-vision модель останется — под чистый Grok+Haiku можно удалить)
- Переменные окружения: `MINIMAX_API_KEY`, `OPENROUTER_API_KEY`

Все эти находки войдут в ANALYSIS.md соответствующих ТЗ, здесь фиксирую чтобы не потерять при переключении сессий.
