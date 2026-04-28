/**
 * xAI Files API — typed wrappers поверх https://api.x.ai/v1/files.
 *
 * Pattern: lib/ai/library/xai-collections.ts (raw fetch + typed responses).
 *
 * Bypass SDK через raw fetch — `@ai-sdk/xai@3.0.83` throw'ит UnsupportedFunctionalityError
 * на любой `file` part кроме `image/*`. Upgrade SDK не помогает (input_file content type
 * в SDK не реализован). См. SPEC v3 §5.1.
 *
 * Source: https://docs.x.ai/developers/files/managing-files
 */

const API_BASE = "https://api.x.ai/v1";
const REQUEST_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 1_000;

function apiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) {
    throw new Error("XAI_API_KEY is not set. Required for xAI Files API.");
  }
  return key;
}

export class XaiFilesApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly responseBody: string,
  ) {
    super(`xAI Files API ${status} at ${url}: ${responseBody.slice(0, 300)}`);
    this.name = "XaiFilesApiError";
  }
}

export interface XaiFile {
  id: string;
  filename: string;
  bytes: number;
  createdAt: number;
  purpose: string;
}

interface XaiFileApiResponse {
  id: string;
  filename: string;
  bytes: number;
  created_at: number;
  purpose: string;
}

function normalizeFile(raw: XaiFileApiResponse): XaiFile {
  return {
    id: raw.id,
    filename: raw.filename,
    bytes: raw.bytes,
    createdAt: raw.created_at,
    purpose: raw.purpose,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callJson<T>(
  url: string,
  init: RequestInit,
  parseEmpty?: T,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          ...(init.body && !(init.body instanceof FormData)
            ? { "Content-Type": "application/json" }
            : {}),
          ...(init.headers ?? {}),
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        // Retry только на 5xx, не на 4xx
        if (response.status >= 500 && attempt === 0) {
          lastError = new XaiFilesApiError(response.status, url, body);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        throw new XaiFilesApiError(response.status, url, body);
      }

      if (response.status === 204) {
        return parseEmpty as T;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return parseEmpty as T;
      }
      return (await response.json()) as T;
    } catch (err) {
      // Network/abort errors — retry once
      if (
        attempt === 0 &&
        !(err instanceof XaiFilesApiError && err.status < 500)
      ) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error("xAI Files API: unreachable code");
}

/**
 * Upload файла в xAI Files API.
 *
 * Source: https://docs.x.ai/developers/files/managing-files#uploading-a-file
 * Limits: max 48 MB, purpose=assistants для использования в Responses API input_file.
 */
export async function xaiUploadFile(params: {
  buffer: Buffer | Uint8Array;
  filename: string;
  mimeType: string;
  purpose?: "assistants";
}): Promise<XaiFile> {
  const { buffer, filename, mimeType } = params;
  const purpose = params.purpose ?? "assistants";

  const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const copy = new ArrayBuffer(source.byteLength);
  new Uint8Array(copy).set(source);

  const formData = new FormData();
  formData.append("file", new Blob([copy], { type: mimeType }), filename);
  formData.append("purpose", purpose);

  const raw = await callJson<XaiFileApiResponse>(`${API_BASE}/files`, {
    method: "POST",
    body: formData,
  });
  return normalizeFile(raw);
}

/**
 * Удаление файла. Вызывается из deleteChatWithCleanup и background reaper.
 *
 * Source: https://docs.x.ai/developers/files/managing-files#deleting-a-file
 */
export async function xaiDeleteFile(
  fileId: string,
): Promise<{ deleted: boolean }> {
  const raw = await callJson<{ id: string; deleted: boolean }>(
    `${API_BASE}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
    { id: fileId, deleted: true } as any,
  );
  return { deleted: raw.deleted };
}

/**
 * Получить metadata файла. Возвращает null при 404.
 *
 * Source: https://docs.x.ai/developers/files/managing-files#retrieving-a-file
 */
export async function xaiGetFileMetadata(
  fileId: string,
): Promise<XaiFile | null> {
  try {
    const raw = await callJson<XaiFileApiResponse>(
      `${API_BASE}/files/${encodeURIComponent(fileId)}`,
      { method: "GET" },
    );
    return normalizeFile(raw);
  } catch (err) {
    if (err instanceof XaiFilesApiError && err.status === 404) return null;
    throw err;
  }
}

export interface XaiFilesListResult {
  data: XaiFile[];
  hasMore: boolean;
  nextToken?: string;
}

interface XaiFilesListResponse {
  data: XaiFileApiResponse[];
  has_more: boolean;
  pagination_token?: string;
}

/**
 * List файлов с пагинацией. Используется background reaper'ом.
 *
 * Source: https://docs.x.ai/developers/files/managing-files#listing-files
 */
export async function xaiListFiles(options?: {
  limit?: number;
  paginationToken?: string;
}): Promise<XaiFilesListResult> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.paginationToken) {
    params.set("pagination_token", options.paginationToken);
  }
  const url = `${API_BASE}/files${params.size > 0 ? `?${params}` : ""}`;
  const raw = await callJson<XaiFilesListResponse>(url, { method: "GET" });
  return {
    data: raw.data.map(normalizeFile),
    hasMore: raw.has_more,
    nextToken: raw.pagination_token,
  };
}
