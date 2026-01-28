import type { NextRequest } from "next/server";
import { getAgentByName } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/agents/by-name/[name]
 * Resolve agent by name or slug (case-insensitive).
 * Used for @-mention resolution.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);

    const agent = await getAgentByName({ name: decodedName });

    if (!agent) {
      return new ChatSDKError("not_found:api", "Agent not found").toResponse();
    }

    return Response.json(agent);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get agent by name"
    ).toResponse();
  }
}
