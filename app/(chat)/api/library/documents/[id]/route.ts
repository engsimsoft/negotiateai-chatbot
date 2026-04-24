import { auth } from "@/app/(auth)/auth";
import {
  attachDocumentToCollection,
  deleteLibraryDocumentById,
  detachDocumentFromCollection,
  getDocumentCollectionIds,
  getLibraryCollectionById,
  getLibraryDocumentById,
  listCollectionsOwnedByUser,
  updateLibraryDocumentPatch,
} from "@/lib/ai/library/db";
import {
  attachFileToCollection,
  deleteFile as xaiDeleteFile,
  detachFileFromCollection,
} from "@/lib/ai/library/xai-collections";
import { ChatSDKError } from "@/lib/errors";

async function loadOwnedDocument(id: string, userId: string) {
  const row = await getLibraryDocumentById(id);
  if (!row) {
    throw new ChatSDKError("not_found:database", "Document not found");
  }
  if (row.userId !== userId) {
    throw new ChatSDKError(
      "unauthorized:chat",
      "You don't have access to this document",
    );
  }
  return row;
}

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
    const doc = await loadOwnedDocument(id, session.user.id);
    const collectionIds = await getDocumentCollectionIds(id);

    return Response.json({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      size: doc.size,
      status: doc.status,
      statusError: doc.statusError,
      autoType: doc.autoType,
      autoTags: doc.autoTags,
      autoDescription: doc.autoDescription,
      autoSummary: doc.autoSummary,
      originalFileUrl: doc.originalFileUrl,
      collectionIds,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to get document",
    ).toResponse();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const doc = await loadOwnedDocument(id, session.user.id);

    const body = await request.json();
    const filename =
      typeof body.filename === "string" ? body.filename.trim() : undefined;
    const collectionIds: string[] | undefined = Array.isArray(body.collectionIds)
      ? body.collectionIds.filter(
          (v: unknown) => typeof v === "string" && v.length > 0,
        )
      : undefined;

    if (filename !== undefined && filename.length === 0) {
      return new ChatSDKError(
        "bad_request:api",
        "Filename cannot be empty",
      ).toResponse();
    }

    if (collectionIds !== undefined && collectionIds.length > 0) {
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
    }

    if (filename !== undefined) {
      await updateLibraryDocumentPatch(id, { filename });
    }

    if (collectionIds !== undefined) {
      const current = await getDocumentCollectionIds(id);
      const currentSet = new Set(current);
      const targetSet = new Set(collectionIds);

      const toAttach = collectionIds.filter((c) => !currentSet.has(c));
      const toDetach = current.filter((c) => !targetSet.has(c));

      for (const collectionId of toAttach) {
        const coll = await getLibraryCollectionById(collectionId);
        if (!coll) continue;
        await attachFileToCollection(coll.xaiCollectionId, doc.xaiFileId);
        await attachDocumentToCollection(id, collectionId);
      }
      for (const collectionId of toDetach) {
        const coll = await getLibraryCollectionById(collectionId);
        if (!coll) continue;
        await detachFileFromCollection(coll.xaiCollectionId, doc.xaiFileId)
          .catch((err) =>
            console.warn("[Library PATCH] xAI detach warn:", err),
          );
        await detachDocumentFromCollection(id, collectionId);
      }
    }

    const updated = await getLibraryDocumentById(id);
    const finalCollectionIds = await getDocumentCollectionIds(id);
    if (!updated) {
      return new ChatSDKError("not_found:database").toResponse();
    }

    return Response.json({
      id: updated.id,
      filename: updated.filename,
      status: updated.status,
      collectionIds: finalCollectionIds,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to update document",
    ).toResponse();
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const doc = await loadOwnedDocument(id, session.user.id);
    const collectionIds = await getDocumentCollectionIds(id);

    for (const collectionId of collectionIds) {
      await detachDocumentFromCollection(id, collectionId);
    }

    await xaiDeleteFile(doc.xaiFileId).catch((err) =>
      console.warn("[Library DELETE] xAI file delete warn:", err),
    );

    await deleteLibraryDocumentById(id);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to delete document",
    ).toResponse();
  }
}
