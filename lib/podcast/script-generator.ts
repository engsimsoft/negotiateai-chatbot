// ТЗ-Б1: Script Generator — Gemini Flash generates dialogue script from article section

import fs from "fs";
import path from "path";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
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
const MAX_SCRIPT_RETRIES = 2;

/**
 * Generate a dialogue script from a briefing section.
 * Returns the raw script text and replica count.
 * Retries automatically if Gemini produces a truncated/short script.
 */
export async function generateScript(
  section: BriefingArticleSection,
  context: ScriptContext,
): Promise<{ script: string; replicaCount: number }> {
  const userMessage = buildScriptwriterMessage(section, context);

  for (let attempt = 0; attempt <= MAX_SCRIPT_RETRIES; attempt++) {
    const { text } = await generateText({
      model: google(SCRIPT_MODEL),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      maxOutputTokens: 2048,
    });

    const script = text.trim();
    const replicaCount = countReplicas(script);
    const wordCount = script.split(/\s+/).length;

    // Validate: Gemini Flash sometimes produces truncated scripts (< 50 words)
    if (wordCount < MIN_SCRIPT_WORDS && attempt < MAX_SCRIPT_RETRIES) {
      console.warn(
        `[podcast/script] ${section.topicId}: too short (${wordCount} words, ${replicaCount} replicas), retrying (${attempt + 1}/${MAX_SCRIPT_RETRIES})`,
      );
      continue;
    }

    return { script, replicaCount };
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Script generation failed after retries");
}
