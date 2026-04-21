# Changelog ТЗ-MindOnVisit

## Сессия 1 — 2026-04-21

### Planning
- Создан SPEC.md. Первоначальный scope «заменить cron на on-visit» после полной карты триггеров и обсуждения с владельцем **расширен до 3 стратегий с выбором пользователя в UI**: `always` (on-visit + cron) / `on-visit` / `cron`.
- Создан ANALYSIS.md — изучены best practices: Next.js `after()` API (стабильный с 15.1), Spring AI predicate-triggered pattern (апрель 2026), Mem0 async default.
- Принятые параметры без вопросов владельцу: дебаунс 30 мин, stale=0 часов, механизм фона — `after()` из `next/server`.
- ROADMAP переписан под 3-стратегийный scope: 6 этапов, 1 коммит (правило 7 WORKFLOW).
- Reuse существующего `components/settings/memory-section.tsx` — новая радио-группа добавляется под текущим тумблером.
