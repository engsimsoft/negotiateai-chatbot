// ТЗ-BR1: Telegram public channel fetcher (t.me/s/{channel})

import * as cheerio from "cheerio";
import {
  FETCH_TIMEOUT_MS,
  FRESHNESS_HOURS,
  MAX_CONTENT_LENGTH,
} from "../briefing-config";
import type { FetchResult, RawContent } from "./types";

/**
 * Fetches posts from a public Telegram channel via its web preview.
 * URL format: https://t.me/s/{channel}
 */
export async function fetchTelegram(
  channelUrl: string,
  sourceName: string,
  sourceLanguage: string,
): Promise<FetchResult> {
  const errors: string[] = [];
  const items: RawContent[] = [];

  try {
    // Normalize URL: @channel → https://t.me/s/channel
    const url = normalizeChannelUrl(channelUrl);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      errors.push(
        `Telegram fetch failed [${sourceName}]: HTTP ${response.status}`,
      );
      return { items, errors };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cutoff = new Date(Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000);

    $(".tgme_widget_message_wrap").each((_, el) => {
      try {
        const $msg = $(el);
        const $text = $msg.find(".tgme_widget_message_text");
        if (!$text.length) return;

        // Extract post date
        const $time = $msg.find("time[datetime]");
        const datetime = $time.attr("datetime");
        const publishedAt = datetime ? new Date(datetime) : undefined;

        // Skip old posts
        if (publishedAt && publishedAt < cutoff) return;

        const rawText = $text.text().trim();
        if (!rawText) return;

        // Title = first line or first 100 chars
        const firstLine = rawText.split("\n")[0].trim();
        const title =
          firstLine.length > 100 ? firstLine.slice(0, 100) + "..." : firstLine;

        const content = rawText.slice(0, MAX_CONTENT_LENGTH);

        // Post URL from data-post attribute
        const postId = $msg
          .find(".tgme_widget_message")
          .attr("data-post");
        const postUrl = postId
          ? `https://t.me/${postId}`
          : url;

        items.push({
          title,
          url: postUrl,
          content,
          publishedAt,
          sourceName,
          sourceLanguage,
        });
      } catch {
        // Skip malformed posts
      }
    });
  } catch (err) {
    errors.push(
      `Telegram fetch failed [${sourceName}]: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { items, errors };
}

function normalizeChannelUrl(input: string): string {
  // @channel → https://t.me/s/channel
  if (input.startsWith("@")) {
    return `https://t.me/s/${input.slice(1)}`;
  }
  // https://t.me/channel → https://t.me/s/channel
  if (input.includes("t.me/") && !input.includes("t.me/s/")) {
    return input.replace("t.me/", "t.me/s/");
  }
  return input;
}
