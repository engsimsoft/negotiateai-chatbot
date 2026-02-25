import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram/bot";

/**
 * ТЗ-TG3: Telegram webhook endpoint.
 * Receives all updates from Telegram Bot API.
 * Validates secret token via X-Telegram-Bot-Api-Secret-Token header.
 */
export const POST = webhookCallback(bot, "std/http", {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
});
