import { del } from "@vercel/blob";
import { auth } from "@/app/(auth)/auth";
import {
  deleteProjectFile,
  getProjectById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * DELETE /api/projects/[id]/files/[fileId]
 * Delete a file from a project
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id: projectId, fileId } = await params;
    const project = await getProjectById({ id: projectId });

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

    const deletedFile = await deleteProjectFile({ id: fileId });

    if (!deletedFile) {
      return new ChatSDKError(
        "not_found:database",
        "File not found"
      ).toResponse();
    }

    // Delete from Vercel Blob
    try {
      await del(deletedFile.url);
    } catch (blobError) {
      console.warn("[ProjectFiles] Failed to delete blob:", blobError);
      // Continue even if blob deletion fails
    }

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to delete file"
    ).toResponse();
  }
}
