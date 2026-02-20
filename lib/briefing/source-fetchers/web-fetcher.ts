// ТЗ-BR1 + ТЗ-WS1 + ТЗ-WS2: Web page fetcher — delegates to shared fetchPage() utility

import { fetchPage } from "@/lib/ai/tools/fetch-page";
import type { FetchPageOptions } from "@/lib/ai/tools/fetch-page";
import { FETCH_TIMEOUT_MS, MAX_CONTENT_LENGTH } from "../briefing-config";
import type { FetchResult, RawContent } from "./types";

/**
 * Fetches a web page and extracts readable content via shared fetchPage().
 * Used for sources without RSS feeds.
 *
 * ТЗ-WS1: Unified to use fetchPage() instead of duplicating Readability + JSDOM logic.
 * Inherits charset detection (windows-1251, koi8-r) and improved fallback from fetchPage().
 * ТЗ-WS2: Supports forceJina option for Jina Reader API sources.
 */
export async function fetchWeb(
  pageUrl: string,
  sourceName: string,
  sourceLanguage: string,
  options?: Pick<FetchPageOptions, "forceJina">,
): Promise<FetchResult> {
  const errors: string[] = [];
  const items: RawContent[] = [];

  try {
    const result = await fetchPage(pageUrl, {
      maxLength: MAX_CONTENT_LENGTH,
      timeoutMs: FETCH_TIMEOUT_MS,
      forceJina: options?.forceJina,
    });

    items.push({
      title: result.title || sourceName,
      url: result.url,
      content: result.content,
      sourceName,
      sourceLanguage,
    });
  } catch (err) {
    errors.push(
      `Web fetch failed [${sourceName}]: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { items, errors };
}
