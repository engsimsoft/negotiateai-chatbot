/**
 * ТЗ-RAG1: Memory fact extraction
 *
 * ТЗ-COMPACTION-UNIFY (v3.95.0): per-turn `extractFactsFromMessages` и
 * `extractAndStoreFacts` удалены. Extract запускается только внутри compaction
 * cycle через `prepareMessagesWithCompaction` — на подмножестве сообщений,
 * уходящих в summary (Mem0 best practice 2026: «memory formation before
 * summarization»). Файл содержит только batch-extraction pipeline + shared
 * helper `processAndStoreFact` (экспорт для middleware) + LLM dedup verify.
 *
 * Pipeline: batch extract facts (one Grok 4.1 Fast call) → embed via Voyage
 * → two-level deduplicate (embedding similarity + LLM verify) → upsert to pgvector.
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

const MEMORY_EXTRACT_BATCH_TASK = "memory:extract-batch" as const;
const MEMORY_DEDUP_VERIFY_TASK = "memory:dedup-verify" as const;
import {
  embedText,
  VOYAGE_INDEX_MODEL,
  calcVoyageCostUsd,
} from "./voyage-client";
import {
  insertMemoryEntry,
  searchSimilarMemories,
  supersedeMemoryEntry,
  markMessagesExtracted,
} from "./memory-queries";
import { getMemorySettings, incrementFactsSinceConsolidation } from "@/lib/db/queries";
import { CONSOLIDATION_THRESHOLD_CUMULATIVE } from "@/lib/ai/context-limits";
import { consolidateUserMemory } from "./consolidate";
import { generateUserProfile } from "./profile";
import { MEMORY_CATEGORIES, type MemoryCategory, type MemorySourceType, type MemorySearchResult } from "./types";

// ---------------------------------------------------------------------------
// Batch prompt (cached at module level)
// ---------------------------------------------------------------------------

const EXTRACT_BATCH_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "memory",
  "extract-batch.md",
);
const EXTRACT_BATCH_SYSTEM_PROMPT = fs.readFileSync(EXTRACT_BATCH_PROMPT_PATH, "utf-8");

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

/** Max messages per batch extraction */
const MAX_BATCH_MESSAGES = 50;

/** Max facts from a single batch extraction */
const MAX_BATCH_FACTS = 30;

// ---------------------------------------------------------------------------
// batchExtractFacts — batch extraction from conversation (used by compaction middleware)
// ---------------------------------------------------------------------------

/**
 * Shared input shape used by `processAndStoreFact` (origin-метаданные факта).
 * После ТЗ-COMPACTION-UNIFY единственный caller — `batchExtractFacts` (через
 * compaction middleware), поля про `userMessage`/`assistantMessage` удалены —
 * они были нужны только бывшему per-turn pipeline, сейчас factory извлекается
 * из склеенного conversation block.
 */
interface FactOriginInput {
  userId: string;
  sourceType: MemorySourceType;
  sourceChatId?: string | null;
  sourceProjectId?: string | null;
}

interface BatchExtractInput {
  userId: string;
  chatId: string;
  /**
   * Origin-метаданные для сохраняемых фактов. `sourceType` определяется
   * chatMode caller-а (simply / expertise / create / project). Без явного
   * значения факты сохранялись бы с неправильным `sourceType`, что ломает
   * фильтрацию retrieve по source.
   */
  sourceType: MemorySourceType;
  /** Только для project chat — иначе null/undefined. */
  sourceProjectId?: string | null;
  messages: Array<{ id: string; role: string; parts: unknown }>;
}

interface BatchExtractResult {
  processed: number;
  extracted: number;
  stored: number;
}

/**
 * Batch extraction pipeline: format conversation → extract facts (one Grok 4.1 Fast call) →
 * embed → deduplicate → store → mark messages as extracted.
 *
 * Вызывается из `prepareMessagesWithCompaction` на `split.toCompact` (сообщения,
 * уходящие в summary). await блокирует compaction — гарантия: ни одно сообщение
 * не покидает историю без попытки извлечь факты.
 */
export async function batchExtractFacts(
  input: BatchExtractInput,
): Promise<BatchExtractResult> {
  const { userId, chatId, sourceType, sourceProjectId, messages } = input;
  const stats: BatchExtractResult = { processed: 0, extracted: 0, stored: 0 };

  try {
    // Take oldest messages first, cap at MAX_BATCH_MESSAGES
    const batch = messages.slice(0, MAX_BATCH_MESSAGES);
    stats.processed = batch.length;

    if (batch.length === 0) {
      return stats;
    }

    console.log(
      `[MIND] Batch extract started: ${batch.length} messages for user ${userId}`,
    );

    // Format conversation block
    const conversationBlock = batch
      .map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        const text = (msg.parts as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text" && p.text?.trim())
          .map((p) => p.text)
          .join("\n");
        return `[${role}]\n${text}`;
      })
      .filter((block) => block.length > 10) // skip empty blocks
      .join("\n\n---\n\n");

    if (conversationBlock.length < 20) {
      // Not enough text content to extract from
      await markMessagesExtracted(batch.map((m) => m.id));
      console.log("[MIND] Batch extract: not enough text, marking as extracted");
      return stats;
    }

    const startTime = Date.now();

    // Single batch call for the whole conversation via native generateObject.
    // Verified 2026-04-14 that xAI generateObject works natively via @ai-sdk/xai.
    // ТЗ-FixSimplyMemory followup: x-grok-conv-id для xAI sticky-routing —
    // тот же chatId → тот же сервер → разогретый кэш на повторных compaction
    // циклах одного чата.
    const extractProvider = getProviderForTask(MEMORY_EXTRACT_BATCH_TASK);
    const { object: parsedResult, usage } = await generateObject({
      model: getModel(MEMORY_EXTRACT_BATCH_TASK),
      maxOutputTokens: getMaxOutputTokensForTask(MEMORY_EXTRACT_BATCH_TASK),
      maxRetries: 0,
      schema: extractionResultSchema,
      system: EXTRACT_BATCH_SYSTEM_PROMPT,
      prompt: conversationBlock,
      temperature: 0.1,
      ...(extractProvider === "xai" && {
        headers: { "x-grok-conv-id": chatId },
      }),
    });

    const durationMs = Date.now() - startTime;

    // Log usage
    logUsage({
      userId,
      usage,
      modelId: getModelIdForTask(MEMORY_EXTRACT_BATCH_TASK),
      provider: getProviderForTask(MEMORY_EXTRACT_BATCH_TASK),
      chatMode: "tool:batch-extract",
      chatId,
      durationMs,
    });

    const facts = parsedResult.facts.slice(0, MAX_BATCH_FACTS);
    stats.extracted = facts.length;

    console.log(
      `[MIND] Batch extract: ${facts.length} facts from ${batch.length} messages (${durationMs}ms)`,
    );

    // Process each fact through existing embed → dedup → store pipeline
    let storedCount = 0;
    let supersededCount = 0;
    for (const fact of facts) {
      try {
        const factStats = { stored: 0, superseded: 0 };
        await processAndStoreFact(
          {
            userId,
            sourceType,
            sourceChatId: chatId,
            sourceProjectId: sourceProjectId ?? null,
          },
          fact,
          factStats,
        );
        storedCount += factStats.stored;
        supersededCount += factStats.superseded;
      } catch (error) {
        console.error(
          `[MIND] Batch extract: failed to store fact "${fact.content.slice(0, 50)}...":`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    stats.stored = storedCount;

    // Mark ALL batch messages as extracted (even if no facts found)
    await markMessagesExtracted(batch.map((m) => m.id));

    // ТЗ-MindConsolidationTriggers v2 (2026-04-21): двойной триггер —
    // (1) мгновенный: storedCount >= 10 (большой batch на одном compaction)
    // (2) накопительный: factsSinceConsolidation + storedCount >= 15
    //     (периодический health-check при малом потоке фактов)
    let cumulativeCount = 0;
    try {
      const settings = await getMemorySettings({ userId });
      cumulativeCount = settings.factsSinceConsolidation ?? 0;
    } catch (err) {
      console.warn(
        "[MIND] Batch extract: failed to read factsSinceConsolidation, cumulative trigger skipped:",
        err instanceof Error ? err.message : err,
      );
    }

    const shouldConsolidate =
      storedCount >= 10 ||
      cumulativeCount + storedCount >= CONSOLIDATION_THRESHOLD_CUMULATIVE;

    if (shouldConsolidate) {
      console.log(
        `[MIND] Batch extract: triggering consolidation (stored=${storedCount}, cumulative=${cumulativeCount})`,
      );
      void (async () => {
        try {
          const consolidationStats = await consolidateUserMemory(userId);
          const totalChanged = consolidationStats.superseded + consolidationStats.merged + consolidationStats.removed;
          console.log(
            `[MIND] Consolidation after extract: ${totalChanged} changes (superseded=${consolidationStats.superseded}, merged=${consolidationStats.merged}, removed=${consolidationStats.removed})`,
          );

          // Event chain — profile if ≥10 facts changed
          if (totalChanged >= 10) {
            console.log(`[MIND] Consolidation: ${totalChanged} changes, triggering profile generation`);
            await generateUserProfile(userId);
          }
        } catch (err) {
          console.warn(
            "[MIND] Post-extract chain failed (non-blocking):",
            err instanceof Error ? err.message : err,
          );
        }
      })().catch(() => {});
    } else if (storedCount > 0) {
      // Накапливаем для cumulative-триггера. Счётчик обнуляется внутри
      // consolidateUserMemory() при старте полного прохода.
      try {
        await incrementFactsSinceConsolidation({ userId });
      } catch (err) {
        console.warn(
          "[MIND] Batch extract: failed to increment consolidation counter:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(
      `[MIND] Batch extract done: ${stats.processed} processed, ${stats.extracted} extracted, ${stats.stored} stored, ${supersededCount} superseded`,
    );

    return stats;
  } catch (error) {
    console.error(
      "[MIND] Batch extract failed:",
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
      model: getModel(MEMORY_DEDUP_VERIFY_TASK),
      maxOutputTokens: getMaxOutputTokensForTask(MEMORY_DEDUP_VERIFY_TASK),
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
// Internal: process a single fact (shared helper, используется batchExtractFacts)
// ---------------------------------------------------------------------------

async function processAndStoreFact(
  input: FactOriginInput,
  fact: ExtractedFact,
  stats: { stored: number; superseded: number },
): Promise<void> {
  const embedStartTime = Date.now();

  // Embed the fact content
  const { embedding, totalTokens } = await embedText(fact.content, "document");

  const embedDurationMs = Date.now() - embedStartTime;

  // Log Voyage embed usage (costUsdOverride — Voyage pricing is per-token, too small for RUB rounding)
  const voyageEmbedCostUsd = calcVoyageCostUsd(VOYAGE_INDEX_MODEL, totalTokens);
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
