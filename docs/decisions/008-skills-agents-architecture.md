# ADR 008: Skills + Agents Architecture (v3.3.0)

**Дата:** 2026-02-02
**Статус:** Принято
**Supersedes:** [ADR 006](006-prompt-architecture.md) (частично)

---

## Контекст

После ADR 006 система промптов использовала TypeScript конфиги в `lib/prompts/`. Но при масштабировании возникли проблемы:

**Проблемы TypeScript-only подхода:**
- Промпты смешаны с кодом (сложно редактировать)
- Нет разделения "навыки" vs "персонажи"
- Сложно добавлять новые capabilities
- Нет Progressive Disclosure (всё загружается сразу)

**Вдохновение:**
- Anthropic публикует свои промпты как SKILL.md файлы
- Разделение на Skills (атомарные навыки) и Agents (персонажи-дирижёры)
- Markdown лучше для редактирования промптов

---

## Решение

Мигрировать на архитектуру Skills + Agents по стандарту Anthropic.

### Концепции

| Концепция | Описание | Пример |
|-----------|----------|--------|
| **Skill** | Атомарный навык в Markdown | `create-presentation/SKILL.md` |
| **Agent** | Персонаж с набором skills | `ben/AGENT.md` + `config.yaml` |
| **Builder** | Система сборки промптов | `registry.ts`, `composer.ts` |

### Файловая структура

```
lib/prompts/
├── skills/                    # Атомарные навыки
│   ├── _template/SKILL.md
│   ├── document/
│   │   ├── create-presentation/SKILL.md
│   │   ├── create-spreadsheet/SKILL.md
│   │   ├── create-text-document/SKILL.md
│   │   └── analyze-document/SKILL.md
│   ├── research/
│   │   └── web-research/SKILL.md
│   └── utility/
│       └── prompt-helper/SKILL.md
│
├── agents/                    # Персонажи-агенты
│   ├── _template/
│   │   ├── AGENT.md
│   │   └── config.yaml
│   └── ben/
│       ├── AGENT.md
│       ├── config.yaml
│       └── references/
│
├── builder/                   # Система сборки
│   ├── registry.ts            # Сканирование skills/agents
│   ├── skill-loader.ts        # Загрузка SKILL.md
│   ├── agent-loader.ts        # Загрузка AGENT.md
│   └── composer.ts            # Сборка финального промпта
│
└── core/                      # Базовые блоки
    ├── base.md
    ├── safety.md
    ├── formatting.md
    └── russian-market.md
```

### Формат SKILL.md

```markdown
---
name: create-presentation
description: Создание презентаций и слайдов
tools:
  - createDocument
---

# Создание презентаций

## Когда использовать
...

## Процесс работы
...
```

### Progressive Disclosure

3 уровня загрузки:

| Уровень | Что загружается | Когда |
|---------|-----------------|-------|
| **Level 1** | Metadata (name, description) | Всегда в промпте |
| **Level 2** | Full SKILL.md content | При активации skill |
| **Level 3** | References | По требованию |

---

## Причины выбора

### Почему Markdown, а не TypeScript?

| Критерий | Markdown | TypeScript |
|----------|----------|------------|
| Редактирование | ✅ Легко (любой редактор) | ⚠️ Нужен IDE |
| Промпт-инжиниринг | ✅ Натуральный формат | ⚠️ Экранирование строк |
| Версионирование | ✅ Чистый diff | ⚠️ Шумный diff |
| AI-совместимость | ✅ Стандарт индустрии | ⚠️ Нестандартно |

### Почему Skills + Agents?

1. **Разделение ответственности:**
   - Skills = что умеет делать (навыки)
   - Agents = как себя ведёт (персонажи)

2. **Композиция:**
   - Agent = набор skills
   - Один skill может использоваться разными agents

3. **Масштабируемость:**
   - Добавить skill = создать папку с SKILL.md
   - Добавить agent = создать папку с AGENT.md + config.yaml

### Почему Registry + Builder?

- **Registry** сканирует папки, извлекает metadata
- **Builder** собирает финальный промпт из компонентов
- Автоматическое обнаружение новых skills/agents

---

## Последствия

**Плюсы:**
- Промпты в Markdown — легко редактировать
- Модульность — skills переиспользуются
- Progressive Disclosure — экономия токенов
- Соответствие стандартам Anthropic

**Минусы:**
- Сложнее чем простые .ts конфиги
- Нужен build step (registry scan)
- Frontmatter требует gray-matter

---

## Альтернативы

### 1. Оставить TypeScript конфиги
- Промпты как строки в .ts файлах

**Отклонено:** Неудобно редактировать, плохой diff.

### 2. YAML вместо Markdown
- Промпты в YAML файлах

**Отклонено:** Markdown лучше для длинных текстов.

### 3. MDX (Markdown + JSX)
- Интерактивные компоненты в промптах

**Отклонено:** Избыточная сложность, не нужны компоненты.

---

## Реализация

**ТЗ:** TZ_04_ROADMAP.md (в _archive/)

**Ключевые файлы:**
- `lib/prompts/builder/` — система сборки
- `lib/prompts/skills/` — навыки
- `lib/prompts/agents/` — агенты
- `lib/prompts/server.ts` — server-only экспорты

**Версия:** 3.3.0

---

## Связанные документы

- [ADR 006](006-prompt-architecture.md) — предыдущая архитектура (superseded partially)
- [ADR 009](009-loadskill-progressive-disclosure.md) — Progressive Disclosure через tool
- [CHANGELOG.md](../../CHANGELOG.md) — версия 3.3.0
- [docs/ai-agents.md](../ai-agents.md) — документация

---

**Обновлено:** 2026-02-03
