# Architecture Decision Records (ADR)

Архитектурные решения проекта Simply.

**Формат:** [ADR](https://adr.github.io/) — стандартный формат для документирования архитектурных решений.

---

## Индекс решений

| # | Название | Дата | Статус |
|---|----------|------|--------|
| [001](001-why-gemini.md) | Выбор Google Gemini | 2026-01-26 | Принято |
| [002](002-family-bot-concept.md) | Концепция Family AI Assistant | 2026-01-26 | Superseded by 005 |
| [003](003-no-guest-mode.md) | Удаление guest режима | 2026-01-26 | Принято |
| [004](004-agent-system.md) | Система из 8 агентов | 2026-01-27 | Superseded by 006 |
| [005](005-simply-rebrand.md) | Ребрендинг в Simply | 2026-01-28 | Принято |
| [006](006-prompt-architecture.md) | Новая архитектура промптов (v3.0) | 2026-02-02 | Superseded by 008 |
| [007](007-projects-claude-integration.md) | Проекты + Claude Integration (v3.2) | 2026-02-02 | Принято |
| [008](008-skills-agents-architecture.md) | Skills + Agents Architecture (v3.3) | 2026-02-02 | Принято |
| [009](009-loadskill-progressive-disclosure.md) | loadSkill — Progressive Disclosure (v3.3.2) | 2026-02-03 | Принято |

---

## Статусы

- **Принято** — решение действует
- **Superseded** — заменено более новым решением
- **Отклонено** — решение отклонено
- **Предложено** — на рассмотрении

---

## Когда создавать ADR

Создавай ADR когда:
- Выбираешь технологию или библиотеку
- Меняешь архитектуру системы
- Принимаешь решение с долгосрочными последствиями
- Отказываешься от чего-то важного

---

## Шаблон

См. [template.md](template.md)

---

**Обновлено:** 2026-02-03
