/**
 * Pipeline Trace — Observability for Briefing, Podcast, Section Refresh
 *
 * Collects structured trace data from every AI call, fetch, and data flow step.
 * All collection is gated behind `isSimplyDevMode` — zero overhead in production.
 *
 * Transport:
 * - Browser: `{trace:...}` events in JSON Lines stream (parsed by client hooks)
 * - Background/Cron: `traceSummary` saved to briefingHistory.metadata
 *
 * @see ADR 029 (Developer Panel v1) for chat-level observability
 * @see ТЗ-DEV2 for full spec
 */

import type { LanguageModelUsage } from "ai";
import type { ModelCatalog } from "tokenlens/core";

import { isSimplyDevMode } from "@/lib/constants";

import { calculateTtsCostRub } from "./providers";
import { calcStepCostRub } from "./tokenlens-catalog";
import { extractUsageForPricing } from "./usage-utils";

// ---------------------------------------------------------------------------
// Types: AI call trace
// ---------------------------------------------------------------------------

/** ТЗ-PIPELINE1: Per-attempt data for retry visibility in DevPanel */
export interface AiCallAttempt {
  attempt: number;
  error?: string;
  durationMs: number;
}

export interface AiCallTrace {
  modelId: string;
  promptPreview: string; // first 500 chars of system or user prompt
  // Disjoint token fields (AI SDK v6 native)
  noCacheInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number; // derived: sum of all fields above
  costRub: number;
  finishReason: string;
  retryCount: number; // 0 = first attempt succeeded
  fallbackUsed?: string; // modelId of fallback model if primary failed
  error?: string; // error message if call failed
  /** ТЗ-PIPELINE1: Per-attempt history for retry visibility */
  attempts?: AiCallAttempt[];
}

// ---------------------------------------------------------------------------
// Types: Fetch trace
// ---------------------------------------------------------------------------

export interface FetchTrace {
  url: string;
  method: "rss" | "telegram" | "jina" | "readability" | "semantic" | "perplexity" | "web";
  statusCode?: number;
  durationMs: number;
  responseSize?: number; // bytes
  itemsExtracted: number;
  error?: string;
  warnings: string[];
  /** Per-fetch data flow breakdown (e.g. RSS entries: total → dropped → extracted) */
  dataFlow?: DataFlowTrace;
}

// ---------------------------------------------------------------------------
// Types: Data flow trace (per stage)
// ---------------------------------------------------------------------------

export interface DataFlowTrace {
  inputCount: number;
  outputCount: number;
  droppedCount: number;
  droppedReasons?: Record<string, number>; // e.g. { "no_title": 3, "stale": 12 }
}

// ---------------------------------------------------------------------------
// Types: URL verification
// ---------------------------------------------------------------------------

export interface UrlCheck {
  url: string;
  foundInSources: boolean; // exists in original fetched items
  originalUrl?: string; // if modified — the original URL
  sourceStage: "fetcher" | "filter" | "author" | "fabricated";
  sectionTopicId: string;
}

export interface UrlVerificationTrace {
  urlsInArticle: UrlCheck[];
  summary: {
    total: number;
    verified: number;
    fabricated: number;
    modified: number;
  };
}

// ---------------------------------------------------------------------------
// Types: Pipeline stage trace
// ---------------------------------------------------------------------------

export interface PipelineStageTrace {
  stage: "fetch" | "filter" | "author" | "intro-outro" | "script" | "tts" | "research" | "section-refresh";
  startedAt: string; // ISO timestamp
  durationMs: number;
  ai?: AiCallTrace;
  fetches?: FetchTrace[];
  dataFlow?: DataFlowTrace;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Types: Pipeline trace summary (final, saved to DB or sent to client)
// ---------------------------------------------------------------------------

export interface PipelineTraceSummary {
  traceId: string;
  pipeline: "briefing" | "podcast" | "section-refresh";
  startedAt: string;
  totalDurationMs: number;
  totalTokens: number;
  totalCostRub: number;
  status: "success" | "partial" | "error";
  errorCount: number;
  warningCount: number;
  stageCount: number;
  urlVerification?: UrlVerificationTrace["summary"];
}

// ---------------------------------------------------------------------------
// Types: Full pipeline trace (stages + summary)
// ---------------------------------------------------------------------------

export interface PipelineTrace {
  traceId: string;
  pipeline: "briefing" | "podcast" | "section-refresh";
  startedAt: string;
  stages: PipelineStageTrace[];
  summary: PipelineTraceSummary;
  urlVerification?: UrlVerificationTrace;
}

// ---------------------------------------------------------------------------
// TraceCollector — accumulates trace data throughout pipeline execution
// All methods are no-op when isSimplyDevMode is false.
// ---------------------------------------------------------------------------

let traceIdCounter = 0;

function generateTraceId(): string {
  traceIdCounter++;
  return `trace-${Date.now()}-${traceIdCounter}`;
}

export class TraceCollector {
  private readonly enabled: boolean;
  private readonly traceId: string;
  private readonly pipeline: PipelineTrace["pipeline"];
  private readonly startedAt: string;
  private readonly startTime: number;
  private stages: PipelineStageTrace[] = [];
  private urlVerification?: UrlVerificationTrace;
  /** ТЗ-CACHE3: TokenLens catalog for SSOT cost calculation */
  readonly catalog?: ModelCatalog;

  constructor(pipeline: PipelineTrace["pipeline"], catalog?: ModelCatalog) {
    this.enabled = isSimplyDevMode;
    this.traceId = generateTraceId();
    this.pipeline = pipeline;
    this.startedAt = new Date().toISOString();
    this.startTime = Date.now();
    this.catalog = catalog;
  }

  /** Check if tracing is active */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Add a completed stage trace */
  addStage(stage: PipelineStageTrace): void {
    if (!this.enabled) return;
    this.stages.push(stage);
  }

  /** Set URL verification results */
  setUrlVerification(verification: UrlVerificationTrace): void {
    if (!this.enabled) return;
    this.urlVerification = verification;
  }

  /** Get the current summary (can be called during or after pipeline) */
  getSummary(): PipelineTraceSummary {
    const totalDurationMs = Date.now() - this.startTime;
    let totalTokens = 0;
    let totalCostRub = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (const stage of this.stages) {
      if (stage.ai) {
        totalTokens += stage.ai.totalTokens;
        totalCostRub += stage.ai.costRub;
      }
      errorCount += stage.errors.length;
      warningCount += stage.warnings.length;
    }

    const hasErrors = this.stages.some((s) => s.errors.length > 0);
    const allErrored = this.stages.length > 0 && this.stages.every((s) => s.errors.length > 0);

    return {
      traceId: this.traceId,
      pipeline: this.pipeline,
      startedAt: this.startedAt,
      totalDurationMs,
      totalTokens,
      totalCostRub: Math.round(totalCostRub * 100) / 100,
      status: allErrored ? "error" : hasErrors ? "partial" : "success",
      errorCount,
      warningCount,
      stageCount: this.stages.length,
      urlVerification: this.urlVerification?.summary,
    };
  }

  /** Get full trace (all stages + summary) */
  getFullTrace(): PipelineTrace {
    return {
      traceId: this.traceId,
      pipeline: this.pipeline,
      startedAt: this.startedAt,
      stages: this.stages,
      summary: this.getSummary(),
      urlVerification: this.urlVerification,
    };
  }

  /** Get latest stage (for streaming to client during pipeline) */
  getLatestStage(): PipelineStageTrace | undefined {
    if (!this.enabled) return undefined;
    return this.stages[this.stages.length - 1];
  }
}

// ---------------------------------------------------------------------------
// Helper: create an AI call trace from Vercel AI SDK result
// ---------------------------------------------------------------------------

export interface AiResultForTrace {
  modelId: string;
  /** AI SDK v6 native usage object. Use extractUsageForPricing to map. */
  usage?: LanguageModelUsage;
  finishReason?: string;
  promptPreview?: string;
  retryCount?: number;
  fallbackUsed?: string;
  durationMs: number;
}

export function buildAiCallTrace(result: AiResultForTrace, catalog?: ModelCatalog): AiCallTrace {
  const pricingUsage = extractUsageForPricing(result.usage);
  const reasoningTokens = pricingUsage.reasoningTokens ?? 0;
  const totalTokens =
    pricingUsage.noCacheInputTokens +
    pricingUsage.cacheReadTokens +
    pricingUsage.cacheWriteTokens +
    pricingUsage.outputTokens +
    reasoningTokens;

  return {
    modelId: result.modelId,
    promptPreview: result.promptPreview ?? "",
    noCacheInputTokens: pricingUsage.noCacheInputTokens,
    cacheReadTokens: pricingUsage.cacheReadTokens,
    cacheWriteTokens: pricingUsage.cacheWriteTokens,
    outputTokens: pricingUsage.outputTokens,
    reasoningTokens,
    totalTokens,
    costRub: calcStepCostRub(result.modelId, pricingUsage, catalog),
    finishReason: result.finishReason ?? "unknown",
    retryCount: result.retryCount ?? 0,
    fallbackUsed: result.fallbackUsed,
  };
}

// ---------------------------------------------------------------------------
// Helper: create a TTS stage trace
// ---------------------------------------------------------------------------

export function buildTtsTrace(input: {
  durationMs: number;
  audioDurationSeconds: number;
  retryCount?: number;
  error?: string;
  charCount?: number;
}): AiCallTrace {
  return {
    modelId: "speech-2.8-hd",
    promptPreview: "(TTS synthesis)",
    noCacheInputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    costRub: input.charCount
      ? calculateTtsCostRub(input.charCount, true)
      : calculateTtsCostRub(input.audioDurationSeconds, false),
    finishReason: input.error ? "error" : "stop",
    retryCount: input.retryCount ?? 0,
    error: input.error,
  };
}

// ---------------------------------------------------------------------------
// Helper: build URL verification from article vs fetched URLs
// ---------------------------------------------------------------------------

const MARKDOWN_LINK_REGEX = /\[.*?\]\((https?:\/\/[^)]+)\)/g;

export function verifyArticleUrls(
  articleSections: Array<{
    topicId: string;
    content: string;
    sources: Array<{ url: string }>;
  }>,
  fetchedUrls: Set<string>,
  filterOutputUrls?: Set<string>,
): UrlVerificationTrace {
  const checks: UrlCheck[] = [];

  for (const section of articleSections) {
    // Check structured sources
    for (const source of section.sources) {
      checks.push(classifyUrl(source.url, section.topicId, fetchedUrls, filterOutputUrls));
    }

    // Check inline markdown links
    const inlineMatches = section.content.matchAll(MARKDOWN_LINK_REGEX);
    for (const match of inlineMatches) {
      const url = match[1];
      // Skip if already checked via sources
      if (checks.some((c) => c.url === url && c.sectionTopicId === section.topicId)) continue;
      checks.push(classifyUrl(url, section.topicId, fetchedUrls, filterOutputUrls));
    }
  }

  const verified = checks.filter((c) => c.foundInSources).length;
  const fabricated = checks.filter((c) => c.sourceStage === "fabricated").length;
  const modified = checks.filter((c) => c.sourceStage === "filter" && !c.foundInSources).length;

  return {
    urlsInArticle: checks,
    summary: {
      total: checks.length,
      verified,
      fabricated,
      modified,
    },
  };
}

function classifyUrl(
  url: string,
  sectionTopicId: string,
  fetchedUrls: Set<string>,
  filterOutputUrls?: Set<string>,
): UrlCheck {
  if (fetchedUrls.has(url)) {
    return { url, foundInSources: true, sourceStage: "fetcher", sectionTopicId };
  }
  if (filterOutputUrls?.has(url)) {
    return { url, foundInSources: false, sourceStage: "filter", sectionTopicId };
  }
  return { url, foundInSources: false, sourceStage: "fabricated", sectionTopicId };
}
