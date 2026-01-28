import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getAgentById, getUserAgentById, updateChatAgent } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * PATCH /api/chats/[id]/agent
 * Changes agent in existing chat
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { id: chatId } = await params;
    const { agentId } = await request.json();

    if (!agentId || typeof agentId !== "string") {
      return new ChatSDKError(
        "bad_request:api",
        "agentId is required"
      ).toResponse();
    }

    // Verify agent exists (either catalog agent or user's personal agent)
    const catalogAgent = await getAgentById({ id: agentId });
    const personalAgent = await getUserAgentById({
      id: agentId,
      userId: session.user.id,
    });

    if (!catalogAgent && !personalAgent) {
      return new ChatSDKError("not_found:api", "Agent not found").toResponse();
    }

    await updateChatAgent({
      chatId,
      agentId,
      userId: session.user.id,
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update chat agent"
    ).toResponse();
  }
}
