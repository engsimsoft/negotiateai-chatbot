/**
 * ТЗ-C1.5: Clerk Snapshot Creator (Fallback)
 *
 * Creates a snapshot when the model ignores the system signal
 * after FALLBACK_MESSAGE_PAIRS exchanges.
 *
 * ТЗ-1 CoreRegistry: model resolved via getModel('clerk:snapshot')
 * Prompt: lib/prompts/clerks/snapshot-creator.md
 */

import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { z } from "zod";

import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import type { DBMessage } from "@/lib/db/schema";
import { logUsage } from "@/lib/ai/usage-utils";

// Load clerk prompt from .md file (cached at module level)
const PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "clerks",
  "snapshot-creator.md"
);
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf-8");

const MAX_CHAT_MESSAGES = 30;

// --- Schema ---

const snapshotOutputSchema = z.object({
  shortSummary: z.string(),
  decisions: z.array(z.string()),
  currentState: z.string(),
  artifacts: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()),
});

export type SnapshotOutput = z.infer<typeof snapshotOutputSchema>;

// --- Helpers ---

function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";

  return parts
    .filter(
      (p: any) =>
        p.type === "text" && typeof p.text === "string"
    )
    .map((p: any) => p.text)
    .join("\n");
}

function prepareChatHistory(messages: DBMessage[]): string {
  const filtered = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_CHAT_MESSAGES);

  if (filtered.length === 0) return "Чат пустой.";

  return filtered
    .map((m) => {
      const text = extractTextFromParts(m.parts);
      return `[${m.role}]: ${text}`;
    })
    .join("\n\n");
}

function buildUserMessage(
  chatMessages: DBMessage[],
  options?: { taskTitle?: string; taskGoal?: string; chatTitle?: string }
): string {
  const chatHistory = prepareChatHistory(chatMessages);

  // Task context (project expert chat) vs general chat context
  const contextBlock = options?.taskTitle
    ? `<task>
  Название: "${options.taskTitle}"
  Цель: "${options.taskGoal || "не указана"}"
</task>`
    : `<context>
  Чат: "${options?.chatTitle || "Диалог"}"
</context>`;

  return `${contextBlock}

<chat_history>
${chatHistory}
</chat_history>`;
}

function stripCodeBlocks(text: string): string {
  let result = text.trim();
  if (result.startsWith("```")) {
    result = result.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return result;
}

/**
 * Build fullMarkdown from structured snapshot output.
 */
function buildFullMarkdown(params: SnapshotOutput): string {
  const sections: string[] = [];

  sections.push(`## Итог\n${params.shortSummary}`);

  if (params.decisions.length > 0) {
    sections.push(
      `## Ключевые решения\n${params.decisions.map((d) => `- ${d}`).join("\n")}`
    );
  }

  sections.push(`## Текущее состояние\n${params.currentState}`);

  if (params.artifacts.length > 0) {
    sections.push(
      `## Созданные артефакты\n${params.artifacts.map((a) => `- ${a}`).join("\n")}`
    );
  }

  if (params.openQuestions.length > 0) {
    sections.push(
      `## Открытые вопросы\n${params.openQuestions.map((q) => `- ${q}`).join("\n")}`
    );
  }

  if (params.nextSteps.length > 0) {
    sections.push(
      `## Следующие шаги\n${params.nextSteps.map((s) => `- ${s}`).join("\n")}`
    );
  }

  return sections.join("\n\n");
}

// --- Main function ---

interface CreateFallbackSnapshotInput {
  /** Task title (project context). Optional for regular chat. */
  taskTitle?: string;
  /** Task goal (project context). Optional for regular chat. */
  taskGoal?: string;
  /** Chat title (regular chat context). Used when no task context. */
  chatTitle?: string;
  chatMessages: DBMessage[];
  /** ТЗ-CACHE2: userId for usage logging */
  userId?: string;
}

/**
 * Create a snapshot using the clerk AI (fallback).
 *
 * @returns SnapshotOutput with fullMarkdown, or null on failure
 */
export async function createFallbackSnapshot(
  input: CreateFallbackSnapshotInput
): Promise<(SnapshotOutput & { fullMarkdown: string }) | null> {
  // ТЗ-1 CoreRegistry: model resolved via task-assignments
  const resolvedModelId = getModelIdForTask("clerk:snapshot");

  try {
    const userMessage = buildUserMessage(input.chatMessages, {
      taskTitle: input.taskTitle,
      taskGoal: input.taskGoal,
      chatTitle: input.chatTitle,
    });

    const result = await generateText({
      model: getModel("clerk:snapshot"),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.1,
    });

    // ТЗ-CACHE2: Usage logging
    if (input.userId) {
      logUsage({
        userId: input.userId,
        usage: result.usage,
        modelId: resolvedModelId,
        provider: getProviderForTask("clerk:snapshot"),
        chatMode: "clerk:snapshot",
      });
    }

    const jsonText = stripCodeBlocks(result.text);
    const rawJson = JSON.parse(jsonText);
    const snapshot = snapshotOutputSchema.parse(rawJson);
    const fullMarkdown = buildFullMarkdown(snapshot);

    const label = input.taskTitle || input.chatTitle || "chat";
    console.log(
      `[SnapshotCreator] Fallback snapshot for "${label}": ${snapshot.decisions.length} decisions, ${snapshot.nextSteps.length} next steps`
    );

    return { ...snapshot, fullMarkdown };
  } catch (error) {
    console.error(
      `[SnapshotCreator] Error for "${input.taskTitle || input.chatTitle || "chat"}":`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
