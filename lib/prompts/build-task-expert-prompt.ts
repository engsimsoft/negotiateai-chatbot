import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Project, ProjectTask } from "@/lib/db/schema";

/**
 * ТЗ-C1: Build system prompt for the Task Expert
 *
 * Combines the expert core prompt (task-expert.md) with
 * project context and task-specific data.
 */

// Cache the core prompt (read once at startup)
let cachedCorePrompt: string | null = null;

function getCorePrompt(): string {
  if (!cachedCorePrompt) {
    const promptPath = join(
      process.cwd(),
      "lib/prompts/experts/task-expert.md"
    );
    cachedCorePrompt = readFileSync(promptPath, "utf-8");
  }
  return cachedCorePrompt;
}

interface CompletedTaskSummary {
  orderIndex: number;
  title: string;
  outputSummary: string;
}

interface BuildTaskExpertPromptParams {
  project: Project;
  task: ProjectTask;
  completedTasks: CompletedTaskSummary[];
  manifest: Project["manifestJson"];
  /** Markdown from last snapshot — injected as <previous_context> */
  snapshotContext?: string;
}

export function buildTaskExpertPrompt({
  project,
  task,
  completedTasks,
  manifest,
  snapshotContext,
}: BuildTaskExpertPromptParams): string {
  const blocks: string[] = [];

  // 1. Core expert prompt
  blocks.push(getCorePrompt());

  // 1.5. Previous context from snapshot (if any)
  if (snapshotContext) {
    blocks.push("<previous_context>");
    blocks.push(snapshotContext);
    blocks.push("</previous_context>");
  }

  // 2. Project passport
  blocks.push("<project_passport>");
  blocks.push(`Название: ${project.name}`);
  if (project.description) {
    blocks.push(`Описание: ${project.description}`);
  }
  if (project.context) {
    blocks.push(`Контекст: ${project.context}`);
  }
  blocks.push("</project_passport>");

  // 3. Manifest (file catalog)
  if (manifest && manifest.files && manifest.files.length > 0) {
    blocks.push("<manifest>");
    for (const file of manifest.files) {
      blocks.push(
        `- ${file.name} (${file.documentType}) — ${file.description}`
      );
    }
    blocks.push("</manifest>");
  }

  // 4. Current task (highest priority context)
  blocks.push("<current_task>");
  blocks.push(`Название: ${task.title}`);
  if (task.goal) {
    blocks.push(`Цель: ${task.goal}`);
  }
  if (task.description) {
    blocks.push("");
    blocks.push("Описание (твоё задание):");
    blocks.push(task.description);
  }
  if (task.input) {
    blocks.push("");
    blocks.push(`Входные данные: ${task.input}`);
  }
  if (task.expectedOutput) {
    blocks.push("");
    blocks.push(`Ожидаемый результат: ${task.expectedOutput}`);
  }
  blocks.push("</current_task>");

  // 5. Previous task summaries
  blocks.push("<previous_summaries>");
  if (completedTasks.length === 0) {
    blocks.push("Это первая задача в проекте.");
  } else {
    for (const ct of completedTasks) {
      blocks.push(
        `Задача ${ct.orderIndex + 1}: «${ct.title}» — Завершена.`
      );
      blocks.push(`Резюме: ${ct.outputSummary}`);
      blocks.push("");
    }
  }
  blocks.push("</previous_summaries>");

  return blocks.join("\n");
}
