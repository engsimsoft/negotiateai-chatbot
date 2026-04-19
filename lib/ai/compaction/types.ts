/**
 * ТЗ-COMPACTION-1: Simply Compaction MVP — общие типы для middleware.
 *
 * Архитектурный источник: specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md (v1.9).
 *
 * NB: файл НЕ имеет `"server-only"` — он экспортирует типы используемые и
 * сервером (middleware в `lib/ai/compaction/`), и клиентом (`CompactionEvent`
 * в `components/elements/context.tsx` + `lib/types.ts` CustomUIDataTypes).
 * Пустой type-only файл без runtime side effects безопасен для client import.
 */

import type { ChatMessage } from "@/lib/types";
import type { CompactionStrategy } from "@/lib/ai/model-catalog";

export type { CompactionStrategy };

/**
 * Контекст, передаваемый middleware из chat handler'а. Содержит всё что
 * нужно middleware для threshold check без повторного подсчёта токенов:
 *
 *  - `chatId` — для чтения/записи compaction state в БД (3 поля Chat).
 *  - `modelId` — физический modelId целевой модели чата (для резолва
 *    стратегии через `getCompactionStrategy`). Compaction всегда использует
 *    свой `grok-4-1-fast-non-reasoning` через taskId `compaction:summarize`
 *    — это не тот modelId.
 *  - `systemPromptTokens` / `totalHistoryTokens` / `newMessageTokens` /
 *    `mindTokens` — уже посчитанные caller'ом через `estimateMessageTokens`.
 *    Формула совпадает с MIND extract trigger в chat/route.ts:787-793.
 */
export interface CompactionContext {
  chatId: string;
  modelId: string;
  systemPromptTokens: number;
  totalHistoryTokens: number;
  newMessageTokens: number;
  mindTokens?: number;
  /**
   * Tools schemas tokens — Zod inputSchema + description для каждого активного tool.
   * Считается на call site через `zod-to-json-schema` (или alternative SDK utility),
   * передаётся middleware для честного `totalContext` подсчёта.
   *
   * ТЗ-COMPACTION-1 fix #2 (архитекторское решение 2026-04-19): tools — свойство
   * call site, не middleware. Compaction решает про history, не про tools registry.
   */
  toolsTokens?: number;
}

/**
 * Событие, которое middleware возвращает caller'у для эмита в DataStream
 * через `emitDebugCompaction` (пока — переиспользуемый helper в
 * `lib/ai/debug-events.ts`, расширение схемы — задача A5).
 *
 *  - `kind: "compaction"` — обычное сжатие сработало (Soft threshold).
 *  - `kind: "truncation_warning"` — сжатие сработало + порог Hard превышен,
 *    UI рекомендует начать новый чат (Фаза 3 архитектуры).
 */
export interface CompactionEvent {
  kind: "compaction" | "truncation_warning";
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
