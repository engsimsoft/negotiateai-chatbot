/**
 * ТЗ-B2: Project Tasks Endpoint
 *
 * GET /api/projects/[id]/tasks
 * Returns ProjectTask[] ordered by orderIndex.
 */

import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getProjectById, getProjectTasksByProjectId } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProjectById({ id });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tasks = await getProjectTasksByProjectId({ projectId: id });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("[tasks] Error:", error);
    return NextResponse.json(
      { error: "Failed to get tasks" },
      { status: 500 }
    );
  }
}
