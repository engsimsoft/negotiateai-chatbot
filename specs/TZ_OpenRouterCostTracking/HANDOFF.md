# HANDOFF — ТЗ_OpenRouterCostTracking

**Создано:** 2026-04-13
**Для следующей сессии:** может быть выполнен в той же сессии — scope маленький

---

## ⚡ Critical first read

**В этом порядке:**

1. **`SPEC.md`** — исходная формулировка из backlog (детали симптома + гипотезы)
2. **`ANALYSIS.md`** — root cause найден, Вариант A выбран, дизайн `normalizeModelId` готов
3. **`ROADMAP.md`** — 4 этапа с чек-листами

**Не читать:**
- Other archived ТЗ (все независимы от этого)
- Provider docs — всё что нужно уже в ANALYSIS.md

---

## 🎯 Старт — первые шаги

### Шаг 1 — Pre-flight (Этап 0)

```bash
cd "/Users/mactm/Projects/NegotiateAI Chatbot"
git status          # clean после v3.87.0
npx tsc --noEmit    # 0 ошибок
```

### Шаг 2 — Empirical confirmation

**Цель:** убедиться что `response.modelId` для OpenRouter-моделей действительно приходит с prefix. Если нет — root cause другой.

**Как:**

1. Добавить в `app/(chat)/api/chat/route.ts` line 1061 временный log:
   ```ts
   const stepModelId = response?.modelId || "unknown";
   console.log("[tz-openrouter-debug]", { rawStepModelId: stepModelId, response: response?.modelId });
   ```
2. `npm run dev` (если не запущен)
3. Открыть `/dev/models`, переключить `simply-chat` на `qwen/qwen3.6-plus`
4. Открыть `/simply`, отправить любое сообщение
5. Прочитать server log → увидеть реальный формат (если есть Monitor listening — поймает автоматически)
6. **Удалить** временный console.log (не коммитить debug)

### Шаг 3 — Implementation (Этап 1)

Применить Вариант A — `normalizeModelId` в `lib/ai/model-catalog.ts`:

```ts
// Добавить в конец model-catalog.ts (перед exports или рядом с getModelEntry):

const KNOWN_REGISTRY_PREFIXES = new Set([
  "anthropic",
  "minimax",
  "minimaxLong",
  "xai",
  "openrouter",
]);

/**
 * Strip known provider registry prefix. См. ADR 051 / ANALYSIS.md TZ_OpenRouterCostTracking.
 */
export function normalizeModelId(raw: string): string {
  const colonIdx = raw.indexOf(":");
  if (colonIdx === -1) return raw;
  const prefix = raw.slice(0, colonIdx);
  if (KNOWN_REGISTRY_PREFIXES.has(prefix)) {
    return raw.slice(colonIdx + 1);
  }
  return raw;
}
```

Применить в 4 catalog lookup функциях:
- `getModelEntry(id)` → `CATALOG[normalizeModelId(id)]`
- `resolveModelEntry(id)` → normalize перед lookup
- `getDisplayName(id)` → normalize перед lookup
- `getContextWindow(id)` (если существует такой паттерн — проверить)

После каждой правки: `npx tsc --noEmit` должен пройти.

### Шаг 4 — Build + manual E2E (Этап 3)

```bash
npm run build  # exit 0
```

Затем пройти все 9 подзадач Этапа 3 из ROADMAP.md — особенно подтверждение через DevPanel что cost стал non-zero.

### Шаг 5 — Финализация (Этап 4)

См. ROADMAP Этап 4. Включает: CHANGELOG [3.87.1], SIMPLY_STATUS короткая запись, package.json bump, tag `v3.87.1`, перенос в `_archive/`.

---

## Известные детали

### Root cause (коротко)

- `response.modelId` от AI SDK v6 для registry-resolved моделей = `openrouter:qwen/qwen3.6-plus` (с префиксом)
- `CATALOG` в model-catalog.ts ключи = `qwen/qwen3.6-plus` (без префикса)
- Lookup mismatch → cost calculation fails silently → DevPanel show `₽0.00`
- **DB path работает** (там bare id записан через `getModelIdForTask`) — problem is DevPanel path specifically

### Почему Вариант A не Вариант B/C

- A (normalize helper): универсальный, SSOT, один helper
- B (taskId-based): требует знания taskId в точке вызова, не защищает от других форматов
- C (hybrid): overkill для 1 bug fix

Обоснование в `ANALYSIS.md` раздел «Решение».

### Риски

- Graница: `unknown:foo` → остаётся как есть (не в known prefixes) ✓
- `anthropic:claude` → становится `claude` → lookup fails → cost=0. НЕ регрессия (раньше было то же самое)
- Test coverage: проект не имеет test framework (проверить) — unit test опционален, замены — мануальная валидация Этапа 3

---

## Запреты и предупреждения

- ❌ **НЕ** расщеплять changes на несколько commits внутри Этапа 1 — это atomic fix
- ❌ **НЕ** модифицировать AI SDK / registry — обходим через normalize
- ❌ **НЕ** забыть удалить временный console.log после Этапа 0
- ❌ **НЕ** делать normalize в call-site (providers.ts) — это должно быть в model-catalog.ts для SSOT
- ⚠️ Если empirical confirmation Этапа 0 покажет что `response.modelId` приходит bare (без prefix) — stop, пересмотреть ANALYSIS, root cause другой

---

## Целевая версия

3.87.0 → **3.87.1** (patch — single bug fix)

---

## Recovery

Если что-то сломается во время реализации:

```bash
git reset --hard v3.87.0
```

Recovery tag установлен после предыдущего релиза.
