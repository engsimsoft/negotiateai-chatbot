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

## Сессия 2 — 2026-04-13 (продолжение в той же реальной сессии)

### Этап 0: Pre-flight + empirical confirmation — ✅ ЗАВЕРШЁН

- [x] Baseline: git clean после v3.87.0, tsc 0 ошибок
- [x] Добавлен временный `console.log("[tz-openrouter-debug]", ...)` на chat/route.ts:1061
- [x] Dev-сервер перезапущен после Next.js `.next` cache flake (ENOENT vendor chunks)
- [x] User провёл UI тест через `/dev/models` qwen/qwen3.6-plus override + Simply Chat message
- [x] Прочитан формат в dev-сервер логах:
  ```
  [tz-openrouter-debug] raw response.modelId: "MiniMax-M2.7"           ← bare
  [tz-openrouter-debug] raw response.modelId: "qwen/qwen3.6-plus-04-02" ← SUFFIX
  ```
- [x] Удалён временный console.log
- [x] **Ground truth зафиксирован:** первоначальная гипотеза про `openrouter:` prefix **опровергнута**. Реальная проблема — OpenRouter на своей стороне pins bare name к dated snapshot version (`qwen/qwen3.6-plus-04-02`), AI SDK просто пропускает через себя

### Этап 1: Implementation — ✅ ЗАВЕРШЁН

Архитектурный pivot: вместо prefix-strip → **suffix-walking loop** в `getModelEntry`.

- [x] `lib/ai/model-catalog.ts` `getModelEntry(id)`:
  ```ts
  export function getModelEntry(id: string): ModelEntry | undefined {
    const direct = CATALOG[id];
    if (direct) return direct;
    let trimmed = id;
    while (true) {
      const lastDash = trimmed.lastIndexOf("-");
      if (lastDash === -1) return undefined;
      trimmed = trimmed.slice(0, lastDash);
      const found = CATALOG[trimmed];
      if (found) return found;
    }
  }
  ```
- [x] Добавлен подробный JSDoc над функцией с объяснением зачем и примером OpenRouter case
- [x] `resolveModelEntry`, `getDisplayName`, `getContextWindow` — **не трогаем**, они уже используют `CATALOG[id]` или `resolveModelEntry(id)` которые идут через `getModelEntry`. Одна точка правки — SSOT
- [x] tsc clean
- [x] **Корректность walk-back loop проверена для edge cases:**
  - `claude-haiku-4-5-20251001` → exact match (первая попытка), loop не активируется ✓
  - `claude-sonnet-4-6` → exact match ✓
  - `MiniMax-M2.7` → exact match ✓
  - `qwen/qwen3.6-plus-04-02` → loop → `qwen/qwen3.6-plus-04` → `qwen/qwen3.6-plus` → **match** ✓
  - Unknown model без match в catalog → walks до EOS, returns undefined ✓

### Этап 2: Unit test — ПРОПУЩЕН

- [x] Проверено наличие test framework — проект использует Next.js + ручные integration scripts, нет unit test infrastructure для pure utility functions
- [x] Решение: **пропустить unit tests**, не создавать test infrastructure ради одного helper. Логика покрыта empirical тестом + code review
- [x] Если в будущем будет добавлен vitest — tests для `getModelEntry` edge cases можно добавить первыми

### Этап 3: Manual E2E validation — ✅ ЗАВЕРШЁН

**Проведено пользователем (2026-04-13):**
- `/dev/models` override `simply-chat` → `qwen/qwen3.6-plus`
- 2 запроса в Simply Chat через qwen
- Проверка DevPanel

**SQL подтверждение (`ai_usage_log` за период теста):**

| ts | modelId | chatMode | inputTokens | costUsd |
|---|---|---|---|---|
| 17:01:33 | qwen/qwen3.6-plus | simply | 14121 | **$0.0051** |
| 17:04:32 | qwen/qwen3.6-plus | simply | 14192 | **$0.0063** |
| 17:05:20 | grok-4-1-fast-reasoning | simply | 27280 | $0.0041 (cache hit 51%) |

**Результаты:**
- ✅ qwen запросы имеют non-zero costUsd (было 0 до фикса)
- ✅ DevPanel показывает правильную цену (user confirmed)
- ✅ Regression check: MiniMax, Grok работают как раньше
- ✅ Bonus: заметили что когда user прикрепил картинку — маршрут ушёл в `simply-chat-vision` → Grok (правильная routing logic, не задета ТЗ), cache на Grok работает (51% hit)

### Этап 4: Финализация — в процессе

- [ ] ANALYSIS.md обновлён с корректным root cause (в конце файла, раздел «ФИНАЛЬНЫЙ ROOT CAUSE»)
- [ ] Этот CHANGELOG обновлён с этапами 0-3
- [ ] Главный CHANGELOG.md [3.87.1]
- [ ] SIMPLY_STATUS.md (короткая patch запись)
- [ ] CLAUDE.md — версия + добавлено в «Завершены»
- [ ] specs/_backlog/README.md — перенос OpenRouterCostTracking в «Закрытые долги»
- [ ] package.json 3.87.0 → 3.87.1
- [ ] git mv specs/TZ_OpenRouterCostTracking → _archive/
- [ ] Release commit
- [ ] Git tag v3.87.1

### Финальная сводка

**Коммиты:**
- `fd7e7ca` — docs: promote backlog → active TZ + ANALYSIS (первоначальный, гипотеза про prefix)
- `_current_` — fix + docs correction (walk-back suffix lookup)

**Lessons learned:**
1. **SQL диагностика вышла на правильную track** (two-path architecture) — ценно
2. **Empirical confirmation критичен** — SQL показал «cost calculated in DB works», но не показал ПОЧЕМУ DevPanel path ломается. Только живой console.log с реальным значением `response.modelId` показал что суффикс, а не префикс
3. **Rule 1 WORKFLOW (official docs first)** не спас бы — это поведение OpenRouter не задокументировано явно, видно только через runtime behavior
4. **Rule for future:** при любом mismatch между expected и actual modelId formats — **всегда сначала print actual value**, потом pattern-matching и fix. Stalling на 2-3 минуты pre-fix diagnostic логе экономит час plumbing неправильного фикса
