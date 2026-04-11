/**
 * ТЗ-RAG2: Opus user profile generation
 *
 * Generates a narrative profile from all active memory facts.
 * Called by nightly cron after consolidation.
 *
 * The profile becomes the first block in system prompt — stable "who is this person" context.
 */

import "server-only";

import fs from "fs";
import path from "path";
import { generateText } from "ai";

import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";
import { calcCostUsd } from "@/lib/ai/tokenlens-catalog";

const MEMORY_PROFILE_TASK = "memory:profile" as const;
import { getMemoryEntriesByUser } from "./memory-queries";
import {
  getProfileSummary,
  upsertProfileSummary,
} from "@/lib/db/queries";
import type { MemoryEntry } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Prompt (cached at module level)
// ---------------------------------------------------------------------------

const PROFILE_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "memory",
  "profile.md",
);
const PROFILE_SYSTEM_PROMPT = fs.readFileSync(PROFILE_PROMPT_PATH, "utf-8");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max facts to send to Opus */
const MAX_FACTS_FOR_PROFILE = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileGenerationResult {
  content: string;
  factCount: number;
  tokenCount: number;
  costUsd: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// formatFactsForProfile
// ---------------------------------------------------------------------------

function formatFactsForProfile(facts: MemoryEntry[]): string {
  return facts
    .map((f) => {
      const date = f.createdAt.toISOString().split("T")[0];
      const confidence = Math.round(Number(f.confidence ?? 1) * 100);
      return `(${f.category}, ${confidence}%, ${date}) ${f.content}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// generateUserProfile
// ---------------------------------------------------------------------------

/**
 * Generate a narrative user profile from all active memory facts.
 * Uses Claude Opus for maximum quality.
 *
 * Returns the generated profile and metadata. Saves to DB.
 */
export async function generateUserProfile(
  userId: string,
): Promise<ProfileGenerationResult> {
  const startTime = Date.now();

  // Load all active facts
  const facts = await getMemoryEntriesByUser(userId, {
    activeOnly: true,
    limit: MAX_FACTS_FOR_PROFILE,
  });

  if (facts.length === 0) {
    return {
      content: "",
      factCount: 0,
      tokenCount: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // Format facts for prompt
  const factsText = formatFactsForProfile(facts);
  const userPrompt = `<facts count="${facts.length}">\n${factsText}\n</facts>`;

  const resolvedModelId = getModelIdForTask(MEMORY_PROFILE_TASK);

  // Generate profile via resolved memory:profile model
  const { text, usage } = await generateText({
    model: getModel(MEMORY_PROFILE_TASK),
    maxRetries: 0,
    system: PROFILE_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.3,
  });

  const durationMs = Date.now() - startTime;

  // Calculate cost
  const costUsd = (await calcCostUsd(resolvedModelId, usage)) ?? 0;

  // Estimate token count of the profile text (~4 chars per token for Russian)
  const tokenCount = Math.ceil(text.length / 4);

  // Log usage
  logUsage({
    userId,
    usage,
    modelId: resolvedModelId,
    provider: getProviderForTask(MEMORY_PROFILE_TASK),
    chatMode: "memory:profile",
    durationMs,
  });

  // Save to DB
  await upsertProfileSummary({
    userId,
    content: text,
    factCount: facts.length,
    tokenCount,
    costUsd,
    modelId: resolvedModelId,
  });

  console.log(
    `[MemoryProfile] Generated for user ${userId}: ${facts.length} facts → ${tokenCount} tokens, $${costUsd.toFixed(4)} (${durationMs}ms)`,
  );

  return {
    content: text,
    factCount: facts.length,
    tokenCount,
    costUsd,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// getProfileBlock — load profile from DB and format for system prompt
// ---------------------------------------------------------------------------

/**
 * Load user profile from DB and return as XML block for system prompt injection.
 * Returns empty string if no profile exists.
 */
export async function getProfileBlock(
  userId: string,
): Promise<string> {
  const profile = await getProfileSummary({ userId });

  if (!profile || !profile.content) {
    return "";
  }

  return `<user-profile>
${profile.content}
</user-profile>`;
}
