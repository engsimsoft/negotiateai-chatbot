import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getProjectFolders,
  createProjectFolder,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(10).optional(),
});

/**
 * GET /api/projects/[id]/folders
 * Get all folders for a project
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
      return new ChatSDKError("not_found:database", "Project not found").toResponse();
    }

    if (project.userId !== session.user.id) {
      return new ChatSDKError("unauthorized:chat", "Access denied").toResponse();
    }

    const folders = await getProjectFolders({ projectId: id });
    return Response.json(folders);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api", "Failed to get folders").toResponse();
  }
}

/**
 * POST /api/projects/[id]/folders
 * Create a new folder
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId } = await params;
    const project = await getProjectById({ id: projectId });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const validated = CreateFolderSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, emoji } = validated.data;
    const newFolder = await createProjectFolder({
      projectId,
      name,
      emoji,
    });

    return NextResponse.json(newFolder, { status: 201 });
  } catch (error) {
    console.error("[Folders] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
