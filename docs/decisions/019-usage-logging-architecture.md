# ADR 019: Архитектура Usage Logging — fire-and-forget + numeric precision

**Дата:** 2026-02-25
**Статус:** Принято

---

## Контекст

Simply использует несколько AI-моделей (Sonnet, Haiku, Opus) через 3+ эндпоинта (основной чат, task-expert, professor-pipeline). До v3.46.0 не было единой системы учёта потребления:

- Нет данных о стоимости запросов per-user
- Нет данных о распределении по моделям и режимам
- Невозможно построить биллинг (pay-as-you-go) — это следующий этап в roadmap
- TokenLens считает стоимость на лету, но данные не сохраняются

**Требования:**
- Логировать каждый AI-запрос с токенами, стоимостью, моделью, режимом
- Никогда не замедлять стриминг ответов
- Поддержка агрегации для будущего биллинга и аналитики
- Расширяемость: новые точки логирования (briefing, clerks) без chatId

---

## Решение

Создана таблица `ai_usage_log` и функция `saveAiUsageLog()` с паттерном fire-and-forget. Интегрировано в 3 эндпоинта (фаза 1).

### Схема таблицы

```sql
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatId UUID REFERENCES "Chat"(id),       -- nullable (для будущих точек без chatId)
  userId UUID NOT NULL REFERENCES "User"(id),
  modelId VARCHAR(100) NOT NULL,            -- реальный model ID (claude-sonnet-4-6)
  inputTokens INTEGER NOT NULL DEFAULT 0,
  outputTokens INTEGER NOT NULL DEFAULT 0,
  thinkingTokens INTEGER NOT NULL DEFAULT 0,
  cacheWriteTokens INTEGER NOT NULL DEFAULT 0,
  cacheReadTokens INTEGER NOT NULL DEFAULT 0,
  costUsd NUMERIC(10,6),                    -- точность для агрегации
  chatMode VARCHAR(50) NOT NULL,            -- expertise, create, chat, project:expert, etc.
  durationMs INTEGER,                       -- TTFT to completion
  createdAt TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX ai_usage_log_user_created_idx ON ai_usage_log (userId, createdAt);
CREATE INDEX ai_usage_log_chatmode_created_idx ON ai_usage_log (chatMode, createdAt);
```

### Паттерн записи

```typescript
// Fire-and-forget: никогда не бросает, не блокирует стриминг
saveAiUsageLog({
  chatId, userId, modelId,
  inputTokens: usage.inputTokens ?? 0,
  outputTokens: usage.outputTokens ?? 0,
  costUsd, chatMode, durationMs,
}).catch(() => {});
```

### Точки интеграции (фаза 1)

| Эндпоинт | Когда | modelId | costUsd |
|----------|-------|---------|---------|
| `chat/route.ts` | `onFinish` | из TokenLens или tier alias | TokenLens `costUSD.totalUSD` |
| `task-chat/route.ts` | `onFinish` | `myProvider.languageModel(alias).modelId` | `null` (нет TokenLens) |
| `professor-pipeline.ts` | после каждой из 3 фаз | `model.modelId` | `null` |

---

## Причины

1. **`numeric(10,6)` вместо `real`** — при агрегации тысяч записей floating-point ошибки накапливаются. `numeric` даёт точные суммы для биллинга: `SUM(costUsd)` = точное значение
2. **`chatId` nullable** — briefing, clerks, background jobs не привязаны к чату. Nullable FK позволяет логировать без chatId сейчас и в будущем
3. **Fire-and-forget** — `.catch(() => {})` гарантирует что сбой записи не ломает стриминг. Потеря одной записи лога < задержка/ошибка для пользователя
4. **5 token counters** — AI SDK v5 возвращает раздельно: input, output, thinking (extended thinking), cache write, cache read. Хранение раздельно позволяет точный расчёт стоимости (разная цена за тип)
5. **Два индекса** — `(userId, createdAt)` для per-user аналитики, `(chatMode, createdAt)` для агрегации по режимам

---

## Последствия

### Плюсы

- Полная картина потребления per-user, per-model, per-mode
- Фундамент для биллинга pay-as-you-go (следующий этап)
- Аналитика: какие модели используются чаще, средняя стоимость запроса
- Точные суммы благодаря `numeric(10,6)`
- Нулевое влияние на latency стриминга

### Минусы

- Рост БД: ~200 байт на запись × N запросов в день
- `costUsd = null` в task-chat (нет TokenLens) — неполные данные
- Professor-pipeline логирует 3-8 записей на один пользовательский запрос (inflate count)

### Миграции

- Фаза 2 (будущее): расширить на briefing, clerks, service-chats
- Фаза 3 (будущее): dashboard аналитики + API для биллинга
- Может потребоваться партиционирование по `createdAt` при больших объёмах

---

## Альтернативы

### Альтернатива 1: Логирование в отдельный сервис (Mixpanel, Amplitude)

**Что это:** Отправка usage events во внешний analytics сервис

**Почему отклонили:**
- Дополнительная зависимость и стоимость
- Данные вне контроля (compliance)
- Сложнее интегрировать с внутренним биллингом

**Когда может быть лучше:** При масштабе 1M+ запросов/день

### Альтернатива 2: `real` вместо `numeric` для costUsd

**Что это:** IEEE 754 float вместо fixed-point decimal

**Почему отклонили:** Ошибки при `SUM()` агрегации. Пример: `0.1 + 0.2 ≠ 0.3` в float. Для биллинга это неприемлемо

**Когда может быть лучше:** Если данные только для визуализации, не для финансовых расчётов

### Альтернатива 3: JSON-лог вместо отдельной таблицы

**Что это:** Хранить usage как JSONB поле в существующей таблице Message или Chat

**Почему отклонили:**
- Сложнее агрегировать (нужен JSONB extraction)
- Привязка к Chat/Message — не все точки имеют chatId
- Отдельная таблица = чистые индексы и простые запросы

---

## Связанные решения

- **ADR 007** — Projects + Claude Integration (модели в проектах)
- **ADR 015** — Neon Serverless Driver (БД)
- **ТЗ-OPT1** — [specs/TZ_OPT1_UsageAndMigration/](../../specs/TZ_OPT1_UsageAndMigration/)

---

## История изменений

- **2026-02-25** — Документ создан (v3.46.0, фаза 1)
