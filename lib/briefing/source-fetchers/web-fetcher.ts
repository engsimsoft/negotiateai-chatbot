// ТЗ-BR1: Web page fetcher using Readability + JSDOM

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { FETCH_TIMEOUT_MS, MAX_CONTENT_LENGTH } from "../briefing-config";
import type { FetchResult, RawContent } from "./types";

/**
 * Fetches a web page and extracts readable content via Readability + JSDOM.
 * Used for sources without RSS feeds.
 */
export async function fetchWeb(
  pageUrl: string,
  sourceName: string,
  sourceLanguage: string,
): Promise<FetchResult> {
  const errors: string[] = [];
  const items: RawContent[] = [];

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      errors.push(
        `Web fetch failed [${sourceName}]: HTTP ${response.status}`,
      );
      return { items, errors };
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: pageUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article && article.textContent) {
      const content = article.textContent
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_CONTENT_LENGTH);

      items.push({
        title: article.title || sourceName,
        url: pageUrl,
        content,
        sourceName,
        sourceLanguage,
      });
    } else {
      errors.push(
        `Web fetch [${sourceName}]: Readability could not extract content`,
      );
    }
  } catch (err) {
    errors.push(
      `Web fetch failed [${sourceName}]: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { items, errors };
}
