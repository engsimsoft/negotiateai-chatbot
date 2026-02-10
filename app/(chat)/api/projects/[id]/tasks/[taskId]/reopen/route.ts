/**
 * ТЗ-C2: Reopen a task with issues
 *
 * POST /api/projects/[id]/tasks/[taskId]/reopen
 * Changes task status from issues → in_progress
 */

import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getProjectTaskById,
  reopenTask,
} from "@/lib/db/queries";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, taskId } = await params;
    const projectData = await getProjectById({ id });

    if (!projectData) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (projectData.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await getProjectTaskById({ taskId, projectId: id });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.status !== "issues") {
      return NextResponse.json(
        { error: "Task does not have issues status" },
        { status: 400 }
      );
    }

    const updated = await reopenTask({ taskId });

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to reopen task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[reopen-task] Error:", error);
    return NextResponse.json(
      { error: "Failed to reopen task" },
      { status: 500 }
    );
  }
}
