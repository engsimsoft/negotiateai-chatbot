# Передача сессии ТЗ-PIPELINE1

**Дата:** 2026-04-06
**Сессия:** 1 (финализация)

## Статус этапов
- [x] Этап 0: Fix multi-step usage logging — totalUsage вместо usage
- [x] Этап 1: Retry-инфраструктура — maxRetries:0, retryWithLogging, убран fallback
- [x] Этап 2: Controller crash fix + Perplexity (dead code — не нужно)
- [x] Этап 3: DevPanel — retry history, URL verification
- [x] Этап 4: Финализация — docs, ADR 037, v3.69.0

## Результат
- До фикса: 74% token usage терялось
- После фикса: дельта <1% vs Anthropic Console
- Artifacts: было 0 логирования, теперь все 5 типов логируют

## Что осталось за scope
- DevPanel "Total (real)" считает sum per-step debug events, показывает ~60% от реального — нужен фикс в DevPanelFooter/Drawer (использовать totalUsage из finish event вместо sum steps)
- research-engine.ts — dead code, не используется в production
