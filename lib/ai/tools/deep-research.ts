/**
 * ТЗ-PX: deepResearch tool
 *
 * Deep research via Perplexity Sonar API. Two depth modes:
 * - "pro" (sonar-pro): fast multi-step search, 5-15 sec, ~$0.02/req
 * - "deep" (sonar-deep-research): exhaustive research, 30-120 sec, ~$0.80/req
 *
 * API is OpenAI Chat Completions compatible.
 */

import { tool } from "ai";
import { z } from "zod";
import { wrapToolExecution } from "./tool-wrapper";

type ResearchDepth = "pro" | "deep";

const PERPLEXITY_MODELS: Record<ResearchDepth, string> = {
  pro: "sonar-pro",
  deep: "sonar-deep-research",
};

const PERPLEXITY_TIMEOUTS: Record<ResearchDepth, number> = {
  pro: 30_000, // 30 sec
  deep: 180_000, // 3 min
};

interface PerplexityCitation {
  url: string;
  title?: string;
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  search_results?: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    search_queries?: number;
    cost?: number;
  };
}

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
        const apiKey = process.env.PERPLEXITY_API_KEY;

        // defaultDepth from client UI overrides model choice
        const depth: ResearchDepth = defaultDepth ?? modelDepth;
        const model = PERPLEXITY_MODELS[depth];
        const timeoutMs = PERPLEXITY_TIMEOUTS[depth];

        console.log("[deepResearch] Starting:", {
          query,
          depth,
          model,
          timeoutMs,
          hasApiKey: !!apiKey,
          keyPreview: apiKey ? apiKey.substring(0, 15) + "..." : "NO KEY",
          overriddenByClient: !!defaultDepth,
        });

        if (!apiKey) {
          return {
            error:
              "Perplexity API key is not configured. Please set PERPLEXITY_API_KEY in .env.local",
          };
        }

        try {
          // Auto-detect language
          const hasCyrillic = /[а-яА-ЯёЁ]/.test(query);
          const systemPrompt = hasCyrillic
            ? "Отвечай на русском языке. Будь точным и структурированным."
            : "Be precise and well-structured.";

          const response = await fetch(
            "https://api.perplexity.ai/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: query },
                ],
              }),
              signal: AbortSignal.timeout(timeoutMs),
            },
          );

          console.log("[deepResearch] Response status:", response.status);

          if (!response.ok) {
            const errorText = await response.text();
            return {
              error: `Perplexity API error (${response.status}): ${errorText}`,
            };
          }

          const data: PerplexityResponse = await response.json();

          const content = data.choices?.[0]?.message?.content;
          if (!content) {
            return { error: "Perplexity returned empty response" };
          }

          // Build citations list from citations array or search_results
          const citations: PerplexityCitation[] = [];
          if (data.citations) {
            for (const url of data.citations) {
              // Try to find title from search_results
              const sr = data.search_results?.find((r) => r.url === url);
              citations.push({ url, title: sr?.title });
            }
          } else if (data.search_results) {
            for (const sr of data.search_results) {
              citations.push({ url: sr.url, title: sr.title });
            }
          }

          console.log("[deepResearch] Success:", {
            depth,
            model,
            contentLength: content.length,
            citationsCount: citations.length,
            usage: data.usage,
          });

          return {
            query,
            depth,
            content,
            citations,
            citationsCount: citations.length,
            usage: data.usage
              ? {
                  totalTokens: data.usage.total_tokens,
                  searchQueries: data.usage.search_queries,
                }
              : undefined,
          };
        } catch (error) {
          return {
            error: `Deep research failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            query,
            depth,
          };
        }
      },
    ),
  });
