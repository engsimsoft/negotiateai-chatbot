/**
 * ТЗ-PIPELINE1: Retry wrapper with per-attempt usage logging.
 *
 * AI SDK default maxRetries=2 does hidden retries without exposing usage.
 * This wrapper replaces that: callers set maxRetries:0 on AI SDK calls
 * and use this wrapper for transparent retry with logging.
 */

import type { LanguageModelUsage } from "ai";
import { waitUntil } from "@vercel/functions";
import { logUsage } from "./usage-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryAttempt {
  /** 0-based attempt index */
  attempt: number;
  /** Usage returned by AI SDK (undefined if call failed before returning usage) */
  usage?: LanguageModelUsage;
  /** Error message if this attempt failed */
  error?: string;
  /** Duration of this attempt in ms */
  durationMs: number;
}

export interface RetryResult<T> {
  /** The successful result */
  result: T;
  /** Usage from the successful attempt */
  usage: LanguageModelUsage;
  /** All attempts (including failed ones) */
  attempts: RetryAttempt[];
  /** Total duration across all attempts */
  totalDurationMs: number;
}

export interface RetryWithLoggingOptions {
  /** Max number of attempts (not retries). 3 = 1 initial + 2 retries. */
  maxAttempts: number;
  /** User ID for usage logging */
  userId?: string;
  /** Model ID for usage logging */
  modelId: string;
  /**
   * Provider id (anthropic, minimax, xai, google, voyage, …). Required so
   * ai_usage_log.provider is never NULL. Resolve via getProviderForTask(taskId).
   */
  provider: string;
  /** Chat mode for usage logging (e.g. "briefing:author") */
  chatMode: string;
  /** Delay between retries in ms (default: 2000) */
  retryDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Retry an AI SDK call with per-attempt usage logging.
 *
 * Callers must set `maxRetries: 0` on the AI SDK call to disable
 * hidden SDK retries. This wrapper handles retries explicitly.
 *
 * @param fn - Function that makes the AI SDK call and returns { result, usage }
 * @param options - Retry and logging configuration
 */
export async function retryWithLogging<T>(
  fn: () => Promise<{ result: T; usage: LanguageModelUsage }>,
  options: RetryWithLoggingOptions,
): Promise<RetryResult<T>> {
  const {
    maxAttempts,
    userId,
    modelId,
    provider,
    chatMode,
    retryDelayMs = 2000,
  } = options;

  const attempts: RetryAttempt[] = [];
  const overallStart = Date.now();

  for (let i = 0; i < maxAttempts; i++) {
    const attemptStart = Date.now();

    try {
      const { result, usage } = await fn();
      const durationMs = Date.now() - attemptStart;

      attempts.push({ attempt: i, usage, durationMs });

      // Log successful attempt
      if (userId) {
        waitUntil(
          logUsage({ userId, usage, modelId, provider, chatMode, durationMs }),
        );
      }

      return {
        result,
        usage,
        attempts,
        totalDurationMs: Date.now() - overallStart,
      };
    } catch (err) {
      const durationMs = Date.now() - attemptStart;
      const errorMsg = err instanceof Error ? err.message : String(err);

      attempts.push({ attempt: i, error: errorMsg, durationMs });

      console.warn(
        `[retry-with-logging] ${chatMode} attempt ${i + 1}/${maxAttempts} failed (${durationMs}ms): ${errorMsg}`,
      );

      // Last attempt — throw
      if (i === maxAttempts - 1) {
        throw err;
      }

      // Wait before retry
      if (retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("retryWithLogging: no attempts made");
}
