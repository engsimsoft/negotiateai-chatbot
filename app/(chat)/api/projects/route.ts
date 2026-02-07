import { auth } from "@/app/(auth)/auth";
import {
  getProjectsWithStats,
  saveProject,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";

/**
 * GET /api/projects
 * Get all projects for the current user with stats
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const projects = await getProjectsWithStats({ userId: session.user.id });
    return Response.json(projects);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get projects"
    ).toResponse();
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const { name, description, context } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new ChatSDKError(
        "bad_request:api",
        "Project name is required"
      ).toResponse();
    }

    const project = await saveProject({
      id: generateUUID(),
      userId: session.user.id,
      name: name.trim(),
      description: description?.trim() || undefined,
      context: context?.trim() || undefined,
    });

    return Response.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to create project"
    ).toResponse();
  }
}
