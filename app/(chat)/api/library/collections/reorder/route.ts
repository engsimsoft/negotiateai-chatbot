import { auth } from "@/app/(auth)/auth";
import { reorderLibraryCollections } from "@/lib/ai/library/db";
import { ChatSDKError } from "@/lib/errors";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const order = Array.isArray(body.order) ? body.order : null;
    if (!order) {
      return new ChatSDKError(
        "bad_request:api",
        "Body must be { order: [{ id, sortOrder }] }",
      ).toResponse();
    }

    const normalized: Array<{ id: string; sortOrder: number }> = [];
    for (const entry of order) {
      if (
        entry &&
        typeof entry.id === "string" &&
        typeof entry.sortOrder === "number"
      ) {
        normalized.push({ id: entry.id, sortOrder: entry.sortOrder });
      }
    }

    await reorderLibraryCollections({
      userId: session.user.id,
      order: normalized,
    });

    return Response.json({ success: true, updated: normalized.length });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to reorder",
    ).toResponse();
  }
}
