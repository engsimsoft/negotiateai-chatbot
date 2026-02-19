// ТЗ-BR1: RSS/Atom feed fetcher

import Parser from "rss-parser";
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

  try {
    const feed = await parser.parseURL(feedUrl);
    const cutoff = new Date(Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000);

    for (const entry of feed.items) {
      const publishedAt = entry.isoDate
        ? new Date(entry.isoDate)
        : entry.pubDate
          ? new Date(entry.pubDate)
          : undefined;

      // Skip old entries
      if (publishedAt && publishedAt < cutoff) {
        continue;
      }

      const title = entry.title?.trim();
      if (!title) continue;

      const url = entry.link?.trim();
      if (!url) continue;

      // Use content snippet or summary
      const rawContent =
        entry.contentSnippet || entry.content || entry.summary || "";
      const content = stripHtml(rawContent).slice(0, MAX_CONTENT_LENGTH);

      items.push({
        title,
        url,
        content,
        publishedAt,
        sourceName,
        sourceLanguage,
      });
    }
  } catch (err) {
    errors.push(
      `RSS fetch failed [${sourceName}]: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { items, errors };
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
