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

/**
 * Generate a dialogue script from a briefing section.
 * Returns the raw script text and replica count.
 */
export async function generateScript(
  section: BriefingArticleSection,
  context: ScriptContext,
): Promise<{ script: string; replicaCount: number }> {
  const userMessage = buildScriptwriterMessage(section, context);

  const { text } = await generateText({
    model: google(SCRIPT_MODEL),
    system: SYSTEM_PROMPT,
    prompt: userMessage,
    maxOutputTokens: 2048,
  });

  const script = text.trim();
  const replicaCount = countReplicas(script);

  return { script, replicaCount };
}
