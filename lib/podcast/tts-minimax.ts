// ТЗ-Briefing-2: MiniMax Speech 2.8 HD TTS Provider
// Replaces Gemini TTS — native Russian, per-replica voice routing

import "server-only";

import { buildTtsTrace } from "@/lib/ai/pipeline-trace";
import { waitUntil } from "@vercel/functions";
import { logUsage } from "@/lib/ai/usage-utils";
import { calculateMinimaxTtsCostUsd } from "@/lib/ai/providers";
import type { PipelineStageTrace } from "@/lib/ai/pipeline-trace";

const TTS_MODEL = "speech-2.8-hd";
const TTS_API_URL = "https://api.minimax.io/v1/t2a_v2";

/** Voice IDs for podcast speakers */
export const PODCAST_VOICES = {
  host: "Russian_Professional_Broadcaster_v2",
  expert: "Russian_Overwhelmed_Vlogger_v1",
} as const;

export interface MiniMaxTTSOptions {
  text: string;
  voiceId: string;
  speed?: number;       // default 1.0
  emotion?: "auto" | "happy" | "calm" | "neutral" | "surprised";
  sampleRate?: number;  // default 32000
  bitrate?: number;     // default 128000
  format?: "mp3" | "wav" | "pcm" | "flac";  // default mp3
}

interface MiniMaxTTSResponse {
  audio_file?: string;          // base64-encoded audio (legacy format)
  data?: {
    audio?: string;             // hex-encoded audio (current API format)
  };
  extra_info?: {
    audio_length?: number;      // duration in ms (if provided)
    audio_sample_rate?: number;
    audio_size?: number;
    bitrate?: number;
    word_count?: number;
    invisible_character_ratio?: number;
  };
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
}

/**
 * Generate speech from text using MiniMax Speech 2.8 HD.
 * Returns MP3 buffer directly (no PCM conversion needed).
 */
export async function generateSpeech(options: MiniMaxTTSOptions): Promise<{
  mp3Buffer: Buffer;
  durationMs: number;
}> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY is not set");
  }

  const response = await fetch(TTS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      text: options.text,
      voice_setting: {
        voice_id: options.voiceId,
        speed: options.speed ?? 1.0,
        vol: 1.0,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: options.sampleRate ?? 32000,
        bitrate: options.bitrate ?? 128000,
        format: options.format ?? "mp3",
      },
    }),
    signal: AbortSignal.timeout(30_000), // 30s timeout per replica
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown");
    throw new Error(`MiniMax TTS API error ${response.status}: ${text}`);
  }

  const data: MiniMaxTTSResponse = await response.json();

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax TTS error: ${data.base_resp.status_msg} (code ${data.base_resp.status_code})`);
  }

  // API returns audio in data.audio (hex) or audio_file (base64)
  const audioHex = data.data?.audio;
  const audioBase64 = data.audio_file;

  if (!audioHex && !audioBase64) {
    console.error("[podcast/tts] No audio in response:", JSON.stringify(data).slice(0, 300));
    throw new Error("MiniMax TTS returned no audio data");
  }

  const mp3Buffer = audioHex
    ? Buffer.from(audioHex, "hex")
    : Buffer.from(audioBase64!, "base64");
  const durationMs = data.extra_info?.audio_length ?? estimateDurationMs(options.text);

  return { mp3Buffer, durationMs };
}

/**
 * Estimate audio duration from text length (fallback if API doesn't return it).
 * Average Russian speech: ~150 words/min = ~2.5 words/sec = ~12 chars/sec
 */
function estimateDurationMs(text: string): number {
  const CHARS_PER_SECOND = 12;
  return Math.round((text.length / CHARS_PER_SECOND) * 1000);
}

/**
 * Generate speech for multiple replicas and merge into a single MP3.
 * Each replica is synthesized separately with its own voice_id.
 * Returns combined MP3 buffer, total duration, and trace data.
 */
export async function generateReplicasSpeech(
  replicas: Array<{ speaker: "host" | "expert"; text: string }>,
  userId?: string,
): Promise<{ mp3Buffer: Buffer; durationSeconds: number; trace?: PipelineStageTrace }> {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(4);
  const startTime = Date.now();
  let totalCharCount = 0;

  // Filter out empty replicas (can happen after text cleanup)
  const validReplicas = replicas.filter((r) => r.text.trim().length > 0);
  if (validReplicas.length === 0) {
    throw new Error("No valid replicas to synthesize (all empty after cleanup)");
  }

  // Add pause markers to all replicas except the first
  const replicasWithPauses = validReplicas.map((r, i) => ({
    ...r,
    text: i === 0 ? r.text : `<#0.3#>${r.text}`,
  }));

  // Generate speech for each replica in parallel (pLimit(4))
  const results = await Promise.all(
    replicasWithPauses.map((replica) =>
      limit(async () => {
        totalCharCount += replica.text.length;
        return generateSpeech({
          text: replica.text,
          voiceId: PODCAST_VOICES[replica.speaker],
          emotion: "auto",
        });
      }),
    ),
  );

  // Concatenate MP3 buffers in script order (MP3 is a streaming format)
  const mp3Buffer = Buffer.concat(results.map((r) => r.mp3Buffer));
  const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const durationSeconds = Math.round(totalDurationMs / 1000);

  const durationMs = Date.now() - startTime;

  // Usage logging
  if (userId) {
    waitUntil(logUsage({
      userId,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as any,
      modelId: TTS_MODEL,
      chatMode: "podcast:tts",
      durationMs,
      costUsdOverride: calculateMinimaxTtsCostUsd(totalCharCount),
    }));
  }

  const trace: PipelineStageTrace = {
    stage: "tts",
    startedAt: new Date(startTime).toISOString(),
    durationMs,
    ai: buildTtsTrace({
      durationMs,
      audioDurationSeconds: durationSeconds,
      retryCount: 0,
      charCount: totalCharCount,
    }),
    errors: [],
    warnings: [],
  };

  return { mp3Buffer, durationSeconds, trace };
}
