# Roadmap ТЗ-TOKENS1: SDK Native Usage Tracking

**Создан:** 2026-04-05
**Версия проекта:** 3.66.0 → 3.67.0
**Статус:** ⬜ Не начат

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Этапов | 9 |
| Текущий этап | 1 |
| Сессий (оценка) | 5-6 |

**Критерий успеха:** Dev Panel cost === Cost Audit Dashboard cost === Anthropic Console cost (допуск <1%) во всех 7 типах чатов.

---

## Этапы

### Этап 1: Базовый контракт (ядро типов)

**Статус:** ✅ Завершён
**Цель:** Переписать интерфейсы `TokenUsageForPricing`, `calculateCostRub`, создать helper `extractUsageForPricing`.

**Задачи:**
- [x] `lib/ai/providers.ts` — переписать интерфейс `TokenUsageForPricing` с явными полями `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens?`
- [x] `lib/ai/providers.ts` — переписать `calculateCostRub()` без ручной субтракции
- [x] `lib/ai/usage-utils.ts` — создать helper `extractUsageForPricing(usage: LanguageModelUsage)` → `TokenUsageForPricing`
- [x] `lib/ai/usage-utils.ts` — `ExtractedUsage.inputTokens` оставлен как есть (total billable для DB, см. ANALYSIS.md рекомендация #1). `extractUsageFields` рабочий.
- [x] `npx tsc --noEmit` → 5 ошибок в callsites (фиксим в Этапах 2-3)

**Файлы:**
- `lib/ai/providers.ts` — интерфейс, функция, не трогаем MODEL_PRICING_RUB
- `lib/ai/usage-utils.ts` — новый helper

**Валидация этапа:**
- [x] Интерфейс `TokenUsageForPricing` скомпилирован корректно
- [x] Функция `extractUsageForPricing` работает для mock-usage объектов
- [x] Ожидаемые ошибки компиляции в callsites зафиксированы (5 ошибок — см. CHANGELOG)
- [x] Git commit: `refactor(tz-tokens1): new TokenUsageForPricing contract + extractUsageForPricing helper`

**Критерий готовности:** Ядро типов готово, компилятор показывает точный список callsites для обновления.

⛔ **НЕ переходить к этапу 2 без фиксации списка ошибок компиляции!**

---

### Этап 2: Обновление ядра (tokenlens + pipeline-trace)

**Статус:** ✅ Завершён
**Цель:** Адаптировать все внутренние callsites в `lib/ai/`.

**Задачи:**
- [x] `lib/ai/tokenlens-catalog.ts` — переписать `calcCostUsd()` через `extractUsageForPricing`
- [x] `lib/ai/tokenlens-catalog.ts` — переписать `calcStepCostRub()` — принимать `TokenUsageForPricing` напрямую
- [x] `lib/ai/providers.ts` → `getStepCostRub()` — bridge создан в Этапе 1 (обновим финально в Этапе 4)
- [x] `lib/ai/pipeline-trace.ts` → `buildAiCallTrace()` — legacy `promptTokens/completionTokens` убраны, переход на `LanguageModelUsage` через `extractUsageForPricing`. Добавлены disjoint поля в `AiCallTrace`.
- [x] `lib/ai/pipeline-trace.ts` → `buildTtsTrace()` — обновлён под новый `AiCallTrace`
- [x] `npx tsc --noEmit` → 0 ошибок в `lib/ai/` (18 ошибок в routes/pipelines/UI — ожидаемо)

**Файлы:**
- `lib/ai/tokenlens-catalog.ts`
- `lib/ai/providers.ts` (getStepCostRub)
- `lib/ai/pipeline-trace.ts`

**Валидация этапа:**
- [x] `npx tsc --noEmit` → 0 ошибок в `lib/ai/`
- [x] Git commit: `refactor(tz-tokens1): update tokenlens-catalog + pipeline-trace to new contract`

**Критерий готовности:** Весь `lib/ai/` компилируется (кроме `debug-events.ts` который обновим в Этапе 4).

---

### Этап 3: Обновление 3 routes (chat, service-chat, task-chat)

**Статус:** ✅ Завершён
**Цель:** Переписать `onStepFinish` и `onFinish` во всех 3 основных чат-роутах.

**Задачи:**
- [x] `app/(chat)/api/chat/route.ts`:
  - [x] `onStepFinish` — использует `extractUsageForPricing(usage)` вместо ручного сбора полей
  - [x] `DebugStepData` — поля legacy (переименование в Этапе 4)
  - [x] `onFinish` → `calculateCostRub` для `estimatedCostRub` — через `extractUsageForPricing`
  - [x] `emitDebugFinish` — используется `usage.inputTokens` как total (поля legacy DebugFinishData до Этапа 4)

- [x] `app/(chat)/api/service-chat/route.ts` — аналогично. `logUsage` продолжает работать через `extractUsageFields`.
- [x] `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` — аналогично. `saveAiUsageLog` работает через `extractUsageFields`.
- [x] `npx tsc --noEmit` → 0 ошибок в 3 routes (остаются pipelines Этап 6 + UI Этап 5)

**Файлы:**
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

**Валидация этапа:**
- [x] `npx tsc --noEmit` → 0 ошибок в routes
- [x] Git commit: `refactor(tz-tokens1): update 3 chat routes to new usage contract`
- ⚠️ `npm run build` отложен до Этапа 6 — pipelines + UI всё ещё сломаны. Мануальный тест также после Этапа 6.

**Критерий готовности:** Routes компилируются.

---

### Этап 4: DebugStepData + DebugFinishData + localStorage migration

**Статус:** ✅ Завершён
**Цель:** Переписать типы debug events + мягкая миграция localStorage.

**Задачи:**
- [x] `lib/ai/debug-events.ts`:
  - [x] `DebugStepData` — disjoint поля: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens`
  - [x] `DebugFinishData` — disjoint поля: `totalNoCacheInputTokens`, `totalCacheReadTokens`, `totalCacheWriteTokens`, `totalOutputTokens`, `totalReasoningTokens`
  - [x] Добавлена константа `DEBUG_EVENT_SCHEMA_VERSION = 2`
  - [x] Добавлено поле `schemaVersion: number` в DebugStepData и DebugFinishData

- [x] `components/dev-panel/dev-panel-provider.tsx`:
  - [x] StoredPayload с `schemaVersion` + `entries[]`; при mismatch → wipe + console.warn
  - [x] Тип `DevPanelMessageData` без изменений (вложенные DebugStepData/DebugFinishData уже типизированы)

- [x] `hooks/use-onboarding-debug.ts`:
  - [x] Аналогичная миграция localStorage

- [x] `lib/ai/providers.ts` → `getStepCostRub(step)` — чтение disjoint полей напрямую, bridge-логика (субтракция) убрана

- [x] 3 routes обновлены (chat, service-chat, task-chat): `DebugStepData`/`DebugFinishData` заполняются новыми именами + `schemaVersion`

- [x] `npx tsc --noEmit` → 0 ошибок в зоне Этапа 4. Новые 17 ошибок в UI секциях / pipelines — ожидаемо (Этапы 5-6)

**Файлы:**
- `lib/ai/debug-events.ts`
- `lib/ai/providers.ts` (getStepCostRub)
- `components/dev-panel/dev-panel-provider.tsx`
- `hooks/use-onboarding-debug.ts`
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

**Валидация этапа:**
- [x] `npx tsc --noEmit` → 0 ошибок в `lib/ai/`, `dev-panel-provider.tsx`, 3 routes
- [ ] При перезагрузке dev-сервера + открытии чата — старый localStorage очищен (проверка после Этапа 5)
- [x] Git commit: `refactor(tz-tokens1): debug events schema v2 + localStorage migration`

**Критерий готовности:** Схема debug events обновлена, старые localStorage данные очищаются.

---

### Этап 5: DevPanel UI (tokens-section, cost-breakdown, footer)

**Статус:** ✅ Завершён
**Цель:** Обновить UI компоненты DevPanel чтобы читать новые поля.

**Задачи:**
- [x] `components/dev-panel/sections/tokens-section.tsx`:
  - [x] disjoint поля: `noCacheInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens`, `reasoningTokens`
  - [x] Отображение: "Input (fresh)" всегда, "Cache read"/"Cache write"/"Reasoning" условно (если > 0)
  - [x] `totalTokens` = sum всех пяти компонентов (disjoint)

- [x] `components/dev-panel/sections/cost-breakdown-section.tsx`:
  - [x] `StepCost` интерфейс и `computePerStepCosts` обновлены под disjoint поля
  - [x] Per-step cost считается через `getStepCostRub(step)` (обновлён в Этапе 4)

- [x] `components/dev-panel/dev-panel-footer.tsx`:
  - [x] `totalTokens` = sum disjoint полей (no cache + cacheRead + cacheWrite + output + reasoning)

- [x] `components/dev-panel/sections/timeline-section.tsx`:
  - [x] `step.inputTokens` → сумма disjoint полей

- [x] `components/dev-panel/pipeline-trace-drawer.tsx`:
  - [x] `stage.ai.promptTokens/completionTokens` → `noCacheInputTokens + cacheReadTokens + cacheWriteTokens` / `outputTokens`

- [x] `components/dev-panel/sections/raw-section.tsx`:
  - [x] Не требует изменений (рендерит raw JSON)

- [x] `npx tsc --noEmit` → 0 ошибок в DevPanel UI (остаются 10 в pipelines — Этап 6)

**Файлы:**
- `components/dev-panel/sections/tokens-section.tsx`
- `components/dev-panel/sections/cost-breakdown-section.tsx`
- `components/dev-panel/sections/timeline-section.tsx`
- `components/dev-panel/dev-panel-footer.tsx`

**Валидация этапа:**
- [x] `npx tsc --noEmit` → 0 ошибок в DevPanel UI
- [ ] `npm run build` → отложен до Этапа 6 (pipelines всё ещё сломаны)
- [x] Git commit: `refactor(tz-tokens1): update DevPanel UI to new debug fields`

🧪 **Мануальный тест:** отложен до окончания Этапа 6 (build не собирается без починки pipelines).

---

### Этап 6: Pipelines (briefing + podcast + meeting + остальные)

**Статус:** ✅ Завершён (ожидает мануальный тест)
**Цель:** Обновить все pipeline файлы, исправить fake-usage баг.

**Задачи:**

**6.1 — Исправление fake usage (3 файла):**
- [x] `lib/briefing/briefing-author.ts` — `result.usage: LanguageModelUsage` сохраняется и передаётся в logUsage напрямую
- [x] `lib/briefing/briefing-section-author.ts` — то же
- [x] `lib/podcast/script-generator.ts` — Gemini без кэша: `inputTokenDetails: { noCacheTokens: totalPromptTokens, cacheReadTokens: 0, cacheWriteTokens: 0 }` в synthetic usage

**6.2 — Callsites обновлены:**
- [x] `lib/briefing/briefing-filter.ts` — `buildAiCallTrace()` c real `LanguageModelUsage`
- [x] `lib/briefing/briefing-author.ts` — `buildAiCallTrace()` + `error` post-set
- [x] `lib/briefing/briefing-section-author.ts` — `buildAiCallTrace()` + `error` post-set
- [x] `lib/briefing/research-engine.ts` — manual AiCallTrace с disjoint-полями (Perplexity = no cache)
- [x] `lib/podcast/script-generator.ts` — manual AiCallTrace с disjoint-полями (Gemini = no cache, retry accumulator)

- [x] `npx tsc --noEmit` → 0 ошибок
- [x] `npm run build` → успешен

**Файлы:**
- `lib/briefing/*.ts` (4 файла)
- `lib/podcast/*.ts` (2 файла)
- `lib/meeting/*.ts` (2 файла)
- `lib/ai/professor-pipeline.ts`
- Остальные pipeline файлы по списку в ANALYSIS.md

**Валидация этапа:**
- [x] `npx tsc --noEmit` → 0 ошибок
- [x] `npm run build` → успешен
- [x] Git commit: `refactor(tz-tokens1): update all pipelines, fix fake usage in briefing/podcast`

🧪 **Мануальный тест (ожидается):**
1. Запусти генерацию брифинга (полный pipeline: filter → author → section-author)
2. В БД проверь записи `ai_usage_log` WHERE chatMode LIKE 'briefing:%' — должны быть реальные токены (не нули)
3. Проверь costUsd ≠ NULL для всех записей
4. Обычный чат с Claude (cached context) → проверить что `inputTokens/cacheReadTokens/cacheWriteTokens` в DB соответствуют Anthropic Console

⛔ **СТОП — дождаться подтверждения пользователя.**

---

### Этап 7: Cost Audit UI — разделение fresh/cache/write

**Статус:** ⬜ Не начат
**Цель:** Обновить страницу `/admin/cost-audit` — показать разделение токенов на fresh / cache_read / cache_write, чтобы можно было сверять с Anthropic Console.

**Задачи:**

**7.1 — DB query обновления:**
- [ ] `lib/db/queries.ts` → `getCostByModel(days)` — добавить в SELECT раздельные поля:
  - `SUM(inputTokens) as totalInputTokens` (уже есть как `inputTokens`)
  - `SUM(cacheReadTokens) as totalCacheReadTokens`
  - `SUM(cacheWriteTokens) as totalCacheWriteTokens`
  - `SUM(thinkingTokens) as totalReasoningTokens`
  - Вычисляемое: `freshInputTokens = inputTokens - cacheReadTokens - cacheWriteTokens`

- [ ] `lib/db/queries.ts` → добавить `getUsageBreakdownByChatMode(days)` — раздельные токены по chatMode (опционально)

**7.2 — UI страница:**
- [ ] `app/(dashboard)/admin/cost-audit/page.tsx`:
  - [ ] В таблицу "Расходы по моделям" добавить колонки:
    - "Fresh in" (свежий input)
    - "Cache read"
    - "Cache write"
    - "Reasoning" (если есть)
  - [ ] Оставить "Токены in (total)" как итоговую, но добавить tooltip "= fresh + cache_read + cache_write"
  - [ ] Цветовая индикация: cache_read — зелёным (скидка), cache_write — жёлтым (надбавка)

**7.3 — Legacy data warning:**
- [ ] Добавить alert в header страницы: "Записи до [дата рефакторинга] могут иметь неточный costUsd — исправлено в TZ_TOKENS1"
- [ ] Дата захардкодится после деплоя (или читается из env переменной `TOKENS1_DEPLOY_DATE`)

**7.4 — Summary карточки:**
- [ ] В верхнем ряду добавить 4-ю карточку "Cache hit rate" = `cacheReadTokens / (cacheReadTokens + freshInputTokens) × 100%`
  - Показывает насколько эффективно работает prompt caching
  - Ожидаемое значение после прогрева: 60-90%

- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешен

**Файлы:**
- `lib/db/queries.ts` — `getCostByModel`, возможно новый `getUsageBreakdownByChatMode`
- `app/(dashboard)/admin/cost-audit/page.tsx` — таблицы + карточки

**Валидация этапа:**
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] `npm run build` → успешен
- [ ] Git commit: `feat(tz-tokens1): cost audit UI — fresh/cache/write columns + hit rate card`

🧪 **Мануальный тест:**
1. Открой `/admin/cost-audit`
2. Проверь новые колонки в таблице "Расходы по моделям"
3. Проверь карточку "Cache hit rate"
4. Убедись что `fresh + cacheRead + cacheWrite ≈ inputTokens (total)` для каждой строки
5. Проверь legacy warning баннер

⛔ **СТОП — дождаться подтверждения пользователя.**

**Критерий готовности:** Dashboard показывает прозрачную разбивку токенов, готов к использованию для сверки с Anthropic Console в Этапе 8.

---

### Этап 8: Валидация (7 типов чатов × 3 запроса)

**Статус:** ⬜ Не начат
**Цель:** Прогнать полный аудит, сверить с Anthropic Console, допуск <1%.

**Задачи:**

**7.1 — Подготовка:**
- [ ] `SIMPLY_DEV_MODE=true` подтверждён
- [ ] DevPanel открыт в браузере
- [ ] Anthropic Console → Usage доступен (URL: console.anthropic.com/settings/usage)
- [ ] mcp__postgres__query работает

**7.2 — Таблица расхождений (заполняется в процессе):**

| # | Тип | chatMode | Модель | Запросов | DevPanel ₽ | DB costUsd×100 | Anthropic $ | Δ% | Статус |
|---|-----|----------|--------|----------|------------|-----------------|-------------|----|----|
| 1 | Обычный чат | chat | Haiku | 3 | — | — | — | — | ⬜ |
| 2 | Экспертиза | expertise | Sonnet | 3 | — | — | — | — | ⬜ |
| 3 | Создание | create | Sonnet | 3 | — | — | — | — | ⬜ |
| 4 | Бен | service:ben | Haiku | 3 | — | — | — | — | ⬜ |
| 5 | Менеджер | service:project-manager | Haiku | 3 | — | — | — | — | ⬜ |
| 6 | Брифинг | briefing:* | Sonnet | 1 pipeline | — | — | — | — | ⬜ |
| 7 | Meeting | meeting:* | Sonnet | 1 запись | — | — | — | — | ⬜ |

**7.3 — Прогон по типам:**
- [ ] Тип 1: 3 сообщения в обычный чат Haiku → зафиксировать
- [ ] Тип 2-3: Экспертиза + Создание (Sonnet) → зафиксировать
- [ ] Тип 4: Бен → зафиксировать
- [ ] Тип 5: Менеджер проекта → зафиксировать
- [ ] Тип 6: полный брифинг pipeline → зафиксировать по каждой стадии
- [ ] Тип 7: короткая meeting запись → зафиксировать

**7.4 — Анализ:**
- [ ] Все строки таблицы заполнены
- [ ] Δ% < 1% во всех случаях
- [ ] Если расхождение >1% — root cause + fix

**Валидация этапа:**
- [ ] Таблица расхождений полностью заполнена
- [ ] Все Δ% < 1%
- [ ] `npm run build` → успешен
- [ ] Git commit: `test(tz-tokens1): validation complete, all chat types verified`

**Критерий готовности:** 7/7 типов прошли валидацию, расхождений нет.

⛔ **СТОП — если есть расхождения, возврат к Этапам 2-7 для fix.**

---

### Этап 9: Финализация

**Статус:** ⬜ Не начат
**Цель:** Документация, ADR, архив.

⛔ **ПЕРВЫМ ДЕЛОМ:** Прочитать `/Users/mactm/Projects/NegotiateAI Chatbot/DOCUMENTATION_GUIDE.md` — пройти чеклист.

**Задачи:**

**Документация (обязательная):**
- [ ] ⛔ Прочитать `DOCUMENTATION_GUIDE.md` → пройти "✅ Чек-лист при изменениях"
- [ ] Обновить главный `CHANGELOG.md` (секция 3.67.0)
- [ ] Обновить `SIMPLY_STATUS.md` (завершённые ТЗ)
- [ ] Обновить `CLAUDE.md` (секция "Структура кода" если нужно)
- [ ] Обновить `package.json` → 3.67.0

**Документация (по чеклисту):**
- [ ] **ADR обязателен:** создать `docs/decisions/030-sdk-native-usage-tracking.md`
  - Контекст: 2 месяца борьбы с расхождением, самопальная формула vs SDK v6 native
  - Решение: breaking refactor на `inputTokenDetails.*`
  - Альтернативы: (1) точечная правка, (2) продолжать субтракцию + тесты
  - Trade-offs: breaking internal API vs надёжность и стандарт
  - Consequences: единый SSOT, устойчивость к будущим провайдерам
- [ ] Обновить `docs/ai-providers.md` → Реестр конфигураций (TokenUsageForPricing, calculateCostRub signature)
- [ ] Обновить `docs/ai-chats-map.md` — не затрагивает модели, но проверить
- [ ] Обновить `docs/architecture.md` — новый контракт typing

**⛔ Верификация docs против кода (Правило 5):**
- [ ] `ai-providers.md` → Реестр конфигураций сверен с `lib/ai/providers.ts`
- [ ] `ai-chats-map.md` → код-блок myProvider совпадает с `providers.ts`
- [ ] `CLAUDE.md` → пути файлов актуальны

**Завершение:**
- [ ] БД-проверка через mcp__postgres__query:
  - [ ] SELECT COUNT(*) FROM ai_usage_log WHERE createdAt > NOW() - INTERVAL '1 day' GROUP BY chatMode
  - [ ] SELECT * FROM ai_usage_log WHERE costUsd IS NULL AND createdAt > NOW() - INTERVAL '1 day'
- [ ] Финальный мануальный тест: 1 сообщение в каждый из 7 типов чатов
- [ ] Перенести `specs/TZ_TOKENS1_SdkNativeUsage/` → `_archive/`

**Валидация:**
- [ ] `npm run build` → успешен
- [ ] Production URL работает (если деплой)
- [ ] Документация актуальна (проверено)
- [ ] Git commit: `chore(tz-tokens1): finalization — docs + ADR + archive`

**Критерий готовности:** Всё задокументировано, ADR создан, папка в архиве.

---

## Файлы затронутые рефакторингом

**Ядро (8 файлов):**
- `lib/ai/providers.ts`
- `lib/ai/tokenlens-catalog.ts`
- `lib/ai/usage-utils.ts`
- `lib/ai/debug-events.ts`
- `lib/ai/pipeline-trace.ts`
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts`

**DevPanel UI (5 файлов):**
- `components/dev-panel/dev-panel-provider.tsx`
- `components/dev-panel/sections/tokens-section.tsx`
- `components/dev-panel/sections/cost-breakdown-section.tsx`
- `components/dev-panel/sections/timeline-section.tsx`
- `components/dev-panel/dev-panel-footer.tsx`
- `hooks/use-onboarding-debug.ts`

**Pipelines (11+ файлов):**
- `lib/briefing/briefing-filter.ts`
- `lib/briefing/briefing-author.ts`
- `lib/briefing/briefing-section-author.ts`
- `lib/briefing/research-engine.ts`
- `lib/podcast/script-generator.ts`
- `lib/podcast/tts-gemini.ts`
- `lib/meeting/meeting-pipeline.ts`
- `lib/meeting/deepgram-transcribe.ts`
- `lib/ai/professor-pipeline.ts`
- `lib/ai/clerks/*.ts`
- `lib/ai/professors/*.ts`
- `lib/ai/tools/deep-research.ts`
- `lib/ai/vision-ocr.ts`
- `app/(chat)/actions.ts`
- `app/(chat)/api/assistant/ben/route.ts`
- `app/(chat)/api/projects/[id]/analyze-file/route.ts`
- `app/(chat)/api/projects/[id]/generate-summary/route.ts`

**Cost Audit Dashboard (Этап 7):**
- `app/(dashboard)/admin/cost-audit/page.tsx`
- `lib/db/queries.ts` (getCostByModel, возможно новые breakdown queries)

**Документация:**
- `docs/decisions/030-sdk-native-usage-tracking.md` — новый
- `docs/ai-providers.md`
- `CHANGELOG.md`
- `SIMPLY_STATUS.md`
- `CLAUDE.md`
- `package.json`

---

## Мантра

**"Непроверенный код = несуществующий код. Непровалидированная стоимость = биллинговый риск."**

Каждая цифра в Dev Panel должна совпадать с Anthropic Console с точностью <1%.
