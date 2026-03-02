/**
 * ТЗ-C2: Complete a task
 *
 * POST /api/projects/[id]/tasks/[taskId]/complete
 * Runs summarizer, optionally reviewer, saves results, unlocks dependents
 */

import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getProjectTaskById,
  getMessagesByChatId,
  completeTask,
} from "@/lib/db/queries";
import { summarizeTask } from "@/lib/ai/clerks/task-summarizer";
import { reviewTask } from "@/lib/ai/professors/task-reviewer";

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

    if (task.status !== "in_progress") {
      return NextResponse.json(
        { error: "Task is not in progress" },
        { status: 400 }
      );
    }

    if (!task.chatId) {
      return NextResponse.json(
        { error: "Task has no chat" },
        { status: 400 }
      );
    }

    // 1. Load chat messages
    const chatMessages = await getMessagesByChatId({ id: task.chatId });

    // 2. Run summarizer
    const taskSummary = await summarizeTask({
      taskTitle: task.title,
      taskGoal: task.goal || "",
      chatMessages,
      userId: session.user.id,
    });

    // 3. Optionally run reviewer (if task needs review)
    let professorVerdict = undefined;
    if (task.needsReview) {
      professorVerdict = await reviewTask({
        passport: {
          name: projectData.name,
          description: projectData.description || "",
          context: projectData.context || "",
        },
        task: {
          title: task.title,
          goal: task.goal || "",
          expectedOutput: task.expectedOutput || "",
        },
        outputSummary: JSON.stringify(taskSummary),
        userId: session.user.id,
      });
    }

    // 4. Save to DB + unlock dependents + check completion
    const result = await completeTask({
      taskId,
      projectId: id,
      outputSummary: JSON.stringify(taskSummary),
      professorVerdict,
    });

    return NextResponse.json({
      status: result.status,
      outputSummary: taskSummary,
      professorVerdict: professorVerdict || null,
      unlockedTasks: result.unlockedTasks,
      projectCompleted: result.projectCompleted,
    });
  } catch (error) {
    console.error("[complete-task] Error:", error);
    return NextResponse.json(
      { error: "Failed to complete task" },
      { status: 500 }
    );
  }
}
