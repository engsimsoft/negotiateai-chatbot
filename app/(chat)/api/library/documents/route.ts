import { after } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { autoAnalyzeDocument } from "@/lib/ai/library/auto-analyze";
import { generateAndSaveSummary } from "@/lib/ai/library/summary-generator";
import {
  attachDocumentToCollection,
  createLibraryDocument,
  ensureDefaultCollectionForUser,
  listCollectionsOwnedByUser,
  listLibraryDocumentsByUser,
  updateLibraryDocumentPatch,
} from "@/lib/ai/library/db";
import {
  attachFileToCollection,
  deleteFile as xaiDeleteFile,
  uploadDocumentToCollection,
} from "@/lib/ai/library/xai-collections";
import { ChatSDKError } from "@/lib/errors";
import { extractTextFromFile } from "@/lib/text-extraction/extract";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

const SUPPORTED_MIME = new Set<string>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/png",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  xlsm: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/**
 * xAI Collections отказывается извлекать текст при content_type=application/octet-stream
 * ("File format not supported"). Браузер не всегда выставляет MIME для .docx/.xlsx —
 * в этом случае резолвим по расширению имени файла.
 */
function resolveMimeType(browserMime: string, filename: string): string {
  if (browserMime && browserMime !== "application/octet-stream") {
    return browserMime;
  }
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXTENSION[ext] ?? browserMime ?? "application/octet-stream";
}

function isMimeSupported(mime: string, filename: string): boolean {
  if (SUPPORTED_MIME.has(mime)) return true;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return ext in MIME_BY_EXTENSION;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const url = new URL(request.url);
    const collectionId = url.searchParams.get("collectionId") ?? undefined;
    const autoType = url.searchParams.get("autoType") ?? undefined;
    const tag = url.searchParams.get("tag") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const { rows, total } = await listLibraryDocumentsByUser(session.user.id, {
      collectionId,
      autoType,
      tag,
      search,
      limit,
      offset,
    });

    return Response.json({
      documents: rows.map((d) => ({
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        size: d.size,
        status: d.status,
        statusError: d.statusError,
        autoType: d.autoType,
        autoTags: d.autoTags,
        autoDescription: d.autoDescription,
        originalFileUrl: d.originalFileUrl,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to list documents",
    ).toResponse();
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let xaiFileId: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return new ChatSDKError("bad_request:api", "No file").toResponse();
    }
    const filename = (form.get("filename") as string | null)
      ?? (file instanceof File ? file.name : "file");
    const rawCollectionIds = form.getAll("collectionIds") as string[];
    const collectionIds = rawCollectionIds.filter(
      (v) => typeof v === "string" && v.length > 0,
    );

    const size = file.size;
    if (size === 0) {
      return new ChatSDKError("bad_request:api", "Empty file").toResponse();
    }
    if (size > MAX_FILE_BYTES) {
      return new ChatSDKError(
        "bad_request:api",
        `File too large: ${size} > ${MAX_FILE_BYTES}`,
      ).toResponse();
    }
    const mimeType = resolveMimeType(file.type, filename);
    if (!isMimeSupported(mimeType, filename)) {
      return new ChatSDKError(
        "bad_request:api",
        `Unsupported MIME: ${mimeType}`,
      ).toResponse();
    }

    if (collectionIds.length > 0) {
      const owned = await listCollectionsOwnedByUser(
        session.user.id,
        collectionIds,
      );
      if (owned.length !== collectionIds.length) {
        return new ChatSDKError(
          "unauthorized:chat",
          "One or more collections don't belong to you",
        ).toResponse();
      }
    } else {
      const defaultColl = await ensureDefaultCollectionForUser(session.user.id);
      collectionIds.push(defaultColl.id);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Auto-analyze: best-effort, не блокируем upload на ошибках.
    let autoType: string | null = null;
    let autoTags: string[] | null = null;
    let autoDescription: string | null = null;
    try {
      const extracted = await extractTextFromFile({
        buffer,
        filename,
        mimeType,
        maxChars: 4_000,
      }).catch(() => null);

      const contentUnavailable =
        !extracted ||
        extracted.kind === "pdf-scan" ||
        extracted.text.length === 0;

      const result = await autoAnalyzeDocument({
        userId: session.user.id,
        filename,
        mimeType,
        extractedText: contentUnavailable ? undefined : extracted?.text,
        contentUnavailable,
      });
      autoType = result.autoType;
      autoTags = result.autoTags;
      autoDescription = result.autoDescription;
    } catch (err) {
      console.warn(
        "[Library upload] auto-analyze failed, proceeding without metadata:",
        err instanceof Error ? err.message : err,
      );
    }

    const [firstCollectionId, ...restCollectionIds] = collectionIds;
    const firstOwned = await listCollectionsOwnedByUser(session.user.id, [
      firstCollectionId,
    ]);
    if (firstOwned.length === 0) {
      return new ChatSDKError(
        "unauthorized:chat",
        "Collection not owned",
      ).toResponse();
    }

    const uploadResult = await uploadDocumentToCollection({
      collectionId: firstOwned[0].xaiCollectionId,
      buffer,
      filename,
      mimeType,
    });
    xaiFileId = uploadResult.file_metadata?.file_id ?? null;
    if (!xaiFileId) {
      throw new Error("xAI upload returned no file_id");
    }

    const doc = await createLibraryDocument({
      userId: session.user.id,
      xaiFileId,
      filename,
      mimeType,
      size,
      status: "processing",
      autoType,
      autoTags,
      autoDescription,
    });

    await attachDocumentToCollection(doc.id, firstCollectionId);

    for (const collectionId of restCollectionIds) {
      const owned = await listCollectionsOwnedByUser(session.user.id, [
        collectionId,
      ]);
      if (owned.length === 0) continue;
      await attachFileToCollection(owned[0].xaiCollectionId, xaiFileId);
      await attachDocumentToCollection(doc.id, collectionId);
    }

    const xaiCollectionIdForSummary = firstOwned[0].xaiCollectionId;
    const xaiFileIdForSummary = xaiFileId;
    const docIdForSummary = doc.id;
    const filenameForSummary = filename;
    after(async () => {
      await generateAndSaveSummary({
        documentId: docIdForSummary,
        xaiFileId: xaiFileIdForSummary,
        xaiCollectionId: xaiCollectionIdForSummary,
        filename: filenameForSummary,
      });
    });

    return Response.json(
      {
        id: doc.id,
        status: doc.status,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        autoType: doc.autoType,
        autoTags: doc.autoTags,
        autoDescription: doc.autoDescription,
      },
      { status: 201 },
    );
  } catch (error) {
    if (xaiFileId) {
      await xaiDeleteFile(xaiFileId).catch(() => {});
    }
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to upload document",
    ).toResponse();
  }
}
