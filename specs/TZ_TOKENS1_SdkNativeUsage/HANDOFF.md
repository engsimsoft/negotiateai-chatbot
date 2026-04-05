# Передача сессии ТЗ-TOKENS1

**Дата:** 2026-04-05
**Последняя сессия:** 3 (Этапы 4-5 завершены)
**Следующая сессия:** начать **Этап 6**

---

## Статус этапов

- [x] **Фаза 1:** Анализ + Код-ревью завершены
- [x] **Фаза 2:** Планирование завершено (ROADMAP 9 этапов)
- [x] **Этап 1:** Базовый контракт — commit `dd411aa`
- [x] **Этап 2:** Обновление ядра (tokenlens + pipeline-trace) — commit `d9cdf31`
- [x] **Этап 3:** 3 chat routes (chat, service-chat, task-chat) — commit `cb04b30`
- [x] **Этап 4:** Debug events v2 + localStorage migration — commit `32ade54`
- [x] **Этап 5:** DevPanel UI — commit TBD
- [ ] **Этап 6:** Pipelines + fake usage fix ← **НАЧАТЬ ЗДЕСЬ**
- [ ] Этап 7: Cost Audit UI (fresh/cache/write колонки)
- [ ] Этап 8: Валидация (7 типов чатов)
- [ ] Этап 9: Финализация

---

## ⛔ Текущее состояние компиляции

**TSC (`npx tsc --noEmit`):** 10 ошибок, все в pipelines (Этап 6):

```
lib/briefing/briefing-author.ts:231,235         (2)
lib/briefing/briefing-filter.ts:137,141         (2)
lib/briefing/briefing-section-author.ts:197,201 (2)
lib/briefing/research-engine.ts:305,309         (2)
lib/podcast/script-generator.ts:162,166         (2)
```

**Все ошибки однотипные:**
- `promptTokens`/`completionTokens` не существуют в `AiCallTrace` (обновлено в Этапе 2)
- `inputTokens` не существует в `TokenUsageForPricing` (обновлено в Этапе 1)

Pipelines передают legacy shape — нужно переписать callsites под новый контракт.

**Build и manual test отложены** до окончания Этапа 6.

---

## ⛔ КРИТИЧНО: читать СНАЧАЛА

**Порядок чтения в новой сессии:**

1. `specs/WORKFLOW.md` — правила работы по ТЗ
2. `specs/TZ_TOKENS1_SdkNativeUsage/SPEC.md` — само ТЗ (9 требований)
3. `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` — **рабочий чеклист** (Этап 6 и далее)
4. `specs/TZ_TOKENS1_SdkNativeUsage/CHANGELOG.md` — история сессий 1-3

---

## Что уже сделано (Этапы 1-5)

### Этап 5: DevPanel UI
- `components/dev-panel/sections/tokens-section.tsx` — disjoint суммы, UI с "Input (fresh)", "Cache read", "Cache write", Output, Reasoning, Total
- `components/dev-panel/sections/cost-breakdown-section.tsx` — StepCost обновлён
- `components/dev-panel/sections/timeline-section.tsx` — сумма disjoint полей
- `components/dev-panel/dev-panel-footer.tsx` — totalTokens обновлён
- `components/dev-panel/pipeline-trace-drawer.tsx` — использует новые поля AiCallTrace

---

## Следующий шаг: Этап 6 — Pipelines

**Цель:** Обновить все pipeline файлы, исправить fake-usage баг.

### Задачи (по ROADMAP)

**6.1 — Исправление fake usage (3 файла):**
- `lib/briefing/briefing-author.ts` — проверить что `result.usage` реальный (не fake)
- `lib/briefing/briefing-section-author.ts` — то же
- `lib/podcast/script-generator.ts` — то же

**6.2 — Callsites `calcStepCostRub` / `buildAiCallTrace`:**
Все они используют legacy shape (`promptTokens`/`completionTokens`/`inputTokens`). Нужно:
- Либо передавать `LanguageModelUsage` через `buildAiCallTrace(modelId, result, ...)`  
- Либо передавать `TokenUsageForPricing` через `extractUsageForPricing(usage)` → `calcStepCostRub`

Файлы:
- `lib/briefing/briefing-filter.ts:137-141`
- `lib/briefing/briefing-author.ts:231-235`
- `lib/briefing/briefing-section-author.ts:197-201`
- `lib/briefing/research-engine.ts:305-309`
- `lib/podcast/script-generator.ts:162-166`

**6.3 — Общая проверка `logUsage` callsites:** убедиться что ничего не сломано.

**6.4 — Валидация:**
- `npx tsc --noEmit` → 0 ошибок
- `npm run build` → успешен
- Мануальный тест: брифинг pipeline + SQL-проверка `ai_usage_log`

### Git commit сообщение

```
refactor(tz-tokens1): update all pipelines, fix fake usage in briefing/podcast
```

---

## Пользователь подтвердил

- ✅ План 9 этапов
- ✅ localStorage migration — dev-режим, старые данные не важны, очищаются автоматически
- ✅ Build + manual test перенесены до окончания Этапа 6

---

## Полезные команды

```bash
# Проверка компиляции
npx tsc --noEmit

# Сборка
npm run build

# Найти callsites
grep -rn "promptTokens\|completionTokens" lib/
grep -rn "calcStepCostRub\|buildAiCallTrace" lib/
```

---

## Правила работы (НИКОГДА НЕ НАРУШАТЬ)

- ⛔ **НЕ** отмечать `[x]` без `npx tsc --noEmit` = 0 ошибок (в зоне этапа)
- ⛔ **НЕ** использовать TodoWrite — основной чеклист это ROADMAP.md
- ✅ Git commit после КАЖДОГО этапа: `refactor(tz-tokens1): описание`
- ✅ ROADMAP.md — обновляй статусы сразу после задачи
- ✅ CHANGELOG.md — добавляй секцию после каждого этапа

---

**Новая сессия:** начинай с `specs/TZ_TOKENS1_SdkNativeUsage/ROADMAP.md` → Этап 6.
