import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

/**
 * AI Provider Configuration
 *
 * Источник правды: docs/ai-providers.md
 *
 * Supported providers:
 * 1. Google Gemini (primary)
 *    - gemini-3-pro — профессиональные задачи, dynamic thinking
 *    - gemini-2.5-flash — простые задачи, быстрый ответ
 *
 * 2. Anthropic Claude 4.5 via OpenRouter
 *    - claude-sonnet-4.5 — баланс скорости и качества, 1M контекст
 *    - claude-opus-4.5 — максимальное качество, reasoning
 *    - claude-haiku-4.5 — быстрый и дешёвый
 */

// Initialize Google provider
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Initialize OpenRouter provider (for Claude models)
const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          // Primary model IDs (используются во всём проекте)
          "auto": chatModel,               // Default fallback (не используется напрямую, только UI)
          "gemini-3-pro": chatModel,       // Professional agents
          "gemini-2.5-flash": chatModel,   // Casual agents

          // Internal use only (не показываются в UI)
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        // Primary model IDs (используются во всём проекте)
        "auto": google("gemini-2.5-flash"),                   // Default fallback (не используется напрямую, только UI)
        "gemini-3-pro": google("gemini-3-pro-preview"),       // Professional agents (Marketer, Copywriter, Translator, Mentor)
        "gemini-2.5-flash": google("gemini-2.5-flash"),       // Casual agents (Cook, Astrologer, Universal, Odessit)

        // Internal use only (не показываются в UI, используются внутри)
        "title-model": google("gemini-2.5-flash"),            // Генерация заголовков чатов
        "artifact-model": google("gemini-2.5-pro"),           // Генерация suggestions для артефактов
      },
    });

/**
 * OpenRouter models (Claude 4.5 via OpenRouter)
 *
 * Use directly with streamText/generateText:
 * ```ts
 * import { claudeSonnet, claudeOpus, claudeHaiku } from '@/lib/ai/providers';
 * const result = await streamText({ model: claudeSonnet, prompt: '...' });
 * ```
 *
 * Pricing (per 1M tokens):
 * - Haiku:  $1 input / $5 output  (fastest, cheapest)
 * - Sonnet: $3 input / $15 output (balanced)
 * - Opus:   $5 input / $25 output (best quality)
 */
export const claudeHaiku = openRouter("anthropic/claude-haiku-4.5");
export const claudeSonnet = openRouter("anthropic/claude-sonnet-4.5");
export const claudeOpus = openRouter("anthropic/claude-opus-4.5");

/**
 * Get Claude model by name
 */
export function getClaudeModel(name: "haiku" | "sonnet" | "opus") {
  switch (name) {
    case "haiku":
      return claudeHaiku;
    case "opus":
      return claudeOpus;
    default:
      return claudeSonnet;
  }
}
