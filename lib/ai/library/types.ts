/**
 * ТЗ-XAI-COL-1: типы для xAI Collections API (Library).
 *
 * Two distinct APIs:
 *  - management-api.x.ai/v1  — collections CRUD (requires XAI_MANAGEMENT_API_KEY)
 *  - api.x.ai/v1             — files + search  (requires XAI_API_KEY)
 *
 * Source: https://docs.x.ai/docs/guides/using-collections/api (fetched 2026-04-21)
 */

// ---------------------------------------------------------------------------
// Collections (management-api.x.ai/v1)
// ---------------------------------------------------------------------------

export interface XaiCollection {
  collection_id: string;
  collection_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface XaiCollectionList {
  collections: XaiCollection[];
}

// ---------------------------------------------------------------------------
// Files (api.x.ai/v1)
// ---------------------------------------------------------------------------

export interface XaiFile {
  id: string;
  bytes?: number;
  filename?: string;
  purpose?: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Document status — internal mirror for our DB.
// xAI exposes GET /v1/collections/{id}/documents/{file_id} (DocumentMetadata)
// with `status` enum DOCUMENT_STATUS_{UNKNOWN,PROCESSING,PROCESSED,FAILED}.
// See: https://docs.x.ai/developers/rest-api-reference/collections/collection
// ---------------------------------------------------------------------------

export type LibraryDocumentStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "error";

export type XaiDocumentStatus =
  | "DOCUMENT_STATUS_UNKNOWN"
  | "DOCUMENT_STATUS_PROCESSING"
  | "DOCUMENT_STATUS_PROCESSED"
  | "DOCUMENT_STATUS_FAILED";

export interface XaiFileMetadata {
  file_id: string;
  name?: string;
  size_bytes?: string;
  content_type?: string;
  created_at?: string;
  expires_at?: string;
  hash?: string;
  upload_status?: string;
  upload_error_message?: string;
  processing_status?: string;
  file_path?: string;
}

export interface XaiDocumentMetadata {
  file_metadata?: XaiFileMetadata;
  fields?: Record<string, unknown>;
  status?: XaiDocumentStatus;
  error_message?: string;
  last_indexed_at?: string;
  chunk_count?: number;
  chunks_processed_count?: string | number;
}

// ---------------------------------------------------------------------------
// Search (api.x.ai/v1/documents/search)
// ---------------------------------------------------------------------------

export type XaiRetrievalMode = "hybrid" | "keyword" | "semantic";

export interface XaiSearchRequest {
  query: string;
  source: {
    collection_ids?: string[];
    file_ids?: string[];
  };
  retrieval_mode?: { type: XaiRetrievalMode };
  max_num_results?: number;
}

/** Raw API response from POST /v1/documents/search (verified 2026-04-21 via e2e). */
export interface XaiSearchMatch {
  file_id: string;
  chunk_id: string;
  chunk_content: string;
  score: number;
  collection_ids: string[];
  fields?: Record<string, unknown>;
  page_number?: number;
}

export interface XaiSearchRawResponse {
  matches: XaiSearchMatch[];
}

/** Domain-normalized chunk returned by `searchDocuments()` — ready for tool execute and UI. */
export interface LibrarySearchChunk {
  content: string;
  score: number;
  fileId: string;
  collectionId: string;
  chunkId: string;
  pageNumber?: number;
  /** Canonical xAI citation URI: collections://{collection_id}/files/{file_id}. */
  citation: string;
  fields?: Record<string, unknown>;
}

export interface LibrarySearchResult {
  chunks: LibrarySearchChunk[];
}

// ---------------------------------------------------------------------------
// Citations — parser surface (see citations-parser.ts)
// ---------------------------------------------------------------------------

export interface ParsedCitation {
  collectionId: string;
  fileId: string;
  raw: string;
}
