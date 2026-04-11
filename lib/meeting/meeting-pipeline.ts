// ТЗ-MR Этап 3: Meeting processing pipeline (Deepgram + Claude + DB save + blob cleanup)
// Pattern: briefing-pipeline.ts (onProgress callback for NDJSON streaming)

import "server-only";

import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { del } from "@vercel/blob";
import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";

const MEETING_SUMMARY_TASK = "meeting:summary" as const;
import { saveMeetingRecord } from "@/lib/db/queries";
import { transcribeAudio } from "./deepgram-transcribe";
import type {
  MeetingPipelineInput,
  MeetingPipelineResult,
  MeetingProgressEvent,
  SummaryLevel,
} from "./meeting-types";

// Load prompt templates (once at module init)
const PROMPTS_DIR = path.join(process.cwd(), "lib", "prompts", "meeting");

const PROMPT_FILES: Record<SummaryLevel, string> = {
  compact: "meeting-summary-compact.md",
  standard: "meeting-summary-standard.md",
  detailed: "meeting-summary-detailed.md",
};

function loadPrompt(level: SummaryLevel): string {
  const filePath = path.join(PROMPTS_DIR, PROMPT_FILES[level]);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Parse title from Claude response.
 * Expected format: first line = title, then "---", then document body.
 */
function parseTitleAndSummary(text: string): { title: string; summary: string } {
  const lines = text.split("\n");
  let titleLine = "";
  let bodyStartIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (!titleLine) {
      // First non-empty line is the title
      titleLine = trimmed;
      continue;
    }

    if (trimmed === "---") {
      bodyStartIdx = i + 1;
      break;
    }
  }

  const title = titleLine.replace(/^#+\s*/, "").slice(0, 60);
  const summary = lines.slice(bodyStartIdx).join("\n").trim();

  return {
    title: title || "Встреча",
    summary: summary || text,
  };
}

/**
 * ТЗ-MR2: Reusable summarization function.
 * Used by both runMeetingPipeline (initial generation) and regenerate route.
 */
export async function summarizeTranscript(
  transcript: string,
  summaryLevel: SummaryLevel,
  userInstructions?: string | null,
  /** ТЗ-CACHE2: userId for usage logging */
  userId?: string,
): Promise<{ title: string; summary: string; usage: { inputTokens?: number; outputTokens?: number } }> {
  const systemPrompt = loadPrompt(summaryLevel);

  const userMessage = userInstructions
    ? `Дополнительные инструкции от участника встречи:\n${userInstructions}\n\n---\n\n${transcript}`
    : transcript;

  const { text: rawSummary, usage } = await generateText({
    model: getModel(MEETING_SUMMARY_TASK),
    system: systemPrompt,
    prompt: userMessage,
    temperature: 0.3,
    maxOutputTokens: 8192,
  });

  const { title, summary } = parseTitleAndSummary(rawSummary);

  // ТЗ-CACHE2: Usage logging
  if (userId) {
    logUsage({
      userId,
      usage,
      modelId: getModelIdForTask(MEETING_SUMMARY_TASK),
      provider: getProviderForTask(MEETING_SUMMARY_TASK),
      chatMode: "meeting:summarize",
    });
  }

  return {
    title,
    summary,
    usage: {
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
    },
  };
}

/**
 * Run the full meeting processing pipeline.
 *
 * Steps: transcribe (Deepgram) → summarize (Claude Sonnet) → save DB → delete blob
 *
 * @param input - Pipeline parameters
 * @param onProgress - Callback for NDJSON streaming events
 * @returns Pipeline result with record ID
 */
export async function runMeetingPipeline(
  input: MeetingPipelineInput,
  onProgress?: (event: MeetingProgressEvent) => void,
): Promise<MeetingPipelineResult> {
  const emit = onProgress ?? (() => {});

  try {
    // Step 1: Transcribe audio (Deepgram)
    emit({
      step: "transcribing",
      message: "Транскрибируем аудио...",
    });

    const transcription = await transcribeAudio(input.blobUrl, input.userId);

    emit({
      step: "transcribing",
      message: "Транскрибируем аудио...",
      done: true,
      detail: `${transcription.speakerCount} спикер(ов), ${Math.round(transcription.durationSeconds / 60)} мин`,
    });

    // Step 2: Summarize with Claude Sonnet (using extracted reusable function)
    emit({
      step: "summarizing",
      message: "Создаём документ...",
    });

    const { title, summary, usage } = await summarizeTranscript(
      transcription.transcript,
      input.summaryLevel,
      input.userInstructions,
      input.userId,
    );

    emit({
      step: "summarizing",
      message: "Создаём документ...",
      done: true,
      detail: title,
    });

    // Step 3: Save to DB
    emit({
      step: "saving",
      message: "Сохраняем результат...",
    });

    // Use Deepgram duration if available, fallback to client-reported duration
    const finalDuration = transcription.durationSeconds > 0
      ? transcription.durationSeconds
      : input.durationSeconds;

    const record = await saveMeetingRecord({
      userId: input.userId,
      title,
      durationSeconds: finalDuration,
      speakerCount: transcription.speakerCount,
      summaryLevel: input.summaryLevel,
      transcript: transcription.transcript,
      summary,
      userInstructions: input.userInstructions,
      metadata: {
        modelId: getModelIdForTask(MEETING_SUMMARY_TASK),
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        deepgramDurationMs: transcription.metadata.durationMs,
      },
    });

    emit({
      step: "saving",
      message: "Сохраняем результат...",
      done: true,
    });

    // Step 4: Cleanup — delete blob (fire-and-forget)
    try {
      await del(input.blobUrl);
    } catch (delErr) {
      console.warn("[meeting-pipeline] Blob cleanup failed:", delErr);
    }

    // Complete
    emit({
      step: "complete",
      message: "Готово!",
      recordId: record.id,
    });

    return {
      status: "success",
      recordId: record.id,
      title,
    };
  } catch (err) {
    console.error("[meeting-pipeline] Pipeline failed:", err);

    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    emit({
      step: "error",
      message: "Не удалось обработать запись. Попробуйте ещё раз.",
    });

    return {
      status: "failed",
      error: errorMessage,
    };
  }
}
