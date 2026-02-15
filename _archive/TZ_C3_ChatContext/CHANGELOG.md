# Changelog ТЗ-C3: Context Window Management для обычного чата

> История изменений в рамках этого ТЗ.
> После завершения — переносится в главный CHANGELOG.md

---

## Сессия 1 — 2026-02-15

### Added
- Создана папка `specs/TZ_C3_ChatContext/` с полным набором документов
- SPEC.md — спецификация задачи
- ANALYSIS.md — глубокий анализ кодовой базы (4 области: chat route, task route, clerk, UI), код-ревью ТЗ с 5 рекомендациями
- ROADMAP.md — план из 5 этапов, 20+ задач с валидацией
- HANDOFF.md — передача для следующей сессии
- Ветка `feature/chat-context` создана

### Решения
- Версия: 3.21.0 → 3.22.0
- Один universal клерк (не два файла)
- Git ветка отдельная от design-system
- onFinish filter — критичный баг идентифицирован до начала разработки

### Files
```
specs/TZ_C3_ChatContext/SPEC.md
specs/TZ_C3_ChatContext/ANALYSIS.md
specs/TZ_C3_ChatContext/ROADMAP.md
specs/TZ_C3_ChatContext/CHANGELOG.md
specs/TZ_C3_ChatContext/HANDOFF.md
```
