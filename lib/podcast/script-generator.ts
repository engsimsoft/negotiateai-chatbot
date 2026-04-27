// Script Generator — generates dialogue script from article section.
// Default model — Kimi K2.6 (Instant mode) через taskId `briefing:podcast-script`.

import fs from "fs";
import path from "path";
import { generateText, type LanguageModelUsage } from "ai";
import {
  getDefaultParamsForTask,
  getMaxOutputTokensForTask,
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { calcStepCostRub } from "@/lib/ai/tokenlens-catalog";
import { extractUsageForPricing } from "@/lib/ai/providers";

const PODCAST_SCRIPT_TASK = "briefing:podcast-script" as const;
import type { ModelCatalog } from "tokenlens/core";
import { waitUntil } from "@vercel/functions";
import { logUsage } from "@/lib/ai/usage-utils";
import type { PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import type { BriefingArticleSection } from "@/lib/briefing/briefing-types";
import type { ScriptContext, ScriptLine } from "./types";

const PROMPT_PATH = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "briefing",
  "briefing-scriptwriter.md",
);
const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf-8");

// ТЗ-1 CoreRegistry: model resolved via getModel(taskId), constant kept for module-scope reference
const SCRIPT_MODEL = getModelIdForTask(PODCAST_SCRIPT_TASK);

// JSON instruction for M2.7 (204K context, up to 16K output — no truncation issues)
const JSON_INSTRUCTION = `

## ФОРМАТ ОТВЕТА

Ответь ТОЛЬКО валидным JSON. Никакого текста до или после JSON. Никакой markdown-обёртки.

{"lines":[{"s":"h","t":"реплика ведущей"},{"s":"e","t":"реплика эксперта"}]}

s = "h" (host) или "e" (expert). t = текст реплики. Минимум 10 реплик.`;

/**
 * Build user message from section + context.
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

const MIN_SCRIPT_LINES = 6;
const MAX_SCRIPT_RETRIES = 4;

const RETRY_REINFORCEMENT =
  "\n\n---\nВАЖНО: Предыдущая попытка была слишком короткой. Сценарий ОБЯЗАН содержать 10-20 реплик и 200-400 слов. Напиши полноценный диалог по всему материалу секции. Ответь ТОЛЬКО JSON.";

/**
 * Generate a dialogue script from a briefing section.
 * Returns parsed script lines, replica count, and optional trace data.
 */
export async function generateScript(
  section: BriefingArticleSection,
  context: ScriptContext,
  userId?: string,
  catalog?: ModelCatalog,
): Promise<{ script: string; lines: ScriptLine[]; replicaCount: number; trace?: PipelineStageTrace }> {
  const baseMessage = buildScriptwriterMessage(section, context);
  const startTime = Date.now();
  // ТЗ-CachePipelineMetrics: disjoint accumulator — отслеживаем все 5 полей
  // из inputTokenDetails/outputTokenDetails вместо gross inputTokens/outputTokens.
  // Даёт реальные cacheReadTokens/cacheWriteTokens в ai_usage_log и DevPanel
  // вместо хардкода 0.
  const totalUsage = {
    noCacheInputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
  };
  let lastFinishReason = "unknown";

  for (let attempt = 0; attempt <= MAX_SCRIPT_RETRIES; attempt++) {
    // Delay between retries to avoid provider API throttling
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
    const prompt =
      attempt >= 2 ? baseMessage + RETRY_REINFORCEMENT : baseMessage;

    const result = await generateText({
      model: getModel(PODCAST_SCRIPT_TASK),
      // Moonshot имеет автоматический prompt cache на стороне провайдера
      // (cached input $0.16 vs $0.95 — без явных breakpoints). cacheReadTokens
      // приходят через AI SDK generic `inputTokenDetails.cacheReadTokens`.
      messages: [
        { role: "system", content: SYSTEM_PROMPT + JSON_INSTRUCTION },
        { role: "user", content: prompt },
      ],
      maxOutputTokens: getMaxOutputTokensForTask(PODCAST_SCRIPT_TASK),
      ...getDefaultParamsForTask(PODCAST_SCRIPT_TASK),
      maxRetries: 0,
    });

    const stepFields = extractUsageForPricing(result.usage);
    totalUsage.noCacheInputTokens += stepFields.noCacheInputTokens;
    totalUsage.cacheReadTokens    += stepFields.cacheReadTokens;
    totalUsage.cacheWriteTokens   += stepFields.cacheWriteTokens;
    totalUsage.outputTokens       += stepFields.outputTokens;
    totalUsage.reasoningTokens    += stepFields.reasoningTokens ?? 0;
    lastFinishReason = result.finishReason ?? "unknown";

    const rawText = result.text.trim();

    // Parse plain text "Host: text" / "Expert: text" format
    const lines = parsePlainText(rawText);

    if (lines.length < MIN_SCRIPT_LINES && attempt < MAX_SCRIPT_RETRIES) {
      console.warn(
        `[podcast/script] ${section.topicId}: too few lines (${lines.length}), retrying (${attempt + 1}/${MAX_SCRIPT_RETRIES})`,
      );
      console.warn(
        `[podcast/script] raw output preview: ${rawText.slice(0, 300)}`,
      );
      continue;
    }

    if (lines.length === 0) {
      if (attempt < MAX_SCRIPT_RETRIES) continue;
      console.error(
        `[podcast/script] ${section.topicId}: parse failed. Raw output: ${rawText.slice(0, 500)}`,
      );
      throw new Error(`Script parse failed after ${MAX_SCRIPT_RETRIES} retries`);
    }

    // Validate minimum lines
    if (lines.length < MIN_SCRIPT_LINES && attempt < MAX_SCRIPT_RETRIES) {
      console.warn(
        `[podcast/script] ${section.topicId}: too few lines (${lines.length}), retrying (${attempt + 1}/${MAX_SCRIPT_RETRIES})`,
      );
      continue;
    }

    // Reconstruct plain text script for logging/debugging
    const script = lines.map((l) => `${l.speaker === "host" ? "Host" : "Expert"}: ${l.text}`).join("\n");
    const replicaCount = lines.length;
    const wordCount = lines.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0);

    if (lines.length < MIN_SCRIPT_LINES) {
      console.error(
        `[podcast/script] ${section.topicId}: still too few lines after ${MAX_SCRIPT_RETRIES} retries (${lines.length}) — giving up`,
      );
    }

    const durationMs = Date.now() - startTime;
    // Gross input = noCache + cacheRead + cacheWrite (Anthropic Console formula)
    const grossInputTokens =
      totalUsage.noCacheInputTokens +
      totalUsage.cacheReadTokens +
      totalUsage.cacheWriteTokens;
    const totalTokens =
      grossInputTokens + totalUsage.outputTokens + totalUsage.reasoningTokens;

    if (userId) {
      const usageForLog: LanguageModelUsage = {
        inputTokens: grossInputTokens,
        outputTokens: totalUsage.outputTokens,
        totalTokens,
        inputTokenDetails: {
          noCacheTokens: totalUsage.noCacheInputTokens,
          cacheReadTokens: totalUsage.cacheReadTokens,
          cacheWriteTokens: totalUsage.cacheWriteTokens,
        },
        outputTokenDetails: {
          textTokens: totalUsage.outputTokens,
          reasoningTokens: totalUsage.reasoningTokens,
        },
      };
      waitUntil(logUsage({
        userId,
        usage: usageForLog,
        modelId: SCRIPT_MODEL,
        provider: getProviderForTask(PODCAST_SCRIPT_TASK),
        chatMode: "podcast:script",
        durationMs,
      }));
    }

    const trace: PipelineStageTrace = {
      stage: "script",
      startedAt: new Date(startTime).toISOString(),
      durationMs,
      ai: {
        modelId: SCRIPT_MODEL,
        promptPreview: baseMessage.slice(0, 500),
        noCacheInputTokens: totalUsage.noCacheInputTokens,
        cacheReadTokens: totalUsage.cacheReadTokens,
        cacheWriteTokens: totalUsage.cacheWriteTokens,
        outputTokens: totalUsage.outputTokens,
        reasoningTokens: totalUsage.reasoningTokens,
        totalTokens,
        costRub: calcStepCostRub(SCRIPT_MODEL, {
          noCacheInputTokens: totalUsage.noCacheInputTokens,
          cacheReadTokens: totalUsage.cacheReadTokens,
          cacheWriteTokens: totalUsage.cacheWriteTokens,
          outputTokens: totalUsage.outputTokens,
          reasoningTokens: totalUsage.reasoningTokens,
        }, catalog),
        finishReason: lastFinishReason,
        retryCount: attempt,
      },
      dataFlow: {
        inputCount: 1,
        outputCount: 1,
        droppedCount: 0,
        droppedReasons: lines.length < MIN_SCRIPT_LINES ? { too_short: 1 } : undefined,
      },
      errors: [],
      warnings: attempt > 0
        ? [`Retried ${attempt} time(s), final lineCount=${lines.length}, wordCount=${wordCount}`]
        : [],
    };

    return { script, lines, replicaCount, trace };
  }

  throw new Error("Script generation failed after retries");
}

/**
 * Universal parser: handles any format M2-Her may return.
 * Strategy: try JSON first, then plain text (multiline and inline).
 */
function parsePlainText(rawText: string): ScriptLine[] {
  // Strategy 1: Try JSON parse (M2-Her sometimes returns JSON despite plain text instruction)
  const jsonLines = tryParseJson(rawText);
  if (jsonLines.length >= 4) return jsonLines;

  // Strategy 2: Split by speaker labels (handles both multiline and inline)
  // Regex splits on "Host:" or "Expert:" (with optional markdown bold ** and variations)
  const speakerPattern = /(?:^|\n)\s*(?:\*\*)?(?:Host|Expert|Ведущая|Ведущий|Эксперт)(?:\*\*)?:\s*/gi;

  // First, try to split inline text where multiple "Host: ... Expert: ..." are on one line
  // by inserting newlines before each speaker label
  const normalized = rawText.replace(
    /(?<!\n)\s*(?:\*\*)?(?:Host|Expert|Ведущая|Ведущий|Эксперт)(?:\*\*)?:\s*/gi,
    (match, offset) => (offset === 0 ? match : "\n" + match.trim()),
  );

  const lines: ScriptLine[] = [];
  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const hostMatch = trimmed.match(
      /^(?:\*\*)?(?:Host|host|Ведущая|Ведущий)(?:\*\*)?:\s*(.+)/i
    );
    const expertMatch = trimmed.match(
      /^(?:\*\*)?(?:Expert|expert|Эксперт)(?:\*\*)?:\s*(.+)/i
    );

    if (hostMatch) {
      const cleaned = cleanReplicaText(hostMatch[1]);
      if (cleaned) lines.push({ speaker: "host", text: cleaned });
    } else if (expertMatch) {
      const cleaned = cleanReplicaText(expertMatch[1]);
      if (cleaned) lines.push({ speaker: "expert", text: cleaned });
    }
  }
  return lines;
}

/** Try parsing raw text as JSON (handles markdown wrappers and various JSON shapes) */
function tryParseJson(rawText: string): ScriptLine[] {
  try {
    const cleaned = rawText.replace(/```json\s*|```\s*/g, "").trim();
    const obj = JSON.parse(cleaned);

    // Shape: { "lines": [...] } or { "script": [...] } or just [...]
    const arr = Array.isArray(obj) ? obj : (obj.lines ?? obj.script ?? []);
    if (!Array.isArray(arr)) return [];

    const lines: ScriptLine[] = [];
    for (const item of arr) {
      // Compact format: { s: "h"|"e", t: "text" }
      if (item?.s && item?.t) {
        const speaker = item.s === "h" ? "host" : item.s === "e" ? "expert" : null;
        if (speaker) {
          const cl = cleanReplicaText(String(item.t));
          if (cl) lines.push({ speaker, text: cl });
        }
        continue;
      }
      // Full format: { speaker: "host"|"expert", text: "..." }
      if (item?.speaker && item?.text) {
        const speaker = String(item.speaker).toLowerCase();
        if (speaker === "host" || speaker === "expert") {
          const cl = cleanReplicaText(String(item.text));
          if (cl) lines.push({ speaker, text: cl });
        }
      }
    }
    return lines;
  } catch {
    return [];
  }
}

/** Remove unwanted artifacts from replica text (markdown bold, asterisk actions) */
function cleanReplicaText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")  // **bold** → bold (keep content)
    .replace(/\*[^*]+\*/g, "")           // Remove *actions* like *кивает*
    .replace(/\([^)]*хлопает[^)]*\)/gi, "")  // Remove (хлопает в ладоши) etc
    .replace(/\s{2,}/g, " ")             // Collapse multiple spaces
    .trim();
}
