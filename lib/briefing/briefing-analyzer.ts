// ТЗ-BR1: Stage 2 — Analyze & group using Gemini 3 Pro

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  ANALYZER_MODEL,
  ANALYZER_MODEL_FALLBACK,
  MAX_BRIEFING_ITEMS,
} from "./briefing-config";
import type { FilteredItem } from "./briefing-filter";
import type { RawContent } from "./source-fetchers/types";
import type { BriefingJSON } from "./briefing-types";
import { TOPICS_CATALOG } from "./topics-catalog";

export type { BriefingItem, BriefingBlock, BriefingJSON } from "./briefing-types";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// --- Zod schemas for BriefingJSON ---

const briefingItemSchema = z.object({
  title: z.string(),
  summary: z.string(),
  importance: z.enum(["high", "medium", "low"]),
  sourceUrl: z.string(),
  sourceName: z.string(),
  sourceLanguage: z.string(),
  publishedAt: z.string().optional(),
});

const briefingBlockSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  emoji: z.string(),
  items: z.array(briefingItemSchema),
});

const briefingJsonSchema = z.object({
  date: z.string(),
  totalSourcesChecked: z.number(),
  totalCandidates: z.number(),
  blocks: z.array(briefingBlockSchema),
});

interface AnalyzerInput {
  candidates: FilteredItem[];
  /** Full texts for candidates that have them */
  fullTexts: Map<string, RawContent>;
  language: string;
  maxItems: number;
  totalSourcesChecked: number;
}

/**
 * Stage 2: Analyze candidates using Gemini 3 Pro.
 * - Selects top items by importance
 * - Writes summaries as "why it matters", not "what happened"
 * - Groups by topic
 * - Translates to user language
 * - "Key stories" (importance: high) go first
 */
export async function analyzeContent(
  input: AnalyzerInput,
): Promise<{ briefing: BriefingJSON; tokensUsed: number }> {
  const { candidates, fullTexts, language, maxItems, totalSourcesChecked } =
    input;

  if (candidates.length === 0) {
    return {
      briefing: {
        date: new Date().toISOString().split("T")[0],
        totalSourcesChecked,
        totalCandidates: 0,
        blocks: [],
      },
      tokensUsed: 0,
    };
  }

  // Build topic reference
  const topicRef = Object.entries(TOPICS_CATALOG)
    .map(([id, t]) => `${id}: ${t.emoji} ${t.name}`)
    .join("\n");

  // Build candidates text with full content where available
  const candidatesText = candidates
    .map((c, i) => {
      const full = fullTexts.get(c.url);
      const content = full ? full.content : "";
      return `[${i + 1}] ${c.sourceName}
Topic: ${c.topicId}
Title: ${c.title}
URL: ${c.url}
Summary: ${c.oneLinerSummary}
${content ? `Content: ${content}` : ""}`;
    })
    .join("\n\n---\n\n");

  const today = new Date().toISOString().split("T")[0];

  let object: BriefingJSON;
  let tokensUsed = 0;

  try {
    const result = await generateObject({
      model: google(ANALYZER_MODEL),
      schema: briefingJsonSchema,
      system: buildAnalyzerPrompt(language, maxItems, topicRef, today, totalSourcesChecked, candidates.length),
      prompt: candidatesText,
    });
    object = result.object;
    tokensUsed = result.usage?.totalTokens ?? 0;
  } catch (err) {
    // Fallback to alternative model
    console.warn(
      `[Briefing] Primary model ${ANALYZER_MODEL} failed, trying ${ANALYZER_MODEL_FALLBACK}:`,
      err instanceof Error ? err.message : err,
    );
    const result = await generateObject({
      model: google(ANALYZER_MODEL_FALLBACK),
      schema: briefingJsonSchema,
      system: buildAnalyzerPrompt(language, maxItems, topicRef, today, totalSourcesChecked, candidates.length),
      prompt: candidatesText,
    });
    object = result.object;
    tokensUsed = result.usage?.totalTokens ?? 0;
  }

  return { briefing: object, tokensUsed };
}

function buildAnalyzerPrompt(
  language: string,
  maxItems: number,
  topicRef: string,
  today: string,
  totalSourcesChecked: number,
  totalCandidates: number,
): string {
  return `You are an expert news analyst and editor for a morning briefing.
Your role: select the most important and interesting news, then write analytical summaries.

OUTPUT LANGUAGE: ${language === "ru" ? "Russian" : language}

Topic categories:
${topicRef}

Rules:
1. From the candidates, select the ${maxItems} most important and interesting items
2. Write summary as a smart colleague would: "why this matters" and "what it means", NOT just "what happened"
3. Group items by topic (topicId). Use emoji and topicName from the reference above
4. If a source is in a different language than the output language, translate the title and summary
5. Mark 2-3 items as importance "high" — these are the day's key stories
6. The "high" importance block should appear first in the output
7. Keep summaries to 1-2 sentences maximum
8. Set date to "${today}", totalSourcesChecked to ${totalSourcesChecked}, totalCandidates to ${totalCandidates}

Output a valid JSON matching the schema.`;
}
