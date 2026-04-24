import { auth } from "@/app/(auth)/auth";
import { listCollectionsOwnedByUser } from "@/lib/ai/library/db";
import { searchDocuments } from "@/lib/ai/library/xai-collections";
import { ChatSDKError } from "@/lib/errors";
import type { XaiRetrievalMode } from "@/lib/ai/library/types";

const ALLOWED_MODES: XaiRetrievalMode[] = ["hybrid", "keyword", "semantic"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const query =
      typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return new ChatSDKError(
        "bad_request:api",
        "query is required",
      ).toResponse();
    }

    const rawCollectionIds = Array.isArray(body.collectionIds)
      ? body.collectionIds.filter(
          (v: unknown) => typeof v === "string" && v.length > 0,
        )
      : [];
    const maxNumResults =
      typeof body.maxNumResults === "number"
        ? Math.min(Math.max(body.maxNumResults, 1), 20)
        : 10;
    const retrievalMode: XaiRetrievalMode = ALLOWED_MODES.includes(
      body.retrievalMode,
    )
      ? body.retrievalMode
      : "hybrid";

    let xaiCollectionIds: string[] | undefined;
    if (rawCollectionIds.length > 0) {
      const owned = await listCollectionsOwnedByUser(
        session.user.id,
        rawCollectionIds,
      );
      if (owned.length !== rawCollectionIds.length) {
        return new ChatSDKError(
          "unauthorized:chat",
          "One or more collections don't belong to you",
        ).toResponse();
      }
      xaiCollectionIds = owned.map((c) => c.xaiCollectionId);
    }

    const result = await searchDocuments({
      query,
      collectionIds: xaiCollectionIds,
      retrievalMode,
      maxNumResults,
    });

    return Response.json({
      query,
      chunks: result.chunks,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to search",
    ).toResponse();
  }
}
