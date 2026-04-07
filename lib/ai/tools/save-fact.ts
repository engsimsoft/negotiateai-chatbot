/**
 * ТЗ-SaveFact: Tool saveFact — гарантированная запись факта в MIND
 *
 * Вызывается AI при явном запросе пользователя на запоминание.
 * Переиспользует инфраструктуру RAG: embedding (Voyage), dedup (Haiku), storage (pgvector).
 *
 * Доступен ТОЛЬКО в Simply Chat (chatMode="simply").
 */

import { tool } from "ai";
import { z } from "zod";

import { MEMORY_CATEGORIES, type MemoryCategory, type MemorySearchResult } from "@/lib/ai/memory/types";
import { embedText, VOYAGE_INDEX_MODEL } from "@/lib/ai/memory/voyage-client";
import {
  insertMemoryEntry,
  searchSimilarMemories,
  supersedeMemoryEntry,
} from "@/lib/ai/memory/memory-queries";
import { logUsage } from "@/lib/ai/usage-utils";

// ---------------------------------------------------------------------------
// Dedup: reuse same constants & LLM verification as extract.ts
// ---------------------------------------------------------------------------

/** Cosine similarity threshold for dedup candidates (same as extract.ts) */
const DEDUP_CANDIDATE_THRESHOLD = 0.55;

// Lazy import to avoid circular deps — verifyDuplicatesWithLLM is internal to extract.ts
// We inline a lightweight version here that reuses the same Haiku pattern.
import { generateObject } from "ai";
import { claudeHaiku } from "@/lib/ai/providers";

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
      if (match) return [match];
    }
  } catch (error) {
    console.warn(
      "[SaveFact] LLM dedup verification failed, falling back to embedding-only:",
      error instanceof Error ? error.message : error,
    );
    const best = candidates[0];
    if (best && best.similarity >= 0.85) return [best];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

interface SaveFactParams {
  userId: string;
  chatId?: string;
}

export const saveFact = ({ userId, chatId }: SaveFactParams) =>
  tool({
    description:
      "Записывает факт в долговременную память (MIND) пользователя. " +
      "Вызывай когда пользователь явно просит что-то запомнить, записать или сохранить.",
    inputSchema: z.object({
      content: z.string().describe("Текст факта для записи. Кратко, до 200 символов."),
      category: z
        .enum(MEMORY_CATEGORIES)
        .describe(
          "Категория факта: task (задача), calendar (событие/встреча), person (контакт), " +
          "decision (решение), idea (идея), fact (заметка/факт), preference (предпочтение)",
        ),
    }),
    execute: async ({ content, category }) => {
      try {
        const startTime = Date.now();

        // Step 1: Embed the fact
        const { embedding, totalTokens } = await embedText(content, "document");

        const embedDurationMs = Date.now() - startTime;

        // Log Voyage embed usage
        const voyageEmbedCostUsd = (totalTokens / 1_000_000) * 0.06;
        logUsage({
          userId,
          usage: {
            inputTokens: totalTokens,
            outputTokens: 0,
            totalTokens,
            inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
            outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
          },
          modelId: VOYAGE_INDEX_MODEL,
          chatMode: "memory:save-fact",
          chatId: chatId ?? null,
          durationMs: embedDurationMs,
          costUsdOverride: voyageEmbedCostUsd,
        });

        // Step 2: Dedup — two-level check
        const { results: candidates } = await searchSimilarMemories(
          userId,
          content,
          {
            limit: 5,
            minSimilarity: DEDUP_CANDIDATE_THRESHOLD,
            category: category as MemoryCategory,
          },
        );

        const similar = candidates.length > 0
          ? await verifyDuplicatesWithLLM(content, candidates)
          : [];

        // Step 3: Store
        if (similar.length > 0) {
          // Supersede the most similar existing fact
          const oldEntry = similar[0];

          // If content is identical — skip entirely
          if (oldEntry.entry.content.trim() === content.trim()) {
            console.log(`[SaveFact] Exact duplicate skipped: "${content.slice(0, 50)}..."`);
            return {
              success: true,
              factId: oldEntry.entry.id,
              action: "duplicate_skipped" as const,
              content,
              category,
            };
          }

          // Merge (supersede old with new)
          const newId = await insertMemoryEntry({
            userId,
            content,
            embedding,
            category,
            confidence: 1.0,
            sourceType: "simply",
            source: "explicit",
            sourceChatId: chatId ?? null,
          });

          await supersedeMemoryEntry(oldEntry.entry.id, newId);

          console.log(
            `[SaveFact] Merged: "${oldEntry.entry.content.slice(0, 40)}..." → "${content.slice(0, 40)}..."`,
          );

          return {
            success: true,
            factId: newId,
            action: "merged" as const,
            content,
            category,
          };
        }

        // New fact — insert directly
        const newId = await insertMemoryEntry({
          userId,
          content,
          embedding,
          category,
          confidence: 1.0,
          sourceType: "simply",
          source: "explicit",
          sourceChatId: chatId ?? null,
        });

        console.log(`[SaveFact] Created: "${content.slice(0, 50)}..." [${category}]`);

        return {
          success: true,
          factId: newId,
          action: "created" as const,
          content,
          category,
        };
      } catch (error) {
        console.error(
          "[SaveFact] Failed:",
          error instanceof Error ? error.message : error,
        );
        return {
          success: false,
          error: "Не удалось сохранить факт. Попробуйте позже.",
        };
      }
    },
  });
