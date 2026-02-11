/**
 * ТЗ-C1.5: Clerk Snapshot Creator (Fallback)
 *
 * Creates a snapshot when the model ignores the system signal
 * after FALLBACK_MESSAGE_PAIRS exchanges.
 *
 * Model: SNAPSHOT_CLERK_MODEL env || gemini-2.5-flash
 * Prompt: lib/prompts/clerks/snapshot-creator.md
 */

import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { z } from "zod";

import { myProvider } from "@/lib/ai/providers";
import type { DBMessage } from "@/lib/db/schema";

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
  taskTitle: string,
  taskGoal: string,
  chatMessages: DBMessage[]
): string {
  const chatHistory = prepareChatHistory(chatMessages);

  return `<task>
  Название: "${taskTitle}"
  Цель: "${taskGoal || "не указана"}"
</task>

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
  taskTitle: string;
  taskGoal: string;
  chatMessages: DBMessage[];
}

/**
 * Create a snapshot using the clerk AI (fallback).
 *
 * @returns SnapshotOutput with fullMarkdown, or null on failure
 */
export async function createFallbackSnapshot(
  input: CreateFallbackSnapshotInput
): Promise<(SnapshotOutput & { fullMarkdown: string }) | null> {
  const modelId = process.env.SNAPSHOT_CLERK_MODEL || "gemini-2.5-flash";

  try {
    const userMessage = buildUserMessage(
      input.taskTitle,
      input.taskGoal,
      input.chatMessages
    );

    const result = await generateText({
      model: myProvider.languageModel(modelId),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.1,
    });

    const jsonText = stripCodeBlocks(result.text);
    const rawJson = JSON.parse(jsonText);
    const snapshot = snapshotOutputSchema.parse(rawJson);
    const fullMarkdown = buildFullMarkdown(snapshot);

    console.log(
      `[SnapshotCreator] Fallback snapshot for "${input.taskTitle}": ${snapshot.decisions.length} decisions, ${snapshot.nextSteps.length} next steps`
    );

    return { ...snapshot, fullMarkdown };
  } catch (error) {
    console.error(
      `[SnapshotCreator] Error for "${input.taskTitle}":`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
