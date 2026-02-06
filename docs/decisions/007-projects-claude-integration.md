# ADR 007: Проекты + Claude Integration (v3.2.0)

**Дата:** 2026-02-02
**Статус:** ⏸️ Приостановлен (см. [ADR 011](011-temporary-gemini-for-projects.md))

---

## Контекст

После упрощения архитектуры промптов (ADR 006) нужно было добавить:
- Изолированные рабочие пространства для сложных задач
- Мультипровайдер AI (не только Gemini)
- Продвинутый reasoning для экспертных задач

**Требования бизнеса:**
- Пользователи хотят работать над проектами изолированно
- Некоторые задачи требуют моделей уровня Claude Opus
- Gemini отлично для общего чата, но Claude лучше для глубокого анализа

---

## Решение

Добавить концепцию "Проектов" с интеграцией Claude (Anthropic) через OpenRouter.

### Архитектура

```
Пользователь
    │
    ├── Dashboard (/dashboard)
    │       ↓
    ├── Обычный чат (/chat) ─────────────► Gemini 3 Pro / 2.5 Flash
    │
    └── Проекты (/projects)
            │
            ├── Исполнитель (⚡) ──────────► Claude Haiku
            ├── Эксперт (🎯) ─────────────► Claude Sonnet (default)
            └── Профессор (🎓) ───────────► Claude Opus + Pipeline
```

### Режим Профессор (Pipeline)

Для сложных задач — многоэтапный reasoning:

```
Запрос пользователя
        ↓
   ┌─────────────────┐
   │ 1. АНАЛИЗ       │ ← Opus анализирует, создаёт подзадачи
   │    (Opus)       │
   └─────────────────┘
           ↓
   ┌─────────────────┐
   │ 2. ИСПОЛНЕНИЕ   │ ← Haiku выполняет подзадачи параллельно
   │    (Haiku ×N)   │
   └─────────────────┘
           ↓
   ┌─────────────────┐
   │ 3. СИНТЕЗ       │ ← Opus объединяет результаты
   │    (Opus)       │
   └─────────────────┘
           ↓
     Финальный ответ
```

### Схема БД

```sql
-- Новая таблица
CREATE TABLE Project (
  id UUID PRIMARY KEY,
  userId UUID REFERENCES User(id),
  name VARCHAR(255),
  description TEXT,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- Изменение в Chat
ALTER TABLE Chat ADD COLUMN projectId UUID REFERENCES Project(id);
```

---

## Причины выбора

### Почему Claude, а не GPT?

| Критерий | Claude | GPT-4 |
|----------|--------|-------|
| Качество reasoning | ✅ Отличное | ✅ Хорошее |
| Русский язык | ✅ Хороший | ⚠️ Средний |
| Стоимость через OpenRouter | ✅ Ниже | ⚠️ Выше |
| Совместимость с AI SDK | ✅ @ai-sdk/anthropic | ✅ @ai-sdk/openai |
| Extended thinking | ✅ Есть | ❌ Нет |

### Почему три уровня моделей?

1. **Исполнитель (Haiku)** — быстрые простые задачи, экономия
2. **Эксперт (Sonnet)** — баланс качества и стоимости (default)
3. **Профессор (Opus)** — максимум для сложного анализа

### Почему Pipeline для Профессора?

- Opus дорогой ($15/1M input tokens)
- Pipeline: Opus анализирует → Haiku выполняет → Opus синтезирует
- Результат: качество Opus по цене Sonnet
- UI показывает прогресс — пользователь видит работу

---

## Последствия

**Плюсы:**
- Изолированные проекты для сложных задач
- Выбор модели под задачу
- Pipeline оптимизирует cost/quality
- Готовность к мультипровайдеру (GPT next)

**Минусы:**
- Зависимость от OpenRouter (intermediary)
- Сложность pipeline (три модели)
- Новая таблица в БД

---

## Альтернативы

### 1. Только Claude везде
- Заменить Gemini на Claude в основном чате

**Отклонено:** Gemini бесплатнее, лучше для общего чата. Claude — для проектов.

### 2. Прямой API Anthropic
- Без OpenRouter

**Отклонено:** OpenRouter даёт единый интерфейс для всех провайдеров.

### 3. Без Pipeline
- Opus напрямую, без разбиения на этапы

**Отклонено:** Слишком дорого, нет visibility прогресса.

---

## Реализация

**ТЗ:** TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md (в _archive/)

**Ключевые файлы:**
- `lib/ai/model-tiers.ts` — конфиг уровней
- `lib/ai/professor-pipeline.ts` — pipeline логика
- `app/(chat)/projects/` — UI проектов
- `components/projects/professor-progress.tsx` — UI прогресса

**Версия:** 3.2.0

---

## Связанные документы

- [ADR 006](006-prompt-architecture.md) — предыдущая архитектура
- [CHANGELOG.md](../../CHANGELOG.md) — версия 3.2.0
- [_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md](../../_archive/TZ_03_PROJECTS_ANTHROPIC_PROFESSOR.md)

---

---

## История изменений

- **2026-02-02** — Документ создан
- **2026-02-05** — Статус изменён на "Приостановлен" (временный переход на Gemini, см. [ADR 011](011-temporary-gemini-for-projects.md))
