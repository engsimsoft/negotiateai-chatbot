# ADR 050: Стратегия 3-breakpoint кэширования + MIND transplant

**Дата:** 2026-04-13
**Статус:** Принято
**ТЗ:** TZ-CacheAudit (v3.85.0)

---

## Контекст

Anthropic Prompt Caching (и его MiniMax-compat реализация — см. ADR 049) поддерживает до 4 cache breakpoints на запрос. Каждый breakpoint помечает содержимое как ephemeral-кэшируемое с TTL 5 минут (по умолчанию). При повторном запросе с идентичным префиксом контент читается из кэша по цене 10% от обычного input token (экономия 90%).

До ТЗ-CacheAudit кэширование в Simply полагалось только на **passive cache** — неявный механизм Anthropic, который срабатывает автоматически для совпадающих префиксов, но без контроля со стороны приложения. Passive cache:

- Работает только для последовательных запросов внутри одной модельной сессии
- TTL короче чем у explicit (5 мин, но менее предсказуемо)
- Не виден в usage logging как cache hit (возвращается в `cacheReadTokens`, но без гарантии)
- Непредсказуем: изменение **любой** части промпта инвалидирует весь кэш

В результате:
- `chat/route.ts` (Simply Chat): passive cache давал ~30-40% экономии на второй/третий turn внутри короткого окна
- MIND memory (динамический блок 200-800 токенов) в system prompt полностью ломал кэш при каждом запросе — факты между запросами меняются
- `task-expert/route.ts`: та же проблема + конкатенация MIND в system prompt через `+=` (скрытый баг) делала existing breakpoint на system бесполезным

Цель — превратить passive cache в explicit cache, добавить наблюдаемость (`cacheReadTokens`/`cacheWriteTokens` как SSOT метрики), и достичь стабильных 50%+ экономии на повторных запросах внутри сессии.

---

## Решение

**3 explicit cache breakpoints на каждом chat-request, плюс MIND transplant для вынесения динамического контента за границу последнего breakpoint.**

### Breakpoint 1: Static System Prompt

Системный промпт собирается **без** MIND facts и помечается `cacheControl: { type: "ephemeral" }`:

```ts
messages: [
  {
    role: "system",
    content: finalSystemPrompt, // без MIND, статический
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  },
  ...coreHistory,
]
```

Кэшируется: базовый промпт (Simply agent, task-expert), описание инструментов, контекст проекта/задачи, user profile, pre-compiled static blocks.

### Breakpoint 2: Tools

Tool definitions — большой статический блок (~3-5K токенов). Кэшируется через helper `withCacheControlOnLastTool<T>()` из `lib/ai/tools/chat-tools.ts`:

```ts
const standardTools = getStandardTools({ ... });
const toolsForRequest = withCacheControlOnLastTool(standardTools);
```

Helper помечает **последний** tool в объекте через `providerOptions.anthropic.cacheControl` — Anthropic расценивает это как breakpoint на весь tools block (работает по правилу «cache everything up to and including this point»).

### Breakpoint 3: Last User Text-Part

Inline cacheControl на последнем text-part последнего user message в `messagesForRequest`. Это захватывает в кэш всю предыдущую историю диалога (включая tools/results), полезно при повторных запросах типа «поясни подробнее» или serial tool calls:

```ts
const lastIdx = messagesForRequest.length - 1;
const lastMsg = messagesForRequest[lastIdx];
if (lastMsg?.role === "user") {
  const existingParts = Array.isArray(lastMsg.content) ? [...lastMsg.content] : [{ type: "text", text: String(lastMsg.content) }];
  const lastPartIdx = existingParts.length - 1;
  existingParts[lastPartIdx] = {
    ...existingParts[lastPartIdx],
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  };
  messagesForRequest[lastIdx] = { ...lastMsg, content: existingParts };
}
```

### MIND Transplant (за границу Breakpoint 3)

MIND dynamic block (retrieved facts ~200-800 токенов) **не склеивается** с system prompt. Вместо этого он добавляется как **отдельный trailing text-part** того же последнего user message — **после** того как Breakpoint 3 уже проставлен на предыдущий text-part:

```ts
if (mindDynamicBlock) {
  existingParts.push({
    type: "text",
    text: `\n\n${mindDynamicBlock}`,
  });
}
```

**Почему это работает:** breakpoint 3 стоит на предыдущем text-part → всё что **до** него (система, tools, история, исходный user query) попадает в кэш. MIND добавлен **после** breakpoint → он не включается в cache key префикса. При следующем запросе MIND может полностью отличаться (новые факты retrieved) — кэш префикса сохраняется.

---

## Причины

1. **3 breakpoint достаточны для текущей архитектуры.** Anthropic поддерживает до 4, но 4-й был бы избыточен для Simply: `projectManifest` уже попадает в system через `buildTaskExpertPrompt()`, отдельный breakpoint не даёт выгоды. Резервируем 4-й для будущих расширений (например, RAG-документы при подключении).

2. **System prompt — самый большой статический блок.** На Simply Chat: 3-8K токенов базы + 2-4K user profile + 1-2K task context. На task-expert: 5-12K с project manifest. Breakpoint 1 даёт наибольший payoff.

3. **Tools — второй по размеру и полностью статичные.** Tool definitions (zod schema → JSON) ~3-5K токенов. Они не меняются между запросами в пределах одного chatMode. Breakpoint 2 работает из коробки для всех sessions.

4. **Breakpoint 3 защищает историю диалога.** При повторных «уточняющих» запросах пользователя (типа «а что насчёт X?», «поясни подробнее», «исправь вот это») — breakpoint 3 позволяет переиспользовать всю предыдущую историю tool use + tool results, не пересчитывая их. Особенно важно для task-expert где каждый turn несёт обширный tool output.

5. **MIND transplant решает фундаментальное противоречие.** MIND — динамический контент (retrieved по каждому запросу разные facts), но должен влиять на генерацию. Если его поместить в system prompt, cache инвалидируется. Если в user message как inline context — кэш префикса сохраняется, влияние на модель остаётся. Trailing text-part — наиболее естественное место, которое не ломает семантику user message.

6. **Capability-гейтинг через `model-catalog.ts` как SSOT.** Compaction API (`compact_20260112`) и prompt caching имеют разные capability requirements (Haiku поддерживает caching, но не compaction). Гейтинг через централизованный `capabilities.supportsCompaction` в `model-catalog.ts` позволяет dev-override'ам через `/dev/models` работать корректно для любой переназначенной модели.

---

## Последствия

### Плюсы

- **Валидированная экономия 54-74%** на втором сообщении в одной сессии:
  - Simply Chat (MiniMax M2.7): 54% (UI-тест Этапа 3)
  - Simply «Думать» (Claude Haiku): 58% (UI-тест Этапа 3)
  - task-expert (Claude Haiku executor): 74% (UI-тест Этапа 4)
- **`cacheReadTokens`/`cacheWriteTokens` теперь SSOT метрика.** DevPanel, Cost Audit Dashboard, `/admin/cost-audit` показывают реальные числа. Решения по оптимизации принимаются на основе данных, не интуиции.
- **MIND работает без деградации кэша.** Факты обновляются на каждом запросе (retrieval делается каждый turn), но префиксный кэш сохраняется.
- **Единый паттерн для Claude и MiniMax.** Благодаря ADR 049 (Anthropic-compat для MiniMax) оба провайдера используют идентичный `providerOptions.anthropic.cacheControl` синтаксис. Нет форков логики.
- **Dev switchboard работает правильно.** При переключении через `/dev/models` на другую модель — capability-gate в `model-catalog.ts` автоматически корректирует поведение (например, отключает `contextManagement` для Haiku после dev-override).
- **Безопасность против orphan tool_use.** `stripLegacyOpenAICompatToolParts()` санитизирует историю перед построением `messagesForRequest`, предотвращая 400 от Anthropic API на сломанных tool_use/tool_result парах.

### Минусы

- **Увеличенный `cacheWriteTokens` на первом сообщении в сессии.** Breakpoints пишут кэш при первом запросе (cold start) — это стоит на 25% дороже обычного input token. Для одиночных сообщений (user задал один вопрос и ушёл) это чистая потеря. Митигация: 25% цены cold-start amortize'ится за 1.5-2 последующих сообщений, что наблюдается в типичных сессиях.
- **Сложность дебага при рассинхроне breakpoints.** Если в `chat/route.ts` добавлен 4-й breakpoint, а в `task-expert/route.ts` его нет — разница в поведении не очевидна без чтения обоих файлов. Митигация: общий helper `withCacheControlOnLastTool` + общий паттерн построения `messagesForRequest` в обоих routes.
- **MIND transplant менее очевиден чем плоский конкат.** Новому разработчику потребуется прочитать комментарий в коде или ADR 050 чтобы понять почему MIND идёт trailing text-part вместо system prompt. Риск: при рефакторинге могут случайно вернуть конкат → скрытая регрессия cache hit rate. Митигация: явный комментарий на месте transplant'а со ссылкой на этот ADR.
- **Capability-гейт — дополнительная косвенность.** Caller должен помнить, что не все Claude модели поддерживают `contextManagement`. Митигация: SSOT в `model-catalog.ts` + capability read через `getModelEntry()` — compile error если capability не считано.
- **Не покрывает pipelines.** Briefing author, podcast script generator, research engine — этим routes breakpoints не расставлены (вне scope ТЗ-CacheAudit из-за блокера uncommitted changes от TZ_MindArtifacts). Будет реализовано в следующем ТЗ (`TZ_CachePipelineMetrics`).

---

## Альтернативы

### Альтернатива 1: Полагаться на passive cache

**Что это:** Не расставлять explicit breakpoints, надеяться что Anthropic внутри себя кэширует совпадающие префиксы.

**Почему отклонили:**
- Passive cache работает только для очень коротких окон и внутри одной session — неконтролируемо
- `cacheReadTokens` для passive hits возвращается непоследовательно — observability сломана
- Не решает проблему MIND (он всё равно будет в system prompt и ломать совпадение префиксов)
- На валидационном тесте Этапа 0 passive cache показал лучшие цифры на MiniMax (96.8% hit на short turn) но cacheWriteTokens всегда 0 — невозможно отследить инвалидацию

**Когда может быть лучше:** Для experimental кодов, где важно минимум конфигурации. Не для production.

### Альтернатива 2: Только Breakpoint 1 (system only)

**Что это:** Кэшировать только системный промпт, игнорировать tools и last user text-part.

**Почему отклонили:**
- Tools занимают 3-5K токенов — упускаем ~40% потенциальной экономии
- Повторные «уточняющие» turns (типа «поясни детальнее») не получают cache hit — каждый раз обрабатываем всю историю заново
- Ненаблюдаемо: нельзя различить «cache работает» и «cache сломан» без статистических средних по session длинам

**Когда может быть лучше:** Для простых assistant'ов без tools и без многоповоротных диалогов.

### Альтернатива 3: 4 breakpoints с отдельным блоком projectManifest

**Что это:** Добавить breakpoint на projectManifest перед history как отдельный cache section.

**Почему отклонили:**
- В текущей архитектуре projectManifest не существует как отдельный блок — он собирается `buildTaskExpertPrompt()` и попадает в `systemPromptText` целиком. Добавить 4-й breakpoint = рефакторинг prompt builder
- Эффект от такого refactor'а был бы marginal: projectManifest часть системного промпта уже попадает в breakpoint 1
- 4-й breakpoint эффективен только если projectManifest меняется реже чем остальная часть system — а это не так в Simply (manifest stable, but stable system prompt тоже)

**Когда может быть лучше:** При добавлении RAG-документов или user-uploaded knowledge base — эти блоки менялись бы независимо от system prompt, имело бы смысл их отдельно кэшировать.

### Альтернатива 4: Client-side cache через `Hash(prompt) → response` в Redis

**Что это:** Локальный кэш целых ответов в Redis с TTL 5-60 минут.

**Почему отклонили:**
- Не работает для streaming — client ожидает chunks, не finalized response
- Ломается для tool calling — response зависит от tool results, которые меняются
- Нарушает observability: Anthropic billing показывает реальную стоимость, наш Redis cache — нет
- Не решает саму проблему: модель всё равно процессит promt полностью на API стороне
- Проблемы с consistency: user profile / MIND меняются, hash может случайно совпасть при разных контекстах

**Когда может быть лучше:** Для полностью idempotent endpoints (типа FAQ API), где ответ не зависит от session state.

---

## Примечания

### Замеры после внедрения (валидация UI-тестами)

| Provider / chatMode | Msg 1 (cold) | Msg 2 (hot) | Экономия на Msg 2 |
|---|---|---|---|
| MiniMax M2.7 (Simply Chat) | ~8.4K write | ~8.1K read | 54% |
| Claude Haiku (Simply «Думать») | ~19.1K write | ~19.1K read | 58% |
| Claude Haiku (task-expert executor) | 11.8K write | 11.8K read | 74% |

Разброс (54% vs 74%) объясняется размером системного промпта: task-expert имеет более крупный static prefix (manifest + task description), поэтому cache hit компенсирует большую долю общей стоимости.

### Взаимодействие с Compaction API

Compaction API (`compact_20260112`) — независимый механизм, работает **совместно** с cache breakpoints. Compaction автоматически суммаризует history при достижении threshold (100K input tokens по умолчанию в Simply), после чего modified history по-прежнему кэшируется с нашими breakpoints.

Capability-гейт необходим потому что Compaction поддерживается только Sonnet 4+/Opus 4+ (и не всегда MiniMax — требует отдельной проверки). Гейт реализован через `effectiveCatalogEntry?.capabilities.supportsCompaction`, см. `chat/route.ts:1005` и `task-expert/route.ts:~360`.

---

## Ссылки и ресурсы

- **Связанный ADR:** [049 MiniMax Anthropic-compat Mode](049-minimax-anthropic-compat-mode.md)
- **Helper:** `lib/ai/tools/chat-tools.ts` → `withCacheControlOnLastTool<T>()`
- **Реализация chat/route:** `app/(chat)/api/chat/route.ts:999-1130`
- **Реализация task-expert:** `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:280-400`
- **Capability source:** `lib/ai/model-catalog.ts` → `ModelCapabilities`
- **Anthropic docs:** Prompt Caching — https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- **AI SDK v6 docs:** Provider options — https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic#cache-control
- **Спецификация ТЗ:** `_archive/TZ_CacheAudit/SPEC.md`

---

## История изменений

- **2026-04-13** — Документ создан в рамках финализации ТЗ-CacheAudit (v3.85.0). Автор: Claude Opus 4.6 по запросу владельца (Vladimir Sharandin).
