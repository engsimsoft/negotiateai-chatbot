import type { NextRequest } from "next/server";
import { getAgentBySlug } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/agents/[slug]
 * Returns full agent details by slug
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const agent = await getAgentBySlug({ slug });

    if (!agent) {
      return new ChatSDKError("not_found:api", "Agent not found").toResponse();
    }

    return Response.json(agent);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api", "Failed to get agent").toResponse();
  }
}
