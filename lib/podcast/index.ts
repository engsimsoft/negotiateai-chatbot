// ТЗ-Б1: Podcast Engine — public API

import type { BriefingArticleSection } from "@/lib/briefing/briefing-types";
import { generateScript } from "./script-generator";
import { generateSpeechWithRetry, DEFAULT_VOICES } from "./tts-gemini";
import { pcmToMp3, calculateDuration } from "./audio-converter";
import type { ScriptContext, PodcastSegment } from "./types";

/**
 * Generate a podcast segment from a briefing section.
 * Full pipeline: text → script → TTS → MP3
 *
 * @param section - Briefing article section (topicId, content, etc.)
 * @param context - Script context (isFirst, isLast, sectionTitles, briefingDate)
 * @returns PodcastSegment with MP3 buffer, duration, and replica count
 */
export async function generatePodcastSegment(
  section: BriefingArticleSection,
  context: ScriptContext,
): Promise<PodcastSegment> {
  // Step 1: Generate dialogue script
  const { script, replicaCount } = await generateScript(section, context);

  const wordCount = script.split(/\s+/).length;
  console.log(
    `[podcast] ${section.topicId}: script ${wordCount} words, ${replicaCount} replicas, ${script.length} chars`,
  );

  // Step 2: Generate speech (PCM) via Gemini TTS with retry
  const pcmBuffer = await generateSpeechWithRetry(script, DEFAULT_VOICES);

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
