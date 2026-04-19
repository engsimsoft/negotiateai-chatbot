# ARCHITECT_ANSWERS — ответы архитектора на вопросы Фазы 1 ТЗ-COMPACTION-1

**Дата:** 2026-04-18
**Источник:** ANALYSIS.md §5 Вопросы архитектору (Группа 1 — блокировала ROADMAP, Группа 2 — детали реализации)
**Итог применения:** архитектурный документ v1.7 → v1.8, 8 правок (см. журнал версий v1.8).

---

## Группа 1 (блокировала ROADMAP) — закрыто

### Q1 — `isProjectChat` special case в [chat/route.ts:952](../../app/(chat)/api/chat/route.ts#L952)

**Ответ архитектора:**

Это заплатка над рассинхронизацией model resolution в project chat:
- В project chat `modelToUse = projectModelConfig.model` (через `getProjectModel(tier)` — прямой резолв из `model-tiers.ts`, см. [chat/route.ts:618-619](../../app/(chat)/api/chat/route.ts#L618-L619)).
- А `effectiveCatalogEntry = getModelEntry(getModelIdForTask(activeTaskId))` — резолвится через taskId `project:expert:${tier}`.
- Эти два пути могут не совпадать в `capabilities.supportsCompaction` — taskId-mapping catalog entry отстаёт от реального project model.
- `isProjectChat = true` **форсирует** включение Compaction API даже если capability через taskId говорит false — доверяя что project chat всегда на Claude.

**Решение (принято архитектором, проверено разработчиком в коде):**

Переписать корректно через `getCompactionStrategy(modelId)` с передачей **реального modelId** (не taskId-резолв):
- Для project chat — `projectModelConfig.model.modelId` (или equivalent lookup).
- Для expertise/create/simply — `getModelIdForTask(activeTaskId)`.
- Убрать `|| isProjectChat` из нового supportsCompaction check.

Добавить в [FINDINGS.md](./FINDINGS.md) хвост: «Рассинхронизация taskId `project:expert:*` → catalog entry vs. реального project model resolution — разобрать при следующем касании project model routing».

**Это НЕ отдельный долг в backlog** — маленькая правка внутри того что переписываем.

**Верификация разработчика (Claude Code):**

- Grep подтвердил `getProjectModel` + `projectModelConfig = getProjectModel(tier)` на [route.ts:618](../../app/(chat)/api/chat/route.ts#L618).
- Рефакторинг Line 952-965 через `getCompactionStrategy(modelId)` сохраняет current behavior для Anthropic моделей (Simply Chat vision на Haiku, project:expert:* на Opus/Sonnet/Haiku) — **но требует explicit smoke test** на каждом из этих путей в Этапе A6 ROADMAP. Риск добавлен в §6 Риски.
- Добавлено в архитектурный документ v1.8 в секции «Сводка изменений кода» (таблица).

### Q2 — Источник pre-call usage для threshold check

**Ответ архитектора:**

Мой Finding #5 был неточен. В коде уже есть `estimateMessageTokens` — in-house approximation в `lib/utils.ts`, используется повсеместно.

Формула из MIND extract ([chat/route.ts:787-793](../../app/(chat)/api/chat/route.ts#L787-L793)):
```typescript
const totalContext = systemPromptTokens + mindTokens + totalHistoryTokens + newMessageTokens;
```

**Решение:** использовать ту же формулу для compaction threshold — SSOT подсчёта токенов во всех context-threshold механизмах.

**Верификация разработчика (Claude Code):**

- Grep подтвердил `estimateMessageTokens` в [lib/utils.ts](../../lib/utils.ts) и использование на Line 485, 507, 787-793 chat/route.ts.
- Explore-агент ошибочно докладывал «tokenizer не найден» — он искал npm-библиотеки (`tiktoken`, `gpt-tokenizer`), не in-house функции. Good catch архитектора.
- Добавлено в архитектурный документ v1.8 в секции «Подсчёт токенов» (§Техническая реализация).
- В expertise/create `mindTokens = 0` (MIND dynamic block инжектируется только в Simply Chat). Формула универсальна — готова к COMPACTION-2 без изменений.

### Q3 — Язык summary

**Ответ архитектора:**

Согласен с рекомендацией (b): **одна инструкция на русском + автоадаптация модели по языку разговора.**

Финально: промпт на русском (стандарт Simply), директива модели «ответь на том же языке что пользователь в разговоре». Grok 4.1 Fast справляется нативно.

**Верификация разработчика:**

- Согласован. Grok 4.1 Fast non-reasoning verified в MIND extract (ТЗ-XAI-2) на language adaptation задаче — та же схема.
- Добавлено в архитектурный документ v1.8 в §Требования к Summary → Язык.

---

## Группа 2 (детали реализации) — закрыто

### Q4 — UI событие до или после сжатия?

**Ответ архитектора:** После сжатия, одним событием на turn. ✅ Принято.

Реализация: `emitDebugCompaction(dataStream, {...})` после успешной записи в БД и подготовки compactedMessages. Добавлено в архитектурный документ v1.8 в §Виджет контекста → Реализация через DataStream protocol.

### Q5 — Fallback при ошибке summary generation

**Ответ архитектора:** Sliding window truncation + dev-лог через `emitDebugWarning`. Пользователь не видит error. ✅ Принято.

Конкретизация разработчика (для Фазы 3 ROADMAP):
- Try/catch вокруг вызова `generateObject` для summary.
- При ошибке: пропустить compaction на этом turn, использовать оригинальные messages (sliding window truncation применится как сейчас).
- `emitDebugWarning(dataStream, { source: "compaction:summarize", error: err.message })` — dev видит ошибку в DevPanel.
- Compaction попытается снова на следующем turn если threshold всё ещё превышен.

### Q6 — Hard upper bound на edge case verbatim window

**Ответ архитектора:** 80K токенов (~40% от SIMPLY_CONTEXT_LIMIT). Маркер `[...сообщение сокращено из-за большого размера...]`. ✅ Принято.

Добавлено в архитектурный документ v1.8 в §Дословное окно → Edge case B.

### Q7 — Название папки

**Ответ архитектора:** `lib/ai/compaction/` ок. Simply Compaction архитектурно ≠ MIND. ✅ Принято.

Структура (v1.8):
- `types.ts` — `CompactionStrategy`, `CompactionContext`, `PrepareMessagesResult`, `DebugCompactionData`
- `prompt.ts` — промпт генерации summary (на русском с language adaptation директивой)
- `summarize.ts` — вызов `generateObject(getModel("compaction:summarize"), ...)` с Zod schema
- `db-queries.ts` — read/write `compactionSummary` / `compactionIndex` / `compactionCount` в Chat
- `prepare-messages.ts` — основная middleware функция `prepareMessagesWithCompaction`

---

## Подтверждения и корректировки по ANALYSIS

### Оценка сложности 3 сессии — принято архитектором

Декомпозиция этапов A1-A6, B1, Финализация одобрена архитектором. Используется в ROADMAP.

### Риски — приемлемы с митигациями

Все 7 рисков из ANALYSIS §6 архитектор принял как приемлемые. Особое внимание:
- **Риск #6** (`npm run build` авто-миграция) — обязательный checkpoint-вопрос владельцу перед build в Этапе A6. **В ROADMAP явный checkpoint.**
- **Риск #7** (двойная обрезка sliding window + compaction) — проверить в Этапе A4.

### Soft dependencies — подтверждены как не-блокирующие

- [TZ_UnifyContextThresholdBase](../_backlog/TZ_UnifyContextThresholdBase.md) — не блокирует MVP.
- [TZ_DevPanelFooterHidesSubCalls](../_backlog/TZ_DevPanelFooterHidesSubCalls.md) — не блокирует MVP, SQL-доступ к `ai_usage_log` достаточен для observability.

### MIND extract timing в Этапе A6 smoke test

Добавить в валидацию: «MIND extract после compaction видит корректный текущий turn». В ROADMAP Этап A6 — явный пункт проверки.

---

## Итого

Группа 1 закрыта полностью. Группа 2 закрыта полностью. 8 правок в архитектурный документ v1.7 → v1.8 применены. **ROADMAP.md может создаваться (Фаза 2 WORKFLOW).**
