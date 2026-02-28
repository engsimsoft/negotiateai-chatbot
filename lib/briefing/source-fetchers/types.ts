// ТЗ-BR1: Source fetcher types

import type { FetchTrace } from "@/lib/ai/pipeline-trace";

export interface RawContent {
  title: string;
  url: string;
  /** Article text (first MAX_CONTENT_LENGTH chars) */
  content: string;
  publishedAt?: Date;
  sourceName: string;
  sourceLanguage: string;
  /** Unique ID for lookup (assigned in route.ts at collection time) */
  itemId?: string;
}

export interface FetchResult {
  items: RawContent[];
  errors: string[];
  /** ТЗ-DEV2: Trace data for observability (always populated, pipeline decides whether to store) */
  trace?: FetchTrace;
}
