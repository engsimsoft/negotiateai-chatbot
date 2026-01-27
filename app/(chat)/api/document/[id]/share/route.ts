import { auth } from "@/app/(auth)/auth";
import { shareDocument, unshareDocument } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * POST /api/document/[id]/share
 * Create a public share link for a document
 * Returns: { shareToken, shareUrl, alreadyShared }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id: documentId } = await params;

  if (!documentId) {
    return new ChatSDKError(
      "bad_request:api",
      "Document ID is required"
    ).toResponse();
  }

  try {
    const result = await shareDocument({
      documentId,
      userId: session.user.id,
    });

    // Build the share URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "";
    const shareUrl = `${baseUrl}/share/${result.shareToken}`;

    return Response.json(
      {
        shareToken: result.shareToken,
        shareUrl,
        alreadyShared: result.alreadyShared,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to share document"
    ).toResponse();
  }
}

/**
 * DELETE /api/document/[id]/share
 * Revoke a public share link for a document
 * Returns: { success, wasShared }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id: documentId } = await params;

  if (!documentId) {
    return new ChatSDKError(
      "bad_request:api",
      "Document ID is required"
    ).toResponse();
  }

  try {
    const result = await unshareDocument({
      documentId,
      userId: session.user.id,
    });

    return Response.json(
      {
        success: true,
        wasShared: result.wasShared,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to unshare document"
    ).toResponse();
  }
}
