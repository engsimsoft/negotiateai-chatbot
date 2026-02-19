// ТЗ-BR1: Stage 2 — Analyze & group using Gemini 3 Pro
// ТЗ-BR3: Load prompt from .md file, pass tier data

import fs from "fs";
import path from "path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  ANALYZER_MODEL,
  ANALYZER_MODEL_FALLBACK,
} from "./briefing-config";
import type { FilteredItem } from "./briefing-filter";
import type { RawContent } from "./source-fetchers/types";
import type { BriefingJSON } from "./briefing-types";
import { TOPICS_CATALOG } from "./topics-catalog";

export type { BriefingItem, BriefingBlock, BriefingJSON } from "./briefing-types";

// Load prompt template from .md file (once at module init)
const PROMPT_PATH = path.join(process.cwd(), "lib", "prompts", "briefing", "briefing-analyst.md");
const PROMPT_TEMPLATE = fs.readFileSync(PROMPT_PATH, "utf-8");

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
  /** Source name → tier mapping */
  tierMap: Map<string, string>;
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
 * - "Key stories" (importance: high) go into topicId "top" block
 */
export async function analyzeContent(
  input: AnalyzerInput,
): Promise<{ briefing: BriefingJSON; tokensUsed: number }> {
  const { candidates, fullTexts, tierMap, language, maxItems, totalSourcesChecked } =
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

  // Build candidates text with full content and tier where available
  const candidatesText = candidates
    .map((c, i) => {
      const full = fullTexts.get(c.url);
      const content = full ? full.content : "";
      const tier = tierMap.get(c.sourceName) ?? "unknown";
      const lang = full?.sourceLanguage ?? "unknown";
      return `[${i + 1}] ${c.sourceName} (${lang}) [Tier: ${tier}]
Topic: ${c.topicId}
Title: ${c.title}
URL: ${c.url}
Summary: ${c.oneLinerSummary}
${content ? `Content: ${content}` : ""}`;
    })
    .join("\n\n---\n\n");

  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = buildAnalyzerPrompt(
    language, maxItems, topicRef, today, totalSourcesChecked, candidates.length,
  );

  let object: BriefingJSON;
  let tokensUsed = 0;

  try {
    const result = await generateObject({
      model: google(ANALYZER_MODEL),
      schema: briefingJsonSchema,
      system: systemPrompt,
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
      system: systemPrompt,
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
  return PROMPT_TEMPLATE
    .replace(/\{\{LANGUAGE\}\}/g, language === "ru" ? "Russian" : language)
    .replace(/\{\{MAX_ITEMS\}\}/g, String(maxItems))
    .replace(/\{\{TOPIC_REFERENCE\}\}/g, topicRef)
    .replace(/\{\{DATE\}\}/g, today)
    .replace(/\{\{TOTAL_SOURCES_CHECKED\}\}/g, String(totalSourcesChecked))
    .replace(/\{\{TOTAL_CANDIDATES\}\}/g, String(totalCandidates));
}
