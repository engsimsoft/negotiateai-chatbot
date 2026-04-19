/**
 * ТЗ-C1.5: Context window budget configuration
 *
 * Working budget = sliding window limit (tokens loaded from DB).
 * Snapshot threshold = % of working budget at which Expert suggests a snapshot.
 */

/** Working budget: max tokens loaded into context (sliding window) */
export const CONTEXT_BUDGET = 140_000;

/** Simply context window limit: min(MiniMax 204K, Sonnet 200K) */
export const SIMPLY_CONTEXT_LIMIT = 200_000;

/** Threshold (0-1): suggest snapshot at this % of working budget */
export const SNAPSHOT_THRESHOLD = 0.7;

/** Messages to wait after suggestion before fallback kicks in */
export const FALLBACK_MESSAGE_PAIRS = 5;

/** ТЗ-ExtractCompression: Soft threshold (60%) — extract if pause ≥ 10 min */
export const EXTRACT_THRESHOLD_SOFT = 0.6;

/** ТЗ-ExtractCompression: Hard threshold (80%) — extract immediately */
export const EXTRACT_THRESHOLD_HARD = 0.8;

/** ТЗ-ExtractCompression: Minimum pause before soft-threshold extract (10 minutes) */
export const EXTRACT_PAUSE_MS = 10 * 60 * 1000;

/**
 * Simply Compaction MVP (ТЗ-COMPACTION-1, 2026-04-18).
 *
 * Константы для middleware `lib/ai/compaction/` — пороги срабатывания и
 * размеры окон. База расчёта — `SIMPLY_CONTEXT_LIMIT` (200K). Подсчёт
 * токенов через `estimateMessageTokens` из `lib/utils.ts` (SSOT формулы
 * идентичен MIND extract).
 *
 * Унификация с `EXTRACT_THRESHOLD_*` запланирована в backlog-долге
 * TZ_UnifyContextThresholdBase (не блокирует MVP).
 *
 * Архитектурный источник: specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md
 */

/** Soft threshold: 50% от SIMPLY_CONTEXT_LIMIT = 100_000 токенов — запускает сжатие. */
export const COMPACTION_THRESHOLD_SOFT = 0.5;

/** Hard threshold: 85% от SIMPLY_CONTEXT_LIMIT = 170_000 токенов — Фаза 3, предупреждение о новом чате. */
export const COMPACTION_THRESHOLD_HARD = 0.85;

/** Дословное окно: последние N токенов истории сохраняются verbatim после сжатия. */
export const COMPACTION_VERBATIM_WINDOW_TOKENS = 40_000;

/** Target объём summary в промпте (hard cap 4096 задан в task-assignments.ts для compaction:summarize). */
export const COMPACTION_SUMMARY_TARGET_TOKENS = 3_000;

/** Calculate usage percentage (0-100) */
export function calcUsagePercent(
  tokens: number,
  budget = CONTEXT_BUDGET
): number {
  if (budget <= 0) return 0;
  return Math.min(Math.round((tokens / budget) * 100), 100);
}
