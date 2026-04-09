// ТЗ-Briefing-2: Podcast Engine — public API
// M2.7 script (better quality) → Gemini TTS (cheaper, acceptable quality) → PCM → MP3

import type { PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import type { BriefingArticleSection } from "@/lib/briefing/briefing-types";
import type { ModelCatalog } from "tokenlens/core";
import { generateScript } from "./script-generator";
import { generateSpeechWithRetry, DEFAULT_VOICES } from "./tts-gemini";
import { pcmToMp3, calculateDuration } from "./audio-converter";
import type { ScriptContext, ScriptLine, PodcastSegment } from "./types";

/** Per-topic trace data from script + TTS stages */
export interface SegmentTrace {
  scriptTrace?: PipelineStageTrace;
  ttsTrace?: PipelineStageTrace;
}

/**
 * Generate a podcast segment from a briefing section.
 * Full pipeline: text → script (M2.7, JSON/plain text) → TTS (Gemini, multi-speaker) → PCM → MP3
 */
export async function generatePodcastSegment(
  section: BriefingArticleSection,
  context: ScriptContext,
  userId?: string,
  catalog?: ModelCatalog,
): Promise<PodcastSegment & { segmentTrace?: SegmentTrace }> {
  // Step 1: Generate dialogue script
  const { script, lines, replicaCount, trace: scriptTrace } = await generateScript(section, context, userId, catalog);

  const wordCount = lines.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0);
  console.log(
    `[podcast] ${section.topicId}: script ${wordCount} words, ${replicaCount} replicas`,
  );

  // Step 2: Convert lines to plain text for Gemini TTS (multi-speaker format)
  const ttsScript = lines
    .map((l) => `${l.speaker === "host" ? "Host" : "Expert"}: ${l.text}`)
    .join("\n");

  // Step 3: Generate speech (PCM) via Gemini TTS with retry
  const { buffer: pcmBuffer, trace: ttsTrace } = await generateSpeechWithRetry(ttsScript, DEFAULT_VOICES, userId);

  // Step 4: Convert PCM → MP3
  const mp3Buffer = pcmToMp3(pcmBuffer);
  const durationSeconds = calculateDuration(pcmBuffer);

  console.log(
    `[podcast] ${section.topicId}: PCM ${pcmBuffer.length} bytes, MP3 ${mp3Buffer.length} bytes, ${durationSeconds}s`,
  );

  return {
    topicId: section.topicId,
    mp3Buffer,
    durationSeconds,
    replicaCount,
    segmentTrace: { scriptTrace, ttsTrace },
  };
}

// Re-export types and utilities
export { generateScript } from "./script-generator";
export { geminiTTS, generateSpeechWithRetry, DEFAULT_VOICES } from "./tts-gemini";
export { pcmToMp3, calculateDuration } from "./audio-converter";
export type {
  VoiceConfig,
  ScriptLine,
  ScriptContext,
  PodcastSegment,
  AudioResult,
  PodcastProgressEvent,
  PodcastProgressStep,
  AudioUrls,
  AudioDurations,
  AudioStatus,
  GenerateSegmentInput,
} from "./types";
