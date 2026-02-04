import { auth } from "@/app/(auth)/auth";
import {
  getChatsByProjectId,
  getProjectById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/projects/[id]/chats
 * Get all chats for a project
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const project = await getProjectById({ id });

    if (!project) {
      return new ChatSDKError(
        "not_found:database",
        "Project not found"
      ).toResponse();
    }

    if (project.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this project"
      ).toResponse();
    }

    const chats = await getChatsByProjectId({ projectId: id });
    return Response.json({ chats, hasMore: false });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get project chats"
    ).toResponse();
  }
}
