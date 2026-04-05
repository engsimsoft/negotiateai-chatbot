// ТЗ-Б1 + ТЗ-DEV2: Gemini TTS Provider — native multi-speaker TTS via @google/genai

import { GoogleGenAI } from "@google/genai";
import { buildTtsTrace } from "@/lib/ai/pipeline-trace";
import { waitUntil } from "@vercel/functions";
import { logUsage } from "@/lib/ai/usage-utils";
import type { PipelineStageTrace } from "@/lib/ai/pipeline-trace";
import type { TTSProvider, VoiceConfig } from "./types";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/** Default voice config: Host → Kore (firm), Expert → Iapetus (clear) */
export const DEFAULT_VOICES: VoiceConfig[] = [
  { speaker: "Host", voiceName: "Kore" },
  { speaker: "Expert", voiceName: "Iapetus" },
];

/**
 * Gemini TTS implementation of TTSProvider.
 * Uses native multi-speaker — sends full script with speaker labels in one call.
 * Returns raw PCM buffer (24kHz, 16-bit, mono).
 */
export const geminiTTS: TTSProvider = {
  async generateSpeech(
    script: string,
    voices: VoiceConfig[] = DEFAULT_VOICES,
  ): Promise<Buffer> {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: voices.map((v) => ({
              speaker: v.speaker,
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: v.voiceName },
              },
            })),
          },
        },
      },
    });

    const audioData =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      throw new Error("Gemini TTS returned no audio data");
    }

    return Buffer.from(audioData, "base64");
  },
};

/**
 * Generate speech with retry (1 attempt on failure).
 * Returns PCM buffer and optional trace data.
 */
export async function generateSpeechWithRetry(
  script: string,
  voices: VoiceConfig[] = DEFAULT_VOICES,
  /** ТЗ-CACHE2: userId for usage logging */
  userId?: string,
): Promise<{ buffer: Buffer; trace?: PipelineStageTrace }> {
  const startTime = Date.now();
  let retryCount = 0;
  let errorMsg: string | undefined;

  try {
    const buffer = await geminiTTS.generateSpeech(script, voices);
    const durationMs = Date.now() - startTime;
    // PCM: 24kHz, 16-bit mono → 48000 bytes/sec
    const audioDurationSeconds = Math.round(buffer.length / 48000);

    // ТЗ-CACHE2: Usage logging — waitUntil ensures completion on Vercel serverless
    if (userId) {
      waitUntil(logUsage({
        userId,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as any,
        modelId: TTS_MODEL,
        chatMode: "podcast:tts",
        durationMs,
      }));
    }

    const trace: PipelineStageTrace = {
      stage: "tts",
      startedAt: new Date(startTime).toISOString(),
      durationMs,
      ai: buildTtsTrace({ durationMs, audioDurationSeconds, retryCount: 0 }),
      errors: [],
      warnings: [],
    };

    return { buffer, trace };
  } catch (error) {
    // Retry once
    retryCount = 1;
    errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      "[podcast/tts] First TTS attempt failed, retrying:",
      errorMsg,
    );

    const buffer = await geminiTTS.generateSpeech(script, voices);
    const durationMs = Date.now() - startTime;
    const audioDurationSeconds = Math.round(buffer.length / 48000);

    // ТЗ-CACHE2: Usage logging (retry path) — waitUntil ensures completion on Vercel serverless
    if (userId) {
      waitUntil(logUsage({
        userId,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as any,
        modelId: TTS_MODEL,
        chatMode: "podcast:tts",
        durationMs,
      }));
    }

    const trace: PipelineStageTrace = {
      stage: "tts",
      startedAt: new Date(startTime).toISOString(),
      durationMs,
      ai: buildTtsTrace({ durationMs, audioDurationSeconds, retryCount }),
      errors: [],
      warnings: [`First attempt failed: ${errorMsg}`],
    };

    return { buffer, trace };
  }
}
