import { auth } from "@/app/(auth)/auth";
import { getChatById, deleteChatById, updateChatTitleWithRenamedFlag } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * DELETE /api/chat/[id]
 * Delete a chat
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const chat = await getChatById({ id });

    if (!chat) {
      return new ChatSDKError(
        "not_found:database",
        "Chat not found"
      ).toResponse();
    }

    // Verify ownership
    if (chat.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this chat"
      ).toResponse();
    }

    await deleteChatById({ id });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to delete chat"
    ).toResponse();
  }
}

/**
 * PATCH /api/chat/[id]
 * Update chat title (rename)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const chat = await getChatById({ id });

    if (!chat) {
      return new ChatSDKError(
        "not_found:database",
        "Chat not found"
      ).toResponse();
    }

    // Verify ownership
    if (chat.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this chat"
      ).toResponse();
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== "string") {
      return new ChatSDKError(
        "bad_request:api",
        "Title is required"
      ).toResponse();
    }

    const updated = await updateChatTitleWithRenamedFlag({
      chatId: id,
      title: title.trim(),
      isRenamed: true, // Mark as manually renamed to disable auto-naming
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update chat"
    ).toResponse();
  }
}
