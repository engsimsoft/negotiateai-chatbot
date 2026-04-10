import { generateText } from "ai";

import { auth } from "@/app/(auth)/auth";
import {
  getProjectById,
  getChatsByProjectId,
  updateProjectSummary,
} from "@/lib/db/queries";
import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";
import { ChatSDKError } from "@/lib/errors";

/**
 * ТЗ-07C2: POST /api/projects/[id]/generate-summary
 * Generate project summary from task summaries using AI
 */
export async function POST(
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

    // Get all tasks (chats) for this project
    const tasks = await getChatsByProjectId({ projectId: id });

    // If no tasks, return empty summary
    if (tasks.length === 0) {
      return Response.json({
        summary: null,
        summaryUpdatedAt: null,
      });
    }

    // Format tasks for the prompt
    const taskStatusLabels: Record<string, string> = {
      not_started: "не начата",
      in_progress: "в работе",
      done: "готово",
    };

    const taskList = tasks
      .map((task, index) => {
        const status = taskStatusLabels[task.taskStatus || "not_started"];
        const summary = task.summary || "нет описания";
        return `${index + 1}. ${task.title}: ${summary} — [${status}]`;
      })
      .join("\n");

    // ТЗ-1 CoreRegistry: model resolved via task-assignments
    const resolvedModelId = getModelIdForTask("util:project-summary");

    const { text, usage } = await generateText({
      model: getModel("util:project-summary"),
      prompt: `Ты — менеджер проекта. На основе итогов задач напиши краткий статус проекта.

Проект: ${project.name}
${project.description ? `Описание: ${project.description}` : ""}

Задачи:
${taskList}

Напиши 2-4 предложения:
- Что уже сделано
- Что сейчас в работе
- Что дальше (если понятно из контекста)

Пиши кратко, по делу, на русском. Не используй маркированные списки, только связный текст.`,
    });

    // ТЗ-CACHE2: Usage logging
    logUsage({
      userId: session.user.id!,
      usage,
      modelId: resolvedModelId,
      provider: getProviderForTask("util:project-summary"),
      chatMode: "clerk:project-summary",
    });

    // Save the summary
    const updated = await updateProjectSummary({
      id,
      summary: text.trim(),
    });

    return Response.json({
      summary: updated.summary,
      summaryUpdatedAt: updated.summaryUpdatedAt,
    });
  } catch (error) {
    console.error("[generate-summary] Error:", error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to generate project summary"
    ).toResponse();
  }
}
