/**
 * ТЗ-FU + ТЗ-WS1 + ТЗ-WS2: Shared utility for fetching and extracting web page content.
 *
 * Extracted from lib/briefing/source-fetchers/web-fetcher.ts to avoid
 * duplication between the briefing fetcher and the fetchUrl tool.
 * Uses Readability + JSDOM for clean text extraction.
 *
 * ТЗ-WS1: Added charset detection (windows-1251, koi8-r, etc.)
 * and improved fallback via JSDOM DOM API for semantic tags.
 *
 * ТЗ-WS2: Jina Reader API as cascading fallback + options object + source tracking.
 * Cascade: Readability (8s) → semantic → Jina (10s) → graceful degradation.
 */

import { Readability } from "@mozilla/readability";
import { detect } from "chardet";
import * as iconv from "iconv-lite";
import { JSDOM } from "jsdom";

import { jinaReader } from "./jina-reader";

export type FetchPageSource = "readability" | "semantic" | "jina";

export interface FetchPageResult {
  title: string;
  content: string;
  url: string;
  originalLength: number;
  source: FetchPageSource;
  /** RSS feed URL discovered from <link rel="alternate"> (ТЗ-FIX2) */
  rssUrl?: string;
}

export interface FetchPageOptions {
  maxLength?: number;
  timeoutMs?: number;
  forceJina?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const CASCADE_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_LENGTH = 10_000;
const MIN_CONTENT_LENGTH = 5_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Detect charset from HTTP Content-Type header, HTML meta tags, or chardet.
 * Priority: HTTP header > <meta charset> > chardet > utf-8.
 */
function detectCharset(
  buffer: Buffer,
  contentType: string | null,
): string {
  // 1. HTTP Content-Type header: charset=...
  if (contentType) {
    const match = contentType.match(/charset=["']?([^"'\s;]+)/i);
    if (match) return match[1].toLowerCase();
  }

  // 2. <meta charset="..."> or <meta http-equiv="Content-Type" content="...; charset=...">
  //    Parse first 2048 bytes as ASCII — meta tags are always in ASCII range
  const head = buffer.subarray(0, 2048).toString("ascii");
  const metaMatch = head.match(/<meta[^>]+charset=["']?([^"'\s;>]+)/i);
  if (metaMatch) return metaMatch[1].toLowerCase();

  // 3. chardet auto-detection
  const detected = detect(buffer);
  if (detected) return detected.toLowerCase();

  // 4. Fallback
  return "utf-8";
}

/**
 * Decode buffer to string using detected charset.
 * Uses iconv-lite for non-UTF-8 encodings.
 */
function decodeBuffer(buffer: Buffer, charset: string): string {
  const normalized = charset.toLowerCase().replace(/[-_]/g, "");

  if (normalized === "utf8" || normalized === "utf16le") {
    return buffer.toString(normalized === "utf8" ? "utf-8" : "utf16le");
  }

  if (iconv.encodingExists(charset)) {
    return iconv.decode(buffer, charset);
  }

  // Unknown encoding — try utf-8
  return buffer.toString("utf-8");
}

/**
 * ТЗ-FIX2: Discover RSS feed URL from <link rel="alternate"> in HTML <head>.
 * Must be called BEFORE Readability.parse() which mutates the DOM.
 */
function discoverRssUrl(document: Document): string | undefined {
  const link = document.querySelector(
    'link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]',
  );
  return (link as Element | null)?.getAttribute("href") ?? undefined;
}

/**
 * Extract text from semantic HTML tags via JSDOM DOM API.
 * Used as fallback when Readability fails or returns too little content.
 */
function extractSemanticText(document: Document): string {
  const elements = document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li");
  const parts: string[] = [];

  for (const el of elements) {
    const text = el.textContent?.trim();
    if (text) parts.push(text);
  }

  return parts.join("\n");
}

/**
 * Fetch a URL and extract readable text via cascading strategy:
 * 1. forceJina → skip Readability, go directly to Jina Reader
 * 2. Readability (8s timeout in cascade) → if >= 200 chars → done
 * 3. Semantic fallback (JSDOM DOM API) → if >= 200 chars → done
 * 4. Jina Reader API (10s timeout) → if content → done
 * 5. Graceful degradation: return whatever we have
 *
 * Supports non-UTF-8 encodings (windows-1251, koi8-r, etc.).
 *
 * @param pageUrl - URL to fetch
 * @param options - Optional configuration
 * @returns Extracted page content or throws on failure
 */
export async function fetchPage(
  pageUrl: string,
  options?: FetchPageOptions,
): Promise<FetchPageResult> {
  const maxLength = options?.maxLength ?? DEFAULT_MAX_LENGTH;
  const forceJina = options?.forceJina ?? false;

  // ТЗ-WS2: forceJina — skip Readability, go directly to Jina
  if (forceJina) {
    const jinaResult = await jinaReader(pageUrl);
    if (jinaResult && jinaResult.content.length > 0) {
      return {
        title: pageUrl,
        content: jinaResult.content.slice(0, maxLength),
        url: pageUrl,
        originalLength: jinaResult.content.length,
        source: "jina",
      };
    }
    // forceJina failed — fall through to Readability as last resort
  }

  // ТЗ-WS2: Use shorter timeout (8s) when cascade is active, full timeout otherwise
  const timeoutMs = options?.timeoutMs ?? (forceJina ? DEFAULT_TIMEOUT_MS : CASCADE_TIMEOUT_MS);

  let readabilityText: string | undefined;
  let articleTitle: string | undefined;
  let semanticText: string | undefined;
  let rssUrl: string | undefined;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    // ТЗ-WS1: Read as binary buffer, detect charset, decode
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    const charset = detectCharset(buffer, contentType);
    const html = decodeBuffer(buffer, charset);

    const dom = new JSDOM(html, { url: pageUrl });

    // ТЗ-FIX2: Discover RSS before Readability (which mutates the DOM)
    rssUrl = discoverRssUrl(dom.window.document);

    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    readabilityText = article?.textContent?.replace(/\s+/g, " ").trim();
    articleTitle = article?.title ?? undefined;

    // If Readability extracted enough content — use it
    if (readabilityText && readabilityText.length >= MIN_CONTENT_LENGTH) {
      return {
        title: articleTitle || pageUrl,
        content: readabilityText.slice(0, maxLength),
        url: pageUrl,
        originalLength: readabilityText.length,
        source: "readability",
        rssUrl,
      };
    }

    // ТЗ-WS1: Improved fallback — extract from semantic tags via JSDOM DOM API
    semanticText = extractSemanticText(dom.window.document);

    if (semanticText.length >= MIN_CONTENT_LENGTH) {
      return {
        title: articleTitle || pageUrl,
        content: semanticText.slice(0, maxLength),
        url: pageUrl,
        originalLength: semanticText.length,
        source: "semantic",
        rssUrl,
      };
    }
  } catch (error) {
    // Readability/fetch failed — continue to Jina fallback
    console.warn(
      `[fetchPage] Readability failed for ${pageUrl}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // ТЗ-WS2: Jina Reader as final fallback (only if not already tried via forceJina)
  if (!forceJina) {
    const jinaResult = await jinaReader(pageUrl);
    if (jinaResult && jinaResult.content.length > 0) {
      return {
        title: articleTitle || pageUrl,
        content: jinaResult.content.slice(0, maxLength),
        url: pageUrl,
        originalLength: jinaResult.content.length,
        source: "jina",
        rssUrl,
      };
    }
  }

  // Graceful degradation: return whatever partial content we have
  const bestText = readabilityText || semanticText;

  if (!bestText) {
    throw new Error("Could not extract content from page");
  }

  return {
    title: articleTitle || pageUrl,
    content: bestText.slice(0, maxLength),
    url: pageUrl,
    originalLength: bestText.length,
    source: readabilityText ? "readability" : "semantic",
    rssUrl,
  };
}
