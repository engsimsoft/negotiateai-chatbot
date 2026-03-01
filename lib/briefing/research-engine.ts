/**
 * ТЗ-FIX2: Research Engine — server-side source discovery and verification.
 *
 * Replaces LLM-orchestrated tool chains (deepResearch → fetchUrl → readTelegramChannel)
 * with deterministic server code. The model calls startResearch once,
 * this engine does the rest: Perplexity search → citation parsing → URL verification
 * → Telegram channel validation → source classification.
 *
 * Used by service-chat briefing-onboarding context.
 */

import pLimit from "p-limit";

import { callPerplexity } from "@/lib/ai/tools/perplexity-client";
import { calculateCostRub } from "@/lib/ai/providers";
import type { PipelineStageTrace, FetchTrace } from "@/lib/ai/pipeline-trace";
import { fetchPage } from "@/lib/ai/tools/fetch-page";
import { parseTelegramChannel } from "@/lib/telegram/parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchTopic {
  topicId: string;
  topicName: string;
  emoji: string;
  briefingStyle: string;
}

export interface ResearchProgressEvent {
  topicId: string;
  topicName: string;
  emoji: string;
  phase: "searching" | "verifying" | "done" | "error";
  found?: number;
  verified?: number;
  error?: string;
}

export interface VerifiedSource {
  sourceName: string;
  sourceUrl: string;
  rssUrl?: string;
  fetchMethod: "rss" | "jina" | "telegram_parse";
  sourceLanguage: string;
  tier: string;
  verified: true;
  verificationMethod: "fetchUrl" | "readTelegramChannel";
  snippet: string;
}

export interface TopicResearchResult {
  topicId: string;
  topicName: string;
  emoji: string;
  sources: VerifiedSource[];
  sourcesChecked: number;
  sourcesVerified: number;
  /** ТЗ-DEV2: Per-topic trace data */
  trace?: PipelineStageTrace;
}

export interface ResearchResult {
  success: boolean;
  results: TopicResearchResult[];
  totalSources: number;
  totalVerified: number;
  error?: string;
  /** ТЗ-DEV2: All per-topic traces */
  traces?: PipelineStageTrace[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max topics to research in parallel */
const TOPIC_CONCURRENCY = 3;

/** Max sources to verify in parallel per topic */
const VERIFY_CONCURRENCY = 5;

/** Timeout for each fetchPage verification call (ms) */
const VERIFY_TIMEOUT_MS = 8_000;

/** Max snippet length for each source (chars) */
const SNIPPET_LENGTH = 300;

/** Max citations to verify per topic (to avoid excessive fetching) */
const MAX_CITATIONS_PER_TOPIC = 12;

/** Max Telegram channels to verify per topic */
const MAX_TELEGRAM_PER_TOPIC = 3;

// ---------------------------------------------------------------------------
// Tier classification — known domains
// ---------------------------------------------------------------------------

const FLAGSHIP_DOMAINS = new Set([
  "reuters.com",
  "bbc.com",
  "bbc.co.uk",
  "nytimes.com",
  "wsj.com",
  "ft.com",
  "bloomberg.com",
  "rbc.ru",
  "kommersant.ru",
  "tass.ru",
  "ria.ru",
  "interfax.ru",
  "openai.com",
  "anthropic.com",
  "google.com",
  "deepmind.google",
]);

const RESPECTED_DOMAINS = new Set([
  "techcrunch.com",
  "theverge.com",
  "arstechnica.com",
  "wired.com",
  "habr.com",
  "vc.ru",
  "rb.ru",
  "3dnews.ru",
  "cnbc.com",
  "coindesk.com",
  "cointelegraph.com",
  "forklog.com",
  "bits.media",
  "hbr.org",
  "motorsport.com",
  "f1news.ru",
  "championat.com",
  "nplus1.ru",
  "meduza.io",
  "cossa.ru",
  "e-pepper.ru",
  "retail.ru",
]);

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Main orchestrator: research multiple topics in parallel.
 *
 * @param topics - Topics to research
 * @param onProgress - Optional callback for streaming progress events
 */
export async function researchTopics(
  topics: ResearchTopic[],
  onProgress?: (event: ResearchProgressEvent) => void,
): Promise<ResearchResult> {
  const limit = pLimit(TOPIC_CONCURRENCY);

  try {
    const results = await Promise.all(
      topics.map((topic) =>
        limit(() => researchSingleTopic(topic, onProgress)),
      ),
    );

    const totalSources = results.reduce((sum, r) => sum + r.sourcesChecked, 0);
    const totalVerified = results.reduce(
      (sum, r) => sum + r.sourcesVerified,
      0,
    );

    // ТЗ-DEV2: Collect per-topic traces
    const traces = results
      .map((r) => r.trace)
      .filter((t): t is PipelineStageTrace => !!t);

    return {
      success: true,
      results,
      totalSources,
      totalVerified,
      traces: traces.length > 0 ? traces : undefined,
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      totalSources: 0,
      totalVerified: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Research a single topic:
 * 1. Perplexity search (sources + telegram channels in one query)
 * 2. Extract citations + telegram handles
 * 3. Verify each in parallel
 * 4. Classify verified sources
 */
async function researchSingleTopic(
  topic: ResearchTopic,
  onProgress?: (event: ResearchProgressEvent) => void,
): Promise<TopicResearchResult> {
  const { topicId, topicName, emoji, briefingStyle } = topic;

  const progress = (
    phase: ResearchProgressEvent["phase"],
    extra?: Partial<ResearchProgressEvent>,
  ) => {
    onProgress?.({ topicId, topicName, emoji, phase, ...extra });
  };

  const startTime = Date.now();
  const warnings: string[] = [];
  const fetchTraces: FetchTrace[] = [];

  try {
    // Phase 1: Perplexity search — combined query for web sources + telegram channels
    progress("searching");

    const query = buildResearchQuery(topicName, briefingStyle);
    const perplexityResult = await callPerplexity({
      query,
      model: "sonar-pro",
      timeoutMs: 30_000,
    });

    // ТЗ-DEV2: Perplexity fetch trace
    if (perplexityResult.durationMs) {
      fetchTraces.push({
        url: "perplexity://sonar-pro",
        method: "perplexity",
        durationMs: perplexityResult.durationMs,
        itemsExtracted: perplexityResult.citations.length,
        warnings: [],
      });
    }

    // Phase 2: Extract URLs and telegram handles
    const citationUrls = extractCitations(perplexityResult.citations, perplexityResult.content);
    const telegramHandles = extractTelegramHandles(perplexityResult.content);

    const totalFound = citationUrls.length + telegramHandles.length;
    progress("verifying", { found: totalFound });

    // Phase 3: Verify in parallel
    const verifyLimit = pLimit(VERIFY_CONCURRENCY);

    const urlVerifications = citationUrls
      .slice(0, MAX_CITATIONS_PER_TOPIC)
      .map((url) => verifyLimit(() => verifySourceWithTrace(url, fetchTraces, warnings)));

    const telegramVerifications = telegramHandles
      .slice(0, MAX_TELEGRAM_PER_TOPIC)
      .map((handle) => verifyLimit(() => verifyTelegramChannelWithTrace(handle, fetchTraces, warnings)));

    const [urlResults, telegramResults] = await Promise.all([
      Promise.allSettled(urlVerifications),
      Promise.allSettled(telegramVerifications),
    ]);

    // Phase 4: Collect verified sources
    const sources: VerifiedSource[] = [];

    for (const result of urlResults) {
      if (result.status === "fulfilled" && result.value) {
        sources.push(result.value);
      }
    }
    for (const result of telegramResults) {
      if (result.status === "fulfilled" && result.value) {
        sources.push(result.value);
      }
    }

    const sourcesChecked =
      Math.min(citationUrls.length, MAX_CITATIONS_PER_TOPIC) +
      Math.min(telegramHandles.length, MAX_TELEGRAM_PER_TOPIC);

    progress("done", {
      found: totalFound,
      verified: sources.length,
    });

    // ТЗ-DEV2: Build per-topic trace
    const durationMs = Date.now() - startTime;
    const promptTokens = perplexityResult.usage?.promptTokens ?? 0;
    const completionTokens = perplexityResult.usage?.completionTokens ?? 0;
    const totalTokens = perplexityResult.usage?.totalTokens ?? (promptTokens + completionTokens);

    const trace: PipelineStageTrace = {
      stage: "research",
      startedAt: new Date(startTime).toISOString(),
      durationMs,
      ai: {
        modelId: "sonar-pro",
        promptPreview: query.slice(0, 500),
        promptTokens,
        completionTokens,
        totalTokens,
        costRub: calculateCostRub("sonar-pro", {
          inputTokens: promptTokens,
          outputTokens: completionTokens,
        }),
        finishReason: "stop",
        retryCount: 0,
      },
      fetches: fetchTraces,
      dataFlow: {
        inputCount: totalFound,
        outputCount: sources.length,
        droppedCount: sourcesChecked - sources.length,
      },
      errors: [],
      warnings,
    };

    return {
      topicId,
      topicName,
      emoji,
      sources,
      sourcesChecked,
      sourcesVerified: sources.length,
      trace,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    progress("error", { error: errorMsg });

    return {
      topicId,
      topicName,
      emoji,
      sources: [],
      sourcesChecked: 0,
      sourcesVerified: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Perplexity query that asks for both web sources and Telegram channels.
 * One call per topic (agreed with architect).
 */
function buildResearchQuery(topicName: string, briefingStyle: string): string {
  return `Лучшие источники новостей и аналитики по теме "${topicName}" в 2026 году.
Стиль: ${briefingStyle}.

Мне нужны:
1. Веб-сайты и блоги — прямые ссылки на главные страницы или разделы
2. Telegram-каналы — укажи @username для каждого канала

Для каждого источника кратко опиши что он публикует и почему полезен.
Включи как русскоязычные, так и англоязычные источники.`;
}

/**
 * Extract unique URLs from Perplexity citations + text-based URL extraction.
 * Filters out non-http URLs and deduplicates.
 */
export function extractCitations(
  citations: Array<{ url: string; title?: string }>,
  text: string,
): string[] {
  const urls = new Set<string>();

  // 1. From structured citations
  for (const c of citations) {
    if (c.url && isValidSourceUrl(c.url)) {
      urls.add(normalizeUrl(c.url));
    }
  }

  // 2. From text — extract URLs that Perplexity mentioned but didn't include in citations
  const urlPattern = /https?:\/\/[^\s)<>\]"',]+/g;
  const textUrls = text.match(urlPattern) || [];
  for (const rawUrl of textUrls) {
    // Clean trailing punctuation
    const cleaned = rawUrl.replace(/[.),:;!?]+$/, "");
    if (isValidSourceUrl(cleaned)) {
      urls.add(normalizeUrl(cleaned));
    }
  }

  return Array.from(urls);
}

/**
 * Extract Telegram @username handles from text.
 * Looks for @word patterns that look like Telegram channel names.
 */
export function extractTelegramHandles(text: string): string[] {
  const handles = new Set<string>();

  // Pattern: @username (5-32 chars, alphanumeric + underscore, Telegram rules)
  const pattern = /@([a-zA-Z][a-zA-Z0-9_]{4,31})\b/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const handle = match[1].toLowerCase();
    // Skip common non-channel handles
    if (!SKIP_HANDLES.has(handle)) {
      handles.add(handle);
    }
  }

  return Array.from(handles);
}

/** Common @mentions that aren't Telegram channels */
const SKIP_HANDLES = new Set([
  "gmail",
  "email",
  "example",
  "username",
  "channel",
  "telegram",
  "param",
  "override",
  "deprecated",
  "returns",
  "throws",
  "typedef",
]);

/**
 * ТЗ-DEV2: Verify a web URL with trace recording.
 */
async function verifySourceWithTrace(
  url: string,
  fetchTraces: FetchTrace[],
  warnings: string[],
): Promise<VerifiedSource | null> {
  const startTime = Date.now();
  const result = await verifySource(url);
  const durationMs = Date.now() - startTime;

  fetchTraces.push({
    url,
    method: "web",
    durationMs,
    itemsExtracted: result ? 1 : 0,
    error: result ? undefined : `Verification failed for ${url}`,
    warnings: [],
  });

  if (!result) {
    warnings.push(`verifySource failed: ${url}`);
  }

  return result;
}

/**
 * ТЗ-DEV2: Verify a Telegram channel with trace recording.
 */
async function verifyTelegramChannelWithTrace(
  handle: string,
  fetchTraces: FetchTrace[],
  warnings: string[],
): Promise<VerifiedSource | null> {
  const startTime = Date.now();
  const result = await verifyTelegramChannel(handle);
  const durationMs = Date.now() - startTime;

  fetchTraces.push({
    url: `https://t.me/${handle}`,
    method: "telegram",
    durationMs,
    itemsExtracted: result ? 1 : 0,
    error: result ? undefined : `Verification failed for @${handle}`,
    warnings: [],
  });

  if (!result) {
    warnings.push(`verifyTelegramChannel failed: @${handle}`);
  }

  return result;
}

/**
 * Verify a web URL: fetch page, extract content, discover RSS.
 * Returns null if verification fails.
 */
async function verifySource(url: string): Promise<VerifiedSource | null> {
  try {
    const result = await fetchPage(url, {
      maxLength: 5_000,
      timeoutMs: VERIFY_TIMEOUT_MS,
    });

    const snippet = result.content.slice(0, SNIPPET_LENGTH).trim();
    if (!snippet) return null;

    const classification = classifySource(url, result.content, result.rssUrl);

    return {
      sourceName: result.title || extractDomain(url),
      sourceUrl: url,
      rssUrl: result.rssUrl,
      fetchMethod: classification.fetchMethod,
      sourceLanguage: classification.language,
      tier: classification.tier,
      verified: true,
      verificationMethod: "fetchUrl",
      snippet,
    };
  } catch (error) {
    console.warn(
      `[research-engine] verifySource failed for ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Verify a Telegram channel: parse channel, check validity.
 * Returns null if verification fails.
 */
async function verifyTelegramChannel(
  handle: string,
): Promise<VerifiedSource | null> {
  try {
    const result = await parseTelegramChannel(handle, {
      timeout: VERIFY_TIMEOUT_MS,
      maxContentLength: 500,
    });

    if (!result.isValid || result.posts.length === 0) {
      return null;
    }

    // Build snippet from recent posts
    const snippet = result.posts
      .slice(0, 3)
      .map((p) => p.text)
      .filter(Boolean)
      .join(" | ")
      .slice(0, SNIPPET_LENGTH)
      .trim();

    if (!snippet) return null;

    // Detect language from content
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(snippet);

    return {
      sourceName: `@${result.channel}`,
      sourceUrl: result.channelUrl,
      fetchMethod: "telegram_parse",
      sourceLanguage: hasCyrillic ? "ru" : "en",
      tier: "community",
      verified: true,
      verificationMethod: "readTelegramChannel",
      snippet,
    };
  } catch (error) {
    console.warn(
      `[research-engine] verifyTelegramChannel failed for @${handle}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

/**
 * Classify a source by tier, fetchMethod, and language.
 * Uses heuristics agreed with architect:
 * - tier: domain from top-list → flagship; known → respected; telegram → community; else → niche
 * - fetchMethod: t.me → telegram_parse; has RSS → rss; else → jina
 * - language: Cyrillic in content → ru; else → en
 */
export function classifySource(
  url: string,
  content: string,
  rssUrl?: string,
): { tier: string; fetchMethod: "rss" | "jina" | "telegram_parse"; language: string } {
  const domain = extractDomain(url);

  // Tier
  let tier = "niche";
  if (url.includes("t.me/")) {
    tier = "community";
  } else if (FLAGSHIP_DOMAINS.has(domain)) {
    tier = "flagship";
  } else if (RESPECTED_DOMAINS.has(domain)) {
    tier = "respected";
  }

  // FetchMethod
  let fetchMethod: "rss" | "jina" | "telegram_parse" = "jina";
  if (url.includes("t.me/")) {
    fetchMethod = "telegram_parse";
  } else if (rssUrl) {
    fetchMethod = "rss";
  }

  // Language
  const hasCyrillic = /[а-яА-ЯёЁ]/.test(content.slice(0, 2000));
  const language = hasCyrillic ? "ru" : "en";

  return { tier, fetchMethod, language };
}

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

function isValidSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Skip search engine result pages, login pages, etc.
    if (parsed.hostname.includes("google.com") && parsed.pathname.startsWith("/search")) return false;
    if (parsed.hostname.includes("bing.com") && parsed.pathname.startsWith("/search")) return false;
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking params
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("utm_content");
    parsed.searchParams.delete("utm_term");
    return parsed.toString();
  } catch {
    return url;
  }
}

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
