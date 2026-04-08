/**
 * ТЗ-C1.5: Context window budget configuration
 *
 * Working budget = sliding window limit (tokens loaded from DB).
 * Snapshot threshold = % of working budget at which Expert suggests a snapshot.
 */

/** Working budget: max tokens loaded into context (sliding window) */
export const CONTEXT_BUDGET = 140_000;

/** Threshold (0-1): suggest snapshot at this % of working budget */
export const SNAPSHOT_THRESHOLD = 0.7;

/** Messages to wait after suggestion before fallback kicks in */
export const FALLBACK_MESSAGE_PAIRS = 5;

/** Calculate usage percentage (0-100) */
export function calcUsagePercent(
  tokens: number,
  budget = CONTEXT_BUDGET
): number {
  if (budget <= 0) return 0;
  return Math.min(Math.round((tokens / budget) * 100), 100);
}
