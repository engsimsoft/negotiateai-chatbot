# ТЗ-UtilTitleCapReasoningMargin — повысить cap `util:title` для reasoning variant override

**Статус:** Хвост, Low impact (косметика — проявляется только при ручном dev override)
**Создано:** 2026-04-18 (ТЗ-AISDKLayerHardening Этап 2, Finding #1)
**Источник:** `specs/_archive/TZ_AISDKLayerHardening/FINDINGS.md` § Finding #1
**Связано с:** [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) (`DEFAULT_MAX_OUTPUT_TOKENS['util:title']`), ADR 053 «AI SDK invocation contract»

---

## Симптом

Default модель `util:title` = `grok-4-1-fast-non-reasoning`. Cap в SSOT = **64** — рассчитан именно на non-reasoning variant (название 1-3 слов ≤32 chars + короткий summary). При ручном dev override `util:title` → `grok-4-1-fast-reasoning` (через `/dev/models`) safety-net (`Math.min(requested, capability)` в [getMaxOutputTokensForTask()](../../lib/ai/getModel.ts)) срезает финальный ответ ровно по cap:

| Запуск | Модель | outputTokens | thinkingTokens | Final answer |
|---|---|---|---|---|
| Override на reasoning (2026-04-18) | `grok-4-1-fast-reasoning` | 570 | 506 | **64 (== cap)** |
| Default non-reasoning (2026-04-18) | `grok-4-1-fast-non-reasoning` | 61 | 0 | 61 (margin 3 tok) |

Название в UI отрисовалось (Zod-схема успевает валидироваться на 64-токенном хвосте), но без запаса. На иных сценариях reasoning variant может обрезать раньше — ответ станет невалидным.

---

## Root cause

Reasoning-model тратит часть budget на внутренний thinking (`506` tok в примере) **до** финальной JSON-выдачи. Cap 64 на суммарный output оставляет ≤64 tok на итоговый JSON. Архитектурно safety-net работает корректно — именно так, как спроектирован. Проблема не в safety-net, а в том что cap table не учитывает reasoning overhead: одно и то же значение для reasoning и non-reasoning вариантов недостаточно.

**Не блокер для production:** default конфигурация (non-reasoning) работает штатно. Finding проявляется только при ручном dev override, а не в проде.

---

## Решение (рекомендованное)

**Поднять `DEFAULT_MAX_OUTPUT_TOKENS['util:title']` с 64 до 256.**

Обоснование:
- Non-reasoning variant всё равно укладывается в ~60-100 tok, дополнительный запас не используется.
- Reasoning variant получает ~192 tok на финальный JSON после thinking — достаточный margin.
- Стоимость: 256 tok × $0.50/M = нерелевантная доля цены util:title вызова.
- Runaway guard ослабляется незначительно (256 vs 64) — для 1-3 слов названия этого всё равно более чем достаточно.

---

## Альтернативы (рассмотрены, отклонены)

1. **Reasoning-aware cap в ADR** — принцип «если variant модели содержит reasoning — добавлять reasoning-бюджет сверх SSOT». Требует расширения cap table (`DEFAULT_MAX_OUTPUT_TOKENS['util:title:reasoning']`) или логики в getter. Overengineering на один случай.
2. **Документировать ограничение без фикса** — явно в ADR зафиксировать что `util:title` cap=64 рассчитан на non-reasoning и переключение на reasoning требует ручного повышения. Сделано частично в ADR 053; но без повышения cap «ручное повышение» всё равно нужно постоянно.

---

## Acceptance criteria

- [ ] `DEFAULT_MAX_OUTPUT_TOKENS['util:title']` в [lib/ai/task-assignments.ts](../../lib/ai/task-assignments.ts) поднят с 64 до 256.
- [ ] Smoke test (dev, override на `grok-4-1-fast-reasoning`): создать новый expertise/create чат → 4+ сообщений → в DevPanel Timeline `util:auto-naming` завершается без обрезания (final_tokens < 256, полный валидный JSON).
- [ ] Smoke test (dev, default non-reasoning): `outputTokens` вызова остаётся в диапазоне 50-100 (без регрессии).
- [ ] SQL: `SELECT max("outputTokens") FROM ai_usage_log WHERE "chatMode"='util:auto-naming' AND "createdAt" > NOW() - INTERVAL '7 days'` не превышает 256 (реальный верхний предел на production traffic).
- [ ] CHANGELOG-запись + ссылка на этот ТЗ / на FINDINGS архива.

---

## НЕ в scope

- Изменение cap для других `util:*` taskId — они под non-reasoning by design, не требуют запаса.
- Переход `util:title` на reasoning variant по умолчанию — отдельный продуктовый вопрос (реально ли улучшает названия? какой cost ROI?).
- Перепроектирование safety-net — работает корректно, не меняем.

---

## Оценка

**< 0.25 сессии:**
- Правка одной строки в `DEFAULT_MAX_OUTPUT_TOKENS` (5 минут).
- Мануальный smoke test владельцем на 2 вариантах (15 минут).
- SQL-проверка + коммит + CHANGELOG (10 минут).
