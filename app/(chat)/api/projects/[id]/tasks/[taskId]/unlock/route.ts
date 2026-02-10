/**
 * ТЗ-C1: Unlock a locked task
 *
 * POST /api/projects/[id]/tasks/[taskId]/unlock
 * Changes task status from locked → pending
 */

import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getProjectTaskById,
  unlockTask,
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
    const project = await getProjectById({ id });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const task = await getProjectTaskById({ taskId, projectId: id });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.status !== "locked") {
      return NextResponse.json(
        { error: "Task is not locked" },
        { status: 400 }
      );
    }

    await unlockTask({ taskId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[unlock-task] Error:", error);
    return NextResponse.json(
      { error: "Failed to unlock task" },
      { status: 500 }
    );
  }
}
