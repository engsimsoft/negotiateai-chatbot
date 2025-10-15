import { tool } from "ai";
import { z } from "zod";
import { wrapToolExecution } from "./tool-wrapper";

/**
 * Brave Search API Response Types
 * Docs: https://api.search.brave.com/app/documentation/web-search/get-started
 */
interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  page_age?: string;
  language?: string;
}

interface BraveSearchResponse {
  query: {
    original: string;
    show_strict_warning: boolean;
    altered?: string;
  };
  web?: {
    results: BraveSearchResult[];
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Web Search Tool using Brave Search API
 *
 * Allows Claude to search the web for current information, news, and facts.
 * Free tier: 2000 queries/month
 *
 * @example
 * // Search for current information
 * await webSearch({ query: "latest developments in AI", count: 5 });
 *
 * // Search for specific facts
 * await webSearch({ query: "population of Tokyo 2024" });
 */
export const webSearch = tool({
  description: `Search the web for current information, news, facts, and answers to questions.
Use this when you need up-to-date information that's not in your training data,
or when the user asks about current events, recent developments, or specific facts.
Returns a list of search results with titles, URLs, and descriptions.`,

  inputSchema: z.object({
    query: z.string().describe("The search query. Be specific and clear."),
    count: z.number().min(1).max(20).default(5).optional().describe("Number of results to return (1-20, default: 5)"),
  }),

  execute: wrapToolExecution(
    {
      name: "webSearch",
      timeout: 15000, // 15 seconds for web search
      enableLogging: true,
    },
    async ({ query, count = 5 }) => {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    // Debug logging - показываем первые 10 символов ключа
    console.log('[webSearch] Executing search:', {
      query,
      count,
      hasApiKey: !!apiKey,
      keyPreview: apiKey ? apiKey.substring(0, 15) + '...' : 'NO KEY'
    });

    if (!apiKey) {
      return {
        error: "Brave Search API key is not configured. Please set BRAVE_SEARCH_API_KEY in .env.local",
      };
    }

    try {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", count.toString());
      url.searchParams.set("country", "US"); // Country code
      url.searchParams.set("search_lang", "en"); // Search language
      url.searchParams.set("ui_lang", "en-US"); // UI language

      console.log('[webSearch] Fetching:', url.toString());

      const response = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
      });

      console.log('[webSearch] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          error: `Brave Search API error (${response.status}): ${errorText}`,
        };
      }

      const data: BraveSearchResponse = await response.json();

      // Check for API errors
      if (data.error) {
        return {
          error: `Brave Search error: ${data.error.message}`,
        };
      }

      // Check if we have results
      if (!data.web?.results || data.web.results.length === 0) {
        return {
          query: data.query.original,
          results: [],
          message: "No results found for this query.",
        };
      }

      // Format results for Claude
      const results = data.web.results.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.description,
        age: result.age || result.page_age,
      }));

      return {
        query: data.query.original,
        altered_query: data.query.altered, // If Brave modified the query
        results,
        count: results.length,
      };
    } catch (error) {
      return {
        error: `Failed to perform web search: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }),
});
