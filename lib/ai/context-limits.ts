/**
 * ТЗ-C1.5: Context window budget configuration
 *
 * Working budget = sliding window limit (tokens loaded from DB).
 * Snapshot threshold = % of working budget at which Expert suggests a snapshot.
 */

/** Working budget: max tokens loaded into context (sliding window) */
export const CONTEXT_BUDGET = 140_000;

/** ТЗ-SlidingWindow: max messages sent to API for Simply chat (≈10 exchanges) */
export const SIMPLY_SLIDING_WINDOW_SIZE = 20;

/** Threshold (0-1): suggest snapshot at this % of working budget */
export const SNAPSHOT_THRESHOLD = 0.7;

/** Messages to wait after suggestion before fallback kicks in */
export const FALLBACK_MESSAGE_PAIRS = 5;

/**
 * ТЗ-SlidingWindow: Trim messages so the window starts with a user message.
 * If the first message is assistant/tool, drop leading non-user messages
 * to avoid sending orphaned assistant/tool context to the API.
 */
export function trimToUserStart<T extends { role: string }>(messages: T[]): T[] {
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  if (firstUserIdx <= 0) return messages;
  return messages.slice(firstUserIdx);
}

/** Calculate usage percentage (0-100) */
export function calcUsagePercent(
  tokens: number,
  budget = CONTEXT_BUDGET
): number {
  if (budget <= 0) return 0;
  return Math.min(Math.round((tokens / budget) * 100), 100);
}
