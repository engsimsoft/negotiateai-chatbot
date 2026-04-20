/**
 * Simply context limits — SSOT для бюджетов контекстного окна и compaction-порогов.
 *
 * ТЗ-COMPACTION-UNIFY (v3.95.0): все пороги считаются от `SIMPLY_CONTEXT_LIMIT`.
 * Константы `CONTEXT_BUDGET`, `EXTRACT_THRESHOLD_SOFT/HARD`, `EXTRACT_PAUSE_MS`
 * удалены — MIND extract теперь работает только в составе compaction cycle
 * через `prepareMessagesWithCompaction`, отдельной per-turn/threshold логики нет.
 *
 * Архитектурный источник: specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md (v2.0),
 * ADR 054 Single-strategy provider-agnostic compaction.
 */

/** Simply context window limit: min(MiniMax 204K, Sonnet 200K). База всех % порогов. */
export const SIMPLY_CONTEXT_LIMIT = 200_000;

/** Threshold (0-1): suggest snapshot at this % of working budget (legacy Snapshot tool). */
export const SNAPSHOT_THRESHOLD = 0.7;

/** Messages to wait after suggestion before fallback kicks in (legacy Snapshot tool). */
export const FALLBACK_MESSAGE_PAIRS = 5;

/**
 * Simply Compaction MVP (ТЗ-COMPACTION-1, 2026-04-18; ТЗ-COMPACTION-UNIFY, 2026-04-20).
 *
 * Константы для middleware `lib/ai/compaction/` — пороги срабатывания и
 * размеры окон. База расчёта — `SIMPLY_CONTEXT_LIMIT` (200K). Подсчёт
 * токенов через `estimateMessageTokens` из `lib/utils.ts` (SSOT формулы
 * идентичен MIND extract).
 *
 * Архитектурный источник: specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md (v2.0)
 */

/** Soft threshold: 50% от SIMPLY_CONTEXT_LIMIT = 100_000 токенов — запускает сжатие. */
export const COMPACTION_THRESHOLD_SOFT = 0.5;

/**
 * Hard threshold: 85% от SIMPLY_CONTEXT_LIMIT = 170_000 токенов.
 *
 * ТЗ-COMPACTION-UNIFY: **observability-only**. Middleware срабатывает на Soft (50%);
 * Hard используется только для различения `action=compact` vs `action=truncate`
 * в структурированных логах `[Compaction]`. Пользовательское предупреждение на
 * этом пороге убрано — сжатие происходит молча (ручной handoff-сценарий — в COMPACTION-3).
 */
export const COMPACTION_THRESHOLD_HARD = 0.85;

/** Дословное окно: последние N токенов истории сохраняются verbatim после сжатия. */
export const COMPACTION_VERBATIM_WINDOW_TOKENS = 40_000;

/** Target объём summary в промпте (hard cap 4096 задан в task-assignments.ts для compaction:summarize). */
export const COMPACTION_SUMMARY_TARGET_TOKENS = 3_000;

/**
 * MIND consolidation cumulative trigger.
 *
 * Consolidation запускается, когда `factsSinceConsolidation + storedCount >= 15`
 * (альтернатива к мгновенному триггеру `storedCount >= 10`). Накопительный порог
 * гарантирует периодический health-check памяти даже при малом потоке фактов
 * на compaction cycle.
 *
 * Источник: specs/_backlog/TZ_MindConsolidationTriggers.md (v2, 2026-04-21).
 */
export const CONSOLIDATION_THRESHOLD_CUMULATIVE = 15;

/** Calculate usage percentage (0-100). Default budget — `SIMPLY_CONTEXT_LIMIT`. */
export function calcUsagePercent(
  tokens: number,
  budget = SIMPLY_CONTEXT_LIMIT
): number {
  if (budget <= 0) return 0;
  return Math.min(Math.round((tokens / budget) * 100), 100);
}
