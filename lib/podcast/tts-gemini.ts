// ТЗ-Б1: Gemini TTS Provider — native multi-speaker TTS via @google/genai

import { GoogleGenAI } from "@google/genai";
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
 */
export async function generateSpeechWithRetry(
  script: string,
  voices: VoiceConfig[] = DEFAULT_VOICES,
): Promise<Buffer> {
  try {
    return await geminiTTS.generateSpeech(script, voices);
  } catch (error) {
    // Retry once
    console.warn(
      "[podcast/tts] First TTS attempt failed, retrying:",
      error instanceof Error ? error.message : error,
    );
    return await geminiTTS.generateSpeech(script, voices);
  }
}
