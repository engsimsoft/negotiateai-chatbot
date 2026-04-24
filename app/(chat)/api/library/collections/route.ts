import { auth } from "@/app/(auth)/auth";
import {
  createLibraryCollection,
  deleteLibraryCollectionById,
  listLibraryCollectionsByUser,
} from "@/lib/ai/library/db";
import { createCollection, deleteCollection } from "@/lib/ai/library/xai-collections";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const collections = await listLibraryCollectionsByUser(session.user.id);
    return Response.json({
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        sortOrder: c.sortOrder,
        documentCount: c.documentCount,
        isDefault: c.isDefault,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to list collections",
    ).toResponse();
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let xaiCollectionId: string | null = null;
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return new ChatSDKError(
        "bad_request:api",
        "Collection name is required",
      ).toResponse();
    }
    const emoji = typeof body.emoji === "string" ? body.emoji : null;

    const xaiCollection = await createCollection(name);
    xaiCollectionId = xaiCollection.collection_id;

    const row = await createLibraryCollection({
      userId: session.user.id,
      xaiCollectionId,
      name,
      emoji,
    });

    return Response.json(
      {
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        sortOrder: row.sortOrder,
        documentCount: row.documentCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (xaiCollectionId) {
      await deleteCollection(xaiCollectionId).catch(() => {});
    }
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to create collection",
    ).toResponse();
  }
}
