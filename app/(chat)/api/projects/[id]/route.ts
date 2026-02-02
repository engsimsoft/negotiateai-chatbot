import { auth } from "@/app/(auth)/auth";
import {
  deleteProjectById,
  getProjectById,
  updateProject,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/projects/[id]
 * Get a single project by ID
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

    // Verify ownership
    if (project.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this project"
      ).toResponse();
    }

    return Response.json(project);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get project"
    ).toResponse();
  }
}

/**
 * PATCH /api/projects/[id]
 * Update project details
 */
export async function PATCH(
  request: Request,
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

    // Verify ownership
    if (project.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this project"
      ).toResponse();
    }

    const body = await request.json();
    const { name, description, instruction } = body;

    const updated = await updateProject({
      id,
      name: name?.trim(),
      description: description !== undefined ? description?.trim() || null : undefined,
      instruction: instruction !== undefined ? instruction?.trim() || null : undefined,
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update project"
    ).toResponse();
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project and all its contents
 */
export async function DELETE(
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

    // Verify ownership
    if (project.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this project"
      ).toResponse();
    }

    await deleteProjectById({ id });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to delete project"
    ).toResponse();
  }
}
