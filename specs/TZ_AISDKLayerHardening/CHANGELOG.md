# Changelog ТЗ-AISDKLayerHardening

> Локальный лог изменений в рамках этого ТЗ. После финализации содержание переносится в главный CHANGELOG.md.

---

## Сессия 1 — 2026-04-17 (Фаза 1 + Фаза 2)

### Added
- `specs/TZ_AISDKLayerHardening/SPEC.md` — umbrella ТЗ объединяющий три долга из `_backlog/`
- `specs/TZ_AISDKLayerHardening/ANALYSIS.md` — аудит кода, изучение официальной документации, 4 вопроса владельцу
- `specs/TZ_AISDKLayerHardening/ROADMAP.md` — план с 3 содержательными этапами + финализация, полная cap table для 37 taskIds

### Findings during analysis
- Этап 1 (DevOverrides) в основном уже сделан через `instrumentation.ts` (коммит `c4b2b63`). Scope сократился до cleanup.
- Scope Этапа 2 — 36 call sites (не 20 как в заготовке): 5 с явным cap, 31 implicit.
- ADR 048 L94-108 стал stale после instrumentation.ts фикса. Будет обновлён в Этапе 1.
- `specs/_backlog/README.md:40` содержит сломанную ссылку на `TZ_DevOverridesSideEffectImportAudit.md` (файл в `_backlog/_archive/`). Будет исправлено в Этапе 1.

### Changed
(пока ничего)

### Fixed
(пока ничего)

### Files
- `specs/TZ_AISDKLayerHardening/SPEC.md` — new
- `specs/TZ_AISDKLayerHardening/ANALYSIS.md` — new
- `specs/TZ_AISDKLayerHardening/ROADMAP.md` — new
- `specs/TZ_AISDKLayerHardening/CHANGELOG.md` — new
- `specs/TZ_AISDKLayerHardening/HANDOFF.md` — new
