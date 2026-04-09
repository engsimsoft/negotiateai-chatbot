// ТЗ-Б1: Audio Converter — PCM to MP3 using lamejs (pure JS, no ffmpeg)
// lamejs is loaded via lame.all.js (self-contained bundle) to avoid
// CJS/ESM bundler issues with webpack/turbopack.
// Lazy loading: lamejs is loaded on first use, not at import time,
// so routes that don't need audio encoding don't pay the cold-start cost.

import fs from "fs";
import path from "path";

const DEFAULT_SAMPLE_RATE = 24000; // Gemini TTS output: 24kHz
const DEFAULT_KBPS = 128; // MP3 bitrate
const BLOCK_SIZE = 1152; // MPEG-1 frame size

// Lazy-loaded Mp3Encoder (initialized on first call to getMp3Encoder)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _Mp3Encoder: any = null;

function getMp3Encoder() {
  if (_Mp3Encoder) return _Mp3Encoder;
  // Resolve lamejs path: pnpm uses real path, npm/yarn use symlink path.
  // outputFileTracingIncludes in next.config.ts ensures lame.all.js is in the bundle.
  // require.resolve is NOT usable — bundler replaces it with numeric module ID.
  const pnpmPath = path.join(
    process.cwd(),
    "node_modules",
    ".pnpm",
    "lamejs@1.2.1",
    "node_modules",
    "lamejs",
    "lame.all.js",
  );
  const symlinkPath = path.join(
    process.cwd(),
    "node_modules",
    "lamejs",
    "lame.all.js",
  );
  const lamejsPath = fs.existsSync(pnpmPath) ? pnpmPath : symlinkPath;
  const code = fs.readFileSync(lamejsPath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const loader = new Function(
    code + "\nreturn { Mp3Encoder: lamejs.Mp3Encoder };",
  );
  _Mp3Encoder = loader().Mp3Encoder;
  return _Mp3Encoder;
}

/**
 * Convert raw PCM buffer (16-bit, mono) to MP3.
 * @param pcmBuffer - Raw PCM data from Gemini TTS (24kHz, 16-bit, mono)
 * @param sampleRate - Sample rate (default 24000 for Gemini TTS)
 * @returns MP3 buffer
 */
export function pcmToMp3(
  pcmBuffer: Buffer,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): Buffer {
  // Convert Buffer to Int16Array (PCM 16-bit samples)
  const samples = new Int16Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    pcmBuffer.length / 2,
  );

  const encoder = new (getMp3Encoder())(1, sampleRate, DEFAULT_KBPS);
  const mp3Chunks: Buffer[] = [];

  // Encode in blocks
  for (let i = 0; i < samples.length; i += BLOCK_SIZE) {
    const block = samples.subarray(
      i,
      Math.min(i + BLOCK_SIZE, samples.length),
    );
    const mp3buf = encoder.encodeBuffer(block);
    if (mp3buf.length > 0) {
      mp3Chunks.push(Buffer.from(mp3buf));
    }
  }

  // Flush remaining data
  const end = encoder.flush();
  if (end.length > 0) {
    mp3Chunks.push(Buffer.from(end));
  }

  return Buffer.concat(mp3Chunks);
}

/**
 * Calculate audio duration from PCM buffer.
 * @param pcmBuffer - Raw PCM data (16-bit, mono)
 * @param sampleRate - Sample rate (default 24000)
 * @returns Duration in seconds
 */
export function calculateDuration(
  pcmBuffer: Buffer,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): number {
  // 16-bit = 2 bytes per sample, mono = 1 channel
  return Math.round(pcmBuffer.length / (sampleRate * 2));
}
