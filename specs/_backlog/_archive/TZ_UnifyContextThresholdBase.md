# ТЗ-UnifyContextThresholdBase — унифицировать базу расчёта процентных порогов контекста

**Статус:** Архитектурный долг, Medium impact (семантическая несогласованность SSOT)
**Создано:** 2026-04-18 (в процессе Фазы 1 ТЗ-COMPACTION-1, архитектурное замечание)
**Источник:** Архитектор при проектировании Compaction-1 увидел что MIND и Compaction используют разные базы для `%` порогов
**Связано с:** [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts) (`CONTEXT_BUDGET`, `SIMPLY_CONTEXT_LIMIT`, `EXTRACT_THRESHOLD_*`), [SIMPLY_COMPACTION_ARCHITECTURE.md](../Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md), [MIND_ARCHITECTURE.md](../Simply_xAI/MIND_ARCHITECTURE.md)

---

## Симптом

Два механизма управления контекстом используют **разные знаменатели** для расчёта `%` триггеров, при этом имена констант не раскрывают это различие:

| Механизм | Константа триггера | База расчёта (знаменатель) | Абсолютное значение |
|---|---|---|---|
| MIND Extract Soft | `EXTRACT_THRESHOLD_SOFT = 0.6` | `CONTEXT_BUDGET = 140K` | 84K токенов |
| MIND Extract Hard | `EXTRACT_THRESHOLD_HARD = 0.8` | `CONTEXT_BUDGET = 140K` | 112K токенов |
| Compaction Soft (после COMPACTION-1) | `COMPACTION_THRESHOLD_SOFT = 0.5` | `SIMPLY_CONTEXT_LIMIT = 200K` | 100K токенов |
| Compaction Hard (после COMPACTION-1) | `COMPACTION_THRESHOLD_HARD = 0.85` | `SIMPLY_CONTEXT_LIMIT = 200K` | 170K токенов |

Разработчик читает `EXTRACT_THRESHOLD_SOFT = 0.6` и думает «60% от бюджета». Фактически срабатывает на 42% от `SIMPLY_CONTEXT_LIMIT`. Это источник ошибок при дебаге и при добавлении новых порогов.

---

## Root cause

**Моя архитектурная ошибка** (архитектор, предыдущие сессии серии xAI): при проектировании MIND extract thresholds не была выбрана единая база расчёта. `CONTEXT_BUDGET` (sliding window cap = сколько истории реально отправляем в модель) и `SIMPLY_CONTEXT_LIMIT` (бюджет качества = зона где модель думает хорошо) смешаны в одной системе координат.

Правильная архитектурная позиция (зафиксирована в Compaction-1 обоснованием из Anthropic research + NVIDIA RULER):

- **`SIMPLY_CONTEXT_LIMIT`** = бюджет качества = база для всех `%` триггеров управления контекстом
- **`CONTEXT_BUDGET`** = техническая деталь sliding window, cap на фактическую отправку в модель = не должна быть знаменателем `%` расчётов

**Не блокер для production:** MIND работает корректно на текущих значениях, production behavior устоявшееся. Долг чисто семантический — имена констант не соответствуют своему реальному действию.

---

## Решение (рекомендованное)

**Перевести все MIND пороги на базу `SIMPLY_CONTEXT_LIMIT = 200K` с сохранением production behavior:**

| Константа | Было | Станет | Проверка behavior |
|---|---|---|---|
| `EXTRACT_THRESHOLD_SOFT` | `0.6` от `CONTEXT_BUDGET` (140K) = 84K | `0.42` от `SIMPLY_CONTEXT_LIMIT` (200K) = 84K | ✅ identical |
| `EXTRACT_THRESHOLD_HARD` | `0.8` от `CONTEXT_BUDGET` (140K) = 112K | `0.56` от `SIMPLY_CONTEXT_LIMIT` (200K) = 112K | ✅ identical |

**Переименование для семантической ясности (опционально):**

- `EXTRACT_THRESHOLD_SOFT` → `EXTRACT_THRESHOLD_SOFT` (оставить — это и есть MIND-специфичный триггер, можно не трогать)
- Либо: `EXTRACT_THRESHOLD_SOFT` → `MIND_EXTRACT_THRESHOLD_SOFT` для полной ясности (добавить префикс `MIND_` всем константам MIND)

**Код-сайты которые используют эти константы** (ANALYSIS при подъёме ТЗ должен проверить весь grep):
- [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts) — определения
- Все места где `EXTRACT_THRESHOLD_SOFT` / `EXTRACT_THRESHOLD_HARD` используются с `CONTEXT_BUDGET` в одном выражении — проверить что формула пересчёта (`usage / SIMPLY_CONTEXT_LIMIT >= threshold`) даёт тот же результат

**Production behavior НЕ меняется.** Это чистый рефакторинг baseline расчёта — не меняет когда триггерится MIND, только приводит формулу к единой базе.

---

## Альтернативы (рассмотрены, отклонены)

1. **Оставить как есть, добавить комментарий в code** — не решает проблему. Разработчик всё равно прочитает имя константы и сделает неверное предположение. Комментарий не защищает от ошибки при копировании паттерна на новый механизм.
2. **Унифицировать в обратную сторону (Compaction → `CONTEXT_BUDGET`)** — неверно архитектурно. `CONTEXT_BUDGET` это технический cap sliding window, не бюджет качества. Перевод Compaction на `CONTEXT_BUDGET` сделает триггер зависимым от технической детали реализации.
3. **Сделать это частью COMPACTION-1** — расширяет scope MVP, смешивает «добавление нового механизма» с «рефакторинг существующего». Одно ТЗ = один concern.

---

## Acceptance criteria

- [ ] `EXTRACT_THRESHOLD_SOFT` и `EXTRACT_THRESHOLD_HARD` в [lib/ai/context-limits.ts](../../lib/ai/context-limits.ts) пересчитаны на базу `SIMPLY_CONTEXT_LIMIT` с сохранением абсолютных значений (84K и 112K соответственно)
- [ ] Комментарии рядом с каждой константой явно указывают: «% от `SIMPLY_CONTEXT_LIMIT`, абсолютно = XX токенов»
- [ ] Все call sites проверены grep-ом: формула `usage/base >= threshold` использует `SIMPLY_CONTEXT_LIMIT` как `base`, не `CONTEXT_BUDGET`
- [ ] Smoke test: логи MIND extract в обычной Simply Chat сессии при заполнении до 84K токенов — триггер срабатывает как раньше
- [ ] SQL-верификация: `SELECT ... FROM ai_usage_log WHERE "chatMode" = 'simply' AND taskId LIKE 'memory:extract%'` показывает тот же паттерн срабатываний что до изменения
- [ ] `MIND_ARCHITECTURE.md` таблица § 5 обновлена с новыми значениями порогов и базой
- [ ] CHANGELOG-запись + ссылка на этот ТЗ

---

## НЕ в scope

- Изменение production behavior MIND (какие message windows извлекаются, как часто, на какую модель идут)
- Изменение порогов Compaction (зафиксированы в Compaction-1 и не пересматриваются)
- Рефакторинг других констант в `context-limits.ts` (`SNAPSHOT_THRESHOLD`, пороги dedup и т.д.)

---

## Оценка

**0.5 сессии:**
- Правка 2 констант + комментарии (15 минут)
- Grep всех call sites + проверка формул (30 минут)
- Smoke test владельцем (15 минут)
- SQL-верификация + обновление MIND_ARCHITECTURE.md + коммит + CHANGELOG (30 минут)
