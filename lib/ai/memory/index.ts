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

// Extraction pipeline
export type { ExtractedFact } from "./extract";
export { extractFactsFromMessages, extractAndStoreFacts } from "./extract";

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
} from "./memory-queries";
