# Changelog ТЗ-OPT1: Usage Logging + Миграция Sonnet 4.6

## Сессия 1 — 2026-02-25

### Added
- SPEC.md — копия ТЗ
- ANALYSIS.md — анализ + код-ревью (4 рекомендации согласованы)
- ROADMAP.md — план из 4 этапов
- HANDOFF.md — передача для следующей сессии

### Решения
- costUsd: numeric(10,6) вместо real (точность при агрегации)
- chatId: nullable (для будущего логирования briefing/clerks)
- Scope: +task-chat route (проектные чаты с Opus — самые дорогие)
- Docs: обновить все 4 файла (ai-providers, ai-agents, ai-chats-map, SIMPLY_STATUS)
