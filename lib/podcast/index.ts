// ТЗ-Briefing-2: Podcast Engine — public API
// M2-Her script → MiniMax Speech 2.8 HD TTS → MP3

import type { PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import type { BriefingArticleSection } from "@/lib/briefing/briefing-types";
import type { ModelCatalog } from "tokenlens/core";
import { generateScript } from "./script-generator";
import { generateReplicasSpeech } from "./tts-minimax";
import type { ScriptContext, ScriptLine, PodcastSegment } from "./types";

/** Per-topic trace data from script + TTS stages */
export interface SegmentTrace {
  scriptTrace?: PipelineStageTrace;
  ttsTrace?: PipelineStageTrace;
}

/**
 * Generate a podcast segment from a briefing section.
 * Full pipeline: text → script (M2-Her, JSON) → per-replica TTS (Speech 2.8 HD) → MP3
 */
export async function generatePodcastSegment(
  section: BriefingArticleSection,
  context: ScriptContext,
  userId?: string,
  catalog?: ModelCatalog,
): Promise<PodcastSegment & { segmentTrace?: SegmentTrace }> {
  // Step 1: Generate dialogue script (JSON lines)
  const { lines, replicaCount, trace: scriptTrace } = await generateScript(section, context, userId, catalog);

  const wordCount = lines.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0);
  console.log(
    `[podcast] ${section.topicId}: script ${wordCount} words, ${replicaCount} replicas`,
  );

  // Step 2: Generate speech for each replica via MiniMax Speech 2.8 HD
  const { mp3Buffer, durationSeconds, trace: ttsTrace } = await generateReplicasSpeech(lines, userId);

  console.log(
    `[podcast] ${section.topicId}: MP3 ${mp3Buffer.length} bytes, ${durationSeconds}s`,
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
export { generateSpeech, generateReplicasSpeech, PODCAST_VOICES } from "./tts-minimax";
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
