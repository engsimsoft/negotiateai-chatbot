# Changelog ТЗ-FIX2: Research Progress Mode

## Сессия 1 — 2026-02-26

### Added
- ANALYSIS.md — код-ревью ТЗ, 5 рекомендаций, 4 вопроса
- ROADMAP.md — план 5 этапов (одобрен архитектором)
- HANDOFF.md — контекст передачи
- SPEC.md — ссылка на оригинал ТЗ

### Decisions
- Progress: shared reference через closure (не dataStream.write напрямую)
- Verified: server-side Set<string> URL + existing DB sources
- Классификация: эвристика (tier по домену, fetchMethod по URL, language по Cyrillic)
- Telegram: совмещённый query (один deepResearch call на тему)
- RSS: парсить `<link rel="alternate">` из HTML при fetchUrl
