import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  deleteProjectFile,
  getProjectById,
  updateProjectFileFolder,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const UpdateFileSchema = z.object({
  folderId: z.string().uuid().nullable(),
});

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

/**
 * PATCH /api/projects/[id]/files/[fileId]
 * Move file to a folder (or to root if folderId is null)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId, fileId } = await params;
    const project = await getProjectById({ id: projectId });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const validated = UpdateFileSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { folderId } = validated.data;
    const updated = await updateProjectFileFolder({ fileId, folderId });

    if (!updated) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Files] Move error:", error);
    return NextResponse.json(
      { error: "Failed to move file" },
      { status: 500 }
    );
  }
}
