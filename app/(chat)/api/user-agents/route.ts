import { auth } from "@/app/(auth)/auth";
import {
  createUserAgent,
  getAgentById,
  getUserAgentsWithSource,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/user-agents
 * Returns user's personal agents with source agent data
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userAgents = await getUserAgentsWithSource({ userId: session.user.id });

    return Response.json(userAgents);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api", "Failed to get user agents").toResponse();
  }
}

/**
 * POST /api/user-agents
 * ТЗ-3B: Create a personal agent
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const body = await request.json();
    const { sourceAgentId, name, customizations } = body;

    // Validate required fields
    if (!sourceAgentId || !name) {
      return new ChatSDKError(
        "bad_request:api",
        "sourceAgentId and name are required"
      ).toResponse();
    }

    // Verify source agent exists
    const sourceAgent = await getAgentById({ id: sourceAgentId });
    if (!sourceAgent) {
      return new ChatSDKError("not_found:api", "Source agent not found").toResponse();
    }

    // Create personal agent
    const userAgent = await createUserAgent({
      userId: session.user.id,
      sourceAgentId,
      name,
      customizations: customizations || null,
    });

    return Response.json(userAgent, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to create user agent"
    ).toResponse();
  }
}
