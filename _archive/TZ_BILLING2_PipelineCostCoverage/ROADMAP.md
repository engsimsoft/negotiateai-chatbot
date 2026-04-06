# Roadmap ТЗ-BILLING2: Pipeline Cost Coverage (Briefing + Podcast)

**Создан:** 2026-04-06
**Версия проекта:** 3.68.0 → 3.69.0
**Статус:** В работе

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 4 |
| Завершено | 0 / 4 |
| Текущий этап | 1 |
| Сессий (оценка) | 1 |

**Критерий успеха:** SQL-запрос `SELECT * FROM ai_usage_log WHERE costUsd IS NULL AND chatMode LIKE 'briefing:%' AND createdAt > NOW() - INTERVAL '1 day'` возвращает 0 строк. Все 7 AI-вызовов в briefing+podcast pipeline логируются с costUsd ≠ NULL.

---

## Этапы

### Этап 1: Fix extractUsageForPricing для Google провайдера

**Статус:** ⬜ Не начат
**Цель:** `extractUsageForPricing` корректно возвращает `noCacheInputTokens` для **любого** AI провайдера (Anthropic, Google, Perplexity), не только Anthropic.

**Root cause:** Google @ai-sdk/google может возвращать `inputTokenDetails` = undefined или с `noCacheTokens` = undefined. Fallback `inputTokens - cacheRead - cacheWrite` должен работать, но по факту `noCacheInputTokens` получается 0 → `calculateCostRub` = 0 → `calcCostUsd` = null.

**Задачи:**

**1.1 — Диагностика:**
- [ ] Добавить временный `console.log` в `calcCostUsd` (`lib/ai/tokenlens-catalog.ts`) — вывести `modelId`, `usage.inputTokens`, `usage.inputTokenDetails`, `extractUsageForPricing(usage)`, `costRub`
- [ ] Запустить генерацию брифинга → посмотреть лог → найти точное место где noCacheInputTokens обнуляется
- [ ] Убрать временный console.log

**1.2 — Fix:**
- [ ] `lib/ai/providers.ts` → `extractUsageForPricing()` — усилить fallback:
  ```typescript
  // Если после всех попыток noCacheInputTokens === 0 но inputTokens > 0 —
  // провайдер не возвращает inputTokenDetails (Google, Perplexity).
  // Безопасный fallback: весь input — это fresh (нет prompt caching).
  if (noCacheInputTokens === 0 && (usage.inputTokens ?? 0) > 0) {
    noCacheInputTokens = usage.inputTokens ?? 0;
  }
  ```
- [ ] Убедиться что fix не ломает Anthropic (у Anthropic noCacheTokens всегда приходит → fallback не срабатывает)

- [ ] `npx tsc --noEmit` → 0 ошибок

**Файлы:**
- `lib/ai/providers.ts` — `extractUsageForPricing()` fallback fix
- `lib/ai/tokenlens-catalog.ts` — временный debug log (добавить → убрать)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешен
- [ ] Git commit: `fix(tz-billing2): extractUsageForPricing fallback for non-Anthropic providers`

🧪 **Мануальный тест:**
1. Запусти генерацию брифинга (`/briefing` → Generate)
2. SQL-проверка:
```sql
SELECT "chatMode", "modelId", "inputTokens", "outputTokens", "costUsd"
FROM "ai_usage_log"
WHERE "chatMode" = 'briefing:filter'
ORDER BY "createdAt" DESC
LIMIT 3;
```
3. **Критерий:** `costUsd IS NOT NULL` для новой записи `briefing:filter`

⛔ **СТОП — дождаться подтверждения пользователя.**

---

### Этап 2: Perplexity research — добавить logUsage

**Статус:** ⬜ Не начат
**Цель:** Расход Perplexity sonar-pro в research-engine логируется в `ai_usage_log`.

**Задачи:**

**2.1 — Пробросить userId:**
- [ ] `lib/briefing/research-engine.ts` — функция `researchSingleTopic()` (или её обёртка) должна принимать `userId: string`
- [ ] Проверить откуда вызывается: `briefing-pipeline.ts` → пробросить userId из pipeline input

**2.2 — Добавить logUsage:**
- [ ] `lib/briefing/research-engine.ts` — после `callPerplexity()` вызвать:
  ```typescript
  if (userId && result.usage) {
    waitUntil(logUsage({
      userId,
      usage: {
        inputTokens: result.usage.promptTokens ?? 0,
        outputTokens: result.usage.completionTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      } as LanguageModelUsage,
      modelId: "sonar-pro",
      chatMode: "briefing:research",
      durationMs,
    }));
  }
  ```

- [ ] `npx tsc --noEmit` → 0 ошибок

**Файлы:**
- `lib/briefing/research-engine.ts` — userId проброс + logUsage
- `lib/briefing/briefing-pipeline.ts` — userId проброс в research calls (если нужно)

**Валидация этапа:**
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешен
- [ ] Git commit: `feat(tz-billing2): perplexity research usage logging`

🧪 **Мануальный тест:**
1. Запусти генерацию брифинга с research (онбординг `/briefing/setup`)
2. SQL-проверка:
```sql
SELECT "chatMode", "modelId", "inputTokens", "outputTokens", "costUsd"
FROM "ai_usage_log"
WHERE "chatMode" = 'briefing:research'
ORDER BY "createdAt" DESC
LIMIT 5;
```
3. **Критерий:** появились записи с `modelId = 'sonar-pro'` и `costUsd IS NOT NULL`

⛔ **СТОП — дождаться подтверждения пользователя.**

---

### Этап 3: Верификация podcast:script + deep-research chat tool

**Статус:** ⬜ Не начат
**Цель:** Убедиться что fix из Этапа 1 также починил `podcast:script` (тот же `extractUsageForPricing` path). Верифицировать что чат-tool `deep-research` (Perplexity) корректно логируется.

**Задачи:**

- [ ] SQL-проверка podcast:script:
```sql
SELECT "chatMode", "modelId", "inputTokens", "outputTokens", "costUsd"
FROM "ai_usage_log"
WHERE "chatMode" = 'podcast:script'
ORDER BY "createdAt" DESC
LIMIT 5;
```
- [ ] Если costUsd = NULL → тот же баг, fix из Этапа 1 должен его закрыть. Прогнать генерацию подкаста для подтверждения.
- [ ] Если costUsd != NULL → уже работает.

- [ ] SQL-проверка deep-research chat tool:
```sql
SELECT "chatMode", "modelId", "costUsd"
FROM "ai_usage_log"
WHERE "chatMode" = 'tool:deep-research'
ORDER BY "createdAt" DESC
LIMIT 3;
```
- [ ] ✅ Уже верифицировано SQL: costUsd=$0.057, modelId=sonar-deep-research — OK.

**⚠️ Известный UI gap (NOT scope):** DevPanel footer суммирует только Claude steps (`getStepCostRub`). Perplexity cost попадает в БД, но не отображается в footer'е. Это отдельная UI-задача, не блокирует биллинг.

**Валидация этапа:**
- [ ] Все pipeline-стадии имеют costUsd != NULL
- [ ] Git commit (если были изменения)

---

### Этап 4: Финализация

**Статус:** ⬜ Не начат
**Цель:** Документация, version bump, archive.

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать `DOCUMENTATION_GUIDE.md`.

**Задачи:**

- [ ] Финальный SQL coverage audit:
```sql
SELECT "chatMode", COUNT(*) as total,
       COUNT(*) FILTER (WHERE "costUsd" IS NULL) AS null_cost
FROM "ai_usage_log"
WHERE "createdAt" > NOW() - INTERVAL '1 day'
GROUP BY "chatMode"
ORDER BY "chatMode";
```
- [ ] Обновить `CHANGELOG.md` (секция 3.69.0)
- [ ] Обновить `SIMPLY_STATUS.md`, `CLAUDE.md`, `package.json` → 3.69.0
- [ ] `npm run build` → успешен
- [ ] Git commit: `docs(tz-billing2): finalization — v3.69.0`
- [ ] Перенести в `_archive/`

**Критерий готовности:** 0 NULL costUsd для всех briefing:*/podcast:* chatModes.

---

## Файлы затронутые

**Этап 1:**
- `lib/ai/providers.ts` — extractUsageForPricing fallback

**Этап 2:**
- `lib/briefing/research-engine.ts` — userId + logUsage
- `lib/briefing/briefing-pipeline.ts` — userId проброс (если нужно)

**Этап 4:**
- `CHANGELOG.md`, `SIMPLY_STATUS.md`, `CLAUDE.md`, `package.json`
