// ТЗ-Б1: Podcast Engine types

import type { BriefingArticleSection } from "@/lib/briefing/briefing-types";

// --- Voice & TTS ---

export interface VoiceConfig {
  speaker: string; // e.g. "Host", "Expert"
  voiceName: string; // e.g. "Kore", "Puck"
}

export interface TTSProvider {
  generateSpeech(script: string, voices: VoiceConfig[]): Promise<Buffer>;
}

// --- Script Generation ---

export interface ScriptContext {
  isFirst: boolean;
  isLast: boolean;
  sectionTitles: string[];
  briefingDate: string; // ISO date string
}

// --- Podcast Segment ---

export interface PodcastSegment {
  topicId: string;
  mp3Buffer: Buffer;
  durationSeconds: number;
  replicaCount: number;
}

export interface AudioResult {
  topicId: string;
  url: string;
  durationSeconds: number;
}

// --- Streaming Progress Events ---

export type PodcastProgressStep =
  | "script"
  | "recording"
  | "done"
  | "error"
  | "complete";

export interface PodcastProgressEvent {
  step: PodcastProgressStep;
  topicId?: string;
  message: string;
  replicaCount?: number;
  url?: string;
  durationSeconds?: number;
  readyCount?: number;
  failedCount?: number;
}

// --- DB audio fields ---

/** JSONB format: { "topic-1": "https://blob.vercel-storage.com/...", ... } */
export type AudioUrls = Record<string, string>;

/** JSONB format: { "topic-1": 134, "topic-2": 138 } (seconds) */
export type AudioDurations = Record<string, number>;

export type AudioStatus =
  | "none"
  | "generating"
  | "ready"
  | "partial"
  | "outdated";

// --- Input for generatePodcastSegment ---

export interface GenerateSegmentInput {
  section: BriefingArticleSection;
  context: ScriptContext;
}
