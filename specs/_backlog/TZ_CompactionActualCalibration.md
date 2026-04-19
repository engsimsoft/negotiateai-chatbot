# ТЗ-CompactionActualCalibration — пост-фактум калибровка формулы compaction по `ai_usage_log`

**Статус:** Хвост, Low impact (sanity-check, не блокер production)
**Создано:** 2026-04-19 (ТЗ-COMPACTION-1 Этап A6, архитекторское решение по Проблеме #2)
**Источник:** `specs/_archive/TZ_COMPACTION_1/FINDINGS.md` (после архивации) + лог решения архитектора в HANDOFF
**Связано с:** [lib/utils.ts](../../lib/utils.ts) (`estimateMessageTokens`), [lib/ai/compaction/prepare-messages.ts](../../lib/ai/compaction/prepare-messages.ts), [lib/ai/tools/chat-tools.ts](../../lib/ai/tools/chat-tools.ts) (`computeToolsTokens`)

---

## Контекст

В ТЗ-COMPACTION-1 формула `totalContext = system + history + new + mind + tools` доведена до ~10-15% точности относительно реального input провайдера через:

1. SSOT-правка в `estimateMessageTokens` — учёт tool-call/tool-result parts (раньше игнорировались)
2. Явный подсчёт `toolsTokens` через `computeToolsTokens` (Zod inputSchema → JSON через `zod-to-json-schema`)

Архитектор оценил accuracy ±10-15% как **приемлемую для threshold-решений** (porog 50%/85% грубый по своей природе).

## Что предлагается

После ~1 недели MVP в production собрать статистику фактического расхождения между нашим `estimate` и `actual.inputTokens` от провайдера через `ai_usage_log`. Если среднее отклонение стабильно **>15%** — пересчитать коэффициенты в `estimateTokenCount` (русский 1.7/2.0, английский 1.3) или подменить формулу на более точный tokenizer.

## Концептуальная схема

`ai_usage_log` уже содержит `usage` JSON с фактическими токенами от провайдера (`promptTokens`, `cacheReadTokens`). Наш `estimate` на момент решения «сжимать или нет» доступен через [Compaction] structured log в Vercel log drain (поле `total`).

Объединение через `chatId + timestamp` даёт пары `(estimate, actual)` за turn.

## SQL-запрос для анализа (заготовка)

```sql
-- Таблица: ai_usage_log (поля: chatId, taskId, modelId, usage::jsonb, createdAt)
-- Поле usage.promptTokens — это actual input от провайдера на этом turn
SELECT
  date_trunc('day', "createdAt") AS day,
  "modelId",
  COUNT(*) AS turns,
  AVG((usage->>'promptTokens')::int) AS avg_actual_prompt,
  -- estimate надо забирать из Vercel log drain через external join (Datadog/Sentry)
  -- или временно эмитить на сервере в ai_usage_log в виде поля `meta.estimate`
  AVG(((usage->>'promptTokens')::int)::float / NULLIF(/* estimate */ 1, 0)) AS actual_to_estimate_ratio
FROM ai_usage_log
WHERE
  "chatMode" IN ('expertise', 'create')  -- compaction-active modes
  AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

**Ожидание:** `actual_to_estimate_ratio` ≈ 1.0 ± 0.15. Если стабильно >1.2 — формула занижает, надо чинить.

## Решение (рекомендованное направление)

При подтверждённом отклонении >15%:

1. **Калибровка коэффициентов `estimateTokenCount`** — измерить фактическое слов→токены соотношение для русского/английского на реальном корпусе сообщений за неделю production. Заменить magic numbers (1.7/2.0/1.3) на эмпирически-подобранные.

2. **Альтернатива — tiktoken-based tokenizer** для точного подсчёта (cl100k_base или o200k_base). Зависимость +1 пакет, но даёт ±2% accuracy. Решение: tradeoff простота vs точность.

3. **Или — ничего не делать**, если в production отклонение в пределах ±15% и `compaction.action = compact|truncate` срабатывает до hard limit модели. Тогда долг закрывается без действий.

## Альтернативы (рассмотрены при основном ТЗ, отклонены)

1. **Reactive калибровка через `onFinish.usage`** для текущего turn — отвергнута: реактивно, не для preventive compaction.
2. **Эмпирический калибровочный фактор** (порог × 0.4) — отвергнута: заплатка, скрывает root cause, ломается при смене модели/режима.

## Acceptance criteria

- [ ] За неделю собран корпус ≥1000 turns в expertise/create.
- [ ] SQL-анализ delta `actual.promptTokens` vs наш `estimate` (через Vercel log + ai_usage_log join).
- [ ] Если ratio в пределах 0.85-1.15 — закрыть долг как **невостребованный** (формула адекватна).
- [ ] Если ratio за пределами — выбрать одно из решений 1/2 выше, реализовать, проверить на новой неделе.

## НЕ в scope

- Изменение `SIMPLY_CONTEXT_LIMIT` (200K), Soft (50%), Hard (85%) — это product decisions, не калибровка.
- Замена `zod-to-json-schema` на иной serializer для `computeToolsTokens` — drift риск нулевой пока версия совпадает с AI SDK транзитивной.
- Расширение compaction на новые chatMode (Simply Chat и т.д.) — отдельное ТЗ-COMPACTION-2.

## Оценка

**0.3 сессии** при подтверждённом отклонении (вариант 1):
- SQL-анализ за неделю production (30 мин)
- Замер коэффициентов на корпусе (30 мин)
- Правка `estimateTokenCount` + smoke test (1 час)
- CHANGELOG + commit (15 мин)

**0 сессий** если ratio адекватен — закрытие долга как невостребованного.
