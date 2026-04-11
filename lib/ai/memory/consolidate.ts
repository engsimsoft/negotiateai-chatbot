/**
 * ТЗ-RAG2: Memory consolidation — Sonnet reviews facts for contradictions, duplicates, and staleness.
 *
 * Two modes:
 * - Full: all active facts, for nightly cron
 * - Mini: recent facts vs existing, event-triggered every N new facts
 *
 * Both modes use the same prompt and action schema — differ only in input scope.
 */

import "server-only";

import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { z } from "zod";

import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";

const MEMORY_CONSOLIDATE_TASK = "memory:consolidate" as const;
import {
  getMemoryEntriesByUser,
  insertMemoryEntry,
  supersedeMemoryEntry,
  deleteMemoryEntry,
} from "./memory-queries";
import { embedText } from "./voyage-client";
import type { MemoryCategory, MemorySourceType } from "./types";
import { updateMemorySettings } from "@/lib/db/queries";
import type { MemoryEntry } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Prompt (cached at module level)
// ---------------------------------------------------------------------------

const CONSOLIDATE_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "memory",
  "consolidate.md",
);
const CONSOLIDATE_SYSTEM_PROMPT = fs.readFileSync(
  CONSOLIDATE_PROMPT_PATH,
  "utf-8",
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mini-consolidation: how many recent facts to review */
const MINI_RECENT_FACTS_LIMIT = 30;

/** Max actions Sonnet can return per call */
const MAX_ACTIONS_PER_CALL = 20;

/** Max facts to send to Sonnet in full consolidation (avoid token overflow) */
const FULL_CONSOLIDATION_MAX_FACTS = 200;

// ---------------------------------------------------------------------------
// Zod schema for consolidation response
// ---------------------------------------------------------------------------

const consolidationActionSchema = z.object({
  factId: z.string().describe("UUID факта, к которому применяется действие"),
  action: z
    .enum(["supersede", "merge", "remove"])
    .describe("Тип действия"),
  supersededById: z
    .string()
    .optional()
    .describe("UUID факта-замены (только для action=supersede)"),
  mergedContent: z
    .string()
    .optional()
    .describe("Объединённый текст (только для action=merge)"),
  reason: z.string().describe("Краткое обоснование действия"),
});

const consolidationResultSchema = z.object({
  actions: z
    .array(consolidationActionSchema)
    .describe("Действия над фактами (пустой массив = всё актуально)"),
});

type ConsolidationAction = z.infer<typeof consolidationActionSchema>;

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface ConsolidationStats {
  reviewed: number;
  superseded: number;
  merged: number;
  removed: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// formatFactsForPrompt — prepare facts list for Sonnet
// ---------------------------------------------------------------------------

function formatFactsForPrompt(facts: MemoryEntry[]): string {
  return facts
    .map((f) => {
      const date = f.createdAt.toISOString().split("T")[0];
      const confidence = Math.round(Number(f.confidence ?? 1) * 100);
      return `[${f.id}] (${f.category}, уверенность: ${confidence}%) ${date} — ${f.content}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// runConsolidation — shared logic for both full and mini modes
// ---------------------------------------------------------------------------

async function runConsolidation(
  userId: string,
  facts: MemoryEntry[],
): Promise<ConsolidationStats> {
  const startTime = Date.now();
  const stats: ConsolidationStats = {
    reviewed: facts.length,
    superseded: 0,
    merged: 0,
    removed: 0,
    durationMs: 0,
  };

  if (facts.length < 2) {
    stats.durationMs = Date.now() - startTime;
    return stats;
  }

  // Build prompt
  const factsText = formatFactsForPrompt(facts);
  const userPrompt = `<facts>\n${factsText}\n</facts>`;

  // Call resolved memory:consolidate model (generateText + JSON.parse + Zod)
  const { text, usage } = await generateText({
    model: getModel(MEMORY_CONSOLIDATE_TASK),
    maxRetries: 0,
    system: CONSOLIDATE_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.1,
  });

  const durationMs = Date.now() - startTime;

  // Parse JSON response
  let object: z.infer<typeof consolidationResultSchema>;
  try {
    const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
    object = consolidationResultSchema.parse(JSON.parse(cleaned));
  } catch (parseErr) {
    console.error(
      `[MemoryConsolidate] Failed to parse consolidation response:`,
      parseErr instanceof Error ? parseErr.message : parseErr,
      `\nRaw text: ${text.slice(0, 500)}`,
    );
    stats.durationMs = Date.now() - startTime;
    return stats;
  }

  // Log usage
  logUsage({
    userId,
    usage,
    modelId: getModelIdForTask(MEMORY_CONSOLIDATE_TASK),
    provider: getProviderForTask(MEMORY_CONSOLIDATE_TASK),
    chatMode: "memory:consolidate",
    durationMs,
  });

  // Apply actions (cap at MAX_ACTIONS_PER_CALL)
  const actions = object.actions.slice(0, MAX_ACTIONS_PER_CALL);
  const factMap = new Map(facts.map((f) => [f.id, f]));

  await applyConsolidationActions(userId, actions, factMap, stats);

  stats.durationMs = Date.now() - startTime;

  console.log(
    `[MemoryConsolidate] Done for user ${userId}: reviewed=${stats.reviewed}, superseded=${stats.superseded}, merged=${stats.merged}, removed=${stats.removed} (${stats.durationMs}ms)`,
  );

  return stats;
}

// ---------------------------------------------------------------------------
// applyConsolidationActions — execute Sonnet's decisions
// ---------------------------------------------------------------------------

async function applyConsolidationActions(
  userId: string,
  actions: ConsolidationAction[],
  factMap: Map<string, MemoryEntry>,
  stats: ConsolidationStats,
): Promise<void> {
  for (const action of actions) {
    try {
      // Validate that the fact exists in our input set
      if (!factMap.has(action.factId)) {
        console.warn(
          `[MemoryConsolidate] Unknown factId ${action.factId}, skipping`,
        );
        continue;
      }

      switch (action.action) {
        case "supersede": {
          if (!action.supersededById || !factMap.has(action.supersededById)) {
            console.warn(
              `[MemoryConsolidate] Invalid supersededById for ${action.factId}, skipping`,
            );
            break;
          }
          await supersedeMemoryEntry(action.factId, action.supersededById);
          stats.superseded++;
          break;
        }

        case "merge": {
          if (!action.mergedContent) {
            console.warn(
              `[MemoryConsolidate] No mergedContent for ${action.factId}, skipping`,
            );
            break;
          }

          const oldFact = factMap.get(action.factId)!;

          // Embed the merged content
          const { embedding } = await embedText(
            action.mergedContent,
            "document",
          );

          // Insert new merged fact
          const newId = await insertMemoryEntry({
            userId,
            content: action.mergedContent,
            embedding,
            category: oldFact.category as MemoryCategory,
            confidence: Number(oldFact.confidence ?? 1),
            sourceType: oldFact.sourceType as MemorySourceType,
            sourceChatId: oldFact.sourceChatId ?? null,
            sourceProjectId: oldFact.sourceProjectId ?? null,
          });

          // Supersede the old fact
          await supersedeMemoryEntry(action.factId, newId);
          stats.merged++;
          break;
        }

        case "remove": {
          await deleteMemoryEntry(action.factId);
          stats.removed++;
          break;
        }
      }
    } catch (error) {
      console.error(
        `[MemoryConsolidate] Failed to apply action ${action.action} on ${action.factId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// consolidateUserMemory — FULL review (for nightly cron)
// ---------------------------------------------------------------------------

/**
 * Full consolidation: review ALL active facts for a user.
 * Used by nightly cron before Opus profile generation.
 */
export async function consolidateUserMemory(
  userId: string,
): Promise<ConsolidationStats> {
  const facts = await getMemoryEntriesByUser(userId, {
    activeOnly: true,
    limit: FULL_CONSOLIDATION_MAX_FACTS,
  });

  const stats = await runConsolidation(userId, facts);

  // Update lastConsolidatedAt + reset counter
  await updateMemorySettings({
    userId,
    patch: {
      lastConsolidatedAt: new Date(),
      factsSinceConsolidation: 0,
    },
  });

  return stats;
}

// ---------------------------------------------------------------------------
// miniConsolidateUserMemory — MINI review (event-triggered)
// ---------------------------------------------------------------------------

/**
 * Mini consolidation: review only recent facts against existing ones.
 * Triggered every N new facts (fire-and-forget from extract.ts).
 *
 * Scope: latest MINI_RECENT_FACTS_LIMIT facts — finds contradictions
 * with each other and with older facts visible in the same batch.
 */
export async function miniConsolidateUserMemory(
  userId: string,
): Promise<ConsolidationStats> {
  // Load recent facts (ordered by createdAt desc, most recent first)
  const recentFacts = await getMemoryEntriesByUser(userId, {
    activeOnly: true,
    limit: MINI_RECENT_FACTS_LIMIT,
  });

  const stats = await runConsolidation(userId, recentFacts);

  // Reset counter + update lastConsolidatedAt
  await updateMemorySettings({
    userId,
    patch: {
      lastConsolidatedAt: new Date(),
      factsSinceConsolidation: 0,
    },
  });

  return stats;
}
