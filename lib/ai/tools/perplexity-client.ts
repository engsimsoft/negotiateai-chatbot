/**
 * ТЗ-FIX2: Shared Perplexity API client
 *
 * Extracted from deep-research.ts to be reusable by research-engine.
 * OpenAI Chat Completions compatible API.
 */

export type PerplexityModel = "sonar-pro" | "sonar-deep-research";

export interface PerplexityCitation {
  url: string;
  title?: string;
}

export interface PerplexityResponse {
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

export interface PerplexityCallOptions {
  query: string;
  model?: PerplexityModel;
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface PerplexityCallResult {
  content: string;
  citations: PerplexityCitation[];
  usage?: {
    totalTokens: number;
    searchQueries?: number;
  };
}

const DEFAULT_MODEL: PerplexityModel = "sonar-pro";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Call Perplexity API and return content + citations.
 * Throws on network/API errors.
 */
export async function callPerplexity(
  options: PerplexityCallOptions,
): Promise<PerplexityCallResult> {
  const {
    query,
    model = DEFAULT_MODEL,
    systemPrompt,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Perplexity API key is not configured. Please set PERPLEXITY_API_KEY in .env.local",
    );
  }

  // Auto-detect language if no system prompt provided
  const hasCyrillic = /[а-яА-ЯёЁ]/.test(query);
  const sysPrompt =
    systemPrompt ??
    (hasCyrillic
      ? "Отвечай на русском языке. Будь точным и структурированным."
      : "Be precise and well-structured.");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: query },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Perplexity API error (${response.status}): ${errorText}`,
    );
  }

  const data: PerplexityResponse = await response.json();

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Perplexity returned empty response");
  }

  // Build citations list from citations array or search_results
  const citations: PerplexityCitation[] = [];
  if (data.citations) {
    for (const url of data.citations) {
      const sr = data.search_results?.find((r) => r.url === url);
      citations.push({ url, title: sr?.title });
    }
  } else if (data.search_results) {
    for (const sr of data.search_results) {
      citations.push({ url: sr.url, title: sr.title });
    }
  }

  return {
    content,
    citations,
    usage: data.usage
      ? {
          totalTokens: data.usage.total_tokens,
          searchQueries: data.usage.search_queries,
        }
      : undefined,
  };
}
