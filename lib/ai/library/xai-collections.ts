/**
 * ТЗ-XAI-COL-1: тонкий wrapper над xAI Collections API.
 *
 * Pattern: lib/ai/memory/voyage-client.ts (raw fetch + typed responses).
 *
 * Two distinct APIs (see types.ts):
 *  - management-api.x.ai/v1 — collections CRUD (XAI_MANAGEMENT_API_KEY)
 *  - api.x.ai/v1            — files + search  (XAI_API_KEY)
 *
 * Source: https://docs.x.ai/docs/guides/using-collections/api
 */

import { formatCitation } from "./citations-parser";
import type {
  LibrarySearchResult,
  XaiCollection,
  XaiCollectionList,
  XaiDocumentMetadata,
  XaiFile,
  XaiRetrievalMode,
  XaiSearchRawResponse,
  XaiSearchRequest,
} from "./types";

const MANAGEMENT_BASE = "https://management-api.x.ai/v1";
const API_BASE = "https://api.x.ai/v1";
const REQUEST_TIMEOUT_MS = 30_000;

function managementKey(): string {
  const key = process.env.XAI_MANAGEMENT_API_KEY;
  if (!key) {
    throw new Error(
      "XAI_MANAGEMENT_API_KEY is not set. Required for Library collections CRUD.",
    );
  }
  return key;
}

function apiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    throw new Error(
      "XAI_API_KEY is not set. Required for Library file upload and search.",
    );
  }
  return key;
}

async function callJson<T>(
  url: string,
  init: RequestInit & { authKey: string },
): Promise<T> {
  const { authKey, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...rest,
      headers: {
        Authorization: `Bearer ${authKey}`,
        ...(rest.body && !(rest.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(rest.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `xAI API ${response.status} ${response.statusText} at ${url}: ${text}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Collections CRUD (management-api.x.ai/v1)
// ---------------------------------------------------------------------------

export async function createCollection(
  collectionName: string,
): Promise<XaiCollection> {
  return callJson<XaiCollection>(`${MANAGEMENT_BASE}/collections`, {
    method: "POST",
    body: JSON.stringify({ collection_name: collectionName }),
    authKey: managementKey(),
  });
}

export async function listCollections(): Promise<XaiCollectionList> {
  return callJson<XaiCollectionList>(`${MANAGEMENT_BASE}/collections`, {
    method: "GET",
    authKey: managementKey(),
  });
}

export async function getCollection(
  collectionId: string,
): Promise<XaiCollection> {
  return callJson<XaiCollection>(
    `${MANAGEMENT_BASE}/collections/${encodeURIComponent(collectionId)}`,
    { method: "GET", authKey: managementKey() },
  );
}

export async function updateCollection(
  collectionId: string,
  collectionName: string,
): Promise<XaiCollection> {
  return callJson<XaiCollection>(
    `${MANAGEMENT_BASE}/collections/${encodeURIComponent(collectionId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ collection_name: collectionName }),
      authKey: managementKey(),
    },
  );
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await callJson<void>(
    `${MANAGEMENT_BASE}/collections/${encodeURIComponent(collectionId)}`,
    { method: "DELETE", authKey: managementKey() },
  );
}

// ---------------------------------------------------------------------------
// Files (api.x.ai/v1)
// ---------------------------------------------------------------------------

export async function uploadFile(params: {
  buffer: Buffer | Uint8Array | ArrayBuffer;
  filename: string;
  mimeType: string;
  purpose?: string;
}): Promise<XaiFile> {
  const source = params.buffer instanceof ArrayBuffer
    ? new Uint8Array(params.buffer)
    : (params.buffer as Uint8Array);
  const copy = new ArrayBuffer(source.byteLength);
  new Uint8Array(copy).set(source);

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([copy], { type: params.mimeType }),
    params.filename,
  );
  formData.append("purpose", params.purpose ?? "assistants");

  return callJson<XaiFile>(`${API_BASE}/files`, {
    method: "POST",
    body: formData,
    authKey: apiKey(),
  });
}

export async function uploadDocumentToCollection(params: {
  collectionId: string;
  buffer: Buffer | Uint8Array | ArrayBuffer;
  filename: string;
  mimeType: string;
}): Promise<XaiDocumentMetadata> {
  const source = params.buffer instanceof ArrayBuffer
    ? new Uint8Array(params.buffer)
    : (params.buffer as Uint8Array);
  const copy = new ArrayBuffer(source.byteLength);
  new Uint8Array(copy).set(source);

  const formData = new FormData();
  formData.append("name", params.filename);
  formData.append(
    "data",
    new Blob([copy], { type: params.mimeType }),
    params.filename,
  );
  formData.append("content_type", params.mimeType);

  return callJson<XaiDocumentMetadata>(
    `${MANAGEMENT_BASE}/collections/${encodeURIComponent(params.collectionId)}/documents`,
    {
      method: "POST",
      body: formData,
      authKey: managementKey(),
    },
  );
}

export async function deleteFile(fileId: string): Promise<void> {
  await callJson<void>(`${API_BASE}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    authKey: apiKey(),
  });
}

export async function getFileContent(fileId: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${API_BASE}/files/${encodeURIComponent(fileId)}/content`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey()}` },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `xAI file content ${response.status} ${response.statusText}: ${text}`,
      );
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Attach / detach file ↔ collection (management-api.x.ai/v1)
// ---------------------------------------------------------------------------

export async function attachFileToCollection(
  collectionId: string,
  fileId: string,
): Promise<void> {
  await callJson<void>(
    `${MANAGEMENT_BASE}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(fileId)}`,
    { method: "POST", authKey: managementKey() },
  );
}

export async function getDocumentMetadata(
  collectionId: string,
  fileId: string,
): Promise<XaiDocumentMetadata> {
  return callJson<XaiDocumentMetadata>(
    `${MANAGEMENT_BASE}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(fileId)}`,
    { method: "GET", authKey: managementKey() },
  );
}

export async function detachFileFromCollection(
  collectionId: string,
  fileId: string,
): Promise<void> {
  await callJson<void>(
    `${MANAGEMENT_BASE}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(fileId)}`,
    { method: "DELETE", authKey: managementKey() },
  );
}

// ---------------------------------------------------------------------------
// Search (api.x.ai/v1/documents/search)
// ---------------------------------------------------------------------------

export async function searchDocuments(params: {
  query: string;
  collectionIds?: string[];
  fileIds?: string[];
  retrievalMode?: XaiRetrievalMode;
  maxNumResults?: number;
}): Promise<LibrarySearchResult> {
  const body: XaiSearchRequest = {
    query: params.query,
    source: {
      collection_ids: params.collectionIds ?? [],
      file_ids: params.fileIds ?? [],
    },
    retrieval_mode: { type: params.retrievalMode ?? "hybrid" },
    max_num_results: params.maxNumResults ?? 10,
  };

  const raw = await callJson<XaiSearchRawResponse>(
    `${API_BASE}/documents/search`,
    {
      method: "POST",
      body: JSON.stringify(body),
      authKey: apiKey(),
    },
  );

  const chunks = (raw.matches ?? []).map((m) => {
    const collectionId = m.collection_ids?.[0] ?? "";
    return {
      content: m.chunk_content,
      score: m.score,
      fileId: m.file_id,
      collectionId,
      chunkId: m.chunk_id,
      pageNumber: m.page_number,
      citation: collectionId
        ? formatCitation(collectionId, m.file_id)
        : `collections://unknown/files/${m.file_id}`,
      fields: m.fields,
    };
  });

  return { chunks };
}
