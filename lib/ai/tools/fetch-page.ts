/**
 * ТЗ-FU: Shared utility for fetching and extracting web page content.
 *
 * Extracted from lib/briefing/source-fetchers/web-fetcher.ts to avoid
 * duplication between the briefing fetcher and the fetchUrl tool.
 * Uses Readability + JSDOM for clean text extraction.
 */

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface FetchPageResult {
  title: string;
  content: string;
  url: string;
  originalLength: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_LENGTH = 10_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetch a URL and extract readable text via Readability + JSDOM.
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

  const html = await response.text();
  const dom = new JSDOM(html, { url: pageUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent) {
    // Fallback: strip HTML tags and return raw text
    const fallbackText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!fallbackText) {
      throw new Error("Could not extract content from page");
    }

    return {
      title: pageUrl,
      content: fallbackText.slice(0, maxLength),
      url: pageUrl,
      originalLength: fallbackText.length,
    };
  }

  const cleanText = article.textContent.replace(/\s+/g, " ").trim();

  return {
    title: article.title || pageUrl,
    content: cleanText.slice(0, maxLength),
    url: pageUrl,
    originalLength: cleanText.length,
  };
}
