# FINDINGS — ТЗ-AISDKLayerHardening

Находки вне scope активных задач ТЗ. По Правилу 8 WORKFLOW.

---

## Finding #1 — `util:title` cap=64 тесен для reasoning-variant override

**Обнаружено:** Этап 2, мануальный тест владельца 2026-04-18.

**Контекст:** Default модель `util:title` = `grok-4-1-fast-non-reasoning` (MEMORY / `project_simply_chat_persistent.md` и `task-assignments.ts:186`). Cap в SSOT = **64** — рассчитан именно на non-reasoning вариант (название 1-3 слова ≤32 chars + короткий summary).

**Симптом:** При включённом dev override `util:title` → `grok-4-1-fast-reasoning` safety-net срезал финальный ответ строго по cap:

| Запуск | Модель | outputTokens | thinkingTokens | Final answer |
|---|---|---|---|---|
| Override на reasoning | `grok-4-1-fast-reasoning` | 570 | 506 | **64 (== cap)** |
| Default non-reasoning | `grok-4-1-fast-non-reasoning` | 61 | 0 | 61 (3 токена margin) |

**Диагностика:** Reasoning модель тратит toolkit токенов на внутренний thinking (`506`) ещё до генерации финального JSON-ответа. Когда доходит до вывода — cap 64 уже едва хватает, ответ обрезается ровно на границе. Название в UI у владельца появилось (Zod-схема успела валидироваться), но без запаса.

**Архитектурная интерпретация:** Safety-net работает **корректно** — именно так, как спроектирован. Проблема не в safety-net, а в том что cap table не учитывает reasoning overhead: одно и то же значение (64) для reasoning и non-reasoning вариантов недостаточно когда variant активный.

**Не блокер для Этапа 2:** default production конфигурация (non-reasoning) работает штатно. Находка проявляется только при ручном dev override, а не в проде.

**Варианты решения (для backlog):**

1. **Повысить cap `util:title` до ~256** — даст запас для reasoning variant без заметной стоимости на non-reasoning (тот всё равно укладывается в ~60-100 tok). Компромисс: чуть ослабляем runaway guard, но 256 tok × $0.50/M ≈ нерелевантная доля цены.
2. **Добавить reasoning-aware cap в ADR** — принцип «если variant модели содержит reasoning — добавлять reasoning-бюджет сверх SSOT». Требует расширения cap table или логики в getter.
3. **Документировать ограничение** — явно в ADR зафиксировать что `util:title` cap=64 рассчитан на non-reasoning и переключение на reasoning требует ручного повышения. Минимальная инвазивность, зависит от дисциплины dev.

**Рекомендация:** вариант 1 (повысить до 256) + упомянуть в ADR контракта (вариант 3). Вариант 2 overengineering на один случай.

**Перенос в backlog:** после финализации ТЗ-AISDKLayerHardening оформить как `specs/_backlog/TZ_UtilTitleCapReasoningMargin.md` (Правило 9 WORKFLOW) — низкий приоритет, косметика, применяется только при нестандартной конфигурации.

---

## Finding #2 — Anthropic API не разделяет thinking tokens от output в usage

**Обнаружено:** Этап 3, мануальный тест владельца 2026-04-18.

**Контекст:** ROADMAP-критерий Этапа 3 включал «`thinkingTokens > 0` в `ai_usage_log` при плане на Opus с adaptive/enabled thinking» — как косвенное подтверждение что extended thinking реально работает на Opus через streamText.

**Симптом:** После прогона на проекте «AI для стоматологической диагностики» (Opus 4.6, cap 32000, streamText, `thinking: { type: "enabled", budgetTokens: 16000 }`, без temperature — чистый конфиг без warning'ов) — `thinkingTokens` в БД = **0**, при этом POST занял 146 секунд (на обычную generateText без thinking Opus обычно укладывается в 20-30с для ~10K output — косвенный признак что thinking реально выполнялся).

**Root cause (подтверждено исходниками @ai-sdk/anthropic@3.0.66):**

1. [node_modules/@ai-sdk/anthropic/dist/index.js:1646-1659](../../node_modules/@ai-sdk/anthropic/dist/index.js#L1646) — функция `convertAnthropicMessagesUsage` всегда возвращает `outputTokens.reasoning: void 0`:
   ```js
   return {
     outputTokens: {
       total: outputTokens,
       text: void 0,
       reasoning: void 0,  // ← ВСЕГДА undefined для Anthropic
     },
     raw: rawUsage ?? usage,
   };
   ```

2. Это не баг SDK — это честное отражение Anthropic Messages API: response возвращает **единое поле `usage.output_tokens`** без разделения thinking vs completion. В отличие от OpenAI и xAI, которые в `completion_tokens_details.reasoning_tokens` отдают thinking отдельно.

3. Наш [lib/ai/usage-utils.ts:76](../../lib/ai/usage-utils.ts#L76) корректно читает `usage.outputTokenDetails?.reasoningTokens ?? 0` — логика правильная, но для Anthropic это всегда 0.

**Следствие:** для Anthropic-моделей (Opus/Sonnet/Haiku) поле `thinkingTokens` в [ai_usage_log](../../lib/db/schema.ts) **архитектурно всегда = 0**, независимо от того, активно ли extended thinking. Токены размышления расходуются (попадают в `usage.output_tokens` Anthropic и, следовательно, в наш `outputTokens`), но неразделимо.

**Решение (принято владельцем 2026-04-18):**

1. **Переформулировать критерий валидации ROADMAP §3** — убрать `thinkingTokens > 0`, заменить на «POST 200 без UND_ERR + план создаётся + время ≥ 60с (косвенный признак работы thinking)».
2. **Зафиксировать в главном CHANGELOG.md** пояснение для будущих разработчиков: на Anthropic `thinkingTokens` всегда 0 — ограничение API, не баг кода.
3. **Backlog item про workaround (попытка восстановить thinking tokens из `usage.raw`)** — НЕ создавать. Причины:
   - Хрупкое: полагается на shape `raw` payload, может сломаться при любом апдейте `@ai-sdk/anthropic`.
   - Не масштабируемо: стратегически рассматривается переход Professor Planning на Grok Multi-Agent (ТЗ-XAI-MA-1 в backlog), где разделение thinking tokens работает штатно. Через 1-2 месяца проблема может стать неактуальной.

**Практический вывод для pricing:**

Текущая формула `costUsd` в [lib/ai/tokenlens-catalog.ts](../../lib/ai/tokenlens-catalog.ts) для Opus считает корректно — pricing per output token (не per thinking) у Anthropic, и все thinking tokens Anthropic включает в output_tokens, т.е. cost уже учтён правильно через `outputTokens × output_price`. Разделения не требуется для биллинга. Различие важно только для аналитики «сколько модель думала» — а это, как показано выше, архитектурно невозможно для Anthropic.

**Не оформляется в backlog** — это неразрешимое SDK-level ограничение, не техдолг.
