/**
 * ТЗ-RAG0: Voyage AI client — embeddings via raw fetch
 *
 * Pattern: perplexity-client.ts (raw fetch + typed response).
 * Endpoint: POST https://api.voyageai.com/v1/embeddings
 *
 * Models:
 *  - voyage-4       (1024 dim) — indexing facts (input_type: "document")
 *  - voyage-4-lite  (1024 dim) — search queries (input_type: "query")
 *
 * Both share the same embedding space — index with voyage-4, search with
 * voyage-4-lite for cost efficiency.
 */

import type { VoyageEmbedRequest, VoyageEmbedResponse } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_TIMEOUT_MS = 15_000;

/** Model for indexing (document embeddings) */
export const VOYAGE_INDEX_MODEL = "voyage-4";
/** Model for queries (cheaper, shared space with voyage-4) */
export const VOYAGE_QUERY_MODEL = "voyage-4-lite";
/** Default output dimension */
export const VOYAGE_DIMENSIONS = 1024;
/** Max items per batch request */
const MAX_BATCH_SIZE = 128;

/**
 * Voyage AI embedding pricing in USD per 1M tokens.
 * SSOT — always read pricing from here, never hardcode in call sites.
 * Source: https://docs.voyageai.com/docs/pricing
 */
export const VOYAGE_PRICING_USD_PER_MTOK: Record<string, number> = {
  "voyage-4": 0.06,
  "voyage-4-lite": 0.02,
};

export function calcVoyageCostUsd(model: string, tokens: number): number {
  const pricePerMtok = VOYAGE_PRICING_USD_PER_MTOK[model] ?? 0;
  return (tokens / 1_000_000) * pricePerMtok;
}

// ---------------------------------------------------------------------------
// Core API call
// ---------------------------------------------------------------------------

async function callVoyageEmbed(
  request: VoyageEmbedRequest,
): Promise<VoyageEmbedResponse> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Voyage AI API key is not configured. Please set VOYAGE_API_KEY in .env.local",
    );
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(VOYAGE_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Voyage AI API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as VoyageEmbedResponse;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EmbedResult {
  embedding: number[];
  totalTokens: number;
}

export interface EmbedBatchResult {
  embeddings: number[][];
  totalTokens: number;
}

/**
 * Embed a single text. Returns a 1024-dim vector.
 *
 * @param text - Text to embed
 * @param inputType - "document" for indexing, "query" for search
 */
export async function embedText(
  text: string,
  inputType: "document" | "query",
): Promise<EmbedResult> {
  const model =
    inputType === "document" ? VOYAGE_INDEX_MODEL : VOYAGE_QUERY_MODEL;

  const data = await callVoyageEmbed({
    input: text,
    model,
    input_type: inputType,
  });

  const item = data.data[0];
  if (!item) {
    throw new Error("Voyage AI returned empty embedding");
  }

  return {
    embedding: item.embedding,
    totalTokens: data.usage.total_tokens,
  };
}

/**
 * Embed multiple texts in one API call (batch).
 * Automatically splits into chunks of MAX_BATCH_SIZE if needed.
 *
 * @param texts - Array of texts to embed (max 1000)
 * @param inputType - "document" for indexing, "query" for search
 */
export async function embedTexts(
  texts: string[],
  inputType: "document" | "query",
): Promise<EmbedBatchResult> {
  if (texts.length === 0) {
    return { embeddings: [], totalTokens: 0 };
  }

  const model =
    inputType === "document" ? VOYAGE_INDEX_MODEL : VOYAGE_QUERY_MODEL;

  // Split into batches if needed
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    batches.push(texts.slice(i, i + MAX_BATCH_SIZE));
  }

  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  for (const batch of batches) {
    const data = await callVoyageEmbed({
      input: batch,
      model,
      input_type: inputType,
    });

    // Voyage returns embeddings sorted by index
    for (const item of data.data) {
      allEmbeddings.push(item.embedding);
    }
    totalTokens += data.usage.total_tokens;
  }

  return { embeddings: allEmbeddings, totalTokens };
}
