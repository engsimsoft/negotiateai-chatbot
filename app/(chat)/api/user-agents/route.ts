import { auth } from "@/app/(auth)/auth";
import { getUserAgents } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/user-agents
 * Returns user's personal agents
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userAgents = await getUserAgents({ userId: session.user.id });

    return Response.json(userAgents);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api", "Failed to get user agents").toResponse();
  }
}
