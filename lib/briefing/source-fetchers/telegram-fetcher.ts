// ТЗ-BR1 → ТЗ-TG1: Telegram public channel fetcher (shared parser)

import { parseTelegramChannel } from "@/lib/telegram/parser";
import {
  FETCH_TIMEOUT_MS,
  FRESHNESS_HOURS,
  MAX_CONTENT_LENGTH,
} from "../briefing-config";
import type { FetchResult, RawContent } from "./types";

/**
 * Fetches posts from a public Telegram channel via shared parser.
 * Maps TelegramPost[] → RawContent[] preserving the FetchResult contract.
 */
export async function fetchTelegram(
  channelUrl: string,
  sourceName: string,
  sourceLanguage: string,
): Promise<FetchResult> {
  const errors: string[] = [];
  const items: RawContent[] = [];

  const cutoff = new Date(Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000);

  const result = await parseTelegramChannel(channelUrl, {
    timeout: FETCH_TIMEOUT_MS,
    freshnessDate: cutoff,
    maxContentLength: MAX_CONTENT_LENGTH,
    includeMediaOnly: false,
    followRedirects: true,
  });

  if (!result.isValid) {
    errors.push(
      `Telegram fetch failed [${sourceName}]: ${result.error ?? "unknown error"}`,
    );
    return { items, errors };
  }

  for (const post of result.posts) {
    if (!post.text) continue;

    // Title = first line or first 100 chars
    const firstLine = post.text.split("\n")[0].trim();
    const title =
      firstLine.length > 100 ? firstLine.slice(0, 100) + "..." : firstLine;

    items.push({
      title,
      url: post.url,
      content: post.text,
      publishedAt: post.date ? new Date(post.date) : undefined,
      sourceName,
      sourceLanguage,
    });
  }

  return { items, errors };
}
