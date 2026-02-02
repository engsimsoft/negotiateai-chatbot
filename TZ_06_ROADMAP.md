# Дорожная карта: ТЗ-06 — Механизм активации Skills (loadSkill tool)

## Цель

Создать tool `loadSkill`, который модель вызывает самостоятельно для загрузки инструкций из SKILL.md файлов. Это решит проблему неработающих skills и обеспечит Progressive Disclosure.

**Детали:** См. [TZ_06_LOAD_SKILL_TOOL.md](TZ_06_LOAD_SKILL_TOOL.md)

## Текущий статус

- **Этап:** ТЗ-06 (loadSkill tool) — В РАБОТЕ
- **Прогресс:** 0/15 задач (0%)
- **Предыдущий:** ТЗ-05 — Базовые Skills (завершён)

---

## Этапы реализации

### 6.1 Создание loadSkill tool (3 задачи)

**Цель:** Создать tool который модель вызывает для загрузки инструкций.

- [ ] Добавить функцию `loadSkillContent()` в `lib/prompts/builder/skill-loader.ts`
- [ ] Создать файл `lib/ai/tools/load-skill.ts` с определением tool
- [ ] Реализовать `executeLoadSkill()` с использованием `wrapToolExecution`

**Файлы:**
- `lib/prompts/builder/skill-loader.ts` (модифицировать)
- `lib/ai/tools/load-skill.ts` (новый)

---

### 6.2 Регистрация tool (2 задачи)

**Цель:** Сделать tool доступным для модели.

- [ ] Добавить `loadSkill` в `experimental_activeTools` массив в `route.ts`
- [ ] Добавить `loadSkill` в объект `tools` в `route.ts`

**Файлы:**
- `app/(chat)/api/chat/route.ts` (модифицировать)

---

### 6.3 Обновление system prompt (2 задачи)

**Цель:** Модель должна знать когда и как использовать loadSkill.

- [ ] Добавить секцию про skills в `lib/prompts/core/base.md`
- [ ] Удалить костыль (строки 25-44) — хардкод правил создания документов

**Файлы:**
- `lib/prompts/core/base.md` (модифицировать)

---

### 6.4 Обновление descriptions в SKILL.md (3 задачи)

**Цель:** Унифицировать descriptions — короткое описание + когда загружать.

- [ ] Обновить `document/create-presentation/SKILL.md` — упростить description
- [ ] Обновить `document/create-spreadsheet/SKILL.md` — упростить description
- [ ] Обновить остальные skills (create-text-document, analyze-document, web-research)

**Паттерн description:**
```yaml
description: >
  Создание презентаций. Загрузи этот skill ПЕРЕД созданием слайдов.
```

**Файлы:**
- `lib/prompts/skills/document/*/SKILL.md`
- `lib/prompts/skills/research/*/SKILL.md`

---

### 6.5 Тестирование (3 задачи)

**Цель:** Убедиться что loadSkill работает корректно.

- [ ] Тест 1: Презентация — loadSkill вызывается, вопросы задаются
- [ ] Тест 2: Простой вопрос — loadSkill НЕ вызывается
- [ ] Тест 3: Таблица — loadSkill вызывается, вопросы задаются

**Сценарии из ТЗ:**

**Тест 1: Презентация**
```
Запрос: "Сделай презентацию про стартап"
Ожидание:
1. Модель вызывает loadSkill("document/create-presentation")
2. Задаёт вопросы (аудитория, слайды, формат)
3. Создаёт презентацию ПОСЛЕ ответов
```

**Тест 2: Простой вопрос**
```
Запрос: "Какая столица Франции?"
Ожидание: loadSkill НЕ вызывается, ответ сразу
```

**Тест 3: Таблица**
```
Запрос: "Сделай таблицу расходов"
Ожидание:
1. Модель вызывает loadSkill("document/create-spreadsheet")
2. Задаёт вопросы
3. Создаёт таблицу
```

---

### 6.6 Финализация (2 задачи)

**Цель:** Документация и коммит.

- [ ] Обновить документацию: SIMPLY_STATUS.md, CHANGELOG.md
- [ ] Коммит: "feat: loadSkill tool for dynamic skill loading — ТЗ-06"

---

## Ключевые файлы

**Новые:**
- `lib/ai/tools/load-skill.ts` — tool definition

**Модифицируемые:**
- `lib/prompts/builder/skill-loader.ts` — добавить `loadSkillContent()`
- `app/(chat)/api/chat/route.ts` — регистрация tool
- `lib/prompts/core/base.md` — секция про skills + удаление костыля
- `lib/prompts/skills/*/SKILL.md` — упростить descriptions

---

## Критерии готовности

- [ ] Tool `loadSkill` создан в `lib/ai/tools/load-skill.ts`
- [ ] Tool зарегистрирован в `route.ts`
- [ ] `base.md` содержит инструкции по использованию skills
- [ ] Костыль (строки 25-44) удалён из base.md
- [ ] 3 тестовых сценария пройдены
- [ ] Документация обновлена

---

## Оценка объёма

| Этап | Задач |
|------|-------|
| 6.1 Создание tool | 3 |
| 6.2 Регистрация | 2 |
| 6.3 System prompt | 2 |
| 6.4 SKILL.md descriptions | 3 |
| 6.5 Тестирование | 3 |
| 6.6 Финализация | 2 |
| **Итого** | **15** |

---

## Текущая сессия

**2026-02-03:**
- [x] Создана дорожная карта TZ_06_ROADMAP.md
- [ ] ...

---

## Связанные документы

- [TZ_06_LOAD_SKILL_TOOL.md](TZ_06_LOAD_SKILL_TOOL.md) — полное ТЗ
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние
- [_archive/TZ_05_ROADMAP.md](_archive/TZ_05_ROADMAP.md) — предыдущая дорожная карта

---

**Создано:** 2026-02-03
**Источник:** TZ_06_LOAD_SKILL_TOOL.md
