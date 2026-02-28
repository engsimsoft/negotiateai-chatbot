// ТЗ-BR1 → ТЗ-TG1 + ТЗ-DEV2: Telegram public channel fetcher with trace

import { parseTelegramChannel } from "@/lib/telegram/parser";
import type { FetchTrace } from "@/lib/ai/pipeline-trace";
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
  const warnings: string[] = [];
  const startTime = Date.now();

  const cutoff = new Date(Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000);

  const result = await parseTelegramChannel(channelUrl, {
    timeout: FETCH_TIMEOUT_MS,
    freshnessDate: cutoff,
    maxContentLength: MAX_CONTENT_LENGTH,
    includeMediaOnly: false,
    followRedirects: true,
  });

  // Collect parser-level warnings
  if (result.warnings) {
    warnings.push(...result.warnings);
  }

  if (!result.isValid) {
    errors.push(
      `Telegram fetch failed [${sourceName}]: ${result.error ?? "unknown error"}`,
    );

    const durationMs = Date.now() - startTime;
    const trace: FetchTrace = {
      url: channelUrl,
      method: "telegram",
      durationMs,
      itemsExtracted: 0,
      error: errors[0],
      warnings,
    };

    return { items, errors, trace };
  }

  // Count stats for trace
  let mediaSkipped = 0;
  let missingText = 0;

  for (const post of result.posts) {
    if (!post.text) {
      missingText++;
      continue;
    }

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

  // Count media-only posts (posts with media but no text — already excluded by includeMediaOnly: false)
  mediaSkipped = result.posts.filter((p) => !p.text && p.hasMedia).length;

  const durationMs = Date.now() - startTime;

  const droppedReasons: Record<string, number> = {};
  if (missingText) droppedReasons.missing_text = missingText;
  if (mediaSkipped) droppedReasons.media_only = mediaSkipped;

  const trace: FetchTrace = {
    url: channelUrl,
    method: "telegram",
    durationMs,
    itemsExtracted: items.length,
    warnings,
    dataFlow: {
      inputCount: result.posts.length,
      outputCount: items.length,
      droppedCount: result.posts.length - items.length,
      droppedReasons: Object.keys(droppedReasons).length > 0 ? droppedReasons : undefined,
    },
  };

  return { items, errors, trace };
}
