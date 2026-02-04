# ТЗ-06: Механизм активации Skills (loadSkill tool)

**Версия:** 1.0  
**Дата:** 2026-02-03  
**Приоритет:** 🔴 Высокий  
**Зависит от:** ТЗ-04 (архитектура), ТЗ-05 (базовые skills)  
**Статус:** Готово к разработке

---

## Проблема

Skills созданы, но не работают. Причина:

```
Текущий flow:
Запрос → промпт с metadata skills → модель отвечает
                ↑
        Только name + description
        Полные инструкции НЕ загружаются
```

Модель видит только краткое описание skill, но не получает инструкции как работать.

---

## Решение

Создать tool `loadSkill`, который модель вызывает сама когда нужны инструкции.

```
Новый flow:
Запрос → промпт с metadata skills → модель понимает что нужен skill
    → вызывает loadSkill("create-presentation")
    → получает полные инструкции
    → следует инструкциям
    → создаёт результат
```

**Это подход Anthropic.** Они используют `view` tool для загрузки SKILL.md.

---

## Почему tool, а не автоматическая загрузка

| Подход | Проблема |
|--------|----------|
| Загружать все skills | Промпт 10,000+ токенов, дорого |
| Keyword classifier | Хрупкий, не понимает контекст |
| LLM classifier | +1 API вызов, задержка, деньги |
| **Tool (модель решает)** | Модель сама знает когда нужна помощь |

---

## Спецификация tool

### Файл: `lib/ai/tools/load-skill.ts`

```typescript
export const loadSkillTool = {
  name: 'loadSkill',
  description: `Загружает инструкции для выполнения сложной задачи.
    
КОГДА ИСПОЛЬЗОВАТЬ:
- Перед созданием презентации → loadSkill("document/create-presentation")
- Перед созданием таблицы → loadSkill("document/create-spreadsheet")  
- Перед созданием документа → loadSkill("document/create-text-document")
- Перед анализом файла → loadSkill("document/analyze-document")
- Перед поиском информации → loadSkill("research/web-research")
- Когда пользователь не знает как спросить → loadSkill("utility/prompt-helper")

ПРАВИЛО: Для сложных задач СНАЧАЛА загрузи инструкции, ПОТОМ выполняй.`,

  parameters: {
    type: 'object',
    properties: {
      skillId: {
        type: 'string',
        description: 'ID skill в формате "категория/название"',
        enum: [
          'document/create-presentation',
          'document/create-spreadsheet',
          'document/create-text-document',
          'document/analyze-document',
          'research/web-research',
          'utility/prompt-helper'
        ]
      }
    },
    required: ['skillId']
  }
}
```

### Реализация

```typescript
import { loadSkillContent } from '@/lib/prompts/builder/skill-loader'

export async function executeLoadSkill({ skillId }: { skillId: string }) {
  const content = await loadSkillContent(skillId)
  
  if (!content) {
    return {
      success: false,
      error: `Skill "${skillId}" не найден`
    }
  }
  
  return {
    success: true,
    instructions: content
  }
}
```

---

## Изменения в skill-loader.ts

### Добавить функцию loadSkillContent

```typescript
export async function loadSkillContent(skillId: string): Promise<string | null> {
  // skillId формат: "document/create-presentation"
  const skillPath = path.join(
    process.cwd(),
    'lib/prompts/skills',
    skillId,
    'SKILL.md'
  )
  
  try {
    const content = await fs.readFile(skillPath, 'utf-8')
    // Убираем frontmatter, возвращаем только контент
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '')
    return contentWithoutFrontmatter
  } catch {
    return null
  }
}
```

---

## Изменения в system prompt

### В core/base.md добавить секцию:

```markdown
## Инструкции для сложных задач (Skills)

У тебя есть доступ к детальным инструкциям для выполнения сложных задач.

**Доступные инструкции:**
{{skills_metadata}}

**Правило использования:**

Для ПРОСТЫХ задач (перевод, ответ на вопрос, короткий текст) — отвечай сразу.

Для СЛОЖНЫХ задач (презентация, таблица, анализ данных, исследование):
1. СНАЧАЛА вызови loadSkill с нужным ID
2. Прочитай полученные инструкции
3. Следуй инструкциям (особенно про вопросы пользователю)
4. Выполни задачу

❌ НЕПРАВИЛЬНО: Пользователь просит презентацию → сразу создаёшь
✅ ПРАВИЛЬНО: Пользователь просит презентацию → loadSkill → читаешь инструкции → задаёшь вопросы → создаёшь
```

---

## Формат skills_metadata

В промпт подставляется список доступных skills:

```markdown
**Доступные инструкции:**

- `document/create-presentation` — Создание презентаций. Загрузи перед созданием слайдов.
- `document/create-spreadsheet` — Создание таблиц Excel. Загрузи перед созданием таблиц.
- `document/create-text-document` — Создание документов. Загрузи перед созданием отчётов, писем.
- `document/analyze-document` — Анализ файлов. Загрузи когда пользователь загрузил файл.
- `research/web-research` — Поиск информации. Загрузи для сложного исследования.
- `utility/prompt-helper` — Помощь с запросами. Загрузи когда пользователь не может сформулировать.
```

---

## Обновление description в SKILL.md

Description больше не нужно перегружать инструкциями. Краткое описание + когда загружать:

### Пример: create-presentation/SKILL.md

```yaml
---
name: create-presentation
description: >
  Создание презентаций и слайдов. Загрузи этот skill ПЕРЕД созданием 
  любой презентации, питча или слайдов.
tools:
  - createDocument
---
```

---

## Регистрация tool

### В lib/ai/tools/index.ts

```typescript
import { loadSkillTool, executeLoadSkill } from './load-skill'

export const allTools = {
  // ... существующие tools
  loadSkill: loadSkillTool
}

export const toolExecutors = {
  // ... существующие executors
  loadSkill: executeLoadSkill
}
```

### В route.ts

Добавить loadSkill в список доступных tools:

```typescript
const tools = {
  getCurrentDate,
  getWeather,
  webSearch,
  createDocument,
  updateDocument,
  readDocument,
  parseExcel,
  requestSuggestions,
  loadSkill  // ← добавить
}
```

---

## Порядок реализации

### Фаза 1: Создание tool
1. Создать файл `lib/ai/tools/load-skill.ts`
2. Реализовать `loadSkillTool` и `executeLoadSkill`
3. Добавить `loadSkillContent` в `skill-loader.ts`

### Фаза 2: Интеграция
4. Зарегистрировать tool в `lib/ai/tools/index.ts`
5. Добавить tool в route.ts
6. Обновить `core/base.md` — добавить секцию про skills

### Фаза 3: Обновление skills
7. Упростить description во всех SKILL.md (убрать инструкции, оставить когда загружать)

### Фаза 4: Тестирование
8. Прогнать тестовые сценарии

---

## Тестовые сценарии

### Тест 1: Презентация
```
Пользователь: "Сделай презентацию про наш стартап для инвесторов"

Ожидаемый flow:
1. Модель вызывает loadSkill("document/create-presentation")
2. Получает инструкции
3. Задаёт вопросы (аудитория, количество слайдов, формат)
4. После ответов — создаёт презентацию

Проверить:
- [ ] loadSkill вызван
- [ ] Вопросы заданы ПЕРЕД созданием
- [ ] Презентация создана ПОСЛЕ ответов
```

### Тест 2: Простой вопрос (skill НЕ нужен)
```
Пользователь: "Какая погода в Москве?"

Ожидаемый flow:
1. Модель НЕ вызывает loadSkill
2. Сразу отвечает (или вызывает getWeather)

Проверить:
- [ ] loadSkill НЕ вызван
- [ ] Ответ получен быстро
```

### Тест 3: Таблица
```
Пользователь: "Сделай таблицу расходов на месяц"

Ожидаемый flow:
1. Модель вызывает loadSkill("document/create-spreadsheet")
2. Задаёт вопросы (какие категории, нужны ли формулы)
3. Создаёт таблицу

Проверить:
- [ ] loadSkill вызван
- [ ] Вопросы заданы
- [ ] Таблица соответствует ответам
```

### Тест 4: Анализ файла
```
Пользователь: [загружает Excel] "Проанализируй"

Ожидаемый flow:
1. Модель вызывает loadSkill("document/analyze-document")
2. Вызывает parseExcel
3. Даёт структурированный анализ

Проверить:
- [ ] loadSkill вызван
- [ ] parseExcel вызван
- [ ] Анализ структурирован по инструкциям skill
```

### Тест 5: Цепочка (презентация без skill)
```
Пользователь: "Привет"
Модель: "Привет! Чем могу помочь?"
Пользователь: "Нужна презентация"

Ожидание:
- На "Привет" — loadSkill НЕ вызывается
- На "Нужна презентация" — loadSkill ВЫЗЫВАЕТСЯ
```

---

## Критерии готовности

- [ ] Tool `loadSkill` создан и работает
- [ ] Tool зарегистрирован и доступен модели
- [ ] `core/base.md` содержит инструкции по использованию skills
- [ ] Все 5 тестов пройдены
- [ ] Вариант A (костыль в base.md) удалён
- [ ] SIMPLY_STATUS.md обновлён

---

## Что удалить

После внедрения удалить костыль из `core/base.md`, который добавил Claude Code (Вариант A).

Skills должны загружаться ТОЛЬКО через loadSkill tool, а не дублироваться в base.md.

---

## Преимущества этого подхода

| Критерий | Результат |
|----------|-----------|
| **Масштабируемость** | Добавляешь skill — он сразу доступен |
| **Экономия токенов** | Загружается только нужный skill |
| **Нет дублирования** | Инструкции в одном месте (SKILL.md) |
| **Модель решает** | Не нужен отдельный classifier |
| **Проверенный подход** | Так делает Anthropic |

---

**Создано:** 2026-02-03  
**Автор:** Claude (Opus 4.5)  
**Для:** Claude Code  
**Статус:** Готово к реализации
