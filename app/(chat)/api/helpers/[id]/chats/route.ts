import { auth } from "@/app/(auth)/auth";
import { getChatsByHelperId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { getHelperById } from "@/lib/helpers/server";

/**
 * GET /api/helpers/[id]/chats
 * Get all chats for a specific helper
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: helperId } = await params;

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    // Verify helper exists
    const helper = await getHelperById(helperId);
    if (!helper) {
      return new ChatSDKError("not_found:database", "Helper not found").toResponse();
    }

    // For custom helpers, verify ownership
    if (helper.type === "custom" && helper.userId !== session.user.id) {
      return new ChatSDKError("forbidden:database", "Access denied").toResponse();
    }

    // Get chats for this helper
    const chats = await getChatsByHelperId({ helperId });

    // Filter to only user's chats
    const userChats = chats.filter((chat) => chat.userId === session.user.id);

    return Response.json({ chats: userChats, hasMore: false });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get helper chats"
    ).toResponse();
  }
}
