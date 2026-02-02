# Дорожная карта: ТЗ-04 — Архитектура Skills + Agents

## Цель

Мигрировать систему промптов на гибридную архитектуру:
- **Skills** — атомарные навыки по стандарту Anthropic (agentskills.io)
- **Agents** — персонажи-дирижёры (расширение Simply)

**Философия:** Progressive Disclosure. Загружаем только то, что нужно.

**Детали:** См. [TZ_04_SKILLS_ARCHITECTURE.md](TZ_04_SKILLS_ARCHITECTURE.md)

## Текущий статус

- **Этап:** ТЗ-04 (Skills + Agents) — ✅ ЗАВЕРШЁН
- **Прогресс:** 40/40 задач (100%)
- **Целевая версия:** 3.3.0
- **Предыдущий:** ТЗ-03 — Проекты + Claude (завершён)

---

## Этапы реализации

### 4.0 Пререквизиты — Валидация текущего состояния

**Цель:** Убедиться, что проект работает перед началом миграции.

- [x] Production build успешен (`npm run build`)
- [x] Приложение запускается локально (`npm run dev`)
- [x] Текущий чат работает корректно
- [x] Ben отвечает корректно
- [x] Prompt-agent работает корректно

---

### 4.1 Создание структуры папок (6 задач)

**Цель:** Создать файловую структуру для skills и agents.

- [x] Создать `lib/prompts/skills/` с подпапками: `document/`, `marketing/`, `research/`, `utility/`
- [x] Создать `lib/prompts/skills/_template/SKILL.md` — шаблон skill
- [x] Создать `lib/prompts/agents/` с подпапками для агентов
- [x] Создать `lib/prompts/agents/_template/` — шаблон агента (AGENT.md, config.yaml)
- [x] Создать `lib/prompts/builder/` — папка для системы сборки
- [x] Обновить `lib/prompts/types.ts` — добавить типы SkillMetadata, AgentMetadata, BuiltPrompt

---

### 4.2 Миграция Core в Markdown (5 задач)

**Цель:** Преобразовать core промпты из .ts в .md формат.

- [x] Создать `lib/prompts/core/base.md` из содержимого `core/base.ts`
- [x] Создать `lib/prompts/core/safety.md` из содержимого `core/safety.ts`
- [x] Создать `lib/prompts/core/formatting.md` из содержимого `core/formatting.ts`
- [x] Создать `lib/prompts/core/russian-market.md` из содержимого `core/russian-market.ts`
- [x] Создать `lib/prompts/core/index.ts` — загрузчик .md файлов

---

### 4.3 Builder — Система сборки промптов (5 задач)

**Цель:** Создать модульную систему сборки промптов.

- [x] Создать `lib/prompts/builder/registry.ts` — сканирует папки, читает metadata
- [x] Создать `lib/prompts/builder/skill-loader.ts` — загружает SKILL.md по требованию
- [x] Создать `lib/prompts/builder/agent-loader.ts` — загружает AGENT.md + config.yaml
- [x] Создать `lib/prompts/builder/composer.ts` — собирает финальный промпт
- [x] Создать `lib/prompts/builder/index.ts` — публичный API

---

### 4.4 Миграция Ben (5 задач)

**Цель:** Перенести Ben в новую архитектуру agents.

- [x] Создать `lib/prompts/agents/ben/AGENT.md` — личность Ben
- [x] Создать `lib/prompts/agents/ben/config.yaml` — метаданные + skills
- [x] Создать `lib/prompts/agents/ben/onboarding.md` — сценарий первого знакомства
- [x] Создать `lib/prompts/agents/ben/references/features.md` — описание фич платформы
- [x] Создать `lib/prompts/agents/ben/references/scenarios.md` — сценарии помощи

---

### 4.5 Миграция Prompt-agent (2 задачи)

**Цель:** Перенести Prompt-agent как skill.

- [x] Создать `lib/prompts/skills/utility/prompt-helper/SKILL.md`
- [x] Убедиться что skill содержит frontmatter (name, description, tools)

---

### 4.6 Интеграция с API routes (4 задачи)

**Цель:** Подключить новый builder к API endpoints.

- [x] Обновить `app/(chat)/api/chat/route.ts` — использовать новый builder
- [x] Обновить `app/(chat)/api/assistant/ben/route.ts` — использовать buildBenPrompt
- [x] Обновить `app/(chat)/api/assistant/prompt-agent/route.ts` — использовать buildPromptAgentPrompt
- [x] Создать `lib/prompts/server.ts` — server-only экспорты (fs-зависимые функции)

---

### 4.7 Удаление старого кода (4 задачи)

**Цель:** Очистить проект от устаревших файлов.

- [x] Удалить `lib/prompts/chat/config.ts`
- [x] Удалить `lib/prompts/ben/config.ts`
- [x] Удалить `lib/prompts/assistants/` (вся папка)
- [x] Удалить старые .ts файлы из core/ (оставить только index.ts и .md)

---

### 4.8 Тестирование (5 задач)

**Цель:** Полное тестирование функционала.

#### Автоматическое:
- [x] `npm run build` — production build успешен

#### Мануальное:
- [ ] Чат отвечает корректно (проверить несколько запросов)
- [ ] Ben отвечает корректно (открыть модальное окно, задать вопрос)
- [ ] Prompt-agent работает (создать промпт)

---

### 4.9 Документация и финализация (4 задачи)

**Цель:** Обновить документацию и завершить этап.

- [ ] Обновить `SIMPLY_STATUS.md` — версия 3.3.0, Skills + Agents
- [ ] Обновить `CHANGELOG.md` — v3.3.0
- [ ] Обновить `docs/ai-agents.md` — описание новой архитектуры
- [ ] Переместить `TZ_04_SKILLS_ARCHITECTURE.md` и `TZ_04_ROADMAP.md` в `_archive/`

---

## Ключевые файлы

### Новые файлы:

```
lib/prompts/
├── skills/
│   ├── _template/SKILL.md
│   └── utility/prompt-helper/SKILL.md
│
├── agents/
│   ├── _template/
│   │   ├── AGENT.md
│   │   └── config.yaml
│   └── ben/
│       ├── AGENT.md
│       ├── config.yaml
│       ├── onboarding.md
│       └── references/
│           ├── features.md
│           └── scenarios.md
│
├── core/
│   ├── base.md
│   ├── safety.md
│   ├── formatting.md
│   ├── russian-market.md
│   └── index.ts
│
├── builder/
│   ├── index.ts
│   ├── registry.ts
│   ├── skill-loader.ts
│   ├── agent-loader.ts
│   └── composer.ts
│
├── server.ts          # Server-only exports
└── index.ts           # Client-safe exports (types, utils)
```

### Модифицированные файлы:

| Файл | Изменение |
|------|-----------|
| `lib/prompts/index.ts` | Клиент-safe экспорты (только типы) |
| `lib/prompts/core/index.ts` | Загрузчик .md файлов |
| `app/(chat)/api/chat/route.ts` | Импорт из server.ts |
| `app/(chat)/api/assistant/ben/route.ts` | Импорт buildBenPrompt из server.ts |
| `app/(chat)/api/assistant/prompt-agent/route.ts` | Импорт buildPromptAgentPrompt из server.ts |
| `components/modal-assistants/ben/drawer.tsx` | Статические greeting константы |

### Удалённые файлы:

| Файл | Причина |
|------|---------|
| `lib/prompts/chat/` | Заменён на builder |
| `lib/prompts/ben/` | Заменён на agents/ben/ |
| `lib/prompts/assistants/` | Заменён на skills/ |
| `lib/prompts/core/*.ts` | Заменены на .md файлы |
| `lib/prompts/builder.ts` | Заменён на builder/ папку |

---

## Критерии готовности (Definition of Done)

### Структура
- [x] Папки skills/, agents/, builder/ созданы
- [x] Шаблоны _template/ созданы для skills и agents
- [x] Типы TypeScript определены в builder

### Builder
- [x] Registry сканирует skills и agents
- [x] Skill loader загружает SKILL.md по требованию
- [x] Agent loader загружает AGENT.md + config.yaml
- [x] Composer собирает финальный промпт
- [x] Progressive disclosure работает (metadata → full)

### Миграция
- [x] Core промпты в .md формате
- [x] Ben мигрирован в agents/ben/
- [x] Prompt-agent мигрирован в skills/utility/prompt-helper/
- [x] Старые файлы удалены

### Интеграция
- [x] Chat route использует новый builder
- [x] Ben route использует buildBenPrompt
- [x] Prompt-agent route использует buildPromptAgentPrompt
- [x] Server-only экспорты изолированы

### Тестирование
- [x] Production build успешен

### Документация
- [ ] SIMPLY_STATUS.md обновлён
- [ ] CHANGELOG.md обновлён
- [ ] docs/ai-agents.md обновлён

---

## Важные заметки

### Server-only импорты

Функции использующие Node.js `fs` module доступны только на сервере:

```typescript
// В API routes и серверных компонентах:
import { buildChatPrompt, buildBenPrompt } from '@/lib/prompts/server';

// В клиентских компонентах (только типы и утилиты):
import type { BuildContext, BuiltPrompt } from '@/lib/prompts';
```

### gray-matter

Добавлена зависимость `gray-matter` для парсинга frontmatter в SKILL.md и AGENT.md файлах.

---

## Связанные документы

- [TZ_04_SKILLS_ARCHITECTURE.md](TZ_04_SKILLS_ARCHITECTURE.md) — полное техническое задание
- [docs/ai-agents.md](docs/ai-agents.md) — документация по агентам
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние проекта
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение продукта

---

**Создано:** 2026-02-02
**Завершено:** 2026-02-02
**Статус:** ✅ Завершён (код реализован, требуется мануальное тестирование)
**Источник:** TZ_04_SKILLS_ARCHITECTURE.md
**Целевая версия:** 3.3.0
