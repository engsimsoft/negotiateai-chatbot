# Changelog ТЗ-MindDeepConsolidation

## Сессия 1 — 2026-04-21

### Planned
- Research-фаза выполнена (Mem0 v3, Letta sleep-time, Zep, Mem0 Dream gate)
- ANALYSIS.md создан с «Изученной документацией», Код-ревью ТЗ, рисками
- ROADMAP.md создан — 4 этапа (A: инфра, B: cron+миграция, C: валидация, D: финализация)

### Decisions
- Default model: `grok-4.20-0309-reasoning` (А/B с Haiku 4.5 через `/dev/models` после запуска)
- Активность: 24ч (`factsUpdatedSince > NOW() - 24h`)
- Schedule: 01:00 МСК (22:00 UTC) — 2ч gap перед memory-profile
- Actions: merge / supersede / remove + **rephrase** (компрессия длинного факта в тот же id)
- Race condition: snapshot cursor `runStartTs` + фильтр `created_at < runStartTs`
- Idempotency: `lastDeepConsolidatedAt > NOW() - 12h` → skip
