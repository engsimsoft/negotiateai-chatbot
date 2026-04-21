# Находки ТЗ-ExpertiseCreateVisionRouting

> Список нерешённых проблем, обнаруженных во время работы над ТЗ.
> После закрытия ТЗ — оформить как follow-up задачу или починить в scope.

---

## 🚩 Finding #1: Несоответствие `project:expert:${tier}` реальным taskId

**Где:** [app/(chat)/api/chat/route.ts:619](../../app/(chat)/api/chat/route.ts#L619)

**Что:** Код собирает taskId как template string:
```typescript
activeTaskId = `project:expert:${tier}` as TaskId;
```
где `tier: ProjectModelTier = "executor" | "expert" | "professor"`. Результат runtime: `"project:expert:executor"` / `"project:expert:expert"` / `"project:expert:professor"`. **Эти строки не существуют в `TaskId` union** — реальные taskId `project:expert:haiku | project:expert:sonnet | project:expert:opus`.

Правильный маппинг существует: `getTaskIdForTier(tier)` в [lib/ai/model-tiers.ts:51-60](../../lib/ai/model-tiers.ts#L51-L60) — резолвит `executor → haiku`, `expert → sonnet`, `professor → opus`.

**Почему проблема:**
- `as TaskId` глушит TS-ошибку — compiler не ловит.
- Runtime `getModelIdForTask("project:expert:executor")` → `DEFAULT_TASK_MODELS["project:expert:executor"]` = `undefined`. Далее getModel возвращает fallback или падает (поведение зависит от реализации `getModel`).
- Система могла полагаться на `getProjectModel(tier).model` (строка 636 — прямой путь к модели через `getTaskIdForTier` внутри), и `activeTaskId` использоваться только для логирования/composer — тогда effect минимален, но всё равно в `ai_usage_log` пишется несуществующий taskId.
- Для observability и SSOT — это неконсистентность: UI режим «Эксперт» должен в аналитике читаться как `project:expert:sonnet`, а реально пишет `project:expert:expert`.

**Предлагаемое решение:** В Этапе 2 при переписывании routing-блока на `resolveActiveTaskId()` использовать `getTaskIdForTier(tier)` вместо template string. Это родная SSOT-функция, TypeScript enforces корректность.

**Влияние:** medium (data-consistency в ai_usage_log, потенциально misrouting если getModel не имеет fallback).

**Обнаружено:** Этап 1, Задача 1.3 (создание `lib/ai/routing.ts`) — при проектировании `resolveDefaultTaskId()`.

**В scope текущего ТЗ:** ✅ Фиксится без отклонения от scope — в рамках переписывания routing-блока (Этап 2). Не создаёт scope creep.
