import { getAgents } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/agents
 * Returns list of active catalog agents for display
 */
export async function GET() {
  try {
    const agents = await getAgents();

    // Return only fields needed for catalog display
    const catalogAgents = agents.map((agent) => ({
      id: agent.id,
      slug: agent.slug,
      type: agent.type,
      name: agent.name,
      icon: agent.icon,
      description: agent.description,
      defaultModel: agent.defaultModel,
    }));

    return Response.json(catalogAgents);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api", "Failed to get agents").toResponse();
  }
}
