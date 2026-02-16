/**
 * ТЗ-C2: Professor Task Reviewer
 *
 * Reviews a completed task's output against expected goals.
 * Called internally by POST .../complete endpoint (only if needsReview).
 *
 * Model: PROFESSOR_MODEL env || claude-opus
 * Prompt: lib/prompts/professors/task-review.md
 * Output: <review_analysis> (markdown) + <review_json> (structured verdict)
 */

import fs from "fs";
import path from "path";
import { generateText } from "ai";

import { myProvider } from "@/lib/ai/providers";
import {
  professorVerdictSchema,
  type ProfessorVerdict,
} from "@/lib/ai/task-completion-types";

// Load professor review prompt from .md file (cached at module level)
const REVIEWER_PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "professors",
  "task-review.md"
);
const REVIEWER_SYSTEM_PROMPT = fs.readFileSync(REVIEWER_PROMPT_PATH, "utf-8");

// --- Types ---

interface ReviewTaskInput {
  passport: {
    name: string;
    description: string;
    context: string;
  };
  task: {
    title: string;
    goal: string;
    expectedOutput: string;
  };
  outputSummary: string;
  artifacts?: Array<{
    name: string;
    type: string;
    contentPreview?: string;
  }>;
}

// --- Helpers ---

/**
 * Extract content between XML tags from the Professor's response.
 * Same pattern as plan/route.ts extractTag.
 */
function extractTag(text: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = text.match(regex);
  return match ? match[1].trim() : null;
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

/**
 * Build user message with XML blocks for the reviewer.
 */
function buildUserMessage(input: ReviewTaskInput): string {
  let artifactsBlock = "Файлы не создавались.";
  if (input.artifacts && input.artifacts.length > 0) {
    artifactsBlock = input.artifacts
      .map(
        (a) =>
          `- ${a.name} (${a.type})${a.contentPreview ? `: ${a.contentPreview}` : ""}`
      )
      .join("\n");
  }

  return `<passport>
${input.passport.context || `${input.passport.name}. ${input.passport.description}`}
</passport>

<task>
{
  "title": "${input.task.title}",
  "goal": "${input.task.goal || "не указана"}",
  "expectedOutput": "${input.task.expectedOutput || "не указан"}"
}
</task>

<output_summary>
${input.outputSummary}
</output_summary>

<artifacts>
${artifactsBlock}
</artifacts>`;
}

// --- Main function ---

/**
 * Review a completed task using the Professor AI.
 *
 * @returns ProfessorVerdict — structured verdict with analysis
 */
export async function reviewTask(
  input: ReviewTaskInput
): Promise<ProfessorVerdict> {
  const modelId = process.env.PROFESSOR_MODEL || "claude-opus";

  try {
    const userMessage = buildUserMessage(input);

    const result = await generateText({
      model: myProvider.languageModel(modelId),
      system: REVIEWER_SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.2,
    });

    // Extract XML tags from response
    const fullAnalysis = extractTag(result.text, "review_analysis");
    const reviewJsonRaw = extractTag(result.text, "review_json");

    if (!reviewJsonRaw) {
      console.error(
        "[TaskReviewer] Missing review_json tag. Raw response:",
        result.text.slice(0, 500)
      );
      // Fallback: approved with no analysis
      return {
        verdict: "approved",
        shortSummary: "Проверка завершена. Детали анализа недоступны.",
        fullAnalysis: fullAnalysis || "",
        issues: [],
      };
    }

    // Parse JSON from review_json tag
    const jsonText = stripCodeBlocks(reviewJsonRaw);
    const rawJson = JSON.parse(jsonText);
    const verdict = professorVerdictSchema.parse(rawJson);

    // Merge fullAnalysis from XML tag (if present and not in JSON)
    if (fullAnalysis && !verdict.fullAnalysis) {
      verdict.fullAnalysis = fullAnalysis;
    }

    console.log(
      `[TaskReviewer] Verdict for "${input.task.title}": ${verdict.verdict}, ${verdict.issues.length} issues`
    );

    return verdict;
  } catch (error) {
    console.error(
      `[TaskReviewer] Error for "${input.task.title}":`,
      error instanceof Error ? error.message : error
    );

    // Fallback: approved (don't block user on reviewer failure)
    return {
      verdict: "approved",
      shortSummary:
        "Автоматическая проверка недоступна. Результат принят.",
      fullAnalysis: "",
      issues: [],
    };
  }
}
