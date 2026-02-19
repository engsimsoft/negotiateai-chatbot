// ТЗ-BR1: Source fetcher dispatcher

import { fetchRSS } from "./rss-fetcher";
import { fetchTelegram } from "./telegram-fetcher";
import type { FetchResult } from "./types";
import { fetchWeb } from "./web-fetcher";

export type { FetchResult, RawContent } from "./types";

interface SourceInfo {
  fetchMethod: "rss" | "jina" | "telegram_parse";
  /** RSS URL (for rss method) or page URL */
  url: string;
  /** Fallback URL if rss field is separate */
  rssUrl?: string;
  sourceName: string;
  sourceLanguage: string;
}

/**
 * Dispatches to the correct fetcher based on fetchMethod.
 * For 'rss' — uses rssUrl if available, otherwise url.
 * For 'jina' — uses web fetcher (Readability + JSDOM).
 * For 'telegram_parse' — uses Telegram web preview parser.
 */
export async function fetchSource(source: SourceInfo): Promise<FetchResult> {
  switch (source.fetchMethod) {
    case "rss": {
      const feedUrl = source.rssUrl || source.url;
      return fetchRSS(feedUrl, source.sourceName, source.sourceLanguage);
    }
    case "telegram_parse":
      return fetchTelegram(
        source.url,
        source.sourceName,
        source.sourceLanguage,
      );
    case "jina":
      return fetchWeb(source.url, source.sourceName, source.sourceLanguage);
    default:
      return {
        items: [],
        errors: [
          `Unknown fetchMethod "${source.fetchMethod}" for ${source.sourceName}`,
        ],
      };
  }
}
