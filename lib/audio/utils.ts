import type { VoiceError, VoiceErrorType } from "./types";
import { VOICE_ERROR_MESSAGES } from "./constants";

/**
 * Convert Float32Array audio data to Int16Array (PCM 16-bit)
 * Required by AssemblyAI
 */
export function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp value between -1 and 1
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // Convert to 16-bit integer
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

/**
 * Convert Int16Array to base64 string for WebSocket transmission
 */
export function int16ToBase64(int16Array: Int16Array): string {
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * Resample audio from source sample rate to target sample rate
 */
export function resampleAudio(
  audioData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return audioData;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    // Linear interpolation
    result[i] =
      audioData[srcIndexFloor] * (1 - fraction) +
      audioData[srcIndexCeil] * fraction;
  }

  return result;
}

/**
 * Create a VoiceError from an Error or string
 */
export function createVoiceError(
  type: VoiceErrorType,
  originalError?: Error
): VoiceError {
  return {
    type,
    message: VOICE_ERROR_MESSAGES[type] || VOICE_ERROR_MESSAGES.unknown,
    originalError,
  };
}

/**
 * Check if browser supports required audio APIs
 */
export function checkBrowserSupport(): boolean {
  if (typeof window === "undefined") return false;
  if (!navigator.mediaDevices) return false;
  if (typeof navigator.mediaDevices.getUserMedia !== "function") return false;
  if (!window.AudioContext) return false;
  return true;
}

/**
 * Get microphone permission status
 * Returns 'granted', 'denied', 'prompt', or 'unsupported'
 */
export async function getMicrophonePermission(): Promise<
  "granted" | "denied" | "prompt" | "unsupported"
> {
  if (!navigator.permissions) {
    return "unsupported";
  }

  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return result.state as "granted" | "denied" | "prompt";
  } catch {
    // Some browsers don't support querying microphone permission
    return "unsupported";
  }
}
