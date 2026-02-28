// ТЗ-BR1 + ТЗ-DEV2: RSS/Atom feed fetcher with trace instrumentation

import Parser from "rss-parser";
import type { FetchTrace } from "@/lib/ai/pipeline-trace";
import {
  FETCH_TIMEOUT_MS,
  FRESHNESS_HOURS,
  MAX_CONTENT_LENGTH,
} from "../briefing-config";
import type { FetchResult, RawContent } from "./types";

const parser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": "Simply-Briefing/1.0",
  },
});

export async function fetchRSS(
  feedUrl: string,
  sourceName: string,
  sourceLanguage: string,
): Promise<FetchResult> {
  const errors: string[] = [];
  const items: RawContent[] = [];
  const warnings: string[] = [];
  const startTime = Date.now();

  // Drop reason counters
  let totalEntries = 0;
  let droppedNoTitle = 0;
  let droppedNoUrl = 0;
  let droppedStale = 0;
  let droppedNoContent = 0;
  let droppedParseError = 0;

  try {
    const feed = await parser.parseURL(feedUrl);
    const cutoff = new Date(Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000);

    for (const entry of feed.items) {
      totalEntries++;
      try {
        const publishedAt = entry.isoDate
          ? new Date(entry.isoDate)
          : entry.pubDate
            ? new Date(entry.pubDate)
            : undefined;

        // Skip old entries
        if (publishedAt && publishedAt < cutoff) {
          droppedStale++;
          continue;
        }

        const title = entry.title?.trim();
        if (!title) {
          droppedNoTitle++;
          continue;
        }

        const url = entry.link?.trim();
        if (!url) {
          droppedNoUrl++;
          continue;
        }

        // Use content snippet or summary
        const rawContent =
          entry.contentSnippet || entry.content || entry.summary || "";
        const content = stripHtml(rawContent).slice(0, MAX_CONTENT_LENGTH);

        if (!content) {
          droppedNoContent++;
          continue;
        }

        items.push({
          title,
          url,
          content,
          publishedAt,
          sourceName,
          sourceLanguage,
        });
      } catch (entryErr) {
        droppedParseError++;
        warnings.push(
          `RSS entry parse error [${sourceName}]: ${entryErr instanceof Error ? entryErr.message : String(entryErr)}`,
        );
      }
    }
  } catch (err) {
    errors.push(
      `RSS fetch failed [${sourceName}]: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const durationMs = Date.now() - startTime;

  // Build drop reasons map (only include non-zero)
  const droppedReasons: Record<string, number> = {};
  if (droppedNoTitle) droppedReasons.no_title = droppedNoTitle;
  if (droppedNoUrl) droppedReasons.no_url = droppedNoUrl;
  if (droppedStale) droppedReasons.stale = droppedStale;
  if (droppedNoContent) droppedReasons.no_content = droppedNoContent;
  if (droppedParseError) droppedReasons.parse_error = droppedParseError;

  const trace: FetchTrace = {
    url: feedUrl,
    method: "rss",
    durationMs,
    itemsExtracted: items.length,
    error: errors[0],
    warnings,
    dataFlow: {
      inputCount: totalEntries,
      outputCount: items.length,
      droppedCount: totalEntries - items.length,
      droppedReasons: Object.keys(droppedReasons).length > 0 ? droppedReasons : undefined,
    },
  };

  return { items, errors, trace };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
