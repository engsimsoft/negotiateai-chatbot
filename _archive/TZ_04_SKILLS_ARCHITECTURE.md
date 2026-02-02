# ТЗ-04: Архитектура Skills + Agents

**Версия:** 1.0  
**Дата:** 2026-02-02  
**Приоритет:** 🔴 Высокий  
**Статус:** Готово к разработке

---

## ⚠️ КРИТИЧЕСКОЕ ПРАВИЛО ДЛЯ CLAUDE CODE

**Данная архитектура основана на стандарте Agent Skills от Anthropic (agentskills.io) с расширением для персонажей-агентов.**

Если Владимир предлагает решение, которое противоречит:
- Формату SKILL.md (стандарт Anthropic)
- Принципу progressive disclosure
- Разделению skills/agents

**→ Отказать и объяснить почему это нарушает стандарт.**

Владимир не инженер. Он может ошибиться в технических терминах. Задача Claude Code — следовать стандарту, а не соглашаться с любым предложением.

**Источники стандарта:**
- https://agentskills.io/specification
- https://github.com/anthropics/skills
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills

---

## Цель

Мигрировать систему промптов на гибридную архитектуру:
- **Skills** — атомарные навыки по стандарту Anthropic
- **Agents** — персонажи-дирижёры (расширение Simply)

---

## Ключевые концепции

### Skill (стандарт Anthropic)

**Атомарное умение без личности.** Переиспользуемый модуль.

Примеры:
- `competitor-analysis` — анализ конкурентов
- `content-plan` — создание контент-плана
- `xlsx` — работа с Excel

Skill НЕ ведёт диалог. Skill выполняет конкретную задачу.

### Agent (расширение Simply)

**Персонаж с личностью.** Дирижёр, который использует skills.

Примеры:
- `marketer` — Маркетолог (использует skills: competitor-analysis, content-plan, deep-research)
- `ben` — Бен, помощник по платформе

Agent ВЕДЁТ диалог. Agent проводит интервью, выбирает нужные skills, контролирует качество.

### Разница

| Skill | Agent |
|-------|-------|
| Что делать | Как общаться |
| Инструкция | Личность |
| Атомарный | Композитный |
| Стандарт Anthropic | Расширение Simply |

---

## Структура файлов

```
lib/prompts/
│
├── skills/                           # Стандарт Anthropic
│   │
│   ├── document/                     # Категория: документы
│   │   ├── xlsx/
│   │   │   ├── SKILL.md             # Главный файл (обязательный)
│   │   │   ├── scripts/             # Опционально
│   │   │   └── references/          # Опционально
│   │   ├── pptx/
│   │   │   └── SKILL.md
│   │   └── pdf/
│   │       └── SKILL.md
│   │
│   ├── marketing/                    # Категория: маркетинг
│   │   ├── competitor-analysis/
│   │   │   └── SKILL.md
│   │   ├── content-plan/
│   │   │   └── SKILL.md
│   │   └── copywriting/
│   │       ├── SKILL.md
│   │       └── references/
│   │           └── tone-examples.md
│   │
│   ├── research/                     # Категория: исследования
│   │   └── deep-research/
│   │       └── SKILL.md
│   │
│   └── utility/                      # Категория: утилиты
│       └── prompt-helper/
│           └── SKILL.md
│
├── agents/                           # Расширение Simply
│   │
│   ├── _template/                    # Шаблон нового агента
│   │   ├── AGENT.md
│   │   └── config.yaml
│   │
│   ├── marketer/
│   │   ├── AGENT.md                 # Личность, стиль диалога
│   │   ├── config.yaml              # Метаданные + список skills
│   │   └── interview.md             # Как проводить интервью
│   │
│   ├── ben/
│   │   ├── AGENT.md
│   │   ├── config.yaml
│   │   ├── onboarding.md            # Сценарий первого знакомства
│   │   └── references/
│   │       ├── features.md          # Описание фич платформы
│   │       └── scenarios.md         # Сценарии помощи
│   │
│   └── copywriter/
│       ├── AGENT.md
│       ├── config.yaml
│       └── interview.md
│
├── core/                             # Базовый системный промпт
│   ├── base.md                      # Общие правила поведения
│   ├── safety.md                    # Ограничения
│   ├── formatting.md                # Форматирование ответов
│   └── russian-market.md            # Специфика РФ
│
├── contexts/                         # Динамические контексты
│   ├── user-profile.ts              # ✅ Сохраняется как есть
│   ├── chat-memory.ts               # Заглушка → будет реализовано позже
│   └── project-context.ts           # ✅ Сохраняется как есть
│
├── builder/                          # Система сборки
│   ├── index.ts                     # Главный API
│   ├── skill-loader.ts              # Загрузчик skills
│   ├── agent-loader.ts              # Загрузчик agents
│   ├── composer.ts                  # Сборка финального промпта
│   └── registry.ts                  # Реестр всех skills/agents
│
├── template.ts                       # ✅ Сохраняется как есть
└── types.ts                          # Обновить типы
```

---

## Формат SKILL.md (стандарт Anthropic)

```markdown
---
name: competitor-analysis
description: >
  Анализ конкурентов: сбор данных, SWOT-анализ, выявление 
  сильных и слабых сторон. Используй когда нужно исследовать 
  конкурентную среду или сравнить позиционирование.
tools:
  - web-search
  - deep-research
---

# Анализ конкурентов

## Процесс

1. Определи список конкурентов (прямые, косвенные)
2. Собери данные по каждому:
   - Позиционирование
   - Ценовая политика
   - Каналы продвижения
   - УТП
3. Проведи SWOT-анализ
4. Сформулируй выводы и рекомендации

## Формат результата

### Конкурент: [Название]

**Позиционирование:** ...
**Сильные стороны:** ...
**Слабые стороны:** ...
**Угрозы от него:** ...

## Примеры

[Примеры хорошего анализа]
```

### Правила SKILL.md

| Поле | Обязательность | Ограничения |
|------|----------------|-------------|
| `name` | ✅ Обязательно | max 64 символа, lowercase, дефисы |
| `description` | ✅ Обязательно | max 1024 символа |
| `tools` | Опционально | Список требуемых tools |
| `license` | Опционально | Для публичных skills |
| `metadata` | Опционально | author, version и т.д. |

**Рекомендуемый размер SKILL.md:** < 5000 токенов

---

## Формат AGENT.md (расширение Simply)

```markdown
---
name: marketer
displayName: Маркетолог
description: >
  Опытный маркетолог-стратег. Помогает с анализом рынка,
  разработкой стратегий продвижения, контент-планами.
model: pro
skills:
  - marketing/competitor-analysis
  - marketing/content-plan
  - marketing/copywriting
  - research/deep-research
  - document/pptx
---

# Личность

Ты опытный маркетолог с 15-летним стажем. Работал с компаниями 
от стартапов до крупных брендов.

## Стиль общения

- Говоришь уверенно, но не высокомерно
- Используешь примеры из практики
- Задаёшь уточняющие вопросы перед работой
- Объясняешь свои рекомендации

## Принцип работы

1. Сначала проведи короткое интервью (см. interview.md)
2. Выбери подходящий навык (skill)
3. Выполни задачу
4. Проверь результат и предложи улучшения

## Чего НЕ делаешь

- Не даёшь советы без понимания контекста
- Не используешь шаблонные ответы
- Не игнорируешь специфику бизнеса клиента
```

### Формат config.yaml для агента

```yaml
# agents/marketer/config.yaml

name: marketer
displayName: Маркетолог
category: business
model: pro

# Какие skills использует этот агент
skills:
  - marketing/competitor-analysis
  - marketing/content-plan
  - marketing/copywriting
  - research/deep-research
  - document/pptx

# Какие файлы загружать в промпт агента
includes:
  - AGENT.md
  - interview.md

# Для UI
icon: 📊
description: "Разрабатывает стратегии, анализирует рынок"
exampleTasks:
  - "Проанализируй моих конкурентов"
  - "Составь контент-план на месяц"
  - "Помоги с позиционированием"
```

---

## Progressive Disclosure

### 3 уровня загрузки

| Уровень | Что загружается | Когда | Токены |
|---------|-----------------|-------|--------|
| **1. Metadata** | name + description всех skills | Всегда | ~50-100 на skill |
| **2. SKILL.md** | Полное содержимое | При активации | < 5000 |
| **3. References** | Файлы из references/ | По требованию | Без лимита |

### Как это работает

```
Запрос пользователя
    │
    ▼
[Реестр: metadata всех skills]
    │
    ▼
Claude решает какой skill нужен
    │
    ▼
Загружается полный SKILL.md
    │
    ▼
При необходимости — файлы из references/
```

---

## Логика сборки промпта

### Для чата (без агента)

```
buildChatPrompt(context) → {
  1. core/base.md
  2. core/safety.md  
  3. core/formatting.md
  4. contexts/user-profile (данные пользователя)
  5. contexts/chat-memory (если есть)
  6. [Metadata всех skills для роутинга]
}
```

### Для агента

```
buildAgentPrompt(agentId, context) → {
  1. core/base.md
  2. core/safety.md
  3. agents/{agentId}/AGENT.md
  4. agents/{agentId}/interview.md (если есть)
  5. contexts/user-profile
  6. contexts/chat-memory
  7. [Metadata skills из config.yaml]
}
```

### Для проекта

```
buildProjectPrompt(projectId, agentId?, context) → {
  1. core/base.md
  2. agents/{agentId}/AGENT.md (если указан)
  3. contexts/user-profile
  4. contexts/project-context (название, описание, файлы)
  5. [Metadata skills]
}
```

---

## API Builder

```typescript
// lib/prompts/builder/index.ts

interface BuilderAPI {
  // Получить реестр всех skills (только metadata)
  getSkillsRegistry(): SkillMetadata[]
  
  // Загрузить полный skill
  loadSkill(skillId: string): Skill
  
  // Получить реестр всех agents
  getAgentsRegistry(): AgentMetadata[]
  
  // Загрузить агента со всеми его skills
  loadAgent(agentId: string): Agent
  
  // Собрать промпт для чата
  buildChatPrompt(context: PromptContext): BuiltPrompt
  
  // Собрать промпт для агента
  buildAgentPrompt(agentId: string, context: PromptContext): BuiltPrompt
  
  // Собрать промпт для проекта
  buildProjectPrompt(projectId: string, context: PromptContext): BuiltPrompt
}

interface BuiltPrompt {
  systemPrompt: string
  model: ModelId
  tools: Tool[]
}
```

---

## Миграция существующего кода

### Что удаляется

```
lib/prompts/
├── chat/config.ts          ❌ Удалить
├── ben/config.ts           ❌ Удалить
├── assistants/             ❌ Удалить всю папку
└── core/                   ❌ Удалить (пересоздадим)
```

### Что сохраняется

```
lib/prompts/
├── contexts/
│   ├── user-profile.ts     ✅ Сохранить
│   ├── chat-memory.ts      ✅ Сохранить (заглушка)
│   └── project-context.ts  ✅ Сохранить
├── template.ts             ✅ Сохранить
└── types.ts                ✅ Обновить типы
```

### Что создаётся

```
lib/prompts/
├── skills/                 🆕 Новая папка
├── agents/                 🆕 Новая папка
├── core/                   🆕 Пересоздать
└── builder/                🆕 Новая папка
```

---

## Порядок реализации

### Фаза 1: Структура

1. Создать структуру папок `skills/`, `agents/`, `core/`, `builder/`
2. Создать `_template/` для skills и agents
3. Обновить `types.ts` с новыми типами

### Фаза 2: Builder

4. Реализовать `registry.ts` — сканирует папки, читает metadata
5. Реализовать `skill-loader.ts` — загружает SKILL.md
6. Реализовать `agent-loader.ts` — загружает AGENT.md + config.yaml
7. Реализовать `composer.ts` — собирает финальный промпт
8. Реализовать `index.ts` — публичный API

### Фаза 3: Core промпты

9. Создать `core/base.md`
10. Создать `core/safety.md`
11. Создать `core/formatting.md`
12. Создать `core/russian-market.md`

### Фаза 4: Миграция Ben

13. Создать `agents/ben/AGENT.md`
14. Создать `agents/ben/config.yaml`
15. Создать `agents/ben/onboarding.md`
16. Создать `agents/ben/references/features.md`

### Фаза 5: Миграция Prompt-agent

17. Создать `skills/utility/prompt-helper/SKILL.md`

### Фаза 6: Интеграция

18. Обновить `api/chat/route.ts` — использовать новый builder
19. Обновить `api/assistant/ben/route.ts`
20. Удалить старые файлы

### Фаза 7: Тестирование

21. Проверить сборку промптов
22. Проверить progressive disclosure
23. Проверить работу Ben
24. Проверить работу чата

---

## Файлы для создания (минимум для запуска)

### Skills (заглушки)

```
skills/
├── utility/
│   └── prompt-helper/
│       └── SKILL.md
└── _template/
    └── SKILL.md
```

### Agents

```
agents/
├── ben/
│   ├── AGENT.md
│   ├── config.yaml
│   └── onboarding.md
└── _template/
    ├── AGENT.md
    └── config.yaml
```

### Core

```
core/
├── base.md
├── safety.md
└── formatting.md
```

---

## Критерии готовности

- [ ] Структура папок создана
- [ ] Builder собирает промпт для чата
- [ ] Builder собирает промпт для агента Ben
- [ ] Progressive disclosure работает (metadata → full)
- [ ] Старые файлы удалены
- [ ] API routes используют новый builder
- [ ] Ben отвечает корректно
- [ ] Чат работает корректно

---

## Документация для обновления

После реализации обновить:

1. `SIMPLY_STATUS.md` — новая версия, изменения
2. `SIMPLY_PROMPTS_ARCHITECTURE.md` — актуализировать под новую структуру
3. `SIMPLY_INDEX.md` — добавить ссылку на это ТЗ
4. `docs/ai-agents.md` — описание новой архитектуры

---

## Ссылки

- [Agent Skills Specification](https://agentskills.io/specification)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
- [Equipping agents for the real world](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

---

**Создано:** 2026-02-02  
**Автор:** Claude (Opus 4.5)  
**Для:** Claude Code  
**Статус:** Готово к реализации
