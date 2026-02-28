// ТЗ-TG4b: Deliver briefing to Telegram via @GetSimplyBot
// Formats BriefingArticle as a short digest + inline buttons, sends via grammY bot API.

import { bot } from "@/lib/telegram/bot";
import {
  getTelegramConnection,
  getBriefingHistory,
  getBriefingSettings,
  updateBriefingDeliveryStatus,
} from "@/lib/db/queries";
import type {
  BriefingArticle,
  BriefingArticleSection,
} from "@/lib/briefing/briefing-types";
import { InlineKeyboard } from "grammy";

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://negotiateai-chatbot.vercel.app"
).trim();

/** Max sections in Telegram digest (PE contract: 5-7 key points) */
const MAX_SECTIONS = 7;

/** Telegram text message limit */
const MAX_MESSAGE_LENGTH = 4096;

// ============================================================================
// Public API
// ============================================================================

export async function deliverBriefingToTelegram({
  userId,
  briefingId,
  deliveryFormat,
  mergedAudioUrl,
}: {
  userId: string;
  briefingId: string;
  deliveryFormat: "text" | "audio" | "text_audio";
  mergedAudioUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  // 1. Check Telegram connection
  const connection = await getTelegramConnection({ userId });

  if (!connection || !connection.isActive) {
    return { success: false, error: "no_connection" };
  }

  const chatId = connection.telegramUserId;

  // 2. Load briefing
  const [briefing] = await getBriefingHistory({
    userId,
    limit: 1,
    status: "ready",
  });

  if (!briefing || briefing.id !== briefingId) {
    return { success: false, error: "briefing_not_found" };
  }

  const article = briefing.briefingJson as BriefingArticle;

  if (!article?.sections?.length) {
    return { success: false, error: "empty_briefing" };
  }

  // 3. Get timezone for date formatting
  const settings = await getBriefingSettings({ userId });
  const timezone = settings?.timezone || "Europe/Moscow";

  const hasAudio =
    briefing.audioStatus === "ready" &&
    briefing.audioUrls &&
    Object.values(briefing.audioUrls as Record<string, string>).length > 0;

  const wantsText =
    deliveryFormat === "text" || deliveryFormat === "text_audio";
  const wantsAudio =
    deliveryFormat === "audio" || deliveryFormat === "text_audio";

  // 4. Send text digest (for "text" and "text_audio" formats)
  if (wantsText) {
    try {
      const html = formatBriefingMessage(article, timezone);
      const keyboard = new InlineKeyboard()
        .url("Читать полностью", `${APP_URL}/briefing`)
        .url("⚙️ Настроить", `${APP_URL}/briefing/setup`);

      await bot.api.sendMessage(chatId, html, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch (err) {
      const errorMsg = classifyTelegramError(err);
      console.error(
        `[briefing-delivery] User ${userId}: sendMessage failed:`,
        err,
      );
      await updateBriefingDeliveryStatus({
        briefingId,
        deliveryStatus: "failed",
      });
      return { success: false, error: errorMsg };
    }
  }

  // 5. Send audio (for "audio" and "text_audio" formats)
  if (wantsAudio) {
    // Prefer merged combined MP3, fallback to first individual track
    const audioUrl =
      mergedAudioUrl ||
      (hasAudio
        ? Object.values(briefing.audioUrls as Record<string, string>)[0]
        : undefined);

    if (audioUrl) {
      try {
        const audioDurations =
          (briefing.audioDurations as Record<string, number>) || {};
        const totalMinutes = Math.round(
          Object.values(audioDurations).reduce((sum, s) => sum + s, 0) / 60,
        );
        const caption = `🎧 Аудио-версия · ${totalMinutes || "~5"} мин`;

        await bot.api.sendAudio(chatId, audioUrl, {
          caption,
          title: `Подкаст: Брифинг за ${formatShortDate(timezone)}`,
        });
      } catch (err) {
        console.error(
          `[briefing-delivery] User ${userId}: sendAudio failed:`,
          err,
        );
        if (deliveryFormat === "audio") {
          await updateBriefingDeliveryStatus({
            briefingId,
            deliveryStatus: "failed",
          });
          return { success: false, error: "audio_send_failed" };
        }
      }
    } else if (deliveryFormat === "audio") {
      // Audio-only but no podcast ready — this is an error
      await updateBriefingDeliveryStatus({
        briefingId,
        deliveryStatus: "failed",
      });
      return { success: false, error: "podcast_not_ready" };
    }
  }

  // 7. Mark as sent
  await updateBriefingDeliveryStatus({ briefingId, deliveryStatus: "sent" });

  return { success: true };
}

// ============================================================================
// Message formatting
// ============================================================================

/**
 * Format BriefingArticle as Telegram HTML digest.
 * Style: PE contract "telegram-bot-messages" — calm, laconic, no greetings.
 * Structure: header + 5-7 key points (emoji + first sentence per section).
 */
export function formatBriefingMessage(
  article: BriefingArticle,
  timezone: string,
): string {
  const dateStr = formatLocalDate(timezone);
  const header = `<b>Брифинг · ${dateStr}</b>`;

  const sections = article.sections.slice(0, MAX_SECTIONS);
  const points = sections.map((s) => formatSectionPoint(s));

  let message = `${header}\n\n${points.join("\n\n")}`;

  // Truncate to Telegram limit (should never happen with 7 sections, but safety net)
  if (message.length > MAX_MESSAGE_LENGTH) {
    message = message.slice(0, MAX_MESSAGE_LENGTH - 3) + "...";
  }

  return message;
}

/**
 * Format a single section as a digest point.
 * Pattern: "{emoji} {first 1-2 sentences of content}"
 */
function formatSectionPoint(section: BriefingArticleSection): string {
  const sentence = extractFirstSentences(section.content, 2);
  return `${section.emoji} ${escapeHtml(sentence)}`;
}

/**
 * Extract first N sentences from markdown content.
 * Strips markdown formatting, keeps plain text.
 */
function extractFirstSentences(content: string, count: number): string {
  // Strip markdown: headers, bold, italic, links, lists
  const plain = content
    .replace(/^#{1,6}\s+/gm, "") // headers
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .replace(/^[-*]\s+/gm, "") // list items
    .replace(/\n+/g, " ") // newlines → spaces
    .trim();

  // Split by sentence-ending punctuation (Russian + English)
  const sentences = plain.match(/[^.!?]+[.!?]+/g);

  if (!sentences || sentences.length === 0) {
    // No clear sentences — take first 200 chars
    return plain.slice(0, 200).trim();
  }

  return sentences
    .slice(0, count)
    .map((s) => s.trim())
    .join(" ");
}

// ============================================================================
// Date formatting
// ============================================================================

/** "четверг, 27 февраля" — in user's timezone */
function formatLocalDate(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    });
    return formatter.format(now);
  } catch {
    // Fallback to Moscow
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Moscow",
    });
    return formatter.format(new Date());
  }
}

/** "27 февраля" — short date for audio title */
function formatShortDate(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      timeZone: timezone,
    });
    return formatter.format(now);
  } catch {
    return new Date().toLocaleDateString("ru-RU");
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Escape HTML special chars for Telegram HTML parse mode */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Classify grammY/Telegram API errors */
function classifyTelegramError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  // 403 Forbidden — user blocked the bot
  if (message.includes("403") || message.includes("Forbidden")) {
    return "blocked";
  }

  // 5xx or network errors
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNREFUSED")
  ) {
    return "telegram_unavailable";
  }

  return `send_failed: ${message.slice(0, 100)}`;
}
