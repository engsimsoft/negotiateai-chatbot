import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getProjectFolderWithFileCount,
  updateProjectFolder,
  deleteProjectFolder,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().max(10).optional(),
});

/**
 * GET /api/projects/[id]/folders/[folderId]
 * Get folder with file count (for delete confirmation)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id, folderId } = await params;
    const project = await getProjectById({ id });

    if (!project) {
      return new ChatSDKError("not_found:database", "Project not found").toResponse();
    }

    if (project.userId !== session.user.id) {
      return new ChatSDKError("unauthorized:chat", "Access denied").toResponse();
    }

    const folder = await getProjectFolderWithFileCount({ id: folderId });

    if (!folder || folder.projectId !== id) {
      return new ChatSDKError("not_found:database", "Folder not found").toResponse();
    }

    return Response.json(folder);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api", "Failed to get folder").toResponse();
  }
}

/**
 * PATCH /api/projects/[id]/folders/[folderId]
 * Update folder name or emoji
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, folderId } = await params;
    const project = await getProjectById({ id });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const validated = UpdateFolderSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, emoji } = validated.data;
    const updated = await updateProjectFolder({
      id: folderId,
      name,
      emoji,
    });

    if (!updated) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Folders] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/folders/[folderId]
 * Delete folder (files move to root)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, folderId } = await params;
    const project = await getProjectById({ id });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const deleted = await deleteProjectFolder({ id: folderId });

    if (!deleted) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Folders] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
