/**
 * ТЗ-FU: fetchUrl tool
 *
 * Fetches a web page and returns clean extracted text.
 * Uses Readability + JSDOM via shared utility (fetch-page.ts).
 * The AI model analyses the returned text itself — no separate analyzeWebsite tool needed.
 */

import { tool } from "ai";
import { z } from "zod";
import { wrapToolExecution } from "./tool-wrapper";
import { fetchPage } from "./fetch-page";

export const fetchUrl = tool({
  description: `Загрузить и прочитать содержимое веб-страницы по URL. Возвращает очищенный текст страницы.

Используй когда:
- Пользователь даёт ссылку и просит проанализировать
- Нужно проверить конкретный источник (живой? качественный? оригинальный контент или перепечатка?)
- deepResearch нашёл источник и нужно убедиться в его качестве

НЕ используй для: поиска информации (для этого webSearch или deepResearch).`,

  inputSchema: z.object({
    url: z.string().url().describe("Full URL of the page to fetch"),
    maxLength: z
      .number()
      .min(1000)
      .max(50000)
      .default(10000)
      .optional()
      .describe("Max characters of extracted text (default 10000)"),
  }),

  execute: wrapToolExecution(
    {
      name: "fetchUrl",
      timeout: 20000, // 20 seconds
      enableLogging: true,
    },
    async ({ url, maxLength = 10000 }) => {
      console.log("[fetchUrl] Fetching:", url, { maxLength });

      try {
        const result = await fetchPage(url, maxLength);

        console.log("[fetchUrl] Success:", {
          title: result.title,
          contentLength: result.content.length,
          originalLength: result.originalLength,
          truncated: result.originalLength > maxLength,
        });

        return {
          url: result.url,
          title: result.title,
          content: result.content,
          originalLength: result.originalLength,
          truncated: result.originalLength > maxLength,
        };
      } catch (error) {
        return {
          error: `Failed to fetch page: ${error instanceof Error ? error.message : "Unknown error"}`,
          url,
        };
      }
    },
  ),
});
