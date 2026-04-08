/**
 * ТЗ-RAG0: Memory CRUD + similarity search
 *
 * Uses pgvector cosine distance operator (<=>) for semantic search.
 * All queries filter by userId — memory is strictly isolated per user.
 */

import "server-only";

import { and, eq, inArray, isNull, sql, desc } from "drizzle-orm";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { memoryEntry, message } from "@/lib/db/schema";
import type {
  NewMemoryEntry,
  MemoryCategory,
  MemorySearchOptions,
  MemorySearchResult,
} from "./types";
import { embedText } from "./voyage-client";

// ---------------------------------------------------------------------------
// DB connection (same pattern as lib/db/queries.ts)
// ---------------------------------------------------------------------------

neonConfig.webSocketConstructor = ws;
// biome-ignore lint: Forbidden non-null assertion.
const pool = new Pool({ connectionString: process.env.POSTGRES_URL! });
const db = drizzle(pool);

// ---------------------------------------------------------------------------
// Insert / Upsert
// ---------------------------------------------------------------------------

/**
 * Insert a new memory entry with pre-computed embedding.
 * Does NOT deduplicate — caller is responsible for checking similarity first.
 */
export async function insertMemoryEntry(
  entry: NewMemoryEntry,
): Promise<string> {
  const [result] = await db
    .insert(memoryEntry)
    .values({
      userId: entry.userId,
      content: entry.content,
      embedding: entry.embedding,
      category: entry.category,
      confidence: String(entry.confidence ?? 1.0),
      sourceType: entry.sourceType,
      source: entry.source ?? "extracted",
      sourceChatId: entry.sourceChatId ?? null,
      sourceProjectId: entry.sourceProjectId ?? null,
      metadata: entry.metadata ?? null,
    })
    .returning({ id: memoryEntry.id });

  return result.id;
}

/**
 * High-level: embed text via Voyage AI, then insert into memory_entry.
 * Returns the new entry id and token count.
 */
export async function embedAndInsertMemory(
  entry: Omit<NewMemoryEntry, "embedding">,
): Promise<{ id: string; totalTokens: number }> {
  const { embedding, totalTokens } = await embedText(
    entry.content,
    "document",
  );

  const id = await insertMemoryEntry({ ...entry, embedding });
  return { id, totalTokens };
}

// ---------------------------------------------------------------------------
// Similarity search
// ---------------------------------------------------------------------------

/**
 * Semantic search: embed query text via voyage-4-lite, then find similar
 * memory entries using pgvector cosine distance.
 *
 * Returns entries sorted by similarity (highest first).
 */
export async function searchSimilarMemories(
  userId: string,
  queryText: string,
  options?: MemorySearchOptions,
): Promise<{ results: MemorySearchResult[]; totalTokens: number }> {
  const limit = options?.limit ?? 10;
  const minSimilarity = options?.minSimilarity ?? 0.3;
  const activeOnly = options?.activeOnly ?? true;

  // Embed query via voyage-4-lite
  const { embedding, totalTokens } = await embedText(queryText, "query");
  const vectorStr = `[${embedding.join(",")}]`;

  // Build WHERE conditions
  const conditions: ReturnType<typeof eq>[] = [
    eq(memoryEntry.userId, userId),
  ];

  if (activeOnly) {
    conditions.push(isNull(memoryEntry.supersededBy));
  }

  if (options?.category) {
    conditions.push(eq(memoryEntry.category, options.category));
  }

  // Raw SQL for cosine similarity: 1 - (embedding <=> query_vector)
  // pgvector <=> returns cosine DISTANCE (0 = identical), we want SIMILARITY
  const rows = await db
    .select({
      id: memoryEntry.id,
      userId: memoryEntry.userId,
      content: memoryEntry.content,
      embedding: memoryEntry.embedding,
      category: memoryEntry.category,
      confidence: memoryEntry.confidence,
      sourceType: memoryEntry.sourceType,
      source: memoryEntry.source,
      sourceChatId: memoryEntry.sourceChatId,
      sourceProjectId: memoryEntry.sourceProjectId,
      metadata: memoryEntry.metadata,
      supersededBy: memoryEntry.supersededBy,
      createdAt: memoryEntry.createdAt,
      updatedAt: memoryEntry.updatedAt,
      similarity: sql<number>`1 - (${memoryEntry.embedding} <=> ${vectorStr}::vector)`.as(
        "similarity",
      ),
    })
    .from(memoryEntry)
    .where(and(...conditions))
    .orderBy(sql`${memoryEntry.embedding} <=> ${vectorStr}::vector`)
    .limit(limit);

  // Filter by minimum similarity
  const results: MemorySearchResult[] = rows
    .filter((row) => row.similarity >= minSimilarity)
    .map((row) => ({
      entry: {
        id: row.id,
        userId: row.userId,
        content: row.content,
        embedding: row.embedding,
        category: row.category,
        confidence: row.confidence,
        sourceType: row.sourceType,
        source: row.source,
        sourceChatId: row.sourceChatId,
        sourceProjectId: row.sourceProjectId,
        metadata: row.metadata,
        supersededBy: row.supersededBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      similarity: row.similarity,
    }));

  return { results, totalTokens };
}

// ---------------------------------------------------------------------------
// List / Filter
// ---------------------------------------------------------------------------

/**
 * Get all memory entries for a user, with optional filters.
 */
export async function getMemoryEntriesByUser(
  userId: string,
  options?: {
    category?: MemoryCategory;
    activeOnly?: boolean;
    limit?: number;
  },
): Promise<typeof memoryEntry.$inferSelect[]> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(memoryEntry.userId, userId),
  ];

  if (options?.activeOnly !== false) {
    conditions.push(isNull(memoryEntry.supersededBy));
  }

  if (options?.category) {
    conditions.push(eq(memoryEntry.category, options.category));
  }

  return db
    .select()
    .from(memoryEntry)
    .where(and(...conditions))
    .orderBy(desc(memoryEntry.createdAt))
    .limit(options?.limit ?? 100);
}

/**
 * Count active memory entries for a user.
 */
export async function countUserMemories(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memoryEntry)
    .where(
      and(eq(memoryEntry.userId, userId), isNull(memoryEntry.supersededBy)),
    );

  return Number(result.count);
}

// ---------------------------------------------------------------------------
// Count by category (for /context dashboard)
// ---------------------------------------------------------------------------

export interface CategorySummary {
  category: string;
  count: number;
  preview: string[]; // top-2 most recent facts
}

/**
 * Get counts and top-2 preview facts per category for a user.
 * Only returns categories that have at least one active fact.
 */
export async function getMemorySummaryByCategory(
  userId: string,
): Promise<CategorySummary[]> {
  // Get all active facts ordered by recency
  const allFacts = await db
    .select({
      category: memoryEntry.category,
      content: memoryEntry.content,
    })
    .from(memoryEntry)
    .where(
      and(eq(memoryEntry.userId, userId), isNull(memoryEntry.supersededBy)),
    )
    .orderBy(desc(memoryEntry.createdAt));

  // Group by category
  const grouped = new Map<string, string[]>();
  for (const fact of allFacts) {
    const list = grouped.get(fact.category) ?? [];
    list.push(fact.content);
    grouped.set(fact.category, list);
  }

  // Build summary with top-2 preview
  const summaries: CategorySummary[] = [];
  for (const [category, contents] of grouped) {
    summaries.push({
      category,
      count: contents.length,
      preview: contents.slice(0, 2),
    });
  }

  // Sort by count descending
  summaries.sort((a, b) => b.count - a.count);

  return summaries;
}

// ---------------------------------------------------------------------------
// Update metadata (ТЗ-SaveFactV2)
// ---------------------------------------------------------------------------

export async function updateMemoryMetadata(
  id: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await db
    .update(memoryEntry)
    .set({ metadata, updatedAt: new Date() })
    .where(eq(memoryEntry.id, id));
}

// ---------------------------------------------------------------------------
// Supersede (replace old fact with new one)
// ---------------------------------------------------------------------------

/**
 * Mark an old memory entry as superseded by a new one.
 */
export async function supersedeMemoryEntry(
  oldId: string,
  newId: string,
): Promise<void> {
  await db
    .update(memoryEntry)
    .set({ supersededBy: newId, updatedAt: new Date() })
    .where(eq(memoryEntry.id, oldId));
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a single memory entry.
 */
export async function deleteMemoryEntry(id: string): Promise<void> {
  // First, clear supersededBy references pointing to this entry
  await db
    .update(memoryEntry)
    .set({ supersededBy: null })
    .where(eq(memoryEntry.supersededBy, id));

  await db.delete(memoryEntry).where(eq(memoryEntry.id, id));
}

/**
 * Delete ALL memory entries for a user ("Удалить всё обо мне").
 */
export async function deleteAllUserMemories(userId: string): Promise<number> {
  const result = await db
    .delete(memoryEntry)
    .where(eq(memoryEntry.userId, userId))
    .returning({ id: memoryEntry.id });

  return result.length;
}

// ---------------------------------------------------------------------------
// ТЗ-ExtractCompression: Mark messages as extracted
// ---------------------------------------------------------------------------

/**
 * Mark messages as extracted (set extractedAt = NOW()).
 * Called after batchExtractFacts processes a batch of messages.
 */
export async function markMessagesExtracted(
  messageIds: string[],
): Promise<void> {
  if (messageIds.length === 0) return;

  await db
    .update(message)
    .set({ extractedAt: new Date() })
    .where(inArray(message.id, messageIds));
}
