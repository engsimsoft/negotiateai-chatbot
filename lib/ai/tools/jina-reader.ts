/**
 * ТЗ-WS2: Jina Reader API utility.
 *
 * Fetches a web page via Jina Reader (headless Chrome on Jina's side),
 * returns clean markdown. Used as fallback when Readability fails.
 *
 * API: GET https://r.jina.ai/{raw_url}
 * Docs: https://jina.ai/reader/
 */

import { JINA_READER_TIMEOUT } from "@/lib/briefing/briefing-config";

export interface JinaReaderResult {
  content: string;
  url: string;
}

let warnedNoKey = false;

/**
 * Fetch a web page via Jina Reader API.
 *
 * @param pageUrl - URL to fetch (appended raw after r.jina.ai/)
 * @returns Extracted content or null on failure
 */
export async function jinaReader(
  pageUrl: string,
): Promise<JinaReaderResult | null> {
  const apiKey = process.env.JINA_API_KEY;

  if (!apiKey && !warnedNoKey) {
    console.warn(
      "[Jina Reader] WARNING: JINA_API_KEY not set, using free tier (20 RPM limit)",
    );
    warnedNoKey = true;
  }

  const headers: Record<string, string> = {
    Accept: "text/markdown",
    "X-Return-Format": "markdown",
    "X-Remove-Selector": "nav, footer, .sidebar, .ads, .cookie-banner",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(`https://r.jina.ai/${pageUrl}`, {
      headers,
      signal: AbortSignal.timeout(JINA_READER_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error(
          `[Jina Reader] RATE LIMIT: url=${pageUrl} status=429`,
        );
      } else if (response.status === 402) {
        console.error(`[Jina Reader] QUOTA EXCEEDED: url=${pageUrl}`);
      } else {
        console.error(
          `[Jina Reader] HTTP error: url=${pageUrl} status=${response.status} ${response.statusText}`,
        );
      }
      return null;
    }

    const content = await response.text();

    console.log(
      `[Jina Reader] url=${pageUrl} status=${response.status} contentLength=${content.length}`,
    );

    if (!content || content.trim().length === 0) {
      console.warn(`[Jina Reader] Empty response: url=${pageUrl}`);
      return null;
    }

    return { content: content.trim(), url: pageUrl };
  } catch (error) {
    console.error(
      `[Jina Reader] Failed: url=${pageUrl} error=${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
