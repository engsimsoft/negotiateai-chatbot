# Передача сессии ТЗ-TOKENS1

**Дата:** 2026-04-05
**Сессия:** 1 (планирование — завершена)
**Следующая сессия:** начать реализацию с Этапа 1

---

## Статус этапов

- [x] **Фаза 1:** Анализ + Код-ревью завершены
- [x] **Фаза 2:** Планирование завершено (ROADMAP 9 этапов)
- [ ] Этап 1: Базовый контракт ← **НАЧАТЬ ЗДЕСЬ**
- [ ] Этап 2: Обновление ядра (tokenlens + pipeline-trace)
- [ ] Этап 3: 3 chat routes (chat, service-chat, task-chat)
- [ ] Этап 4: Debug events v2 + localStorage migration
- [ ] Этап 5: DevPanel UI
- [ ] Этап 6: Pipelines + fake usage fix
- [ ] Этап 7: Cost Audit UI (fresh/cache/write колонки)
- [ ] Этап 8: Валидация (7 типов чатов)
- [ ] Этап 9: Финализация

---

## ⛔ КРИТИЧНО: читать СНАЧАЛА перед работой

**Новая сессия должна прочитать в таком порядке:**

1. `specs/WORKFLOW.md` — правила работы по ТЗ (валидация, git-commits)
2. `specs/ROADMAP_GUIDE.md` — правила чеклиста
3. `specs/TZ_TOKENS1_SdkNativeUsage/SPEC.md` — само ТЗ (9 требований R1-R9)
4. `specs/TZ_TOKENS1_SdkNativeUsage/ANALYSIS.md` — код-ревью, риски, решения
5. `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` — **рабочий чеклист** (9 этапов)

**Главный документ для работы:** `ROADMAP.md` — перечитывай перед каждой задачей, отмечай `[x]` после.

---

## Суть ТЗ

**Breaking refactor** системы расчёта токенов и стоимости. Переход с самопальной формулы `inputTokens - cacheRead - cacheWrite` на стандартный AI SDK v6 API (`usage.inputTokenDetails.{noCacheTokens, cacheReadTokens, cacheWriteTokens}`).

**Почему:** 2 месяца борьбы с расхождением Dev Panel vs Anthropic Console. Исходники `node_modules/@ai-sdk/anthropic/dist/internal/index.js` подтверждают — SDK уже предоставляет готовые разделённые поля.

**Масштаб:** 35+ файлов (8 ядерных + 28 callsites `logUsage` + DevPanel UI + Cost Audit).

---

## Ключевые решения (из ANALYSIS.md)

1. **DB schema НЕ трогаем** — `ai_usage_log.inputTokens` остаётся как total billable. Миграция данных не нужна.
2. **localStorage migration через version-key** — `DEBUG_EVENT_SCHEMA_VERSION = 2`, старые записи очищаются при несовпадении.
3. **Fake-usage в 3 pipeline файлах** (`briefing-author.ts`, `briefing-section-author.ts`, `podcast/script-generator.ts`) — включено в Этап 6 (получать real usage из `result.usage`).
4. **Legacy `promptTokens`/`completionTokens`** в `pipeline-trace.ts` — убираем в Этапе 2.
5. **Cost Audit Dashboard** — добавляем разделение fresh/cache/write колонок в Этапе 7.

---

## Первые шаги новой сессии

### Шаг 1 — прочитать контекст (3 мин)
```
Read: specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md (весь)
Read: specs/TZ_TOKENS1_SdkNativeUsage/ANALYSIS.md (секция "Текущая архитектура")
Read: lib/ai/providers.ts (файл который сейчас правим)
```

### Шаг 2 — Этап 1: Базовый контракт
Переписать `lib/ai/providers.ts`:

**Было (строки 106-137):**
```typescript
export interface TokenUsageForPricing {
  inputTokens: number;          // непрозрачно: total? fresh?
  outputTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
}

export function calculateCostRub(modelId, usage) {
  // ...
  const freshInput = usage.inputTokens - cacheRead - cacheWrite;  // ← ручная субтракция
  // ...
}
```

**Стало:**
```typescript
export interface TokenUsageForPricing {
  noCacheInputTokens: number;     // явно свежие
  cacheReadTokens: number;        // явно read
  cacheWriteTokens: number;       // явно write
  outputTokens: number;
  reasoningTokens?: number;       // опционально (Opus extended thinking)
}

export function calculateCostRub(modelId, usage): number {
  const p = MODEL_PRICING_RUB[modelId];
  if (!p) return 0;
  const effectiveOutput = usage.outputTokens + (usage.reasoningTokens ?? 0);
  const cost =
    (usage.noCacheInputTokens / 1000) * p.input +
    (usage.cacheReadTokens    / 1000) * p.cached +
    (usage.cacheWriteTokens   / 1000) * p.cacheWrite +
    (effectiveOutput          / 1000) * p.output;
  return Math.round(cost * 100) / 100;
}
```

**Затем создать helper в `lib/ai/usage-utils.ts`:**
```typescript
export function extractUsageForPricing(
  usage: LanguageModelUsage | undefined | null,
): TokenUsageForPricing {
  const details = usage?.inputTokenDetails;
  return {
    noCacheInputTokens: details?.noCacheTokens ?? usage?.inputTokens ?? 0,
    cacheReadTokens:    details?.cacheReadTokens ?? 0,
    cacheWriteTokens:   details?.cacheWriteTokens ?? 0,
    outputTokens:       usage?.outputTokens ?? 0,
    reasoningTokens:    usage?.outputTokenDetails?.reasoningTokens ?? 0,
  };
}
```

### Шаг 3 — валидация
```bash
npx tsc --noEmit
```
**Ожидаем ~20+ ошибок** в callsites — это нормально. Зафиксировать список (копировать вывод) в `CHANGELOG.md` сессии 2. Это будет roadmap для Этапов 2-3-4.

### Шаг 4 — git commit
```bash
git add lib/ai/providers.ts lib/ai/usage-utils.ts
git commit -m "refactor(tz-tokens1): new TokenUsageForPricing contract + extractUsageForPricing helper"
```

### Шаг 5 — отметить `[x]` в ROADMAP для Этапа 1, обновить HANDOFF

---

## Открытые вопросы (нужно подтверждение пользователя)

**ПЕРВЫМ ДЕЛОМ в новой сессии — спросить пользователя:**

1. **Согласен с планом 9 этапов?** (см. ROADMAP.md → Обзор)
2. **localStorage migration** — ок что старые dev-записи DevPanel очистятся при первом открытии? (self-healing, одноразово, только dev-режим)

Если ДА на оба — начинать Этап 1.
Если НЕТ — обсуждать корректировки.

---

## Что уже сделано в сессии 1

### Созданные документы
- `specs/TZ_TOKENS1_SdkNativeUsage/SPEC.md` — 9 требований
- `specs/TZ_TOKENS1_SdkNativeUsage/ANALYSIS.md` — код-ревью + 6 рисков
- `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` — 9 этапов с валидацией
- `specs/TZ_TOKENS1_SdkNativeUsage/CHANGELOG.md`
- `specs/TZ_TOKENS1_SdkNativeUsage/HANDOFF.md` (этот файл)

### Архивирование
- `specs/TZ_AUDIT1_TokenCostValidation/` → `_archive/` (заменён этим TZ)

### Разведка кодовой базы
Полная карта зависимостей в ANALYSIS.md. Все callsites найдены:
- `calculateCostRub`: 6 мест
- `calcStepCostRub`: 4 места (route.ts × 3 + pipeline-trace)
- `logUsage`: 28 мест
- `extractUsageFields`: 6 мест
- `emitDebugStep/Finish/Guardian/Prompt`: 12 мест в 3 routes
- DevPanel UI: 5 компонентов

---

## Валидация (критерий успеха всего TZ)

```
DevPanel cost === Cost Audit Dashboard cost === Anthropic Console cost (Δ<1%)
```

Для 7 типов чатов × 3 запроса каждый (см. Этап 8 в ROADMAP).

---

## Полезные команды

```bash
# Проверка компиляции
npx tsc --noEmit

# Сборка
npm run build

# Dev сервер
npm run dev

# Найти все callsites типа
grep -rn "calculateCostRub\(" lib/ app/
grep -rn "calcStepCostRub\(" lib/ app/
grep -rn "logUsage\(" lib/ app/

# Проверка БД (через mcp__postgres__query)
SELECT chatMode, COUNT(*), SUM("costUsd") FROM ai_usage_log
WHERE "createdAt" > NOW() - INTERVAL '1 day'
GROUP BY chatMode;
```

---

## Правила работы (из WORKFLOW.md)

- ⛔ **НЕ** отмечать `[x]` без `npx tsc --noEmit` = 0 ошибок
- ⛔ **НЕ** переходить к следующему этапу без мануального теста пользователя
- ⛔ **НЕ** делать "скопом" — Этап → tsc → build → git commit → ТЕСТ → следующий
- ✅ Git commit после КАЖДОГО этапа: `refactor(tz-tokens1): описание`
- ✅ ROADMAP.md — это чеклист, а не архив. Отмечай `[x]` сразу после задачи.

---

**Следующая сессия:** открой `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md`, прочитай Этап 1, спроси у пользователя подтверждение, начинай.
