// ТЗ-BR1: Stage 1 — Filter & deduplicate using Gemini 2.0 Flash

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { FILTER_MODEL, MAX_FILTER_CANDIDATES } from "./briefing-config";
import type { RawContent } from "./source-fetchers/types";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const filteredItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  sourceName: z.string(),
  topicId: z.string(),
  oneLinerSummary: z.string(),
});

export type FilteredItem = z.infer<typeof filteredItemSchema>;

const filterResultSchema = z.object({
  candidates: z.array(filteredItemSchema),
});

/**
 * Stage 1: Filter raw content using Gemini Flash.
 * - Deduplicates (same story from multiple sources → keep best)
 * - Removes ads/promo
 * - Removes stale content (>48h unless important)
 * - Returns up to MAX_FILTER_CANDIDATES with one-liner summaries
 */
export async function filterContent(
  items: RawContent[],
  topicIds: string[],
): Promise<{ candidates: FilteredItem[]; tokensUsed: number }> {
  if (items.length === 0) {
    return { candidates: [], tokensUsed: 0 };
  }

  // Prepare articles for the prompt
  const articlesText = items
    .map(
      (item, i) =>
        `[${i + 1}] ${item.sourceName} (${item.sourceLanguage})
Title: ${item.title}
URL: ${item.url}
Published: ${item.publishedAt?.toISOString() || "unknown"}
Content: ${item.content}`,
    )
    .join("\n\n---\n\n");

  const { object, usage } = await generateObject({
    model: google(FILTER_MODEL),
    schema: filterResultSchema,
    system: `You are a news filter for a morning briefing service.
Your job is to select the ${MAX_FILTER_CANDIDATES} best news candidates from the raw feed.

Available topic categories: ${topicIds.join(", ")}

Rules:
1. DEDUPLICATE: If the same story appears from multiple sources, keep only the best version (most detailed, most authoritative)
2. REMOVE ads, promotional content, sponsored posts
3. REMOVE outdated news (>48 hours) unless it's genuinely important
4. For each candidate, write a one-liner summary (1 sentence, factual)
5. Assign each candidate to the most relevant topicId from the available list
6. Prefer original reporting over derivative content
7. Return up to ${MAX_FILTER_CANDIDATES} candidates, sorted by importance

Output JSON with "candidates" array.`,
    prompt: `Filter these ${items.length} articles:\n\n${articlesText}`,
  });

  return {
    candidates: object.candidates.slice(0, MAX_FILTER_CANDIDATES),
    tokensUsed: usage?.totalTokens ?? 0,
  };
}
