import { auth } from "@/app/(auth)/auth";
import {
  getChatById,
  deleteChatById,
  updateChatTitleWithRenamedFlag,
  updateChatTaskStatus,
} from "@/lib/db/queries";
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
 * Update chat: title (rename) or taskStatus
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
    const { title, taskStatus } = body;

    // ТЗ-07C2: Update taskStatus if provided
    if (taskStatus) {
      const validStatuses = ["not_started", "in_progress", "done"];
      if (!validStatuses.includes(taskStatus)) {
        return new ChatSDKError(
          "bad_request:api",
          "Invalid taskStatus. Must be: not_started, in_progress, or done"
        ).toResponse();
      }

      await updateChatTaskStatus({
        chatId: id,
        taskStatus: taskStatus as "not_started" | "in_progress" | "done",
      });

      return Response.json({ success: true, taskStatus });
    }

    // Update title (original behavior)
    if (!title || typeof title !== "string") {
      return new ChatSDKError(
        "bad_request:api",
        "Title or taskStatus is required"
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
