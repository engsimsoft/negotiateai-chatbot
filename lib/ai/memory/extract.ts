/**
 * ТЗ-RAG1: Memory fact extraction
 *
 * Extracts significant facts about the user from chat message pairs
 * (user message + assistant response) using Claude Sonnet.
 *
 * Pipeline: extract facts → embed via Voyage → deduplicate → upsert to pgvector.
 *
 * All operations are fire-and-forget — caller never waits for results.
 */

import "server-only";

import fs from "fs";
import path from "path";
import { generateObject } from "ai";
import { z } from "zod";

import { claudeSonnet, claudeHaiku } from "@/lib/ai/providers";
import { logUsage } from "@/lib/ai/usage-utils";
import { calcCostUsd } from "@/lib/ai/tokenlens-catalog";
import {
  embedText,
  VOYAGE_INDEX_MODEL,
} from "./voyage-client";
import {
  insertMemoryEntry,
  searchSimilarMemories,
  supersedeMemoryEntry,
} from "./memory-queries";
import { incrementFactsSinceConsolidation } from "@/lib/db/queries";
import { miniConsolidateUserMemory } from "./consolidate";
import { MEMORY_CATEGORIES, type MemoryCategory, type MemorySourceType, type MemorySearchResult } from "./types";

/** ТЗ-RAG2: Number of new facts before triggering mini-consolidation */
const MINI_CONSOLIDATION_THRESHOLD = 20;

// ---------------------------------------------------------------------------
// Prompt (cached at module level)
// ---------------------------------------------------------------------------

const EXTRACT_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "memory",
  "extract.md",
);
const EXTRACT_SYSTEM_PROMPT = fs.readFileSync(EXTRACT_PROMPT_PATH, "utf-8");

// ---------------------------------------------------------------------------
// Zod schema for structured extraction
// ---------------------------------------------------------------------------

const extractedFactSchema = z.object({
  content: z
    .string()
    .describe("Факт о пользователе на русском языке, до 200 символов"),
  category: z.enum(MEMORY_CATEGORIES).describe("Категория факта"),
  confidence: z
    .number()
    .describe("Уверенность в факте от 0.5 до 1.0"),
});

const extractionResultSchema = z.object({
  facts: z.array(extractedFactSchema).describe("Извлечённые факты (может быть пустой)"),
});

export type ExtractedFact = z.infer<typeof extractedFactSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cosine similarity threshold for deduplication candidates.
 * Low threshold (0.55) to catch semantically similar facts with different wording.
 * Candidates are then verified by LLM to avoid false positives. */
const DEDUP_CANDIDATE_THRESHOLD = 0.55;

/** Max facts to extract per message pair */
const MAX_FACTS_PER_EXTRACTION = 10;

// ---------------------------------------------------------------------------
// extractFactsFromMessages — extract facts via Claude Sonnet
// ---------------------------------------------------------------------------

interface ExtractFactsInput {
  userId: string;
  userMessage: string;
  assistantMessage: string;
  sourceType: MemorySourceType;
  sourceChatId?: string | null;
  sourceProjectId?: string | null;
}

/**
 * Extract facts from a user+assistant message pair using Claude Sonnet.
 * Returns structured facts with category and confidence.
 */
export async function extractFactsFromMessages(
  input: ExtractFactsInput,
): Promise<ExtractedFact[]> {
  const { userId, userMessage, assistantMessage } = input;

  // Skip very short messages — unlikely to contain meaningful facts
  if (userMessage.length < 10 && assistantMessage.length < 10) {
    return [];
  }

  const startTime = Date.now();

  const userPrompt = `<user_message>\n${userMessage}\n</user_message>\n\n<assistant_message>\n${assistantMessage}\n</assistant_message>`;

  const { object, usage } = await generateObject({
    model: claudeSonnet,
    maxRetries: 0,
    schema: extractionResultSchema,
    system: EXTRACT_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.1,
  });

  const durationMs = Date.now() - startTime;

  // Fire-and-forget usage logging
  logUsage({
    userId,
    usage,
    modelId: claudeSonnet.modelId,
    chatMode: "memory:extract",
    chatId: input.sourceChatId ?? null,
    durationMs,
  });

  // Cap the number of facts
  const facts = object.facts.slice(0, MAX_FACTS_PER_EXTRACTION);

  console.log(
    `[MemoryExtract] Extracted ${facts.length} facts for user ${userId} (${durationMs}ms)`,
  );

  return facts;
}

// ---------------------------------------------------------------------------
// extractAndStoreFacts — full pipeline: extract → embed → deduplicate → upsert
// ---------------------------------------------------------------------------

/**
 * Full extraction pipeline: extract facts from messages → embed → deduplicate → store.
 *
 * This is the main entry point, designed to be called fire-and-forget:
 * ```ts
 * waitUntil(extractAndStoreFacts({ ... }));
 * ```
 */
export async function extractAndStoreFacts(
  input: ExtractFactsInput,
): Promise<{ extracted: number; stored: number; superseded: number }> {
  const stats = { extracted: 0, stored: 0, superseded: 0 };

  try {
    // Step 1: Extract facts via Claude Sonnet
    const facts = await extractFactsFromMessages(input);
    stats.extracted = facts.length;

    if (facts.length === 0) {
      return stats;
    }

    // Step 2: For each fact — embed, deduplicate, store
    for (const fact of facts) {
      try {
        await processAndStoreFact(input, fact, stats);
      } catch (error) {
        console.error(
          `[MemoryExtract] Failed to store fact "${fact.content.slice(0, 50)}...":`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    // ТЗ-RAG2: Increment facts counter + trigger mini-consolidation at threshold
    if (stats.stored > 0) {
      try {
        const newCount = await incrementFactsSinceConsolidation({ userId: input.userId });
        if (newCount >= MINI_CONSOLIDATION_THRESHOLD) {
          console.log(
            `[MemoryExtract] Threshold reached (${newCount} facts), triggering mini-consolidation`,
          );
          void miniConsolidateUserMemory(input.userId).catch((err) =>
            console.warn(
              "[MemoryExtract] Mini-consolidation failed (non-blocking):",
              err instanceof Error ? err.message : err,
            ),
          );
        }
      } catch (err) {
        console.warn(
          "[MemoryExtract] Failed to increment factsSinceConsolidation:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(
      `[MemoryExtract] Pipeline done: ${stats.extracted} extracted, ${stats.stored} stored, ${stats.superseded} superseded`,
    );

    return stats;
  } catch (error) {
    console.error(
      "[MemoryExtract] Pipeline failed:",
      error instanceof Error ? error.message : error,
    );
    return stats;
  }
}

// ---------------------------------------------------------------------------
// Internal: LLM-based duplicate verification (Haiku — fast & cheap)
// ---------------------------------------------------------------------------

const deduplicationSchema = z.object({
  duplicateOf: z
    .string()
    .nullable()
    .describe("ID существующего факта, если новый факт дублирует его. null если это новый уникальный факт."),
});

async function verifyDuplicatesWithLLM(
  newFact: string,
  candidates: MemorySearchResult[],
): Promise<MemorySearchResult[]> {
  if (candidates.length === 0) return [];

  const candidateList = candidates
    .map((c) => `- ID: ${c.entry.id} | "${c.entry.content}" (sim: ${c.similarity.toFixed(3)})`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: claudeHaiku,
      maxRetries: 0,
      schema: deduplicationSchema,
      system: `Ты проверяешь дубликаты фактов в памяти пользователя.

Новый факт хотят сохранить. Есть кандидаты из базы — факты на похожую тему.

Определи: новый факт ДУБЛИРУЕТ один из существующих? Дублирование = тот же смысл, та же тема, даже если сформулировано иначе. Обновлённая версия факта тоже считается дубликатом (supersede старый).

Если дубликат — верни ID самого релевантного существующего факта.
Если это действительно новый факт — верни null.`,
      prompt: `Новый факт: "${newFact}"

Кандидаты из базы:
${candidateList}`,
      temperature: 0,
    });

    if (object.duplicateOf) {
      const match = candidates.find((c) => c.entry.id === object.duplicateOf);
      if (match) {
        console.log(
          `[MemoryDedup] LLM confirmed duplicate: "${newFact.slice(0, 40)}..." ≈ "${match.entry.content.slice(0, 40)}..."`,
        );
        return [match];
      }
    }
  } catch (error) {
    console.warn(
      "[MemoryDedup] LLM verification failed, falling back to embedding-only:",
      error instanceof Error ? error.message : error,
    );
    // Fallback: if LLM fails, use highest similarity candidate if above 0.85
    const best = candidates[0];
    if (best && best.similarity >= 0.85) return [best];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Internal: process a single fact
// ---------------------------------------------------------------------------

async function processAndStoreFact(
  input: ExtractFactsInput,
  fact: ExtractedFact,
  stats: { stored: number; superseded: number },
): Promise<void> {
  const embedStartTime = Date.now();

  // Embed the fact content
  const { embedding, totalTokens } = await embedText(fact.content, "document");

  const embedDurationMs = Date.now() - embedStartTime;

  // Log Voyage embed usage (costUsdOverride — Voyage pricing is per-token, too small for RUB rounding)
  const voyageEmbedCostUsd = (totalTokens / 1_000_000) * 0.06; // voyage-4: $0.06/1M tokens
  logUsage({
    userId: input.userId,
    usage: {
      inputTokens: totalTokens,
      outputTokens: 0,
      totalTokens,
      inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    },
    modelId: VOYAGE_INDEX_MODEL,
    chatMode: "memory:embed",
    chatId: input.sourceChatId ?? null,
    durationMs: embedDurationMs,
    costUsdOverride: voyageEmbedCostUsd,
  });

  // Deduplicate: two-level check
  // Level 1: embedding similarity (low threshold to find candidates)
  const { results: candidates } = await searchSimilarMemories(
    input.userId,
    fact.content,
    {
      limit: 5,
      minSimilarity: DEDUP_CANDIDATE_THRESHOLD,
      category: fact.category as MemoryCategory,
    },
  );

  // Level 2: LLM verification — is this really the same fact?
  const similar = candidates.length > 0
    ? await verifyDuplicatesWithLLM(fact.content, candidates)
    : [];

  if (similar.length > 0) {
    // Supersede the most similar existing fact
    const oldEntry = similar[0];
    const newId = await insertMemoryEntry({
      userId: input.userId,
      content: fact.content,
      embedding,
      category: fact.category,
      confidence: fact.confidence,
      sourceType: input.sourceType,
      source: "extracted",
      sourceChatId: input.sourceChatId ?? null,
      sourceProjectId: input.sourceProjectId ?? null,
    });

    await supersedeMemoryEntry(oldEntry.entry.id, newId);
    stats.superseded++;
    stats.stored++;

    console.log(
      `[MemoryExtract] Superseded "${oldEntry.entry.content.slice(0, 40)}..." → "${fact.content.slice(0, 40)}..." (similarity: ${oldEntry.similarity.toFixed(3)})`,
    );
  } else {
    // New fact — insert directly
    await insertMemoryEntry({
      userId: input.userId,
      content: fact.content,
      embedding,
      category: fact.category,
      confidence: fact.confidence,
      sourceType: input.sourceType,
      source: "extracted",
      sourceChatId: input.sourceChatId ?? null,
      sourceProjectId: input.sourceProjectId ?? null,
    });

    stats.stored++;
  }
}
