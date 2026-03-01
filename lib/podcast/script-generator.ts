// ТЗ-Б1 + ТЗ-DEV2: Script Generator — Gemini Flash generates dialogue script from article section

import fs from "fs";
import path from "path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { calculateCostRub } from "@/lib/ai/providers";
import type { PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import type { BriefingArticleSection } from "@/lib/briefing/briefing-types";
import type { ScriptContext } from "./types";

const PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "briefing",
  "briefing-scriptwriter.md",
);
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf-8");

const SCRIPT_MODEL = "gemini-2.5-flash";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/**
 * Build user message from section + context (per user template).
 */
function buildScriptwriterMessage(
  section: BriefingArticleSection,
  context: ScriptContext,
): string {
  const parts: string[] = [];

  parts.push(`Дата выпуска: ${context.briefingDate}`);
  parts.push("");

  if (context.isFirst) {
    parts.push("## Контекст выпуска");
    parts.push(
      "Это первая секция. Начни с приветствия и краткого анонса.",
    );
    parts.push(`Всего тем сегодня: ${context.sectionTitles.length}.`);
    parts.push(`Темы: ${context.sectionTitles.join(", ")}`);
    parts.push("");
  }

  if (context.isLast) {
    parts.push("## Контекст выпуска");
    parts.push(
      "Это последняя секция. После обсуждения темы — завершение и прощание.",
    );
    parts.push("");
  }

  parts.push(`## Тема: ${section.topicName}`);
  parts.push("");
  parts.push(section.content);

  return parts.join("\n");
}

/**
 * Count replicas in script (lines starting with "Host:" or "Expert:").
 */
function countReplicas(script: string): number {
  return script
    .split("\n")
    .filter((line) => /^(Host|Expert):\s/.test(line)).length;
}

const MIN_SCRIPT_WORDS = 120;
const MAX_SCRIPT_RETRIES = 4;

/**
 * Reinforcement suffix added to the prompt on retry attempts.
 * Gemini Flash sometimes produces ~40-word stubs; explicit length reminder helps.
 */
const RETRY_REINFORCEMENT =
  "\n\n---\nВАЖНО: Предыдущая попытка была слишком короткой. Сценарий ОБЯЗАН содержать 200-400 слов и 10-20 реплик. Напиши полноценный диалог по всему материалу секции.";

/**
 * Generate a dialogue script from a briefing section.
 * Returns the raw script text, replica count, and optional trace data.
 * Retries automatically if Gemini produces a truncated/short script,
 * adding a reinforcement prompt on attempts 2+.
 */
export async function generateScript(
  section: BriefingArticleSection,
  context: ScriptContext,
): Promise<{ script: string; replicaCount: number; trace?: PipelineStageTrace }> {
  const baseMessage = buildScriptwriterMessage(section, context);
  const startTime = Date.now();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let lastFinishReason = "unknown";

  for (let attempt = 0; attempt <= MAX_SCRIPT_RETRIES; attempt++) {
    // Add reinforcement on retry attempts 2+ (after 2 consecutive failures)
    const prompt =
      attempt >= 2 ? baseMessage + RETRY_REINFORCEMENT : baseMessage;

    const result = await generateText({
      model: google(SCRIPT_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 2048,
    });

    // ТЗ-DEV2: Accumulate usage across retries (AI SDK v5: inputTokens/outputTokens)
    totalPromptTokens += result.usage?.inputTokens ?? 0;
    totalCompletionTokens += result.usage?.outputTokens ?? 0;
    lastFinishReason = result.finishReason ?? "unknown";

    const script = result.text.trim();
    const replicaCount = countReplicas(script);
    const wordCount = script.split(/\s+/).length;

    // Validate: Gemini Flash sometimes produces truncated scripts (< 50 words)
    if (wordCount < MIN_SCRIPT_WORDS && attempt < MAX_SCRIPT_RETRIES) {
      console.warn(
        `[podcast/script] ${section.topicId}: too short (${wordCount} words, ${replicaCount} replicas), retrying (${attempt + 1}/${MAX_SCRIPT_RETRIES})`,
      );
      continue;
    }

    if (wordCount < MIN_SCRIPT_WORDS) {
      console.error(
        `[podcast/script] ${section.topicId}: still too short after ${MAX_SCRIPT_RETRIES} retries (${wordCount} words) — giving up`,
      );
    }

    const durationMs = Date.now() - startTime;
    const totalTokens = totalPromptTokens + totalCompletionTokens;

    const trace: PipelineStageTrace = {
      stage: "script",
      startedAt: new Date(startTime).toISOString(),
      durationMs,
      ai: {
        modelId: SCRIPT_MODEL,
        promptPreview: baseMessage.slice(0, 500),
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens,
        costRub: calculateCostRub(SCRIPT_MODEL, {
          inputTokens: totalPromptTokens,
          outputTokens: totalCompletionTokens,
        }),
        finishReason: lastFinishReason,
        retryCount: attempt,
      },
      dataFlow: {
        inputCount: 1,
        outputCount: 1,
        droppedCount: 0,
        droppedReasons: wordCount < MIN_SCRIPT_WORDS ? { too_short: 1 } : undefined,
      },
      errors: [],
      warnings: attempt > 0
        ? [`Retried ${attempt} time(s), final wordCount=${wordCount}`]
        : [],
    };

    return { script, replicaCount, trace };
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Script generation failed after retries");
}
