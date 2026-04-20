# FINDINGS — ТЗ-COMPACTION-1

Находки костылей / архитектурных долгов обнаруженные в процессе ТЗ, выходящие
за scope MVP. **НЕ расширять scope текущего ТЗ** — каждая находка medium/high
должна быть оформлена как `TZ_<name>.md` в `specs/_backlog/` на Финализации.

---

## Finding #1 — `generateObject` помечен `@deprecated` в AI SDK v6

**Impact:** Medium (codebase-wide).

**Where:** `node_modules/ai/dist/index.d.ts:5154`:

```
@deprecated Use `generateText` with an `output` setting instead.
```

**Current usage в проекте:**
- [lib/ai/memory/extract.ts:134](../../lib/ai/memory/extract.ts) — `extractFactsFromMessages` (Grok 4.20 reasoning).
- [lib/ai/memory/extract.ts:316](../../lib/ai/memory/extract.ts) — `batchExtractFacts` (Grok 4.1 Fast).
- [lib/ai/memory/extract.ts:451](../../lib/ai/memory/extract.ts) — `verifyDuplicatesWithLLM` (Grok 4.1 Fast).
- [lib/ai/compaction/summarize.ts](../../lib/ai/compaction/summarize.ts) — новый в этом ТЗ, использует тот же pattern для consistency.

**Рекомендуемая миграция:** `generateText({ model, output: Output.object({ schema }) })` вместо `generateObject({ model, schema })`. Возвращаемое API немного меняется — объект лежит в `experimental_output` или `object` в зависимости от Output helper'а (нужна проверка актуальной документации на момент миграции).

**Почему не делаем сейчас:** scope creep. ТЗ-COMPACTION-1 должен следовать существующему паттерну MIND extract — перевод в рамках одного ТЗ был бы частичным (или потребовал бы одновременной миграции MIND, что удвоит scope и риски). Миграция — отдельный ТЗ.

**Предлагаемое название будущего ТЗ:** `TZ_GenerateObjectToOutputAPI.md` (backlog).

---

## Finding #2 — Конфликт схем `DebugCompactionData` ✅ ЗАКРЫТ (2026-04-19)

**Impact:** High (блокер для Этапа A5 текущего ТЗ) — **разрешён архитектором**.

**Решение архитектора (2026-04-19):** вариант B — раздельные event channels. Применено:
- Существующий `data-debug-compaction` в `lib/ai/debug-events.ts` остаётся неизменным (dev-only, для Anthropic provider iterations).
- Новый user-visible event: `data-compaction` через `emitCompactionEvent` в новом файле `lib/ai/compaction/events.ts`, без `isSimplyDevMode` gating, тип данных `CompactionEvent` (из `lib/ai/compaction/types.ts`).
- Архитектурный документ обновлён v1.8 → v1.9 (9-я правка в §Виджет контекста → Реализация через DataStream protocol).
- Файл `lib/ai/compaction/events.ts` создан, tsc чист.

**Context:** В [lib/ai/debug-events.ts:102-112](../../lib/ai/debug-events.ts) уже существует тип `DebugCompactionData` и функция `emitDebugCompaction`, созданные в ТЗ-RAG3 для **Anthropic provider compaction**. Текущая схема:

```typescript
interface DebugCompactionData {
  triggered: boolean;
  iterations: Array<{ type: 'compaction' | 'message'; inputTokens: number; outputTokens: number }>;
}
```

Активно используется в [app/(chat)/api/chat/route.ts:1253](../../app/(chat)/api/chat/route.ts#L1253) (читает `providerMetadata.anthropic.iterations`).

**Архитектурная v1.8 схема** для Simply Compaction (см. [SIMPLY_COMPACTION_ARCHITECTURE.md §Виджет контекста](../Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md)):

```typescript
type DebugCompactionData = {
  kind: "compaction" | "truncation_warning";
  chatId: UUID;
  compactionIndex: number;
  compactionCount: number;
  summaryTokens: number;
  squeezedTokens: number;
};
```

**Конфликт:** несовместимые схемы — одно поле `triggered` vs `kind`, `iterations` vs `compactionIndex/Count/summaryTokens/squeezedTokens`.

**Разрешение в Этапе A5:** два варианта:

1. **Discriminated union** — расширить существующий `DebugCompactionData` дискриминатором `source: "provider" | "simply"` с разной shape для каждой ветки. Один event type, две formы.
2. **Раздельные события** — ввести `DebugSimplyCompactionData` + `emitSimplySiCompaction` / `data-simply-compaction` тип события, оставить существующий неизменным для Anthropic provider compaction. Dev Panel обрабатывает два разных события.

**Рекомендация:** вариант 2 (раздельные события). Они семантически разные (провайдерский compaction = iterations metadata; Simply Compaction = state после сжатия), одноимённый тип будет бременем на future maintenance. Dev Panel уже показывает оба пути через отдельные accent'ы (warning vs info).

**Это НЕ отдельный долг в backlog** — решается внутри Этапа A5 на cтыковке middleware с UI.

---

## Finding #3 — Рассинхронизация taskId `project:expert:*` → catalog entry vs реального project model ✅ ЗАКРЫТ (2026-04-19, Этап A5)

**Impact:** Low (закрыт в Этапе A5 рефакторингом Line 952-965).

**Разрешение:** в Этапе A5 введён `effectiveModelId = getModelIdForTask(activeTaskId)`, передаётся прямо в `getCompactionStrategy(effectiveModelId)`. Заплатка `|| isProjectChat` удалена из `chat/route.ts`.

**Побочный эффект — корректное behavior change для project:expert:haiku:**

- **Старое поведение:** `supportsCompaction = isAnthropicModel && (modelSupportsCompaction || isProjectChat)` форсированно включал Anthropic Compaction API для Haiku в project chat. Но Haiku 4.5 **архитектурно не поддерживает** Compaction API (per Anthropic docs, только Sonnet/Opus 4+). `capabilities.supportsCompaction: false` в [model-catalog.ts:240](../../lib/ai/model-catalog.ts#L240) — это истина. Anthropic API скорее всего молча игнорировал опцию (либо была тихая degradation без сигнала).
- **Новое поведение:** `getCompactionStrategy("claude-haiku-4-5-20251001") → { kind: "simply" }`, `compactionOptions = undefined`. Haiku project chat → без provider compaction, fallback на sliding window truncation (`getMessagesByChatId maxTokens=140K` — работает как и для остальных).
- **Оценка регрессии:** минимальная. Haiku Compaction API никогда фактически не работал — убираем запрос функции которой нет. Simply Compaction на Haiku в project chat пока не активирована (MVP scope — только expertise).

Требует внимания в Этапе A6 smoke test: отдельная регрессионная проверка project:expert:* на всех 3 tier'ах (что Opus/Sonnet всё ещё работают с Anthropic Compaction, Haiku — нормально работает на sliding window).

**Context:** Архитектор подтвердил в [ARCHITECT_ANSWERS.md Q1](./ARCHITECT_ANSWERS.md) что `isProjectChat` special case в `supportsCompaction` check — заплатка над разными путями резолва model:
- В project chat `modelToUse = projectModelConfig.model` (через `getProjectModel(tier)` из `model-tiers.ts`).
- А `effectiveCatalogEntry = getModelEntry(getModelIdForTask(activeTaskId))` резолвится через taskId `project:expert:${tier}`.

**Разрешение в Этапе A5:** правка Line 952-965 через `getCompactionStrategy(effectiveModelId)` с передачей реального modelId для project chat (из `projectModelConfig.model.modelId` или equivalent lookup) — убирает `|| isProjectChat` case.

**Это НЕ отдельный долг в backlog** (per архитектор) — маленькая правка внутри переписываемого блока.

---

## Finding #4 — Точка интеграции middleware требует пересмотра (ChatMessage vs ModelMessage)

**Impact:** Medium (решено в Этапе A4, уточнение для A5).

**Context:** ROADMAP §A5 sketch предполагает вызов middleware на `messagesForRequest` (line 1089 chat/route.ts), а это уже `ModelMessage[]` после `convertToModelMessages`. Архитектурный документ v1.8 специфицирует `UIMessage[]`.

**Решение принятое в A4:**
- Middleware работает на `ChatMessage[]` (проектный alias `UIMessage<MessageMetadata, ...>`).
- Получает ТОЛЬКО историю разговора (без leading system prompt).
- Интеграция в A5 сдвигается с `messagesForRequest` (line 1089) на `uiMessages` (~line 504) — до `convertToModelMessages`.

**Обоснование:** чище архитектурно. В `messagesForRequest` смешаны system/MIND/cache-control разметки после конверсии — middleware пришлось бы их распутывать. Работа на уровне `ChatMessage[]` — концептуально прозрачная «сжать историю, потом конвертировать».

**Это НЕ отдельный долг в backlog** — закрыто в скоупе текущего ТЗ.
