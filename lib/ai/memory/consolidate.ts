/**
 * ТЗ-RAG2: Memory consolidation — LLM reviews facts for contradictions, duplicates, and staleness.
 *
 * Two modes (tiered processing, ТЗ-MindDeepConsolidation):
 * - `consolidateUserMemory` (hot path) — Grok 4.1 Fast, event-triggered at ≥10
 *   stored ИЛИ ≥15 cumulative. Actions: merge / supersede / remove.
 * - `deepConsolidateUserMemory` (ночной cron 01:00 МСК) — reasoning-модель
 *   (Grok 4.20 по умолчанию), проходит по всей памяти пользователя.
 *   Actions: merge / supersede / remove + **rephrase** (сжатие длинных
 *   формулировок с сохранением id). Snapshot cursor `beforeTs` защищает
 *   от race condition с hot path (Letta sleep-time pattern).
 */

import "server-only";

import fs from "fs";
import path from "path";
import { generateObject } from "ai";
import { z } from "zod";

import {
  getMaxOutputTokensForTask,
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";
import {
  getMemoryEntriesByUser,
  insertMemoryEntry,
  supersedeMemoryEntry,
  deleteMemoryEntry,
  updateMemoryEntryContent,
} from "./memory-queries";
import { embedText } from "./voyage-client";
import type { MemoryCategory, MemorySourceType } from "./types";
import { updateMemorySettings } from "@/lib/db/queries";
import type { MemoryEntry } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Task IDs
// ---------------------------------------------------------------------------

const MEMORY_CONSOLIDATE_TASK = "memory:consolidate" as const;
const MEMORY_DEEP_CONSOLIDATE_TASK = "memory:deep-consolidate" as const;

type ConsolidationTaskId =
  | typeof MEMORY_CONSOLIDATE_TASK
  | typeof MEMORY_DEEP_CONSOLIDATE_TASK;

// ---------------------------------------------------------------------------
// Prompts (cached at module level)
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

const DEEP_CONSOLIDATE_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "memory",
  "deep-consolidate.md",
);
const DEEP_CONSOLIDATE_SYSTEM_PROMPT = fs.readFileSync(
  DEEP_CONSOLIDATE_PROMPT_PATH,
  "utf-8",
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max actions LLM can return per call */
const MAX_ACTIONS_PER_CALL = 20;

/** Max facts to send to LLM in full consolidation (avoid token overflow) */
const FULL_CONSOLIDATION_MAX_FACTS = 200;

// ---------------------------------------------------------------------------
// Zod schema for consolidation response
// ---------------------------------------------------------------------------

const consolidationActionSchema = z.object({
  factId: z.string().describe("UUID факта, к которому применяется действие"),
  action: z
    .enum(["supersede", "merge", "remove", "rephrase"])
    .describe("Тип действия"),
  supersededById: z
    .string()
    .optional()
    .describe("UUID факта-замены (только для action=supersede)"),
  mergedContent: z
    .string()
    .optional()
    .describe("Объединённый текст (только для action=merge)"),
  rephrasedContent: z
    .string()
    .optional()
    .describe("Сжатая формулировка (только для action=rephrase)"),
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
  rephrased: number;
  durationMs: number;
}

function emptyStats(reviewed: number): ConsolidationStats {
  return {
    reviewed,
    superseded: 0,
    merged: 0,
    removed: 0,
    rephrased: 0,
    durationMs: 0,
  };
}

// ---------------------------------------------------------------------------
// formatFactsForPrompt
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
// runConsolidation — shared logic parameterized by taskId + prompt
// ---------------------------------------------------------------------------

async function runConsolidation(
  userId: string,
  facts: MemoryEntry[],
  config: {
    taskId: ConsolidationTaskId;
    systemPrompt: string;
    logLabel: string;
  },
): Promise<ConsolidationStats> {
  const startTime = Date.now();
  const stats = emptyStats(facts.length);

  if (facts.length < 2) {
    stats.durationMs = Date.now() - startTime;
    return stats;
  }

  const factsText = formatFactsForPrompt(facts);
  const userPrompt = `<facts>\n${factsText}\n</facts>`;

  const { object, usage } = await generateObject({
    model: getModel(config.taskId),
    maxOutputTokens: getMaxOutputTokensForTask(config.taskId),
    maxRetries: 0,
    schema: consolidationResultSchema,
    system: config.systemPrompt,
    prompt: userPrompt,
    temperature: 0.1,
  });

  const durationMs = Date.now() - startTime;

  logUsage({
    userId,
    usage,
    modelId: getModelIdForTask(config.taskId),
    provider: getProviderForTask(config.taskId),
    chatMode: config.taskId,
    durationMs,
  });

  const actions = object.actions.slice(0, MAX_ACTIONS_PER_CALL);
  const factMap = new Map(facts.map((f) => [f.id, f]));

  await applyConsolidationActions(userId, actions, factMap, stats);

  stats.durationMs = Date.now() - startTime;

  const ratioPercent =
    stats.reviewed > 0
      ? Math.round(
          ((stats.superseded + stats.merged + stats.removed + stats.rephrased) /
            stats.reviewed) *
            100,
        )
      : 0;

  console.log(
    `[${config.logLabel}] user=${userId} reviewed=${stats.reviewed} actions={merged:${stats.merged}, superseded:${stats.superseded}, removed:${stats.removed}, rephrased:${stats.rephrased}} ratioPercent=${ratioPercent}% durationMs=${stats.durationMs}`,
  );

  return stats;
}

// ---------------------------------------------------------------------------
// applyConsolidationActions — execute LLM decisions
// ---------------------------------------------------------------------------

async function applyConsolidationActions(
  userId: string,
  actions: ConsolidationAction[],
  factMap: Map<string, MemoryEntry>,
  stats: ConsolidationStats,
): Promise<void> {
  for (const action of actions) {
    try {
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

          const { embedding } = await embedText(
            action.mergedContent,
            "document",
          );

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

          await supersedeMemoryEntry(action.factId, newId);
          stats.merged++;
          break;
        }

        case "rephrase": {
          if (!action.rephrasedContent) {
            console.warn(
              `[MemoryConsolidate] No rephrasedContent for ${action.factId}, skipping`,
            );
            break;
          }

          const { embedding } = await embedText(
            action.rephrasedContent,
            "document",
          );
          await updateMemoryEntryContent(
            action.factId,
            action.rephrasedContent,
            embedding,
          );
          stats.rephrased++;
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
// consolidateUserMemory — HOT PATH (Grok 4.1 Fast, event-triggered)
// ---------------------------------------------------------------------------

/**
 * Full consolidation: review ALL active facts for a user (capped at
 * FULL_CONSOLIDATION_MAX_FACTS). Triggered event-chain from batchExtractFacts
 * when ≥10 facts are stored in one batch.
 */
export async function consolidateUserMemory(
  userId: string,
): Promise<ConsolidationStats> {
  const facts = await getMemoryEntriesByUser(userId, {
    activeOnly: true,
    limit: FULL_CONSOLIDATION_MAX_FACTS,
  });

  const stats = await runConsolidation(userId, facts, {
    taskId: MEMORY_CONSOLIDATE_TASK,
    systemPrompt: CONSOLIDATE_SYSTEM_PROMPT,
    logLabel: "MemoryConsolidate",
  });

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
// deepConsolidateUserMemory — BACKGROUND (ночной cron, reasoning-модель)
// ---------------------------------------------------------------------------

/**
 * Deep consolidation: reasoning-модель (Grok 4.20 по умолчанию) проходит по
 * всей активной памяти пользователя. Снимок `runStartTs` гарантирует что
 * факты добавленные hot path во время прогона не попадут в обработку
 * (race condition guard, Letta sleep-time pattern).
 *
 * Actions: merge / supersede / remove + **rephrase** — сжатие длинных
 * формулировок с сохранением id (hot path этого не умеет).
 *
 * Called from `/api/cron/memory-deep-consolidate` с фильтром пользователей
 * активных за последние 24 часа.
 */
export async function deepConsolidateUserMemory(
  userId: string,
  runStartTs: Date = new Date(),
): Promise<ConsolidationStats> {
  const facts = await getMemoryEntriesByUser(userId, {
    activeOnly: true,
    limit: FULL_CONSOLIDATION_MAX_FACTS,
    beforeTs: runStartTs,
  });

  return runConsolidation(userId, facts, {
    taskId: MEMORY_DEEP_CONSOLIDATE_TASK,
    systemPrompt: DEEP_CONSOLIDATE_SYSTEM_PROMPT,
    logLabel: "cron/memory-deep-consolidate",
  });
}
