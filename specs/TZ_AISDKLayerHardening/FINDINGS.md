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
