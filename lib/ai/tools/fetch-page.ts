/**
 * ТЗ-FU + ТЗ-WS1: Shared utility for fetching and extracting web page content.
 *
 * Extracted from lib/briefing/source-fetchers/web-fetcher.ts to avoid
 * duplication between the briefing fetcher and the fetchUrl tool.
 * Uses Readability + JSDOM for clean text extraction.
 *
 * ТЗ-WS1: Added charset detection (windows-1251, koi8-r, etc.)
 * and improved fallback via JSDOM DOM API for semantic tags.
 */

import { Readability } from "@mozilla/readability";
import { detect } from "chardet";
import * as iconv from "iconv-lite";
import { JSDOM } from "jsdom";

export interface FetchPageResult {
  title: string;
  content: string;
  url: string;
  originalLength: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_LENGTH = 10_000;
const MIN_CONTENT_LENGTH = 200;

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
 * Fetch a URL and extract readable text via Readability + JSDOM.
 * Supports non-UTF-8 encodings (windows-1251, koi8-r, etc.).
 *
 * @param pageUrl - URL to fetch
 * @param maxLength - Max characters of extracted text (default 10 000)
 * @param timeoutMs - Fetch timeout in ms (default 15 000)
 * @returns Extracted page content or throws on failure
 */
export async function fetchPage(
  pageUrl: string,
  maxLength: number = DEFAULT_MAX_LENGTH,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<FetchPageResult> {
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
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const readabilityText = article?.textContent?.replace(/\s+/g, " ").trim();

  // If Readability extracted enough content — use it
  if (readabilityText && readabilityText.length >= MIN_CONTENT_LENGTH) {
    return {
      title: article?.title || pageUrl,
      content: readabilityText.slice(0, maxLength),
      url: pageUrl,
      originalLength: readabilityText.length,
    };
  }

  // ТЗ-WS1: Improved fallback — extract from semantic tags via JSDOM DOM API
  const semanticText = extractSemanticText(dom.window.document);

  if (semanticText.length >= MIN_CONTENT_LENGTH) {
    return {
      title: article?.title || pageUrl,
      content: semanticText.slice(0, maxLength),
      url: pageUrl,
      originalLength: semanticText.length,
    };
  }

  // Last resort: use whatever we have (Readability partial or semantic partial)
  const bestText = readabilityText || semanticText;

  if (!bestText) {
    throw new Error("Could not extract content from page");
  }

  return {
    title: article?.title || pageUrl,
    content: bestText.slice(0, maxLength),
    url: pageUrl,
    originalLength: bestText.length,
  };
}
