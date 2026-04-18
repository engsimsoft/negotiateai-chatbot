# ADR 053 — AI SDK invocation contract

**Дата:** 2026-04-18
**Статус:** Accepted
**Источник решения:** ТЗ-AISDKLayerHardening (v3.93.0) — umbrella ТЗ, закрывший 3 backlog-долга (`TZ_DevOverridesSideEffectImportAudit` 🟥 + `TZ_MaxOutputTokensAudit` 🟧 + `TZ_ProfessorPlanStreaming` 🟧)

---

## Контекст

Simply использует AI SDK v6 (`ai@6.x`) для всех LLM-вызовов — `generateText`, `streamText`, `generateObject`, `streamObject`. На момент создания ADR — 37 taskId × 5 провайдеров (Anthropic, xAI, MiniMax, MiniMax-long, OpenRouter), 25+ call sites в production-коде.

За 6 месяцев active development накопился пласт повторяющихся проблем, каждая из которых закрывалась tactical фиксом без кодификации правила:

1. **`TZ_DevOverridesSideEffectImportAudit`** (🟥 High) — 6+ backend routes не регистрировали overrides reader (молча игнорировали dev overrides). Каждый новый route «забывал» добавить `import "@/lib/ai/model-overrides-node"`.
2. **`TZ_MaxOutputTokensAudit`** (🟧 Medium) — ~20 call sites без явного `maxOutputTokens`. Runaway защиты нет (на Opus default = 128K → может попасть на timeout-bomb).
3. **`TZ_ProfessorPlanStreaming`** (🟧 Medium) — `plan/route.ts` использовал `generateText` на Opus с cap 32000 → Anthropic threshold 21333 → `UND_ERR_SOCKET`. Tactical hot-fix `maxOutputTokens: 16000` (d9d3488) ограничивал output произвольно.

**Корневая причина накопления этих долгов** — отсутствие кодифицированного контракта. Каждое добавление taskId или route было пересказом устного правила «вот тут надо явно задать max tokens, вот тут reader импортировать, вот тут streamText вместо generateText» — а устное правило не масштабируется через 90+ ТЗ.

Запись в backlog «Этот же ТЗ родился из того что 3 предыдущих долга накопились» (из [ROADMAP § ADR rationale](../../_archive/TZ_AISDKLayerHardening/ROADMAP.md)) — прямая мотивация этого ADR.

**Дополнительный триггер — Finding #2 из ТЗ-AISDKLayerHardening:** во время Этапа 3 обнаружено что `@ai-sdk/anthropic@3.0.66` всегда возвращает `outputTokens.reasoning: void 0` ([dist/index.js:1646-1659](../../node_modules/@ai-sdk/anthropic/dist/index.js)). Это не баг SDK, а честное отражение Anthropic Messages API: response даёт единое `usage.output_tokens` без разделения thinking vs completion (в отличие от OpenAI/xAI, где есть `completion_tokens_details.reasoning_tokens`). Следствие: `thinkingTokens` в `ai_usage_log` для всех Anthropic-моделей **архитектурно всегда 0**. Это known limitation, которое должно быть зафиксировано, чтобы будущие разработчики не гонялись за «пропавшими» thinking tokens.

---

## Решение

Фиксируем **4-аспектный контракт** AI SDK invocation. Каждый call site AI SDK (generateText / streamText / generateObject / streamObject) обязан явно декларировать все четыре аспекта. Каждый аспект имеет SSOT и правила взаимосвязей с другими.

### 1. `taskId` — стабильный идентификатор AI-точки

**Что:** строковая константа из `TaskId` union type в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) (например, `"professor:planning"`, `"util:title"`, `"artifact:markdown"`).

**Зачем:** taskId — единственная точка конфигурации. Не модель, не cap, не call mode — taskId. При смене модели, увеличении cap, переключении на streaming — taskId остаётся тем же. Это позволяет логу, метрикам, dev panel, cost tracking ссылаться на стабильный идентификатор.

**SSOT:** `TaskId` union в `task-assignments.ts`. Добавление нового taskId = правка одной строки в union + обязательные записи в `DEFAULT_TASK_MODELS` и `DEFAULT_MAX_OUTPUT_TOKENS` (TS compile-time гарантия через `Record<TaskId, …>`).

**Не меняется в runtime.** Никогда не строится динамически. Литерал в call site.

### 2. `model` — какая модель обслуживает taskId

**Что:** physical catalog id (например, `"claude-opus-4-6"`, `"grok-4.20-0309-reasoning"`), резолвимый через `getModel(taskId)` или `getModelIdForTask(taskId)`.

**SSOT:** `DEFAULT_TASK_MODELS: Record<TaskId, string>` в `task-assignments.ts`. Смена default-модели для задачи = одна строка.

**Runtime override:** через `/dev/models` (file-based) → `model-overrides-node.ts` → `lookupOverride()` в `getModel.ts`. Работает **только в dev mode** (production `notFound`). Reader регистрируется **единственный раз** в [instrumentation.ts](../../instrumentation.ts) (Next.js boot hook).

**HMR-immunity:** reader вынесен в `globalThis.__simplyOverridesReader` (не module-level `let`), потому что Next.js HMR пересоздаёт `lib/ai/model-overrides.ts` при hot-reload и module-level state сбрасывался в no-op. Не меняем — потеряем dev overrides при любом hot reload.

**Резолв order:** test mocks → dev overrides → task-assignments → catalog → registry.

### 3. `cap` — максимальное количество output tokens

**Что:** параметр `maxOutputTokens` в вызове `generateText`/`streamText`/etc. Обязан быть явным на каждом call site (единственное исключение по дизайну — `briefing:author` с dynamic `MAX_TOKENS_BY_VOLUME[volume]`).

**SSOT:** `DEFAULT_MAX_OUTPUT_TOKENS: Record<TaskId, number>` в `task-assignments.ts`. Добавление нового taskId без записи → TS падает (`Record<TaskId, number>` compile-time check).

**Getter:** `getMaxOutputTokensForTask(taskId)` в [lib/ai/getModel.ts](../../lib/ai/getModel.ts) применяет **двухслойную safety-net**:

1. **`Math.min(requested, capability)`** — защита от рассинхронизации SSOT и catalog. Если cap в `DEFAULT_MAX_OUTPUT_TOKENS` выше чем `maxOutput` у резолвленной модели (через override или смену default) — безопасно срезается до capability. Runtime-safety, без краха.
2. **`warnOnce` при `provider === "anthropic" && effective > 21333`** — обязывает dev перейти на streaming (см. аспект 4). Логируется один раз на процесс через `Set<TaskId>` seen.

**Использование:** каждый production call site вызывает `maxOutputTokens: getMaxOutputTokensForTask("taskId")`. Литеральные числа (как предыдущий tactical `maxOutputTokens: 16000` в plan/route.ts) — запрещены.

### 4. `call mode` — streaming vs non-streaming

**Что:** выбор между `generateText`/`generateObject` (non-streaming, response accumulates in memory) и `streamText`/`streamObject` (streaming, chunks to client/accumulator).

**Архитектурный инвариант:**

> **Anthropic threshold:** если `taskId` использует модель Anthropic и effective cap > 21333 — call site ОБЯЗАН использовать `streamText` или `streamObject`.

**Почему 21333:** [@ai-sdk/anthropic@3.0.66 docs](https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic) + Anthropic Messages API docs — non-streaming response с `max_tokens > 21333` может превысить default 60s fetch timeout → `UND_ERR_SOCKET: other side closed` → 3× retry → ~180s total fail.

Правило касается **обоих** non-streaming API: `generateText` и `generateObject` (та же timeout-bomb при больших JSON ответах). На xAI / MiniMax / OpenRouter threshold не применяется (их tokens/second выше и SDK/провайдер сами handle non-streaming для больших output). На Anthropic — жёстко.

**Как защищено:** `warnOnce` в `getMaxOutputTokensForTask` предупреждает в dev-логах при попытке собрать такую комбинацию. Production — не крашится (предупреждение game-over если появится — но лучше чем socket error).

---

## Checklist для будущих изменений (обязательный)

### Добавляешь новый taskId

- [ ] Добавил `"new:taskId"` в `TaskId` union в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts).
- [ ] Добавил запись в `DEFAULT_TASK_MODELS` (иначе TS падает).
- [ ] Добавил запись в `DEFAULT_MAX_OUTPUT_TOKENS` (иначе TS падает).
- [ ] Cap ≤ `maxOutput` назначенной default-модели (проверить в `model-catalog.ts`, иначе safety-net срежет до capability — runtime fine, но в SSOT будет неправильная декларация).
- [ ] Если default-модель Anthropic **и** cap > 21333 → каждый call site этого taskId использует `streamText` или `streamObject`.
- [ ] На каждом call site: `maxOutputTokens: getMaxOutputTokensForTask("new:taskId")` — явно, через getter. Литералы запрещены.
- [ ] Обновил [docs/ai-chats-map.md](../ai-chats-map.md) — добавил строку в соответствующую таблицу.

### Меняешь default-модель в `DEFAULT_TASK_MODELS`

- [ ] Cap в `DEFAULT_MAX_OUTPUT_TOKENS` ≤ `maxOutput` новой модели (иначе SSOT рассинхронизируется с catalog — runtime safety-net срежет, но в таблице останется ложная декларация).
- [ ] Если новая модель Anthropic **и** cap > 21333 — убедиться что все call sites этого taskId используют `streamText`/`streamObject` (не `generateText`/`generateObject`).
- [ ] Обновил [docs/ai-chats-map.md](../ai-chats-map.md) — строка с моделью.

### Увеличиваешь cap в `DEFAULT_MAX_OUTPUT_TOKENS`

- [ ] Новое значение ≤ `maxOutput` default-модели (`model-catalog.ts`).
- [ ] Если новое значение > 21333 **и** модель Anthropic — каждый call site этого taskId на streaming.
- [ ] Подумать: нужно ли повысить cap *только для reasoning variant* (см. Finding #1 ниже) — тогда задача шире чем одна правка.

### Добавляешь новый call site для существующего taskId

- [ ] Использовать `maxOutputTokens: getMaxOutputTokensForTask("taskId")` (не литерал).
- [ ] Если cap > 21333 и модель Anthropic → `streamText`/`streamObject`.
- [ ] Нет нужды добавлять side-effect импорт `model-overrides-node` — reader уже зарегистрирован в [instrumentation.ts](../../instrumentation.ts).

---

## Known limitations

### Finding #1 — cap `util:title`=64 тесен при reasoning variant override

Default `util:title` = `grok-4-1-fast-non-reasoning`, cap=64 рассчитан именно на non-reasoning. При ручном dev override на `grok-4-1-fast-reasoning` reasoning съедает часть budget на внутренний thinking (506 tok) — safety-net обрезает финальный JSON ровно по cap. Production не затронут. Решение — поднять до 256 при получении scope для `TZ_UtilTitleCapReasoningMargin` в backlog.

**Принцип:** cap в `DEFAULT_MAX_OUTPUT_TOKENS` должен учитывать запас под reasoning overhead, если модель когда-либо может переключаться на reasoning variant (даже через override). Для большинства taskId это не актуально — они зафиксированы на одном варианте. Для `util:title` и будущих «утилитарных» taskId — требует внимания.

### Finding #2 — `thinkingTokens` на Anthropic всегда = 0 (architectural)

`@ai-sdk/anthropic` (проверено на v3.0.66, поведение стабильно с первого релиза провайдера) всегда возвращает `outputTokens.reasoning: void 0` в результате `convertAnthropicMessagesUsage`. Причина: Anthropic Messages API response содержит единое поле `usage.output_tokens` без разделения thinking vs completion.

**Следствия:**

1. `thinkingTokens` в [ai_usage_log](../../lib/db/schema.ts) для Opus/Sonnet/Haiku **архитектурно всегда 0**, независимо от активности extended thinking. Это не баг в [lib/ai/usage-utils.ts](../../lib/ai/usage-utils.ts) — логика `usage.outputTokenDetails?.reasoningTokens ?? 0` правильная; но для Anthropic это всегда undefined.
2. **Pricing корректен.** Thinking tokens попадают в `output_tokens` у Anthropic, и наша формула `outputTokens × output_price` учитывает их правильно. Биллинг не затронут.
3. **Аналитика «сколько модель думала» недоступна.** Отсутствует разделение thinking vs completion.
4. **OpenAI и xAI работают иначе** — у них есть `completion_tokens_details.reasoning_tokens`. Если строим аналитический слой поверх AI SDK — учитывать что `outputTokenDetails.reasoningTokens` провайдер-специфичен.

**Workaround НЕ рассматривается** (владелец, 2026-04-18): попытка восстановить thinking из `usage.raw` хрупкая (ломается при любом апдейте `@ai-sdk/anthropic`), а стратегически обсуждается переход Professor Planning на Grok Multi-Agent (ТЗ-XAI-MA-1 в backlog) где разделение работает штатно. Через 1-2 месяца проблема может стать неактуальной.

**Критерий валидации thinking в тестах Anthropic:** не `thinkingTokens > 0` (архитектурно невозможно), а «POST 200 без UND_ERR + ответ создан + время ≥ 60с» (косвенный признак работы thinking через duration).

### Временные константы

- **21333** — Anthropic non-streaming threshold (AI SDK + Anthropic API). Может быть изменён в будущих версиях SDK/API. В коде `getMaxOutputTokensForTask` — литерал с комментарием ссылки на этот ADR. При апдейте `@ai-sdk/anthropic` — проверить.
- **21333 НЕ касается xAI / MiniMax / OpenRouter.** Только Anthropic.

---

## Причины

1. **Компилируемый SSOT вместо устного правила.** `Record<TaskId, number>` заставляет TS падать при забытой записи. Это сильнее любого code review — процессная защита вместо человеческой дисциплины.
2. **Двухслойная safety-net в runtime.** `Math.min(requested, capability)` + `warnOnce` защищают от рассинхронизации SSOT/catalog и от забытого streaming. Production не крашится при ошибке конфигурации.
3. **Единая точка регистрации overrides reader.** `instrumentation.ts` — Next.js SSOT для boot-time side effects. Per-route import был anti-pattern — каждый новый route «забывал».
4. **HMR-immunity через `globalThis`.** Не очевидно без этого опыта, но критично для dev UX. Без этого dev overrides молча переставали работать при hot-reload, маскируя более глубокие баги.
5. **Обязательный checklist в ADR.** Следующий разработчик, добавляющий taskId, не знает устных правил — но он видит этот ADR и проходит checklist. Закрывает root cause «новые долги появляются быстрее чем старые решаются».

---

## Последствия

### Плюсы

- Compile-time защита от забытых записей в SSOT (TS падает).
- Runtime safety-net (`Math.min` + warnOnce) — ошибка конфигурации не крашит production.
- Единая точка регистрации reader → нельзя забыть, нет копипасты.
- HMR-immune dev workflow — overrides работают после любых hot-reload.
- 4 аспекта документированы в одном ADR — новый разработчик получает полный контракт за 10 минут.
- Known limitations зафиксированы — никто не будет гоняться за «пропавшими» thinkingTokens на Anthropic.

### Минусы

- 21333 — magic constant, привязана к версии AI SDK. При апдейте `@ai-sdk/anthropic` надо проверять. Mitigated: комментарий в коде + этот ADR как canonical reference.
- TS compile-time check через `Record<TaskId, number>` требует синхронного обновления двух мест при добавлении taskId (`DEFAULT_TASK_MODELS` + `DEFAULT_MAX_OUTPUT_TOKENS`). Это фича, не баг — но в первый раз может удивить.
- Checklist-овская дисциплина требует от разработчика чтения ADR. Без этого — долги снова накопятся. Smoke test: каждый следующий umbrella ТЗ в этой области — тревожный сигнал что ADR игнорируется.

### Trade-offs

- `globalThis.__simplyOverridesReader` — debatable hack. Альтернатива — перевезти на symbol-keyed global или отдельный singleton модуль. Выбрано `globalThis` как самый простой, HMR-immune механизм. Revisit если появится pattern на 2+ global reader/writer.

---

## Альтернативы

### Альтернатива 1: Рантайм валидация через Zod вместо TS compile-time check

**Что:** вместо `Record<TaskId, number>` — Zod-схема + `parse()` при старте приложения.

**Почему отклонено:** TS compile-time check строже — IDE сразу показывает ошибку, билд не проходит. Zod validate даёт ту же гарантию, но только на boot (можно пропустить в unit tests). Минимальный код → максимальная защита — это `Record`.

**Когда может быть лучше:** если в будущем cap станет dynamic (например, per-user или per-workspace override) — тогда литеральный `Record` не подойдёт, и Zod schema-validated config нужен.

### Альтернатива 2: Middleware / wrapper для всех AI SDK calls

**Что:** единая функция `callAI({ taskId, ... })` которая сама подтягивает model + cap + выбирает call mode.

**Почему отклонено:**

- AI SDK API богатый (tools, providerOptions, experimental features, onFinish hooks, provider-specific params) — wrapper либо покроет 30% и будет мешать в специальных случаях, либо повторит всю площадь SDK и будет maintenance-burden.
- Call sites уже простые: `streamText({ model: getModel("taskId"), maxOutputTokens: getMaxOutputTokensForTask("taskId"), ... })`. Wrapper не сокращает существенно.
- Текущее решение (getter + SSOT + ADR) — мягкий «type-driven» подход, совместимый со всеми режимами AI SDK.

**Когда может быть лучше:** если project вырастет до 100+ call sites с повторяющимися паттернами (retry, caching, rate limiting) — рассмотреть middleware.

### Альтернатива 3: Per-provider threshold в `DEFAULT_MAX_OUTPUT_TOKENS`

**Что:** `DEFAULT_MAX_OUTPUT_TOKENS` хранит не number, а `{ cap, streamRequired: boolean }`.

**Почему отклонено:** дублирует информацию из `model-catalog.ts` (provider известен) и из самого cap (> 21333 + anthropic provider → streamRequired). Это вычислимо, не декларативно — в SSOT не храним.

**Когда может быть лучше:** если threshold станет per-provider, per-model (не только Anthropic 21333, но и xAI/MiniMax со своими значениями). Тогда декларативный флаг на каждом taskId может быть проще чем вычисление.

### Альтернатива 4: ESLint rule «все AI SDK calls должны использовать getter»

**Что:** custom lint rule который падает на литеральный `maxOutputTokens: 16000`.

**Почему отклонено:** дорого в поддержке, false positives (scripts/ содержат тестовые скрипты), грубо. ADR + checklist — достаточно для code review discipline.

**Когда может быть лучше:** при команде 5+ разработчиков где code review не успевает за темпом. В текущем проекте — overkill.

---

## Ссылки и ресурсы

- [ТЗ-AISDKLayerHardening](../../_archive/TZ_AISDKLayerHardening/) — полный контекст решений этого ADR (SPEC, ANALYSIS, ROADMAP, FINDINGS, HANDOFF)
- [ADR 047 — Core model registry](047-core-model-registry.md) — предыдущая итерация SSOT резолва
- [ADR 048 — Dev switchboard UI](048-dev-switchboard-ui.md) — dev overrides, связан с reader регистрацией
- [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) — `DEFAULT_TASK_MODELS` + `DEFAULT_MAX_OUTPUT_TOKENS`
- [lib/ai/getModel.ts](../../lib/ai/getModel.ts) — resolver + safety-net getter
- [instrumentation.ts](../../instrumentation.ts) — единственная точка регистрации overrides reader
- [@ai-sdk/anthropic SDK source — convertAnthropicMessagesUsage](../../node_modules/@ai-sdk/anthropic/dist/index.js#L1646) — подтверждение Finding #2 (`outputTokens.reasoning: void 0`)
- [Anthropic Messages API — usage response](https://docs.anthropic.com/en/api/messages) — единое поле `output_tokens` без разделения thinking
- [AI SDK v6 docs](https://sdk.vercel.ai/docs) — generateText / streamText / generateObject / streamObject

---

## Примечания

**Процессный урок из ТЗ-AISDKLayerHardening, фиксируемый этим ADR:** этот ТЗ сам по себе появился из того что 3 долга по одной теме накопились раздельно (отдельные backlog-записи в разные моменты времени), и при очередной попытке добавить taskId / изменить модель / поднять cap — обнаружились все три. Umbrella ТЗ стоил 3 сессии работы.

Если следующее изменение в этой области (добавление taskId, смена модели, новый provider) **снова** обнаружит недокументированное правило или tactical hot-fix — это сигнал что ADR надо расширять, не накапливать долги до следующего umbrella. Путь: находка → FINDINGS → backlog → либо сразу ADR-update, либо следующий фокусный ТЗ.

---

## История изменений

- **2026-04-18** — Документ создан (ТЗ-AISDKLayerHardening, финализация Этап 4)
