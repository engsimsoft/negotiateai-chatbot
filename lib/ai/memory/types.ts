/**
 * ТЗ-RAG0: MIND Memory types
 *
 * Shared types for memory extraction, storage, and retrieval.
 */

import type { MemoryEntry } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Memory categories (validated by Zod in extract, stored as varchar(32))
// ---------------------------------------------------------------------------

export const MEMORY_CATEGORIES = [
  "fact",       // general factual information
  "task",       // tasks, deadlines, action items
  "preference", // user preferences, likes/dislikes
  "calendar",   // dates, meetings, events
  "person",     // people, contacts, relationships
  "decision",   // decisions made, conclusions reached
  "idea",       // ideas, concepts, brainstorming
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Source types (which chat mode the fact was extracted from)
// ---------------------------------------------------------------------------

export const MEMORY_SOURCE_TYPES = [
  "chat",
  "simply",
  "expertise",
  "create",
  "project",
] as const;

export type MemorySourceType = (typeof MEMORY_SOURCE_TYPES)[number];

// ---------------------------------------------------------------------------
// Source (how the fact was created)
// ---------------------------------------------------------------------------

export const MEMORY_SOURCES = [
  "extracted", // background Extract pipeline
  "explicit",  // user explicitly asked AI to remember (saveFact tool)
] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];

// ---------------------------------------------------------------------------
// New memory entry (for insertion)
// ---------------------------------------------------------------------------

export interface NewMemoryEntry {
  userId: string;
  content: string;
  embedding: number[];
  category: MemoryCategory;
  confidence?: number;
  sourceType: MemorySourceType;
  source?: MemorySource;
  sourceChatId?: string | null;
  sourceProjectId?: string | null;
}

// ---------------------------------------------------------------------------
// Search options
// ---------------------------------------------------------------------------

export interface MemorySearchOptions {
  /** Max results to return (default: 10) */
  limit?: number;
  /** Minimum cosine similarity threshold (default: 0.3) */
  minSimilarity?: number;
  /** Filter by category */
  category?: MemoryCategory;
  /** Only active (non-superseded) entries (default: true) */
  activeOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Search result (entry + similarity score)
// ---------------------------------------------------------------------------

export interface MemorySearchResult {
  entry: MemoryEntry;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Voyage AI API types
// ---------------------------------------------------------------------------

export interface VoyageEmbedRequest {
  input: string | string[];
  model: string;
  input_type?: "query" | "document" | null;
  output_dimension?: number | null;
  truncation?: boolean;
}

export interface VoyageEmbedResponse {
  object: "list";
  data: Array<{
    object: "embedding";
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}
