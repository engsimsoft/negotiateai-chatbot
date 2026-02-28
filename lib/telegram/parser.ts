// TZ-TG1: Shared Telegram channel parser

import * as cheerio from "cheerio";
import type {
  TelegramParseResult,
  TelegramPost,
  ParseTelegramOptions,
} from "./types";
import { normalizeChannelUrl, extractChannelHandle } from "./utils";

const DEFAULT_TIMEOUT = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Cheerio selectors indicating media content in a Telegram post */
const MEDIA_SELECTORS = [
  ".tgme_widget_message_photo",
  ".tgme_widget_message_video",
  ".tgme_widget_message_document",
  ".tgme_widget_message_sticker",
  ".tgme_widget_message_voice",
];

/**
 * Parse a public Telegram channel and return structured posts.
 *
 * Fetches HTML from t.me/s/{channel} and extracts posts with cheerio.
 * Supports configurable freshness filter, content truncation, media-only inclusion,
 * and redirect behavior.
 */
export async function parseTelegramChannel(
  channelInput: string,
  options: ParseTelegramOptions = {},
): Promise<TelegramParseResult> {
  const {
    timeout = DEFAULT_TIMEOUT,
    freshnessDate,
    maxContentLength,
    includeMediaOnly = true,
    followRedirects = false,
  } = options;

  const channel = extractChannelHandle(channelInput);
  const channelUrl = `https://t.me/${channel}`;
  const fetchUrl = normalizeChannelUrl(channelInput);

  try {
    const response = await fetch(fetchUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeout),
      redirect: followRedirects ? "follow" : "manual",
    });

    // 302/301 redirect with manual mode = private or non-existent channel
    if (!followRedirects && (response.status === 302 || response.status === 301)) {
      return {
        channel,
        channelUrl,
        isValid: false,
        posts: [],
        error: `Канал @${channel} приватный или не существует`,
      };
    }

    if (!response.ok) {
      return {
        channel,
        channelUrl,
        isValid: false,
        posts: [],
        error: `Не удалось загрузить канал @${channel}: HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const messageWraps = $(".tgme_widget_message_wrap");

    if (messageWraps.length === 0) {
      return {
        channel,
        channelUrl,
        isValid: false,
        posts: [],
        error: `Канал @${channel} не имеет видимых постов (возможно приватный или пустой)`,
      };
    }

    const posts: TelegramPost[] = [];
    const warnings: string[] = [];

    messageWraps.each((_, el) => {
      try {
        const $msg = $(el);
        const $text = $msg.find(".tgme_widget_message_text");
        const rawText = $text.length ? $text.text().trim() : "";

        // Detect media
        const hasMedia = MEDIA_SELECTORS.some(
          (sel) => $msg.find(sel).length > 0,
        );

        // Skip media-only posts if not wanted
        if (!rawText && !includeMediaOnly) return;

        // Extract date
        const $time = $msg.find("time[datetime]");
        const datetime = $time.attr("datetime") || null;

        // Freshness filter
        if (freshnessDate && datetime) {
          const postDate = new Date(datetime);
          if (postDate < freshnessDate) return;
        }

        // Post URL from data-post attribute
        const postId = $msg
          .find(".tgme_widget_message")
          .attr("data-post");
        const url = postId ? `https://t.me/${postId}` : channelUrl;

        // Truncate text if needed
        const text = maxContentLength
          ? rawText.slice(0, maxContentLength)
          : rawText;

        posts.push({ text, date: datetime, url, hasMedia });
      } catch (e) {
        // ТЗ-DEV2: surface per-post parse errors instead of silently swallowing
        warnings.push(`Malformed post in @${channel}: ${e instanceof Error ? e.message : String(e)}`);
      }
    });

    return {
      channel,
      channelUrl,
      isValid: true,
      posts,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    return {
      channel,
      channelUrl,
      isValid: false,
      posts: [],
      error: `Ошибка загрузки @${channel}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
