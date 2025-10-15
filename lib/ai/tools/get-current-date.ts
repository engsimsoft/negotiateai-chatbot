import { tool } from "ai";
import { z } from "zod";
import { wrapToolExecution } from "./tool-wrapper";

export const getCurrentDate = tool({
  description:
    "Get the current date and time. Returns the current date in ISO 8601 format with timezone information. Use this when you need to know today's date for context-aware responses.",
  inputSchema: z.object({
    // No input parameters needed
  }),
  execute: wrapToolExecution(
    {
      name: "getCurrentDate",
      timeout: 1000, // 1 second - this is a simple operation
      enableLogging: true,
    },
    async () => {
    const now = new Date();

    return {
      date: now.toISOString(),
      timestamp: now.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      formatted: {
        date: now.toLocaleDateString("ru-RU", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        time: now.toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        dateTime: now.toLocaleString("ru-RU", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    };
  }),
});
