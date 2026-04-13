# Changelog ТЗ_OpenRouterCostTracking

> Локальный changelog ТЗ. Заполняется по мере работы.

---

## Сессия 1 — 2026-04-13 (создание ТЗ + аудит + plan)

### Создано

- `SPEC.md` — получено из backlog, создано в TZ_UnfreezePipelines session find (commit 51a2ec3)
- `ANALYSIS.md` — полный root cause analysis с SQL-диагностикой, дизайном `normalizeModelId` helper, обоснованием Варианта A
- `ROADMAP.md` — 4 этапа (Pre-flight/confirm, Implementation, Test, E2E validate + Финализация)
- `HANDOFF.md` — мост с конкретными первыми шагами
- `CHANGELOG.md` — этот файл

### Root cause подтверждён через SQL + grep

**Ключевое открытие:** database имеет корректный cost для qwen/qwen3.6-plus ($0.0069), но DevPanel показывает ₽0.00. Значит **две параллельные ветки в одном `onStepFinish`** — `logUsage` path корректен (использует `getModelIdForTask` → bare id), а `stepCostRub` path ломается (использует `response.modelId` → prefixed form).

**Диагностическая SQL:**
```sql
SELECT "modelId", "provider", "costUsd" FROM "ai_usage_log"
WHERE "modelId" ILIKE '%qwen%';
-- modelId: "qwen/qwen3.6-plus", provider: "openrouter", costUsd: 0.006900
```

### Решение: Вариант A (normalize helper в catalog)

Добавить `normalizeModelId(raw)` в `lib/ai/model-catalog.ts`, применить внутри `getModelEntry` / `resolveModelEntry` / `getDisplayName`. SSOT защита — все call-sites через catalog автоматически получают нормализацию.

### Эстимация

**1 сессия (~1-1.5 часа).** Меньше чем изначальные 0.5-1 сессии потому что root cause найден в ходе подготовки ТЗ (SQL + grep investigation). Реализация — single atomic commit.

### Не сделано в этой сессии

- Этап 0 (Pre-flight + empirical confirm) — старт следующего блока работы
- Этапы 1-4 — старт следующего блока

---

## Сессия 2 — TBD

### Этап 0: Pre-flight + empirical confirmation

[ ] baseline git status + tsc clean
[ ] Временный console.log на line 1061 chat/route.ts
[ ] Запрос через qwen override в /dev/models
[ ] Прочитать формат response.modelId из dev-сервер log
[ ] Удалить временный console.log
[ ] Зафиксировать ground truth в этом CHANGELOG

### Этап 1: Implementation

[ ] normalizeModelId helper + KNOWN_REGISTRY_PREFIXES в model-catalog.ts
[ ] getModelEntry применяет normalize
[ ] resolveModelEntry применяет normalize
[ ] getDisplayName применяет normalize
[ ] Проверить getContextWindow и другие lookup
[ ] tsc clean + build clean

### Этап 2: Unit test (если framework есть)

[ ] Проверить наличие vitest/jest в проекте
[ ] Добавить edge cases test если возможно
[ ] Или зафиксировать пропуск

### Этап 3: Manual E2E validation

[ ] qwen/qwen3.6-plus через /dev/models → DevPanel cost non-zero
[ ] z-ai/glm-4.6 → DevPanel cost non-zero
[ ] z-ai/glm-4.6v → DevPanel cost non-zero
[ ] Control Haiku → не сломано
[ ] Control MiniMax → не сломано
[ ] SQL sanity check `ai_usage_log`
[ ] Reset overrides

### Этап 4: Финализация

[ ] CHANGELOG.md [3.87.1]
[ ] SIMPLY_STATUS.md короткая запись
[ ] CLAUDE.md — версия + добавлено в Завершены
[ ] specs/_backlog/README.md — перенос в closed
[ ] package.json 3.87.0 → 3.87.1
[ ] Финальный smoke test user'ом
[ ] git mv specs → _archive
[ ] Release commit + tag v3.87.1
