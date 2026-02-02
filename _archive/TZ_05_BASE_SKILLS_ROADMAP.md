# Дорожная карта: ТЗ-05 — Базовые Skills для Tools

## Цель

Создать skills, которые учат агентов правильно использовать существующие tools в Simply.

**Важно:** Skills в Simply — это НЕ Python код (как у Anthropic). Это инструкции для агентов: когда и как вызывать готовые tools.

**Детали:** См. [TZ_05_BASE_SKILLS.md](TZ_05_BASE_SKILLS.md)

## Текущий статус

- **Этап:** ТЗ-05 (Базовые Skills) — ✅ ЗАВЕРШЁН
- **Прогресс:** 24/30 задач (80%) — мануальное тестирование pending
- **Целевая версия:** 3.3.1
- **Предыдущий:** ТЗ-04 — Skills + Agents Architecture (завершён)

---

## Skills для создания

| Категория | Skill | Tools | Статус |
|-----------|-------|-------|--------|
| document/ | create-presentation | createDocument | ✅ |
| document/ | create-spreadsheet | createDocument | ✅ |
| document/ | create-text-document | createDocument | ✅ |
| document/ | analyze-document | readDocument, parseExcel | ✅ |
| research/ | web-research | webSearch | ✅ |
| utility/ | prompt-helper | — | ✅ Уже создан в ТЗ-04 |

---

## Этапы реализации

### 5.0 Пререквизиты — Валидация текущего состояния (5 задач)

**Цель:** Убедиться, что проект работает перед началом разработки.

- [x] Production build успешен (`npm run build`)
- [x] Приложение запускается локально (`npm run dev`)
- [x] Чат работает корректно
- [x] Skill `prompt-helper` загружается в registry
- [x] Ben отвечает корректно

---

### 5.1 Создание структуры папок (2 задачи)

**Цель:** Создать директории для новых skills.

- [x] Создать `lib/prompts/skills/document/` (категория)
- [x] Создать `lib/prompts/skills/research/` (категория)

---

### 5.2 Создание Skills — Document категория (4 задачи)

**Цель:** Создать skills для работы с документами.

- [x] Создать `lib/prompts/skills/document/create-presentation/SKILL.md`
- [x] Создать `lib/prompts/skills/document/create-spreadsheet/SKILL.md`
- [x] Создать `lib/prompts/skills/document/create-text-document/SKILL.md`
- [x] Создать `lib/prompts/skills/document/analyze-document/SKILL.md`

---

### 5.3 Создание Skills — Research категория (1 задача)

**Цель:** Создать skill для веб-поиска.

- [x] Создать `lib/prompts/skills/research/web-research/SKILL.md`

---

### 5.4 Интеграция с Builder (3 задачи)

**Цель:** Убедиться что новые skills корректно загружаются.

- [x] Проверить что `skill-loader.ts` загружает новые skills
- [x] Проверить что `registry.ts` находит все 6 skills
- [x] Проверить корректность metadata (name, description, tools)

---

### 5.5 Интеграция с Chat (2 задачи)

**Цель:** Подключить skills к промпту чата.

- [x] Обновить промпт чата — добавить список доступных skills
- [x] Проверить что skills отображаются в system prompt

---

### 5.6 Автоматическое тестирование (2 задачи)

**Цель:** Проверить что проект собирается без ошибок.

- [x] `npm run build` — production build успешен
- [x] `npm run dev` — локальный запуск без ошибок

---

### 5.7 Мануальное тестирование (6 задач)

**Цель:** Проверить работу каждого skill в реальных условиях.

#### Тест 1: Презентация
```
Запрос: "Сделай презентацию про наш стартап для инвесторов"

Ожидание:
1. Агент задаёт уточняющие вопросы (аудитория, количество слайдов)
2. Создаёт презентацию через createDocument
3. Структура соответствует рекомендациям skill
```
- [ ] Тест презентации пройден

#### Тест 2: Таблица Excel
```
Запрос: "Мне нужна таблица для учёта расходов на месяц"

Ожидание:
1. Агент уточняет категории расходов
2. Создаёт Excel через createDocument
3. Есть формулы для итогов
```
- [ ] Тест таблицы пройден

#### Тест 3: Текстовый документ
```
Запрос: "Напиши письмо клиенту с извинениями за задержку"

Ожидание:
1. Агент может уточнить детали (имя, причина задержки)
2. Создаёт документ через createDocument
3. Структура делового письма
```
- [ ] Тест текстового документа пройден

#### Тест 4: Анализ файла
```
Запрос: [загрузить Excel] "Проанализируй эту таблицу"

Ожидание:
1. Агент вызывает parseExcel
2. Даёт краткое резюме данных
3. Предлагает что можно посмотреть детальнее
```
- [ ] Тест анализа файла пройден

#### Тест 5: Веб-поиск
```
Запрос: "Найди актуальные цены на iPhone 15"

Ожидание:
1. Агент делает webSearch
2. Возвращает результаты с источниками
```
- [ ] Тест веб-поиска пройден

#### Тест 6: Помощь с промптом
```
Запрос: "Не могу объяснить что мне нужно"

Ожидание:
1. Агент задаёт уточняющие вопросы
2. Предлагает улучшенную формулировку
3. Объясняет почему так лучше
```
- [ ] Тест помощи с промптом пройден (уже работает из ТЗ-04)

---

### 5.8 Документация (3 задачи)

**Цель:** Обновить документацию проекта.

- [x] Обновить `SIMPLY_STATUS.md` — версия 3.3.1, добавлены базовые skills
- [x] Обновить `CHANGELOG.md` — v3.3.1
- [x] Обновить `docs/ai-agents.md` — описание новых skills

---

### 5.9 Финализация (2 задачи)

**Цель:** Завершить этап и зафиксировать изменения.

- [x] Переместить `TZ_05_BASE_SKILLS.md` в `_archive/`
- [x] Переместить `TZ_05_BASE_SKILLS_ROADMAP.md` в `_archive/`

---

### 5.10 Git (2 задачи)

**Цель:** Зафиксировать изменения в репозитории.

- [x] Git add все изменённые файлы
- [x] Git commit с сообщением: `feat(skills): Add base skills for tools (v3.3.1)`

---

## Ключевые файлы

### Новые файлы:

```
lib/prompts/skills/
├── document/
│   ├── create-presentation/
│   │   └── SKILL.md
│   ├── create-spreadsheet/
│   │   └── SKILL.md
│   ├── create-text-document/
│   │   └── SKILL.md
│   └── analyze-document/
│       └── SKILL.md
│
└── research/
    └── web-research/
        └── SKILL.md
```

### Модифицированные файлы:

| Файл | Изменение |
|------|-----------|
| `SIMPLY_STATUS.md` | Обновление версии и статуса |
| `CHANGELOG.md` | Добавление записи v3.3.1 |
| `docs/ai-agents.md` | Описание новых skills |

---

## Критерии готовности (Definition of Done)

### Структура
- [x] Все 5 новых SKILL.md файлов созданы
- [x] Формат YAML frontmatter корректен (name, description, tools)
- [x] Содержимое соответствует ТЗ-05

### Интеграция
- [x] Skills загружаются в registry без ошибок
- [x] Metadata корректно парсится
- [x] Skills доступны в промпте чата

### Тестирование
- [x] Production build успешен
- [ ] Все 6 мануальных тестов пройдены

### Документация
- [x] SIMPLY_STATUS.md обновлён
- [x] CHANGELOG.md обновлён
- [x] docs/ai-agents.md обновлён

### Git
- [x] Изменения закоммичены
- [x] Файлы ТЗ перенесены в архив

---

## Важные заметки

### Формат SKILL.md

```yaml
---
name: skill-name
description: >
  Описание skill. Когда использовать, для чего предназначен.
  Это описание используется для routing (выбора skill по запросу).
tools:
  - toolName1
  - toolName2
---

# Содержимое skill

## Когда использовать
...

## Процесс работы
...
```

### Существующие Tools

| Tool | Файл |
|------|------|
| `getCurrentDate` | `lib/ai/tools/get-current-date.ts` |
| `getWeather` | `lib/ai/tools/get-weather.ts` |
| `webSearch` | `lib/ai/tools/web-search.ts` |
| `createDocument` | `lib/ai/tools/create-document.ts` |
| `updateDocument` | `lib/ai/tools/update-document.ts` |
| `readDocument` | `lib/ai/tools/read-document.ts` |
| `parseExcel` | `lib/ai/tools/excel/parse-excel.ts` |
| `requestSuggestions` | `lib/ai/tools/request-suggestions.ts` |

---

## Связанные документы

- [TZ_05_BASE_SKILLS.md](_archive/TZ_05_BASE_SKILLS.md) — полное техническое задание
- [docs/ai-agents.md](docs/ai-agents.md) — документация по агентам и skills
- [SIMPLY_STATUS.md](SIMPLY_STATUS.md) — текущее состояние проекта
- [SIMPLY_PRODUCT_VISION.md](SIMPLY_PRODUCT_VISION.md) — видение продукта

---

**Создано:** 2026-02-02
**Завершено:** 2026-02-02
**Статус:** ✅ Завершён (код реализован, требуется мануальное тестирование)
**Источник:** TZ_05_BASE_SKILLS.md
**Целевая версия:** 3.3.1
