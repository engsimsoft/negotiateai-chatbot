# Анализ ТЗ-COMPACTION-UNIFY

**Статус:** Фаза 1 — код-ревью и вопросы архитектору
**Автор:** Claude Code (Opus 4.7, 1M context)
**Дата:** 2026-04-20
**Источник ТЗ:** [TZ_COMPACTION_UNIFY.md](TZ_COMPACTION_UNIFY.md)

---

## 0. Изученная документация (Правило 1 WORKFLOW)

### Внешние технологии в scope

| Технология | Источник | Ключевые находки для ТЗ |
|---|---|---|
| Vercel AI SDK v6 (`ai@6.x`) | [ai-sdk.dev/docs/ai-sdk-core/middleware](https://ai-sdk.dev/docs/ai-sdk-core/middleware) | `transformParams` / `wrapGenerate` / `wrapStream` — 3 middleware-хука. В нашей архитектуре middleware `prepareMessagesWithCompaction` **НЕ** является AI SDK middleware — это explicit pre-call preprocessing ([ADR 053 аспект 5](../../docs/decisions/053-aisdk-invocation-contract.md)). Это сознательное решение v1.8 SIMPLY_COMPACTION_ARCHITECTURE (pure function, доступ к `dataStream.write`, линейный lifecycle). Менять подход в рамках этого ТЗ не нужно. |
| Anthropic contextManagement (`compact_20260112`) | [platform.claude.com/.../build-with-claude/context-management](https://platform.claude.com/docs/en/build-with-claude/context-management) (503 при fetch), [AI SDK Anthropic provider docs](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) | Beta feature (header `anthropic-beta: context-management-2025-06-27`), опция `providerOptions.anthropic.contextManagement.edits[]`. Опциональна — если не передавать, compaction на стороне Anthropic **не активируется**. Отключение = просто не передавать опцию. Никаких `type: "none"` или deprecation в 2026 не найдено. Параллельное использование (наш synthetic summary + Anthropic contextManagement) — не документировано, сценарий undefined → избегаем. |
| xAI Grok (`grok-4-1-fast-non-reasoning`) | [docs.x.ai/docs/models](https://docs.x.ai/docs/models) | Модель существует, цены $0.20/$0.50 (verified в catalog 2026-04-12). `generateObject` работает нативно через `@ai-sdk/xai`. `prompt_cache_key` автоматический — не нужно opt-in. Для `compaction:summarize` уже используется (подтверждено в [lib/ai/task-assignments.ts:166](../../../lib/ai/task-assignments.ts#L166)). |

### Красные флаги

- **AI SDK v6 middleware API** стабильна, breaking changes в 6.0 не касаются `transformParams`. Наш Simply Compaction **не использует** этот API — unchanged.
- **Anthropic Compaction API** — всё ещё beta, но стабильная (в проде с февраля 2026 в [ADR 042](../../docs/decisions/042-compaction-dual-strategy.md)). Удаление нашей ветки `providerOptions.anthropic.contextManagement` = просто перестаём передавать опцию → Anthropic больше ничего не сжимает на своей стороне → наша Simply Compaction middleware закрывает эту функциональность единообразно. Никаких deprecation-таймингов нет — тайминг миграции на стороне Simply.
- **xAI** — ничего нового по compaction не ожидается (у xAI нет нативного compaction API по состоянию на 2026-04), это и было аргументом ТЗ-COMPACTION-1 за собственную Simply Compaction.

---

## 1. Резюме

**Что делаем:** унифицируем управление памятью Simply в одну провайдер-агностичную логику. Решаем одним проходом четыре проблемы, выявленные после закрытия ТЗ-COMPACTION-1:

1. **UI-шум** — предупреждение «Новое задание с итогом» на 85% заменяем на молчаливый второй цикл сжатия + ручная опция в меню.
2. **Расход денег** — удаляем per-turn `extractAndStoreFacts` в expertise/create/project; extract запускается только когда сообщения уходят из окна (best practice 2026: Mem0 «memory formation before summarization»).
3. **Две базы расчёта %** — унифицируем всё на `SIMPLY_CONTEXT_LIMIT = 200K`, удаляем `CONTEXT_BUDGET` и `EXTRACT_THRESHOLD_*`. Закрывается backlog-долг `TZ_UnifyContextThresholdBase`.
4. **Провайдер-зависимость** — удаляем `providerOptions.anthropic.contextManagement` и capability `supportsCompaction`. Наша Simply Compaction работает для всех моделей.

**Результат:** одна точка управления памятью (`prepareMessagesWithCompaction`), одна модель для всех extract-вызовов (`memory:extract-batch` → Grok 4.1 Fast non-reasoning), один порог (50% от `SIMPLY_CONTEXT_LIMIT`), одна последовательность (extract → compact на той же группе сообщений), одна гарантия (ни одно сообщение не покидает окно без попытки извлечь факты).

---

## 2. Рекомендации разработчика (Код-ревью ТЗ)

> Ниже — технические рекомендации на основе фактического анализа кода.
> Каждая рекомендация требует согласования с архитектором.

### ✅ Согласен с ТЗ

- **Проблема 1 (удаление Фазы 3 warning):** архитектурно верно. Текущий UI в [components/elements/context.tsx:155-197](../../../components/elements/context.tsx#L155-L197) — единственное место где Фаза 3 визуализируется. Удаление ветки `isWarning` + action button + mode-aware лейблы «Новый запрос/задание с итогом» = ~40 строк правок.
- **Проблема 2 (удаление per-turn extract):** согласен. Вызовы в [chat/route.ts:1624-1651](../../../app/(chat)/api/chat/route.ts#L1624-L1651) и [tasks/[taskId]/chat/route.ts:729-754](../../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L729-L754) действительно выполняются **на каждом turn** без gate по threshold для expertise/create/project, независимо от нужности. Цифры ТЗ ($0.0072 vs $0.0862 — 12×) согласуются с pricing `memory:extract` = Grok 4.20 reasoning vs `memory:extract-batch` = Grok 4.1 Fast.
- **Проблема 3 (унификация базы):** архитектурно верно. Обоснование исчерпывающе в [TZ_UnifyContextThresholdBase.md](../../_backlog/TZ_UnifyContextThresholdBase.md). `CONTEXT_BUDGET = 140K` как «технический sliding window cap» больше нигде не нужен — sliding window defensive truncation уже делает [getMessagesByChatId](../../../lib/db/queries.ts) на уровне БД (отдельная грань); `CONTEXT_BUDGET` в `calcUsagePercent` был побочным использованием.
- **Проблема 4 (удаление зависимости от Anthropic Compaction API):** согласен архитектурно. Наша Simply Compaction уже покрывает ту же задачу, логика дублирующая. Ликвидация провайдер-ветки упрощает ментальную модель и автоматически закрывает риск регрессии при dev-override на `/dev/models`.
- **Модель extract — Grok 4.1 Fast non-reasoning для `memory:extract-batch`:** уже используется, подтверждено best practice 2026 (см. SIMPLY_COMPACTION_ARCHITECTURE §Модель для сжатия v1.5). Решение ТЗ «один taskId для всех extract-вызовов» корректно.
- **Scope «НЕ в этом ТЗ»:** правильно исключена калибровка `estimateMessageTokens` (это долг `TZ_CompactionActualCalibration`) и перевод проекта с Anthropic на xAI (отдельный Legacy Code cleanup — там свой набор решений).

### ⚠️ Рекомендую изменить / дополнить

| # | Предложение ТЗ | Рекомендация | Обоснование из кода |
|---|---|---|---|
| 1 | «Удалить ветку `providerOptions.anthropic.contextManagement` из `app/(chat)/api/chat/route.ts`» — упомянут только ОДИН route handler | **Добавить в scope второй handler: [`app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:366-392`](../../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L366-L392).** Там тоже живёт `contextManagement` (`compact_20260112`), capability-gate через `modelSupportsCompaction`, и **per-turn extract** в [:729-754](../../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts#L729-L754). Без изменений в task-expert route проект-чаты остаются на Anthropic Compaction API — критерий приёмки #11 ТЗ не выполним. | Task-expert route — отдельный handler с **собственной** реализацией compaction-ветки и extract-вызова. Это зеркальная копия кода из chat/route.ts для proejct:expert:*. Архитектор упоминает «проект-чат на Claude Opus» в критерии 11, но не перечисляет файл. Зона ответственности разработчика — включить оба handler'а явно. |
| 2 | «Extract запускается **вместе с compaction** на том же пороге — последовательность extract → compact на той же группе сообщений» — на каких данных? | **Extract должен работать на `split.toCompact` — подмножестве сообщений, уходящих в summary.** Это буквальная реализация принципа ТЗ «ни одно сообщение не покидает историю чата без попытки извлечь факты». Архитектурно middleware `prepareMessagesWithCompaction` становится оркестратором: (1) вычисляет `split = buildVerbatimWindow(messages)`, (2) вызывает `batchExtractFacts({ userId, chatId, messages: split.toCompact })` await, (3) затем `generateCompactionSummary({ messagesToCompact: split.toCompact })`. | Сейчас middleware `prepareMessagesWithCompaction` ([prepare-messages.ts:46](../../../lib/ai/compaction/prepare-messages.ts#L46)) не знает userId — он есть только в CompactionContext через chatId. Чтобы middleware вызвал extract, нужен `userId` в CompactionContext. Это одно поле в типе + одно поле в call site. Архитектурная цена минимальная, ответственность middleware остаётся чистой (управление memory & history). |
| 3 | «Удалить taskId `memory:extract` и его промпт» | **Также удалить функцию `extractFactsFromMessages` (экспорт из `lib/ai/memory/extract.ts`) — это per-message обёртка единственного call site (`extractAndStoreFacts`). И `extractAndStoreFacts` обёртку целиком.** После удаления per-turn вызовов функция становится dead code. Оставить **`batchExtractFacts`** и shared helper `processAndStoreFact` (используется и `extractAndStoreFacts`, и `batchExtractFacts`). | `extractFactsFromMessages` ([extract.ts:120](../../../lib/ai/memory/extract.ts#L120)) вызывается ТОЛЬКО из `extractAndStoreFacts` (сразу ниже в том же файле). Он читает `EXTRACT_SYSTEM_PROMPT` (который удаляется), вызывает taskId `memory:extract` (удаляется). После чистки ТЗ этот code-path unreachable. Оставить «на будущее» = dead code. |
| 4 | «Удаляется capability `supportsCompaction` из `lib/ai/model-catalog.ts`» | **Также удалить тип `CompactionStrategy`** в `model-catalog.ts` (или упростить до `{ kind: "simply" } \| { kind: "none" }`). Ветка `provider` станет недостижимой — нет SSOT где она возвращается. Разработчик увидит unreachable code в TypeScript (`if (strategy.kind !== "simply")` — линтер `never`-type warning). | `CompactionStrategy` — discriminated union [model-catalog.ts:674](../../../lib/ai/model-catalog.ts#L674). Сужение типа делает exhaustive check в [prepare-messages.ts:54](../../../lib/ai/compaction/prepare-messages.ts#L54) автоматически корректным (`if (strategy.kind !== "simply") return` → early-return для `none`). Чистый TS без mental overhead. |
| 5 | «Удаляются константы `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT/HARD`, `EXTRACT_PAUSE_MS`» — не упомянут `calcUsagePercent`-параметр | **`calcUsagePercent(tokens, budget = CONTEXT_BUDGET)` ([context-limits.ts:56-62](../../../lib/ai/context-limits.ts#L56-L62)) — сменить default на `SIMPLY_CONTEXT_LIMIT`.** Функция используется везде где отображается usagePercent в логах ("usagePercent = X%"). Default — единственная работающая ссылка на `CONTEXT_BUDGET` после удаления констант. | `calcUsagePercent` используется в chat/route.ts:814, нескольких других местах; если не заменить default — TS не упадёт (параметр optional), но будет `ReferenceError` в runtime при удалении `CONTEXT_BUDGET`. Правка однострочная. |
| 6 | «Кнопка "Новый чат с итогом" остаётся как опция в меню чата для ручного использования» | **Уточнить что такое "меню чата"** — в коде нет единого "меню чата" где эта кнопка естественно жила бы. Есть два варианта, см. **Вопрос 7** ниже. Рекомендую либо (a) оставить кнопку в popover виджета контекста (рядом с индикатором compaction), но без условия truncation_warning — всегда доступна когда compaction прошёл хотя бы раз; либо (b) скрыть её полностью в этом ТЗ и вынести реализацию в follow-up. Новый UI-компонент — расширение scope. | Сейчас кнопка "Новый запрос/задание с итогом" живёт в `CompactionIndicator` в popover `Context` widget ([context.tsx:123-198](../../../components/elements/context.tsx#L123-L198)). Другого "меню чата" нет — messages menu (3-dot action) не имеет action "начать новый чат с summary". Добавление новой кнопки ≠ 1 строка правки. |
| 7 | Scope — «Обновление архитектурных документов: SIMPLY_COMPACTION_ARCHITECTURE.md, MIND_ARCHITECTURE.md; Обновление ADR 053 (5-й аспект)» | **Добавить в scope: ADR 042 (compaction-dual-strategy) — superseded, ADR 052 (context-management-strategy-per-provider) — superseded, ADR 050 (cache-breakpoints-strategy) — упоминает `contextManagement` в пользу Anthropic, нужен edit.** Создать новый ADR «Single-strategy provider-agnostic compaction (v3.95.0)» суперседящий 042+052 с обоснованием. Или одна правка на 053 с явным указанием supersedes 042+052. | ADR — SSOT архитектурных решений. После этого ТЗ решения 042 ("dual strategy Anthropic+Simply") и 052 ("per-provider context management") прекращают действие. Оставить их в active без supersede = разработчики через 6 месяцев будут читать устаревшее описание и путаться. |
| 8 | «Удаляется событие `truncation_warning` в compaction middleware» | **Также удалить тип `kind` из `CompactionEvent`** — останется один kind `"compaction"`. Либо (a) удалить поле `kind` вовсе (если событие всегда одного типа — не нужен дискриминатор), либо (b) оставить как `kind: "compaction"` для будущей расширяемости. Рекомендую (a) — YAGNI. | `CompactionEvent.kind: "compaction" \| "truncation_warning"` ([types.ts:58](../../../lib/ai/compaction/types.ts#L58)). Если удаляется один variant — union схлопывается до одного kind, дискриминатор теряет смысл. UI в `ContextIcon` использует три состояния иконки (`compactionKind === "truncation_warning"`, `=== "compaction"`, `undefined`) — после ТЗ остаётся два (`compactionKind === "compaction"` и `undefined`). |
| 9 | «SQL-верификация БД в критериях приёмки» не упомянута | **Добавить в критерии проверку `ai_usage_log`:** после внедрения `taskId = "memory:extract"` не должно появляться (grep по таблице). Должны появляться `memory:extract-batch` записи когда сработал compaction. Архитектурный критерий «per-turn extract удалён» доказуем только через логи. | `ai_usage_log` — SSOT наблюдаемости вызовов. В финализации ТЗ-COMPACTION-1 SQL-проверка уже выполнялась (HANDOFF §SQL). Без неё "архитектурный долг удалён" — только декларация. |

### ❓ Требует уточнения архитектора

См. §3 Вопросы для уточнения ниже — 10 вопросов.

---

## 3. Вопросы для уточнения

**Вопрос 1 (High) — Где живёт orchestration extract → compact?**

Два варианта архитектуры, взаимоисключающие:

- **(A) Middleware-инкапсуляция.** `prepareMessagesWithCompaction` сам запускает extract на `split.toCompact` перед генерацией summary. Caller (chat/route.ts) ничего не знает про MIND — просто вызывает middleware. **Цена:** нужен `userId` в `CompactionContext` (одно поле). **Плюс:** caller тонкий, одна ответственность.
- **(B) Caller оркестрирует.** Middleware экспортирует вспомогательную функцию `computeToCompact(messages, context)`, caller делает последовательность `toCompact = compute...; await batchExtractFacts({...toCompact}); result = await runCompaction(...toCompact)`. **Цена:** 2 вызова в 2 handler'ах вместо 1. **Плюс:** middleware остаётся pure function по истории.

Рекомендую **(A)**. MIND — часть memory-стратегии, не отдельная оркестрация. Middleware уже знает `chatId`, `modelId`, tokens — ещё один `userId` не меняет ответственность. Но решение за архитектором.

---

**Вопрос 2 (High) — Что делать с `extractAndStoreFacts` и `extractFactsFromMessages`?**

ТЗ явно говорит удалить taskId `memory:extract` и промпт. После удаления:

- `extractFactsFromMessages` — dead code (unreachable).
- `extractAndStoreFacts` — dead code (единственный caller — он же).
- `EXTRACT_SYSTEM_PROMPT` загрузка в `lib/ai/memory/extract.ts:53-60` — удалить.
- `processAndStoreFact` — **оставить** (shared helper, используется `batchExtractFacts`).

Согласен на полную чистку? Или оставить `extractFactsFromMessages` на случай если захотим вернуть per-turn extract (например, для Simply Chat или нового режима)?

Рекомендую **полная чистка** — дед-код вызывает путаницу и ложную надежду. YAGNI.

---

**Вопрос 3 (High) — Project task-expert route в scope?**

ТЗ упоминает только `app/(chat)/api/chat/route.ts`. Но:

- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts:366-392` — отдельная реализация Anthropic `contextManagement`.
- Там же `:743` — отдельный вызов `extractAndStoreFacts` (per-turn).
- Критерий приёмки #11 «Smoke test project chat на Claude Opus: наша логика работает вместо Anthropic Compaction» — невыполним без изменений этого файла.

Предлагаю: **task-expert route в scope этого ТЗ**. Добавить в список файлов и в scope. Это не расширение — это логическое следствие критериев приёмки.

Подтверждаете?

---

**Вопрос 4 (Medium) — Порог 85% Hard — что именно он триггерит после удаления Фазы 3 warning?**

ТЗ: «При достижении 85% (170K): ещё один цикл сжатия молча, без предупреждений». Вопрос механики:

- Если 50% уже запустило сжатие и получилось вернуть usage под 50% → до 85% не дойдём. Второй Hard триггер не нужен.
- Единственный сценарий когда Soft не сработал, а Hard близко: один turn скакнул usage с 40% до 90% (например, attachment 80K пришёл одним файлом, больше verbatim window).
- Но в этом случае middleware вызовется однократно per turn (в начале handler'а). Один проход: compute split → extract → compact. Граница Soft/Hard — *какое поведение* middleware производит на выходе, а не сколько раз он запускается.

Предлагаю конкретизировать: **Soft и Hard = один и тот же алгоритм middleware, просто разные пороги активации.** Hard = всегда сжимает безусловно. Soft = сжимает только если usage ≥ 50%. Между ними поведение identical (extract → compact one pass). Подтвердите или уточните сценарий где Hard отличается от Soft.

---

**Вопрос 5 (Medium) — Порог 50% для Simply Chat совместим с текущими EXTRACT_THRESHOLD?**

Сейчас Simply Chat делает `batchExtractFacts` на 60% от 140K (≈84K) или на 80% = 112K. После ТЗ — на 50% от 200K = 100K. Абсолютные значения:

- Было (Simply extract): 84K (soft) / 112K (hard).
- Станет (Simply compact + extract): 100K для всех chat modes.

Production behavior для Simply **сдвигается** — extract будет срабатывать позже (100K vs 84K). Это новая граница для Simply Chat. Согласен на этот трейд-оff? (Я считаю — да, унификация важнее, и 100K достаточно для объёма русскоязычной сессии.)

Также важный момент: **Simply Chat раньше не имел Simply Compaction вовсе** — только batch extract. После ТЗ у Simply появляется полноценный цикл (extract + compact + verbatim window). Это **расширение** функциональности для Simply, не только унификация. Архитектор это осознаёт в Критерии приёмки #8, но стоит зафиксировать явно.

---

**Вопрос 6 (Medium) — Какая judgement call про Grok 4.1 Fast модель для Simply Chat compaction?**

Ранее в SIMPLY_COMPACTION_ARCHITECTURE.md v1.7 Simply Chat compaction был **отложен в COMPACTION-2** с аргументом «technical complexity of ordering». Речь о том что в Simply Chat одновременно работает MIND retrieve → MIND инжект в system prompt → пользовательский вопрос, и добавление summary создаёт сложность: на каком этапе сжимать историю (до или после MIND retrieve)?

Сейчас ТЗ пулит compaction в Simply Chat в этот же релиз. Текущий handler chat/route.ts в Simply-ветке:

```
MIND retrieve → mindDynamicBlock → systemPromptText
        ↓
adaptHistoryToCapabilities(history, caps)
        ↓
[NEW] prepareMessagesWithCompaction(history, { mindTokens, toolsTokens, ... })
        ↓
convertToModelMessages → streamText
```

Вопрос: MIND retrieve работает по **текущему user query**, не по истории, не по summary. Значит ordering не проблема — MIND retrieve всегда работает на свежем вопросе, Simply Compaction работает на истории. Они independent. Подтверждаете что Simply Chat в scope?

---

**Вопрос 7 (Medium) — Что за "меню чата" для ручной опции «Новый чат с итогом»?**

ТЗ: «Кнопка "Новый чат с итогом" остаётся как опция в меню чата для ручного использования, но не всплывает автоматически.»

В текущем коде нет "меню чата" как отдельной UI-поверхности. Варианты реализации:

- **(a)** Оставить кнопку в popover виджета контекста ([components/elements/context.tsx](../../../components/elements/context.tsx)), но без attached to `truncation_warning` event — всегда доступна когда compaction сработал хоть раз.
- **(b)** Добавить кнопку в message-area menu (3-dot кнопка рядом с инпутом, [components/prompt-input.tsx](../../../components/prompt-input.tsx) или sidebar). Новая UI-интеграция → расширение scope.
- **(c)** Убрать кнопку целиком из этого ТЗ. Механика "новый чат с pre-fill summary" и так зарезервирована под COMPACTION-3 (помянуто в [context.tsx:119](../../../components/elements/context.tsx#L119)).

Рекомендую **(a)** — если текущая инфраструктура (UUID + route.push) достаточна, это 1 строка `if (compactionCount > 0 && !isWarning)` в `CompactionIndicator`. Если хочешь полноценное меню — это отдельный ТЗ.

Какой вариант выбираете?

---

**Вопрос 8 (Medium) — Что с ADR 042/052?**

После этого ТЗ:

- **ADR 042** — «Dual compaction strategy (Anthropic + Simply)» — **полностью superseded**. Одна стратегия.
- **ADR 052** — «Per-provider context management strategy» — **полностью superseded**. Провайдер-агностичность.
- **ADR 050** — упоминает `contextManagement` в разделе про Anthropic cache breakpoints → нужно **edit** (не supersede), удалить упоминание Compaction API.
- **ADR 053** аспект 5 — **edit** (упрощение: `{kind: "simply" \| "none"}`, без provider; переформулировать в терминах единого стратегии).

Варианты:

- **(a)** Создать новый ADR «ADR 054 — Single-strategy provider-agnostic compaction (v3.95.0)» с явным supersedes 042+052. В 042/052 добавить header «Superseded by 054».
- **(b)** Просто обновить ADR 053 и пометить 042/052 superseded с ссылкой на 053.

Рекомендую **(a)** — ADR не переписывают, их суперседят. Это стандарт. Архитектор подтверждает?

---

**Вопрос 9 (Low) — Удалять `CompactionEvent.kind` полностью или оставить дискриминатор "compaction"?**

После удаления `truncation_warning` в `CompactionEvent`:

- **(a)** Удалить поле `kind` вовсе — событие одного типа, дискриминатор избыточен. UI в `ContextIcon` тогда использует флаг `compactionEvent !== null` вместо `compactionEvent?.kind === "compaction"`.
- **(b)** Оставить `kind: "compaction"` для будущей расширяемости. Избыточно сейчас, но структура подсказывает «здесь могут быть разные события».

Рекомендую **(a)**. YAGNI. Если в будущем понадобится новый kind — добавим. Сейчас хранить пустой дискриминатор — мусор в типе.

---

**Вопрос 10 (Low) — Миграция БД для compaction-state?**

Chat таблица уже имеет поля `compactionSummary` / `compactionIndex` / `compactionCount` (миграция 0056 ТЗ-COMPACTION-1). Эти поля **общие** для всех chat modes, не гейтятся по mode. Значит для Simply Chat + project-task-chat миграция не нужна — БД готова.

Но вопрос: после ТЗ **все** чаты будут иметь эти поля заполненными (compaction срабатывает в любом mode). Для исторических чатов (до ТЗ) они null/0 — это OK, middleware обрабатывает null как Phase 0. Правильно понимаю что нет миграционного risk?

---

## 4. Потенциальные риски

| # | Риск | Вероятность | Impact | Митигация |
|---|---|---|---|---|
| R1 | **Regression в project chat на Opus/Sonnet:** Anthropic Compaction API работал как "чёрный ящик" — сжимал когда сам считал нужным. Замена на Simply Compaction даёт нам контроль, но меняет behavior. Если наш threshold 100K не попадает в их старый 100K trigger (а он совпадает по ТЗ-COMPACTION-1 configuration) — поведение может сместиться. | Middle | High (пользователь может потерять контекст в project chat) | Smoke test на Claude Opus с заполнением до 100K перед финализацией (Этап B в ROADMAP). Логи `[Compaction] chat=... task=... strategy=simply tokens={...} action=compact` при достижении порога. |
| R2 | **Расходы на Grok 4.1 Fast при Simply Chat compaction** могут быть выше ожидаемых. Simply Chat — самый частый mode (дворецкий, много turns). Даже если compaction запускается реже extract — overhead всё равно есть. | Low | Middle | SQL-мониторинг `ai_usage_log WHERE taskId = 'compaction:summarize'` на первой неделе production. Порог alert: >3 compaction per session average = аномально, пересмотреть порог 50%. |
| R3 | **Potential edge case: compaction + MIND retrieve одновременно в Simply Chat.** MIND retrieve вызывается async перед compaction middleware (chat/route.ts:744-791). Оба читают/инжектят `mindDynamicBlock` в system prompt. Compaction считает `mindTokens` — но это tokens до retrieve-injection или после? Логика должна быть audit-ed. | Middle | Middle | Ревью Этапа B2 в ROADMAP: явная проверка что `mindTokens` в `CompactionContext` **включает** retrieved facts, не только profile block. |
| R4 | **xAI Grok non-reasoning может генерировать summary хуже на длинных русскоязычных сессиях.** Текущий compaction:summarize работает только на expertise/create (средние сессии). Simply Chat может иметь более короткие/мелкие сообщения, на которых summary-промпт менее эффективен. | Low | Middle | Smoke test по Критерию #8 — отобрать несколько реальных Simply-сессий, прогнать compaction, проверить качество summary читаемо/осмысленно. Если проблема — ADR новый промпт компакции для Simply, не в scope этого ТЗ. |
| R5 | **Удаление `CONTEXT_BUDGET` может затронуть неочевидные места.** grep показал 9 upstream reference (6 в архивных ТЗ, 3 в текущем коде + 1 в `sliding-window-messages.ts` возможно). Надо проверить все до последней ссылки — один пропущенный импорт даст `ReferenceError`. | Middle | Middle | `npx tsc --noEmit` после каждой правки + дополнительный grep `'CONTEXT_BUDGET'` после удаления. |
| R6 | **Chat stream `onFinish` время увеличится** после встраивания extract в compaction flow. Сейчас extract fire-and-forget `void`. После ТЗ — `await` внутри middleware перед compact. Для chat с compaction это +3-8 секунд перед началом streaming. | Middle | Middle | Measure latency impact на Этапе B testing. Рассмотреть parallel execution extract || compact (они independent в terms of input) — Promise.all если архитектор согласен. Или принять задержку как осознанный trade-off за семантическую целостность «ни один факт не теряется». |
| R7 | **Dev overrides на /dev/models могут переключить Simply-chat на Anthropic Sonnet/Opus.** До ТЗ — в Simply Chat через override Haiku идёт через Anthropic Compaction API. После ТЗ — Simply Compaction. Меняется behavior разработчика через dev panel. | Low | Low | Dev-only, изменение поведения в dev mode — ожидаемое. Документировать в `docs/decisions/048-dev-switchboard-ui.md`. |

---

## 5. Зависимости

### Что нужно сделать до начала

- [ ] Получить ответы на 10 вопросов в §3
- [ ] Подтверждение что task-expert route в scope (Вопрос 3)
- [ ] Решение по "меню чата" (Вопрос 7)
- [ ] Решение по ADR 042/052/054 (Вопрос 8)

### Затрагиваемые компоненты (high-level)

- **Core:** `lib/ai/compaction/` (middleware + types + events), `lib/ai/memory/extract.ts` (per-turn удаление), `lib/ai/context-limits.ts` (константы), `lib/ai/model-catalog.ts` (capability удаление), `lib/ai/task-assignments.ts` (taskId удаление)
- **Promts:** `lib/prompts/memory/extract.md` (удаление файла)
- **Handlers:** `app/(chat)/api/chat/route.ts` (~5 секций правок), `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (~3 секции правок)
- **UI:** `components/elements/context.tsx` (~40 строк упрощения)
- **Docs:** `docs/decisions/042/050/052/053/054`, `docs/ai-chats-map.md`, `docs/ai-providers.md` (упоминания pricing `memory:extract` → удалить), `docs/model-catalog-ops.md`
- **Architecture specs:** `specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md` (major update), `specs/Simply_xAI/MIND_ARCHITECTURE.md` (обновить секцию пороги + base), `specs/Simply_xAI/SIMPLY_PROMPTS_AND_MODEL_CONFIG.md` (удалить EXTRACT константы)
- **Backlog:** закрыть `TZ_UnifyContextThresholdBase` → `_backlog/_archive/`, запись в `BACKLOG_CLOSED.md`

### Что после ТЗ не должно остаться в коде

- `EXTRACT_THRESHOLD_SOFT`, `EXTRACT_THRESHOLD_HARD`, `EXTRACT_PAUSE_MS`, `CONTEXT_BUDGET`
- `supportsCompaction` field в `ModelCapabilities`
- `getCompactionStrategy` function (или сокращённая до `simply | none`)
- `providerOptions.anthropic.contextManagement` и `compact_20260112`
- `extractAndStoreFacts`, `extractFactsFromMessages`, `EXTRACT_SYSTEM_PROMPT`
- `memory:extract` taskId
- `lib/prompts/memory/extract.md`
- `truncation_warning` в CompactionEvent
- UI блок «Рекомендуем начать новый…» с action button (если Вопрос 7 → вариант c)

---

## 6. Оценка сложности

- [x] **Сложное (5+ сессий)** — multi-file, multi-handler, многоуровневое обновление

**Разбивка по этапам (предварительно, детали в ROADMAP после Фазы 2):**

| Этап | Описание | Сессий |
|---|---|---|
| A | Core refactor: middleware с extract → compact, удаление старых констант/taskId/capability | 1.5 |
| B1 | chat/route.ts integration: Simply + expertise + create через единую middleware | 1 |
| B2 | task-expert route integration: удаление `contextManagement`, добавление Simply Compaction | 0.5 |
| C | UI cleanup: удаление Фазы 3 warning, реализация "меню чата" (если вариант a) | 0.5 |
| D | Docs: ADR 054, супердирование 042/052, обновление 053/050; спеков SIMPLY_COMPACTION_ARCHITECTURE/MIND | 1 |
| E | Финализация: SQL-проверка, smoke tests (4 critera), CHANGELOG, закрытие backlog-долга | 0.5 |

**Итого:** ~5 сессий (исходя из стабильной производительности и отсутствия блокеров).

**Если задача окажется проще** — сократится до 3-4 сессий за счёт совмещения B1+B2 и C+D.

---

## 7. Open findings (не блокирующие)

Во время ревью кода обнаружил несколько мест для последующего внимания (не в scope этого ТЗ, кандидаты в FINDINGS.md при внедрении):

1. **Рассинхронизация ADR 053 vs кода.** ADR 053 описывает пример как `providerOptions.anthropic.contextManagement: { type: "auto" }`, в коде же `{ edits: [{ type: 'compact_20260112', ... }] }`. Это точно описывает разные вещи — `type: "auto"` скорее всего historical reference на более раннюю беру API. Правка в рамках этого ТЗ (ADR 053 будет edit-иться всё равно).
2. **`COMPACTION_THRESHOLD_SOFT` == `EXTRACT_THRESHOLD_SOFT` в абсолюте?** Soft = 100K (50% от 200K), прежний `EXTRACT_THRESHOLD_SOFT` = 84K (60% от 140K). Не совпадают. Production behavior сдвигается — см. Вопрос 5.
3. **`estimateMessageTokens` точность.** Это оценка (~70% от фактического). Документированный долг `TZ_CompactionActualCalibration` (не в scope). После унификации на 50% порог могут появиться новые observation points — MVP live period перед решением.

---

## Статус Фазы 1

- [x] Прочитана официальная документация AI SDK v6 middleware, Anthropic contextManagement, xAI Grok (§0)
- [x] Изучены затронутые файлы в кодовой базе
  - `lib/ai/context-limits.ts`, `lib/ai/model-catalog.ts`, `lib/ai/task-assignments.ts`, `lib/ai/getModel.ts`
  - `lib/ai/compaction/*.ts` (6 files), `lib/ai/memory/extract.ts`, `lib/ai/memory/index.ts`
  - `app/(chat)/api/chat/route.ts`, `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`
  - `components/elements/context.tsx`
  - `lib/prompts/memory/extract.md`, `lib/prompts/memory/extract-batch.md`
  - `specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md` (v1.10), `docs/decisions/053-aisdk-invocation-contract.md`
- [x] Проверен `_backlog/` — есть 3 открытых долга, один из которых (`TZ_UnifyContextThresholdBase`) закрывается этим ТЗ. Второй (`TZ_CompactionActualCalibration`) — явно исключён из scope. Третий (`TZ_ExpertiseCreateVisionRouting`) — не связан (vision-routing, независимый долг).
- [x] ANALYSIS.md создан с: изученная документация, код-ревью ТЗ (✅/⚠️/❓), вопросы для уточнения (10), риски (7), зависимости, оценка сложности
- [ ] **СТОП** — жду ответов архитектора на вопросы §3 + подтверждение рекомендаций §2 (особенно рек. #1 — task-expert route в scope)
