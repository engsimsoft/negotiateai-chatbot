/**
 * ТЗ-XAI-COL-1: парсер citations из xAI Collections API.
 *
 * Format: collections://{collection_id}/files/{file_id}
 * Example: collections://collection_3be0eec8-.../files/file_d4d1a968-...
 *
 * Source: https://docs.x.ai/docs/guides/tools/collections-search-tool
 */

import type { ParsedCitation } from "./types";

const CITATION_RE = /^collections:\/\/([^/]+)\/files\/([^/?#\s]+)$/;

export function parseCitation(uri: string): ParsedCitation | null {
  const match = CITATION_RE.exec(uri.trim());
  if (!match) return null;
  return { collectionId: match[1], fileId: match[2], raw: uri };
}

export function parseCitations(uris: string[]): ParsedCitation[] {
  const result: ParsedCitation[] = [];
  for (const uri of uris) {
    const parsed = parseCitation(uri);
    if (parsed) result.push(parsed);
  }
  return result;
}

export function formatCitation(
  collectionId: string,
  fileId: string,
): string {
  return `collections://${collectionId}/files/${fileId}`;
}
