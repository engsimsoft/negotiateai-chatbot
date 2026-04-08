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

/** Calculate usage percentage (0-100) */
export function calcUsagePercent(
  tokens: number,
  budget = CONTEXT_BUDGET
): number {
  if (budget <= 0) return 0;
  return Math.min(Math.round((tokens / budget) * 100), 100);
}
