// ТЗ-Б1 + ТЗ-DEV2: Podcast Engine — public API

import type { PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import type { BriefingArticleSection } from "@/lib/briefing/briefing-types";
import type { ModelCatalog } from "tokenlens/core";
import { generateScript } from "./script-generator";
import { generateSpeechWithRetry, DEFAULT_VOICES } from "./tts-gemini";
import { pcmToMp3, calculateDuration } from "./audio-converter";
import type { ScriptContext, PodcastSegment } from "./types";

/** Per-topic trace data from script + TTS stages */
export interface SegmentTrace {
  scriptTrace?: PipelineStageTrace;
  ttsTrace?: PipelineStageTrace;
}

/**
 * Generate a podcast segment from a briefing section.
 * Full pipeline: text → script → TTS → MP3
 *
 * @param section - Briefing article section (topicId, content, etc.)
 * @param context - Script context (isFirst, isLast, sectionTitles, briefingDate)
 * @returns PodcastSegment with MP3 buffer, duration, replica count, and trace data
 */
export async function generatePodcastSegment(
  section: BriefingArticleSection,
  context: ScriptContext,
  /** ТЗ-CACHE2: userId for usage logging */
  userId?: string,
  /** ТЗ-CACHE3: TokenLens catalog for SSOT cost calculation */
  catalog?: ModelCatalog,
): Promise<PodcastSegment & { segmentTrace?: SegmentTrace }> {
  // Step 1: Generate dialogue script
  const { script, replicaCount, trace: scriptTrace } = await generateScript(section, context, userId, catalog);

  const wordCount = script.split(/\s+/).length;
  console.log(
    `[podcast] ${section.topicId}: script ${wordCount} words, ${replicaCount} replicas, ${script.length} chars`,
  );

  // Step 2: Generate speech (PCM) via Gemini TTS with retry
  const { buffer: pcmBuffer, trace: ttsTrace } = await generateSpeechWithRetry(script, DEFAULT_VOICES, userId);

  // Step 3: Convert PCM → MP3
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
  TTSProvider,
  VoiceConfig,
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
