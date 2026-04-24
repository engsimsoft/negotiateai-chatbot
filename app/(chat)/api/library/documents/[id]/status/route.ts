import { auth } from "@/app/(auth)/auth";
import {
  getDocumentCollectionIds,
  getLibraryCollectionById,
  getLibraryDocumentById,
  updateLibraryDocumentPatch,
} from "@/lib/ai/library/db";
import { getDocumentMetadata } from "@/lib/ai/library/xai-collections";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/library/documents/[id]/status
 *
 * Опрашивает xAI DocumentMetadata (`GET /v1/collections/{cid}/documents/{fid}`)
 * и синхронизирует нашу БД. Клиент опрашивает каждые ~3 сек до ready|error.
 *
 * F3 (FINDINGS): раньше использовался search-based probe — он возвращал
 * только «есть чанки / нет», но не различал PROCESSING от FAILED. После
 * обнаружения DocumentMetadata endpoint в сессии 4 (ADR 056) перешли на него.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const doc = await getLibraryDocumentById(id);
    if (!doc) {
      return new ChatSDKError(
        "not_found:database",
        "Document not found",
      ).toResponse();
    }
    if (doc.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this document",
      ).toResponse();
    }

    // Terminal state — просто возвращаем. Документы могут переживать
    // повторные страницы/клиенты — не ходим в xAI за тем что уже знаем.
    if (doc.status === "ready" || doc.status === "error") {
      return Response.json({
        status: doc.status,
        statusError: doc.statusError,
      });
    }

    const collectionIds = await getDocumentCollectionIds(id);
    if (collectionIds.length === 0) {
      return Response.json({
        status: doc.status,
        statusError: doc.statusError,
      });
    }
    const firstCollection = await getLibraryCollectionById(collectionIds[0]);
    if (!firstCollection) {
      return Response.json({
        status: doc.status,
        statusError: doc.statusError,
      });
    }

    try {
      const meta = await getDocumentMetadata(
        firstCollection.xaiCollectionId,
        doc.xaiFileId,
      );
      if (meta.status === "DOCUMENT_STATUS_PROCESSED") {
        await updateLibraryDocumentPatch(id, {
          status: "ready",
          statusError: null,
        });
        return Response.json({ status: "ready", statusError: null });
      }
      if (meta.status === "DOCUMENT_STATUS_FAILED") {
        const errorMessage =
          meta.error_message ?? "xAI indexing failed";
        await updateLibraryDocumentPatch(id, {
          status: "error",
          statusError: errorMessage,
        });
        return Response.json({ status: "error", statusError: errorMessage });
      }
    } catch (err) {
      console.warn(
        "[Library status] metadata fetch failed:",
        err instanceof Error ? err.message : err,
      );
    }

    return Response.json({
      status: doc.status,
      statusError: doc.statusError,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to get status",
    ).toResponse();
  }
}
