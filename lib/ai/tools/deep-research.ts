/**
 * ТЗ-PX: deepResearch tool
 *
 * Deep research via Perplexity Sonar API. Two depth modes:
 * - "pro" (sonar-pro): fast multi-step search, 5-15 sec, ~$0.02/req
 * - "deep" (sonar-deep-research): exhaustive research, 30-120 sec, ~$0.80/req
 *
 * ТЗ-FIX2: Uses shared perplexity-client for API calls.
 */

import { tool } from "ai";
import { z } from "zod";

import {
  callPerplexity,
  type PerplexityModel,
} from "./perplexity-client";
import { wrapToolExecution } from "./tool-wrapper";

type ResearchDepth = "pro" | "deep";

const PERPLEXITY_MODELS: Record<ResearchDepth, PerplexityModel> = {
  pro: "sonar-pro",
  deep: "sonar-deep-research",
};

const PERPLEXITY_TIMEOUTS: Record<ResearchDepth, number> = {
  pro: 30_000, // 30 sec
  deep: 180_000, // 3 min
};

/**
 * Build the deepResearch tool.
 *
 * Factory pattern: accepts optional defaultDepth override from the client
 * (dev-mode UI switcher). When provided, the tool uses it instead of letting
 * the model pick depth via inputSchema.
 */
export const deepResearch = ({ defaultDepth }: { defaultDepth?: ResearchDepth } = {}) =>
  tool({
    description: `Глубокое исследование темы через Perplexity. Используй вместо webSearch когда:
- Нужен мультишаговый анализ (не один факт, а картина целиком)
- Тема требует синтеза из множества источников
- Пользователь просит "исследовать", "проанализировать рынок", "сравнить варианты"
- Простой поиск не даст достаточно глубокого ответа

НЕ используй для: простых фактов, погоды, курсов валют, быстрых справок — для этого webSearch.

Параметр depth:
- "pro" — быстрый мультишаговый поиск (5-15 сек). По умолчанию.
- "deep" — исчерпывающее исследование (30-120 сек). Только когда пользователь явно просит глубокий анализ или тема нишевая/сложная.

Результат deepResearch включает источники. Оформляй их:
- Ключевые выводы — своими словами, не копируй текст Perplexity дословно
- Источники — списком в конце: [1] Название — URL
- Если источник сомнительный — отмечай это`,

    inputSchema: z.object({
      query: z.string().describe("Research query — what to investigate"),
      depth: z
        .enum(["pro", "deep"])
        .default("pro")
        .optional()
        .describe(
          '"pro" — fast multi-step search (default). "deep" — exhaustive research (30-120 sec).',
        ),
    }),

    execute: wrapToolExecution(
      {
        name: "deepResearch",
        // Use max timeout; actual per-request timeout is handled via AbortSignal
        timeout: 190_000,
        enableLogging: true,
      },
      async ({ query, depth: modelDepth = "pro" }) => {
        // defaultDepth from client UI overrides model choice
        const depth: ResearchDepth = defaultDepth ?? modelDepth;
        const model = PERPLEXITY_MODELS[depth];
        const timeoutMs = PERPLEXITY_TIMEOUTS[depth];

        console.log("[deepResearch] Starting:", {
          query,
          depth,
          model,
          timeoutMs,
          hasApiKey: !!process.env.PERPLEXITY_API_KEY,
          overriddenByClient: !!defaultDepth,
        });

        try {
          const result = await callPerplexity({
            query,
            model,
            timeoutMs,
          });

          console.log("[deepResearch] Success:", {
            depth,
            model,
            contentLength: result.content.length,
            citationsCount: result.citations.length,
            usage: result.usage,
          });

          return {
            query,
            depth,
            content: result.content,
            citations: result.citations,
            citationsCount: result.citations.length,
            usage: result.usage,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";

          // Match original error format for backward compatibility
          if (message.includes("API key is not configured")) {
            return { error: message };
          }

          return {
            error: `Deep research failed: ${message}`,
            query,
            depth,
          };
        }
      },
    ),
  });
