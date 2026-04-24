import { auth } from "@/app/(auth)/auth";
import {
  deleteLibraryCollectionById,
  getLibraryCollectionById,
  updateLibraryCollection,
} from "@/lib/ai/library/db";
import {
  deleteCollection as xaiDeleteCollection,
  updateCollection as xaiUpdateCollection,
} from "@/lib/ai/library/xai-collections";
import { ChatSDKError } from "@/lib/errors";

async function loadOwned(id: string, userId: string) {
  const row = await getLibraryCollectionById(id);
  if (!row) {
    throw new ChatSDKError("not_found:database", "Collection not found");
  }
  if (row.userId !== userId) {
    throw new ChatSDKError(
      "unauthorized:chat",
      "You don't have access to this collection",
    );
  }
  return row;
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
    const row = await loadOwned(id, session.user.id);

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const emoji =
      body.emoji === null
        ? null
        : typeof body.emoji === "string"
          ? body.emoji
          : undefined;

    if (name !== undefined && !name) {
      return new ChatSDKError(
        "bad_request:api",
        "Name cannot be empty",
      ).toResponse();
    }

    if (name !== undefined && name !== row.name) {
      await xaiUpdateCollection(row.xaiCollectionId, name);
    }

    const updated = await updateLibraryCollection({ id, name, emoji });

    return Response.json({
      id: updated.id,
      name: updated.name,
      emoji: updated.emoji,
      sortOrder: updated.sortOrder,
      documentCount: updated.documentCount,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to update collection",
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
    const row = await loadOwned(id, session.user.id);

    if (row.isDefault) {
      return new ChatSDKError(
        "bad_request:api",
        "Коллекцию «Мои документы» нельзя удалить — в неё автоматически складываются файлы без категории",
      ).toResponse();
    }

    await xaiDeleteCollection(row.xaiCollectionId);
    await deleteLibraryCollectionById(id);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to delete collection",
    ).toResponse();
  }
}
