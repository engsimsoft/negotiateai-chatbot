/**
 * ТЗ-RAG0: MIND Memory — public API
 *
 * Usage:
 *   import { embedAndInsertMemory, searchSimilarMemories } from "@/lib/ai/memory";
 */

// Types
export type {
  MemoryCategory,
  MemorySourceType,
  NewMemoryEntry,
  MemorySearchOptions,
  MemorySearchResult,
} from "./types";
export { MEMORY_CATEGORIES, MEMORY_SOURCE_TYPES } from "./types";

// Voyage AI client
export { embedText, embedTexts } from "./voyage-client";

// Extraction pipeline (ТЗ-COMPACTION-UNIFY: per-turn extract удалён, остался только batch)
export type { ExtractedFact } from "./extract";
export { batchExtractFacts } from "./extract";

// On-visit trigger (ТЗ-MindOnVisit)
export { processStaleFactsOnVisit } from "./on-visit";

// Consolidation
export type { ConsolidationStats } from "./consolidate";
export { consolidateUserMemory } from "./consolidate";

// Profile generation
export type { ProfileGenerationResult } from "./profile";
export { generateUserProfile, getProfileBlock } from "./profile";

// Retrieval + prompt injection
export type { RetrievalResult } from "./retrieve";
export { retrieveMemoryContext, formatMemoryForPrompt } from "./retrieve";

// Memory CRUD + search
export {
  insertMemoryEntry,
  embedAndInsertMemory,
  searchSimilarMemories,
  getMemoryEntriesByUser,
  countUserMemories,
  supersedeMemoryEntry,
  deleteMemoryEntry,
  deleteAllUserMemories,
  markMessagesExtracted,
} from "./memory-queries";
