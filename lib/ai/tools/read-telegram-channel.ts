/**
 * ТЗ-TG1: readTelegramChannel tool
 *
 * AI tool for reading public Telegram channels.
 * Wraps the shared parser (lib/telegram/parser.ts).
 */

import { tool } from "ai";
import { z } from "zod";
import { wrapToolExecution } from "./tool-wrapper";
import { parseTelegramChannel } from "@/lib/telegram/parser";

export const readTelegramChannel = tool({
  description: `Прочитать публичный Telegram-канал и получить последние посты.

Используй когда:
- Пользователь просит прочитать, проанализировать или проверить Telegram-канал
- Нужно узнать о чём пишет канал, последние новости, сравнить каналы
- Пользователь указывает @channel или ссылку t.me/channel

Принимает: имя канала (@durov, durov, t.me/durov — любой формат).
Возвращает: массив постов (text, date, url, hasMedia).`,

  inputSchema: z.object({
    channel: z
      .string()
      .describe("Telegram channel — @handle, handle, or t.me/handle URL"),
    maxPosts: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(50)
      .optional()
      .describe("Maximum number of posts to return (1-50, default 50)"),
  }),

  execute: wrapToolExecution(
    {
      name: "readTelegramChannel",
      timeout: 15000, // 15 seconds — network fetch + parsing
      enableLogging: true,
    },
    async ({ channel, maxPosts = 50 }) => {
      console.log("[readTelegramChannel] Fetching:", channel, { maxPosts });

      const result = await parseTelegramChannel(channel, {
        includeMediaOnly: true,
        followRedirects: false,
      });

      if (!result.isValid) {
        console.log("[readTelegramChannel] Invalid channel:", result.error);
        return {
          isValid: false,
          channel: result.channel,
          channelUrl: result.channelUrl,
          error: result.error,
        };
      }

      const posts = result.posts.slice(0, maxPosts);

      // Compute date range from available posts
      const datesWithValues = posts
        .map((p) => p.date)
        .filter((d): d is string => d !== null);

      const oldestDate = datesWithValues.length > 0
        ? datesWithValues[datesWithValues.length - 1]
        : null;
      const newestDate = datesWithValues.length > 0
        ? datesWithValues[0]
        : null;

      console.log("[readTelegramChannel] Success:", {
        channel: result.channel,
        totalFetched: result.posts.length,
        returned: posts.length,
        oldestDate,
        newestDate,
      });

      return {
        isValid: true,
        channel: result.channel,
        channelUrl: result.channelUrl,
        totalFetched: result.posts.length,
        posts,
        oldestDate,
        newestDate,
      };
    },
  ),
});
