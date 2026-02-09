/**
 * ТЗ-B2: Approve Plan Endpoint
 *
 * POST /api/projects/[id]/approve-plan
 * Creates ProjectTask[] from planJson, transitions phase to 'approved'.
 */

import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getProjectTasksByProjectId,
  createProjectTasks,
  updateProjectPhase,
} from "@/lib/db/queries";
import {
  type ProfessorPlanJson,
  isPlanWithTasks,
} from "@/lib/ai/professor-types";

export async function POST(
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

    // Validate planJson exists and has tasks
    const planJson = project.planJson as ProfessorPlanJson | null;
    if (!planJson || !isPlanWithTasks(planJson)) {
      return NextResponse.json(
        { error: "No plan with tasks to approve" },
        { status: 400 }
      );
    }

    // Guard: prevent double approval
    const existingTasks = await getProjectTasksByProjectId({ projectId: id });
    if (existingTasks.length > 0) {
      return NextResponse.json(
        { error: "Plan already approved", tasks: existingTasks },
        { status: 409 }
      );
    }

    // Map planJson.tasks → ProjectTask rows
    const taskRows = planJson.tasks.map((task) => {
      const hasDependencies =
        task.dependencies && task.dependencies.length > 0;

      return {
        orderIndex: task.order,
        title: task.title,
        description: task.description || null,
        goal: task.goal || null,
        input: task.input || null,
        expectedOutput: task.expectedOutput || null,
        status: hasDependencies ? ("locked" as const) : ("pending" as const),
        dependsOn: task.dependencies?.length ? task.dependencies : null,
        tools: task.tools?.length ? task.tools : null,
        needsReview: task.needsReview ?? false,
      };
    });

    // Create tasks in DB
    const createdTasks = await createProjectTasks({
      projectId: id,
      tasks: taskRows,
    });

    // Transition phase → approved
    await updateProjectPhase({ id, phase: "approved" });

    return NextResponse.json({
      success: true,
      tasks: createdTasks,
      count: createdTasks.length,
    });
  } catch (error) {
    console.error("[approve-plan] Error:", error);
    return NextResponse.json(
      { error: "Failed to approve plan" },
      { status: 500 }
    );
  }
}
