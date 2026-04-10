/**
 * ТЗ-C2: Clerk Task Summarizer
 *
 * Summarizes a completed task's chat into structured output.
 * Called internally by POST .../complete endpoint.
 *
 * ТЗ-1 CoreRegistry: model resolved via getModel('clerk:task-summary')
 * Prompt: lib/prompts/clerks/task-summarizer.md
 */

import fs from "fs";
import path from "path";
import { generateText } from "ai";

import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import {
  taskSummarySchema,
  createFallbackSummary,
  type TaskSummary,
} from "@/lib/ai/task-completion-types";
import type { DBMessage } from "@/lib/db/schema";
import { logUsage } from "@/lib/ai/usage-utils";

// Load clerk prompt from .md file (cached at module level)
const SUMMARIZER_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "clerks",
  "task-summarizer.md"
);
const SUMMARIZER_SYSTEM_PROMPT = fs.readFileSync(
  SUMMARIZER_PROMPT_PATH,
  "utf-8"
);

// --- Constants ---
const MAX_CHAT_MESSAGES = 40;

// --- Types ---

interface SummarizeTaskInput {
  taskTitle: string;
  taskGoal: string;
  chatMessages: DBMessage[];
  artifacts?: Array<{
    name: string;
    type: string;
    contentPreview?: string;
  }>;
  /** ТЗ-CACHE2: userId for usage logging */
  userId?: string;
}

// --- Helpers ---

/**
 * Extract text content from message parts (DBMessage.parts is JSON).
 */
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

/**
 * Prepare chat messages for the summarizer:
 * - Filter user/assistant only
 * - Take last N messages
 * - Extract text content
 */
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

/**
 * Build user message with XML blocks for the summarizer.
 */
function buildUserMessage(input: SummarizeTaskInput): string {
  const chatHistory = prepareChatHistory(input.chatMessages);

  let artifactsBlock = "Файлы не создавались.";
  if (input.artifacts && input.artifacts.length > 0) {
    artifactsBlock = input.artifacts
      .map(
        (a) =>
          `- ${a.name} (${a.type})${a.contentPreview ? `: ${a.contentPreview}` : ""}`
      )
      .join("\n");
  }

  return `<task>
  Название: "${input.taskTitle}"
  Цель: "${input.taskGoal || "не указана"}"
</task>

<chat_history>
${chatHistory}
</chat_history>

<artifacts>
${artifactsBlock}
</artifacts>`;
}

/**
 * Strip markdown code blocks from JSON response.
 */
function stripCodeBlocks(text: string): string {
  let result = text.trim();
  if (result.startsWith("```")) {
    result = result.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return result;
}

// --- Main function ---

/**
 * Summarize a completed task using the Clerk AI.
 *
 * @returns TaskSummary — structured summary or fallback
 */
export async function summarizeTask(
  input: SummarizeTaskInput
): Promise<TaskSummary> {
  // ТЗ-1 CoreRegistry: model resolved via task-assignments
  const resolvedModelId = getModelIdForTask("clerk:task-summary");

  try {
    const userMessage = buildUserMessage(input);

    const result = await generateText({
      model: getModel("clerk:task-summary"),
      system: SUMMARIZER_SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.1,
    });

    // ТЗ-CACHE2: Usage logging
    if (input.userId) {
      logUsage({
        userId: input.userId,
        usage: result.usage,
        modelId: resolvedModelId,
        provider: getProviderForTask("clerk:task-summary"),
        chatMode: "clerk:summarizer",
      });
    }

    // Parse JSON response
    const jsonText = stripCodeBlocks(result.text);
    const rawJson = JSON.parse(jsonText);
    const summary = taskSummarySchema.parse(rawJson);

    console.log(
      `[TaskSummarizer] Success for "${input.taskTitle}": ${summary.keyDecisions.length} decisions, ${summary.createdArtifacts.length} artifacts`
    );

    return summary;
  } catch (error) {
    console.error(
      `[TaskSummarizer] Error for "${input.taskTitle}":`,
      error instanceof Error ? error.message : error
    );

    // Fallback summary
    return createFallbackSummary(input.taskTitle, input.taskGoal);
  }
}
