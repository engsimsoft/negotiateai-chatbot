// ТЗ-TG5: GET /api/telegram/groups/[groupId]/messages — сообщения группы

import { auth } from "@/app/(auth)/auth";
import {
  getTelegramGroupById,
  getTelegramGroupTopics,
  getTelegramMessages,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(
  request: Request,
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

    // Parse query params
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const topicId = url.searchParams.get("topicId");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 100) : 50;

    // Fetch messages + topics in parallel
    const [messagesResult, topics] = await Promise.all([
      getTelegramMessages({ groupId, topicId, cursor, limit }),
      group.isForum ? getTelegramGroupTopics({ groupId }) : Promise.resolve([]),
    ]);

    return Response.json({
      messages: messagesResult.messages,
      nextCursor: messagesResult.nextCursor,
      topics,
      group: {
        id: group.id,
        title: group.title,
        type: group.type,
        isForum: group.isForum,
        isActive: group.isActive,
      },
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get group messages",
    ).toResponse();
  }
}
