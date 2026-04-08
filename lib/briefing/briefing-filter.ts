// ТЗ-Briefing-1: Stage 1 — Filter & deduplicate using MiniMax M2.7
// (migrated from Gemini 2.0 Flash, generateObject → generateText + JSON.parse + Zod)

import { streamText } from "ai";
import { z } from "zod";
import type { ModelCatalog } from "tokenlens/core";
import { waitUntil } from "@vercel/functions";
import { logUsage } from "@/lib/ai/usage-utils";
import { buildAiCallTrace, type PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import { minimaxM27Long } from "@/lib/ai/providers";
import { FILTER_MODEL, MAX_FILTER_CANDIDATES } from "./briefing-config";
import type { RawContent } from "./source-fetchers/types";

export const filteredItemSchema = z.object({
  sourceItemId: z.string(),
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

// --- JSON schema description for prompt injection ---

const FILTER_JSON_INSTRUCTION = `

Ответь строго в формате JSON. Без markdown-обёртки (\`\`\`json), без пояснений до или после JSON.

JSON-схема ответа:
{
  "candidates": [
    {
      "sourceItemId": "string — EXACT itemId from [src-N] bracket of the source article",
      "title": "string — headline",
      "url": "string — article URL",
      "sourceName": "string — publication name",
      "topicId": "string — topic category from allowed list",
      "oneLinerSummary": "string — one sentence factual summary"
    }
  ]
}`;

/**
 * Stage 1: Filter raw content using MiniMax M2.7.
 * - Deduplicates (same story from multiple sources → keep best)
 * - Removes ads/promo
 * - Removes stale content (>48h unless important)
 * - Returns up to MAX_FILTER_CANDIDATES with one-liner summaries
 */
export async function filterContent(
  items: RawContent[],
  topicIds: string[],
  /** ТЗ-CACHE2: userId for usage logging */
  userId?: string,
  /** ТЗ-CACHE3: TokenLens catalog for SSOT cost calculation */
  catalog?: ModelCatalog,
): Promise<{ candidates: FilteredItem[]; tokensUsed: number; trace?: PipelineStageTrace }> {
  if (items.length === 0) {
    return { candidates: [], tokensUsed: 0 };
  }

  const startTime = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  // Prepare articles for the prompt
  const articlesText = items
    .map(
      (item) =>
        `[${item.itemId}] ${item.sourceName} (${item.sourceLanguage})
Title: ${item.title}
URL: ${item.url}
Published: ${item.publishedAt?.toISOString() || "unknown"}
Content: ${item.content}`,
    )
    .join("\n\n---\n\n");

  const userPrompt = `Filter these ${items.length} articles:\n\n${articlesText}`;

  const systemPrompt = `You are a news filter for a morning briefing service.
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
8. sourceItemId is REQUIRED. Return the EXACT itemId from the square brackets [src-N] of the source article the news was extracted from. For example, if the news comes from [src-3], set sourceItemId to "src-3".

Output JSON with "candidates" array.` + FILTER_JSON_INSTRUCTION;

  // ТЗ-Briefing-1: streamText + JSON.parse + Zod (MiniMax M2.7)
  // Using streamText instead of generateText — keeps connection alive for thinking model
  const res = streamText({
    model: minimaxM27Long,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.1,
    maxRetries: 0,
  });

  // Consume stream to get full text
  const text = await res.text;
  const usage = await res.usage;

  // Clean markdown wrapper and parse JSON
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const object = filterResultSchema.parse(JSON.parse(cleaned));

  const candidates = object.candidates.slice(0, MAX_FILTER_CANDIDATES);

  // ТЗ-DEV2: Post-generation validation
  const inputItemIds = new Set(items.map((it) => it.itemId).filter(Boolean));
  const inputUrls = new Map(items.map((it) => [it.itemId, it.url]));

  for (const c of candidates) {
    // Validate sourceItemId exists in input
    if (!inputItemIds.has(c.sourceItemId)) {
      warnings.push(`sourceItemId "${c.sourceItemId}" not found in input items`);
    }
    // Validate URL matches the source item
    const expectedUrl = inputUrls.get(c.sourceItemId);
    if (expectedUrl && c.url !== expectedUrl) {
      warnings.push(`URL mismatch for ${c.sourceItemId}: filter="${c.url}" vs input="${expectedUrl}"`);
    }
    // Validate topicId is in allowed list
    if (!topicIds.includes(c.topicId)) {
      warnings.push(`topicId "${c.topicId}" not in allowed list [${topicIds.join(", ")}]`);
    }
  }

  const durationMs = Date.now() - startTime;

  // ТЗ-CACHE2: Usage logging — waitUntil ensures completion on Vercel serverless
  if (userId && usage) {
    waitUntil(logUsage({
      userId,
      usage,
      modelId: FILTER_MODEL,
      chatMode: "briefing:filter",
      durationMs,
    }));
  }

  const ai = buildAiCallTrace(
    {
      modelId: FILTER_MODEL,
      usage,
      finishReason: "stop",
      promptPreview: userPrompt.slice(0, 500),
      retryCount: 0,
      durationMs,
    },
    catalog,
  );

  const trace: PipelineStageTrace = {
    stage: "filter",
    startedAt: new Date(startTime).toISOString(),
    durationMs,
    ai,
    dataFlow: {
      inputCount: items.length,
      outputCount: candidates.length,
      droppedCount: items.length - candidates.length,
    },
    errors,
    warnings,
  };

  return {
    candidates,
    tokensUsed: ai.totalTokens,
    trace,
  };
}
