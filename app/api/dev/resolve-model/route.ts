/**
 * Dev-only diagnostic endpoint: resolve a taskId → { effectiveModelId, defaultModelId, overrideActive }.
 *
 * Purpose: prove at runtime whether the dev overrides reader sees a given taskId,
 * without having to trigger a full AI call. Useful for validating cleanup of
 * side-effect imports (Этап 1 ТЗ-AISDKLayerHardening) and diagnosing suspected
 * override regressions on specific taskIds.
 *
 * Gated by SIMPLY_DEV_MODE=true — returns 404 in production.
 */

import { NextResponse } from "next/server";

import {
  getModelIdForTask,
  isTaskOverridden,
} from "@/lib/ai/getModel";
import { DEFAULT_TASK_MODELS, type TaskId } from "@/lib/ai/task-assignments";
import { isSimplyDevMode } from "@/lib/constants";

export async function GET(request: Request) {
  if (!isSimplyDevMode) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json(
      { error: "taskId query param is required" },
      { status: 400 },
    );
  }

  if (!(taskId in DEFAULT_TASK_MODELS)) {
    return NextResponse.json(
      { error: `Unknown taskId "${taskId}"` },
      { status: 400 },
    );
  }

  const typedTaskId = taskId as TaskId;
  const effectiveModelId = getModelIdForTask(typedTaskId);
  const defaultModelId = DEFAULT_TASK_MODELS[typedTaskId];
  const overrideActive = isTaskOverridden(typedTaskId);

  return NextResponse.json({
    taskId,
    effectiveModelId,
    defaultModelId,
    overrideActive,
  });
}
