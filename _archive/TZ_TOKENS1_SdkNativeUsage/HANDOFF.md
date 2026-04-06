# Передача сессии ТЗ-TOKENS1

**Дата:** 2026-04-05
**Завершена сессия:** 3 (Этапы 4-6)
**Следующая сессия:** мануальный тест Этапа 6 → затем **Этап 7**
**Причина передачи:** исчерпано контекстное окно предыдущей сессии

---

## Статус этапов

- [x] **Фаза 1:** Анализ + Код-ревью завершены
- [x] **Фаза 2:** Планирование завершено (ROADMAP 9 этапов)
- [x] **Этап 1:** Базовый контракт — commit `dd411aa`
- [x] **Этап 2:** Обновление ядра (tokenlens + pipeline-trace) — commit `d9cdf31`
- [x] **Этап 3:** 3 chat routes (chat, service-chat, task-chat) — commit `cb04b30`
- [x] **Этап 4:** Debug events v2 + localStorage migration — commit `32ade54`
- [x] **Этап 5:** DevPanel UI — commit `11df1b3`
- [x] **Этап 6:** Pipelines + fake usage fix — commit `3b2e3ca` ⏸️ **ожидает мануальный тест**
- [ ] **Этап 7:** Cost Audit UI (fresh/cache/write колонки) ← после теста
- [ ] Этап 8: Валидация (7 типов чатов × 3 запроса, сверка с Anthropic Console)
- [ ] Этап 9: Финализация (ADR 030, docs, archive)

---

## ✅ Состояние компиляции

**TSC (`npx tsc --noEmit`):** 0 ошибок ✅
**Build (`npm run build`):** успешен ✅

Весь рефакторинг (Этапы 1-6) скомпилирован и собран.

---

## 🧪 ПРИОРИТЕТ: мануальный тест Этапа 6

**Выполнить ПЕРВЫМ ДЕЛОМ в новой сессии перед Этапом 7.**

### Тест 1: обычный чат (проверка prompt caching Anthropic)

1. Запусти dev-сервер (`npm run dev`) с `SIMPLY_DEV_MODE=true`
2. Открой обычный чат, отправь 2-3 сообщения (Haiku или Sonnet)
3. Открой DevPanel (кликни footer под ответом AI)
4. **Проверь Tokens & Cost секцию:**
   - "Input (fresh)" отображается всегда
   - "Cache read" отображается после 2-го сообщения (> 0)
   - "Cache write" отображается после 1-го сообщения (> 0)
   - "Output", "Total", "Cost" корректны, без NaN/undefined
5. **Критично:** после 2-го сообщения `cacheReadTokens > 0` — prompt caching работает

### Тест 2: брифинг pipeline (fake usage fix)

1. Запусти генерацию брифинга (`/briefing` → Generate)
2. После завершения — SQL-проверка через mcp__postgres__query:

```sql
SELECT "chatMode", "inputTokens", "cacheReadTokens", "cacheWriteTokens",
       "outputTokens", "costUsd", "createdAt"
FROM "AiUsageLog"
WHERE "chatMode" LIKE 'briefing:%'
ORDER BY "createdAt" DESC
LIMIT 10;
```

3. **Критерии:**
   - `inputTokens > 0` во всех записях `briefing:filter`, `briefing:author`, `briefing:section-author`
   - `costUsd IS NOT NULL` во всех записях
   - Для `briefing:author`/`briefing:section-author` (Claude Sonnet): `cacheReadTokens > 0` после первой секции

### Тест 3: localStorage migration

1. Browser DevTools → Application → Local Storage → `localhost:3000`
2. Найди ключи с префиксом `simply-dev-chat-debug:*`
3. **Сценарий A (чистый старт):**
   - Удали все `simply-dev-chat-debug:*` ключи
   - Перезагрузи страницу, отправь сообщение в чат
   - Проверь что новый ключ содержит `{"schemaVersion": 2, "entries": [...]}`
4. **Сценарий B (legacy migration):**
   - Вручную вставь в localStorage: ключ `simply-dev-chat-debug:test123`, значение `[["msg1",{}]]` (без wrapper)
   - Перезагрузи страницу → в console должен появиться warn `[DevPanel] Clearing legacy debug cache for chat test123 (schema mismatch)`
   - Ключ должен быть удалён

### После теста — доложи результат пользователю

Формат:
```
✅ Тест 1: OK / ❌ FAIL (причина)
✅ Тест 2: OK / ❌ FAIL (причина)
✅ Тест 3: OK / ❌ FAIL (причина)
```

Если FAIL — расследуй, покажи логи/SQL-вывод, предложи фикс. После подтверждения всех тестов — переходи к Этапу 7.

---

## ⛔ КРИТИЧНО: читать СНАЧАЛА в новой сессии

1. `specs/WORKFLOW.md` — правила работы по ТЗ
2. `specs/TZ_TOKENS1_SdkNativeUsage/SPEC.md` — само ТЗ (9 требований R1-R9)
3. `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` — **рабочий чеклист** (Этап 7 и далее)
4. `specs/TZ_TOKENS1_SdkNativeUsage/CHANGELOG.md` — история сессий 1-3

---

## Что сделано в сессии 3 (Этапы 4-6)

### Этап 4: Debug events schema v2 (commit `32ade54`)

- `lib/ai/debug-events.ts`:
  - Экспорт `DEBUG_EVENT_SCHEMA_VERSION = 2`
  - `DebugStepData` disjoint поля: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens` + `schemaVersion`
  - `DebugFinishData` disjoint поля: `totalNoCacheInputTokens`, `totalCacheReadTokens`, `totalCacheWriteTokens`, `totalOutputTokens`, `totalReasoningTokens` + `schemaVersion`
- `lib/ai/providers.ts` → `getStepCostRub(step)` читает disjoint поля напрямую (bridge-логика с субтракцией убрана)
- `components/dev-panel/dev-panel-provider.tsx`:
  - StoredPayload `{ schemaVersion, entries[] }`. При mismatch → wipe + `console.warn`
- `hooks/use-onboarding-debug.ts` — аналогичная миграция
- 3 routes (chat, service-chat, task-chat) — `DebugStepData`/`DebugFinishData` заполняются новыми именами + `schemaVersion`

### Этап 5: DevPanel UI (commit `11df1b3`)

- `components/dev-panel/sections/tokens-section.tsx` — disjoint суммы, UI: "Input (fresh)" всегда + условно "Cache read"/"Cache write"/"Reasoning" (>0)
- `components/dev-panel/sections/cost-breakdown-section.tsx` — StepCost интерфейс обновлён
- `components/dev-panel/sections/timeline-section.tsx` — полная сумма disjoint полей
- `components/dev-panel/dev-panel-footer.tsx` — `totalTokens` из disjoint полей
- `components/dev-panel/pipeline-trace-drawer.tsx` — читает новые поля AiCallTrace

### Этап 6: Pipelines + fake usage fix (commit `3b2e3ca`)

**Ключевое: fix fake usage в briefing/podcast.**
До этого `briefing-author` / `briefing-section-author` / `podcast/script-generator` / `briefing-filter` передавали в `logUsage` вручную собранный shape `{ inputTokens, outputTokens, totalTokens } as any`, **теряя `inputTokenDetails.cacheReadTokens/cacheWriteTokens`**. Теперь передаётся оригинальный `LanguageModelUsage` от AI SDK → `extractUsageFields` внутри `logUsage` корректно извлекает cache-поля.

Файлы:
- `lib/briefing/briefing-filter.ts` — `buildAiCallTrace()` + real usage в logUsage
- `lib/briefing/briefing-author.ts` — хранит `result.usage: LanguageModelUsage` целиком, `buildAiCallTrace()` + post-set `ai.error`
- `lib/briefing/briefing-section-author.ts` — аналогично briefing-author
- `lib/briefing/research-engine.ts` — manual AiCallTrace с disjoint-полями (Perplexity без кэша: noCacheInputTokens=promptTokens, cacheRead/Write=0)
- `lib/podcast/script-generator.ts` — synthetic `LanguageModelUsage` с `inputTokenDetails.{noCacheTokens, cacheReadTokens: 0, cacheWriteTokens: 0}` для logUsage + manual AiCallTrace (Gemini без кэша, retry accumulator)

---

## Следующий шаг: Этап 7 — Cost Audit UI (после тестов)

**Цель:** Обновить `/admin/cost-audit` — раздельные колонки fresh/cache_read/cache_write + Cache hit rate card + legacy data warning.

### Задачи (по ROADMAP)

**7.1 — DB query обновления:**
- `lib/db/queries.ts` → `getCostByModel(days)` — добавить в SELECT раздельные поля:
  - `SUM(cacheReadTokens) as totalCacheReadTokens`
  - `SUM(cacheWriteTokens) as totalCacheWriteTokens`
  - `SUM(thinkingTokens) as totalReasoningTokens`
  - Вычисляемое: `freshInputTokens = inputTokens - cacheReadTokens - cacheWriteTokens`
- Опционально: `getUsageBreakdownByChatMode(days)`

**7.2 — UI страница:**
- `app/(dashboard)/admin/cost-audit/page.tsx`:
  - В таблицу "Расходы по моделям" добавить колонки: "Fresh in", "Cache read", "Cache write", "Reasoning"
  - Оставить "Токены in (total)" с tooltip "= fresh + cache_read + cache_write"
  - Цветовая индикация: cache_read — зелёным, cache_write — жёлтым

**7.3 — Legacy data warning:**
- Alert в header: "Записи до [TOKENS1_DEPLOY_DATE] могут иметь неточный costUsd"

**7.4 — Summary card:**
- "Cache hit rate" = `cacheReadTokens / (cacheReadTokens + freshInputTokens) × 100%`

### Git commit сообщение

```
feat(tz-tokens1): cost audit UI — fresh/cache/write columns + hit rate card
```

---

## Пользователь подтвердил

- ✅ План 9 этапов
- ✅ localStorage migration — dev-режим, старые данные не важны, очищаются автоматически
- ✅ Build + manual test перенесены до окончания Этапа 6 (теперь выполняются в начале новой сессии)
- ✅ Тесты откладываются до новой сессии из-за исчерпания контекстного окна

---

## Полезные команды

```bash
# Проверка компиляции
npx tsc --noEmit

# Сборка
npm run build

# Dev сервер (с DevPanel)
SIMPLY_DEV_MODE=true npm run dev

# Найти callsites
grep -rn "promptTokens\|completionTokens" lib/
grep -rn "calcStepCostRub\|buildAiCallTrace" lib/
```

---

## Правила работы (НИКОГДА НЕ НАРУШАТЬ)

- ⛔ **НЕ** отмечать `[x]` без `npx tsc --noEmit` = 0 ошибок (в зоне этапа)
- ⛔ **НЕ** использовать TodoWrite — основной чеклист это ROADMAP.md
- ✅ Git commit после КАЖДОГО этапа: `refactor(tz-tokens1): описание` или `feat(tz-tokens1): описание`
- ✅ ROADMAP.md — обновляй статусы сразу после задачи
- ✅ CHANGELOG.md — добавляй секцию после каждого этапа

---

**Новая сессия:**
1. Прочитай этот HANDOFF
2. Прочитай `ROADMAP.md` (раздел Этап 6 + Этап 7)
3. **Выполни 3 теста** (Тест 1, 2, 3 выше)
4. Доложи результат пользователю
5. После подтверждения → начинай Этап 7
