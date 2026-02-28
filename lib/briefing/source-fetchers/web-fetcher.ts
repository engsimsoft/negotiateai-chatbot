// ТЗ-BR1 + ТЗ-WS1 + ТЗ-WS2 + ТЗ-DEV2: Web page fetcher with trace

import { fetchPage } from "@/lib/ai/tools/fetch-page";
import type { FetchPageOptions } from "@/lib/ai/tools/fetch-page";
import type { FetchTrace } from "@/lib/ai/pipeline-trace";
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
  const warnings: string[] = [];
  const startTime = Date.now();

  let fetchMethod: FetchTrace["method"] = "web";

  try {
    const result = await fetchPage(pageUrl, {
      maxLength: MAX_CONTENT_LENGTH,
      timeoutMs: FETCH_TIMEOUT_MS,
      forceJina: options?.forceJina,
    });

    // Track which extraction method succeeded
    fetchMethod = result.source;

    // publishedAt is not available from web fetcher
    warnings.push(`publishedAt not available for web source [${sourceName}]`);

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

  const durationMs = Date.now() - startTime;

  const trace: FetchTrace = {
    url: pageUrl,
    method: fetchMethod,
    durationMs,
    itemsExtracted: items.length,
    error: errors[0],
    warnings,
  };

  return { items, errors, trace };
}
