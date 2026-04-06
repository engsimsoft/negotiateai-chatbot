/**
 * ТЗ-RAG1: Memory retrieval + prompt injection
 *
 * Retrieves relevant facts from MIND memory and formats them
 * for injection into the system prompt.
 *
 * Budget: ~500 tokens for the memory block (top-5 facts).
 * Soft framing: "Из предыдущих разговоров известно..." — non-intrusive.
 */

import "server-only";

import { logUsage } from "@/lib/ai/usage-utils";
import { VOYAGE_QUERY_MODEL } from "./voyage-client";
import { searchSimilarMemories } from "./memory-queries";
import type { MemorySearchResult } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max facts to inject into prompt */
const MAX_FACTS_FOR_PROMPT = 5;

/** Min similarity for retrieval (lower than dedup — cast a wider net) */
const RETRIEVAL_MIN_SIMILARITY = 0.3;

/** Max results to fetch from pgvector (pre-filter pool) */
const RETRIEVAL_SEARCH_LIMIT = 10;

// ---------------------------------------------------------------------------
// Category labels for prompt display
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  fact: "факт",
  task: "задача",
  preference: "предпочтение",
  calendar: "событие",
  person: "человек",
  decision: "решение",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievalResult {
  /** Formatted text block for system prompt (empty string if no facts) */
  promptBlock: string;
  /** Retrieved facts with similarity scores */
  facts: MemorySearchResult[];
  /** Voyage API tokens used for query embedding */
  voyageTokens: number;
  /** Total retrieval duration in ms */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// retrieveMemoryContext — main entry point
// ---------------------------------------------------------------------------

/**
 * Retrieve relevant memory facts for a user query.
 *
 * Returns a formatted prompt block and metadata.
 * If no relevant facts found or Voyage API fails — returns empty block
 * (graceful degradation, never throws).
 */
export async function retrieveMemoryContext(
  userId: string,
  queryText: string,
  options?: { chatId?: string | null },
): Promise<RetrievalResult> {
  const startTime = Date.now();

  try {
    const { results, totalTokens } = await searchSimilarMemories(
      userId,
      queryText,
      {
        limit: RETRIEVAL_SEARCH_LIMIT,
        minSimilarity: RETRIEVAL_MIN_SIMILARITY,
      },
    );

    const durationMs = Date.now() - startTime;

    // Log Voyage search usage (costUsdOverride — Voyage pricing too small for RUB rounding)
    const voyageSearchCostUsd = (totalTokens / 1_000_000) * 0.02; // voyage-4-lite: $0.02/1M tokens
    logUsage({
      userId,
      usage: {
        inputTokens: totalTokens,
        outputTokens: 0,
        totalTokens,
        inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
        outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
      },
      modelId: VOYAGE_QUERY_MODEL,
      chatMode: "memory:search",
      chatId: options?.chatId ?? null,
      durationMs,
      costUsdOverride: voyageSearchCostUsd,
    });

    // Take top-N for prompt injection
    const topFacts = results.slice(0, MAX_FACTS_FOR_PROMPT);
    const promptBlock = formatMemoryForPrompt(topFacts);

    console.log(
      `[MemoryRetrieve] Found ${results.length} facts, injecting ${topFacts.length} (${durationMs}ms)`,
    );

    return {
      promptBlock,
      facts: topFacts,
      voyageTokens: totalTokens,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    console.warn(
      "[MemoryRetrieve] Failed (graceful degradation):",
      error instanceof Error ? error.message : error,
    );

    // Graceful degradation: return empty block, chat works without memory
    return {
      promptBlock: "",
      facts: [],
      voyageTokens: 0,
      durationMs,
    };
  }
}

// ---------------------------------------------------------------------------
// formatMemoryForPrompt — format facts as a system prompt block
// ---------------------------------------------------------------------------

/**
 * Format retrieved facts into a prompt block.
 *
 * Returns empty string if no facts — caller should not inject anything.
 */
export function formatMemoryForPrompt(facts: MemorySearchResult[]): string {
  if (facts.length === 0) {
    return "";
  }

  const lines = facts.map((f) => {
    const label = CATEGORY_LABELS[f.entry.category] ?? f.entry.category;
    const confidence = Math.round(Number(f.entry.confidence ?? 1) * 100);
    return `- [${label}] ${f.entry.content} (ув��ренность: ${confidence}%)`;
  });

  return `<memory>
Из предыдущих разговоров известно:
${lines.join("\n")}

Используй эту информацию мягко и естественно. Упоминай только если это релевантно текущему запросу. Не навязывай и не пересказывай всё подряд.
</memory>`;
}
