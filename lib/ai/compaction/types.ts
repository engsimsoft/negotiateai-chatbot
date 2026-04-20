/**
 * ТЗ-COMPACTION-1 / ТЗ-COMPACTION-UNIFY: Simply Compaction — общие типы для middleware.
 *
 * Архитектурный источник: specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md (v2.0),
 * ADR 054 Single-strategy provider-agnostic compaction.
 *
 * NB: файл НЕ имеет `"server-only"` — он экспортирует типы используемые и
 * сервером (middleware в `lib/ai/compaction/`), и клиентом (`CompactionEvent`
 * в `components/elements/context.tsx` + `lib/types.ts` CustomUIDataTypes).
 * Пустой type-only файл без runtime side effects безопасен для client import.
 */

import type { ChatMessage } from "@/lib/types";
import type { MemorySourceType } from "@/lib/ai/memory/types";

/**
 * Контекст, передаваемый middleware из chat handler'а. Содержит всё что
 * нужно middleware для threshold check + orchestration extract → compact:
 *
 *  - `chatId` — для чтения/записи compaction state в БД (3 поля Chat).
 *  - `userId` — для вызова `batchExtractFacts` на сообщениях, уходящих в summary.
 *    ТЗ-COMPACTION-UNIFY: middleware оркестрирует extract → compact на одной
 *    группе сообщений (Mem0 best practice «memory formation before summarization»).
 *  - `modelId` — физический modelId целевой модели чата (для логирования).
 *    Compaction всегда использует `grok-4-1-fast-non-reasoning` через taskId
 *    `compaction:summarize` — это НЕ тот modelId.
 *  - `sourceType` — chatMode caller-а ("simply" / "expertise" / "create" / "project").
 *    Передаётся в `batchExtractFacts` → сохраняется в `memory_entry.sourceType`
 *    для корректной фильтрации retrieve по источнику.
 *  - `sourceProjectId` — только для project chat, иначе undefined/null.
 *  - `systemPromptTokens` / `totalHistoryTokens` / `newMessageTokens` /
 *    `mindTokens` — уже посчитанные caller'ом через `estimateMessageTokens`.
 *    Формула совпадает с MIND extract trigger в chat/route.ts.
 *  - `mindTokens` включает retrieved facts (dynamic). Profile block включён
 *    в `systemPromptTokens` (inject в system prompt на chat/route.ts).
 *  - `toolsTokens` — Zod inputSchema + description каждого активного tool.
 *    Свойство call site (не middleware). Compaction решает про history,
 *    не про tools registry.
 */
export interface CompactionContext {
  chatId: string;
  userId: string;
  modelId: string;
  sourceType: MemorySourceType;
  sourceProjectId?: string | null;
  systemPromptTokens: number;
  totalHistoryTokens: number;
  newMessageTokens: number;
  mindTokens?: number;
  toolsTokens?: number;
}

/**
 * Событие, которое middleware возвращает caller'у для эмита в DataStream
 * через `emitCompactionEvent` ([events.ts](./events.ts)).
 *
 * ТЗ-COMPACTION-UNIFY: поле `kind` удалено — compaction работает молча,
 * user-visible предупреждение на Hard threshold убрано (handoff-сценарий
 * перенесён в COMPACTION-3). Виджет контекста показывает индикатор
 * «📦 Разговор сжат» при любом compactionEvent !== null.
 */
export interface CompactionEvent {
  chatId: string;
  /** Сколько сообщений ушло в summary на этом turn'е. */
  compactionIndex: number;
  /** Счётчик compaction-циклов для чата (после инкремента). */
  compactionCount: number;
  /** Оценка размера сгенерированного summary в токенах. */
  summaryTokens: number;
  /** Оценка размера сжатой части истории в токенах (до компакции). */
  squeezedTokens: number;
}

/**
 * Результат middleware. `messages` — готовый массив для передачи в конверсию
 * `convertToModelMessages` → streamText. Если compaction не сработал —
 * возвращается исходный массив без изменений (identity), `compactionEvent`
 * отсутствует.
 *
 * При сработавшем compaction в массиве первым идёт synthetic assistant-message
 * с summary предыдущей части разговора (роль `assistant`, не `system` — так
 * модель читает его как прошлый ход, а caller может спокойно ставить свой
 * system prompt отдельно).
 */
export interface PrepareMessagesResult {
  messages: ChatMessage[];
  compactionEvent?: CompactionEvent;
}
