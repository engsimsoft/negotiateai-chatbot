// ТЗ-TG5: DELETE /api/telegram/groups/[groupId] — деактивировать группу

import { auth } from "@/app/(auth)/auth";
import {
  getTelegramGroupById,
  deactivateTelegramGroupById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { groupId } = await params;

    // Verify ownership
    const group = await getTelegramGroupById({
      groupId,
      ownerUserId: session.user.id,
    });

    if (!group) {
      return new ChatSDKError("not_found:api", "Group not found").toResponse();
    }

    await deactivateTelegramGroupById({
      groupId,
      ownerUserId: session.user.id,
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to deactivate group",
    ).toResponse();
  }
}
