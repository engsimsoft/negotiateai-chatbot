// ТЗ-А3: Shared BriefingArticle types (client-safe)
// Replaces old BriefingJSON/BriefingBlock/BriefingItem (v3.30.0)

/** Source card within an article section */
export interface BriefingArticleSource {
  title: string;
  url: string;
  sourceName: string;
  tier: string;
  summary: string;
}

/** Article section (one topic) */
export interface BriefingArticleSection {
  topicId: string;
  topicName: string;
  emoji: string;
  content: string;
  newsCount: number;
  sources: BriefingArticleSource[];
}

/** Article metadata */
export interface BriefingArticleMeta {
  totalNews: number;
  topicsCount: number;
  readingTimeMinutes: number;
}

/** Full briefing article (one issue) */
export interface BriefingArticle {
  title: string;
  intro: string;
  sections: BriefingArticleSection[];
  outro: string;
  meta: BriefingArticleMeta;
}

// ТЗ-BF1: Saved briefing topic (client-safe)

/** A topic saved by the user from a briefing issue */
export interface SavedBriefingTopicClient {
  id: string;
  topicId: string;
  topicName: string;
  emoji: string;
  title: string;
  content: string;
  sources: BriefingArticleSource[];
  briefingGeneratedAt: string; // ISO string
  savedAt: string; // ISO string
}

// ТЗ-Б2: Audio/Podcast types (client-safe)

/** JSONB format: { "topicId": "https://blob.vercel-storage.com/...", ... } */
export type AudioUrls = Record<string, string>;

/** JSONB format: { "topicId": 134, ... } (seconds) */
export type AudioDurations = Record<string, number>;

export type AudioStatus =
  | "none"
  | "generating"
  | "ready"
  | "partial"
  | "outdated";

// ТЗ-TG4a: Pipeline result (server-side)

/** Result of running the briefing generation pipeline */
export interface BriefingPipelineResult {
  status: "ready" | "failed";
  article?: BriefingArticle;
  sourcesChecked: number;
  itemsIncluded: number;
  duplicatesRemoved: number;
  tokensUsed: number;
  error?: string;
  /** ТЗ-DEV2: Trace summary for cron metadata storage */
  traceSummary?: import("@/lib/ai/pipeline-trace").PipelineTraceSummary;
}

// ТЗ-А5: Streaming progress events (client-safe)

export type BriefingProgressStep =
  | "connecting"
  | "fetching"
  | "filtering"
  | "writing"
  | "complete"
  | "error";

/** Event emitted by /api/briefing/generate streaming response */
export interface BriefingProgressEvent {
  step: BriefingProgressStep;
  message: string;
  done?: boolean;
  detail?: string;
  redirectUrl?: string;
}
