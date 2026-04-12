/**
 * Provider Registry — AI SDK v6 createProviderRegistry (ТЗ-1 CoreRegistry)
 *
 * Регистрирует 4 LLM-провайдера с разделителем `:` между provider id и model id.
 * Использование: registry.languageModel("anthropic:claude-sonnet-4-6")
 *
 * Этот модуль — низкоуровневый. Call-sites в приложении НЕ должны импортировать
 * его напрямую — они зовут getModel(taskId) из `./getModel.ts`.
 *
 * Non-LLM провайдеры (Voyage, Deepgram, Perplexity, Gemini TTS) НЕ в registry —
 * они используются через raw fetch и не имеют AI SDK provider interface.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createProviderRegistry } from "ai";
import { createMinimax } from "vercel-minimax-ai-provider";

// ---------------------------------------------------------------------------
// Provider factories
// ---------------------------------------------------------------------------

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// MiniMax — официально рекомендованный Anthropic-совместимый режим
// (`api.minimax.io/anthropic/v1`). Под капотом провайдер проксирует запросы
// через AnthropicMessagesLanguageModel из @ai-sdk/anthropic/internal, что
// даёт нативную поддержку streamText, tool calling, generateObject, reasoning
// parts и explicit `providerOptions.anthropic.cacheControl` (до 4 breakpoints).
// См. ADR 049.
const minimax = createMinimax({
  apiKey: process.env.MINIMAX_API_KEY,
});

// Long-timeout MiniMax — 180s для briefing/memory pipelines с большими промптами.
// Зарегистрирован как отдельный provider-namespace (minimaxLong:*) чтобы getModel()
// мог различать их через алиасы в model-catalog.
const minimaxLong = createMinimax({
  apiKey: process.env.MINIMAX_API_KEY,
  fetch: async (url, init) => {
    return fetch(url, { ...init, signal: AbortSignal.timeout(180_000) });
  },
});

const xai = createXai({
  apiKey: process.env.XAI_API_KEY,
});

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const registry = createProviderRegistry(
  {
    anthropic,
    minimax,
    minimaxLong,
    xai,
    openrouter,
  },
  { separator: ":" },
);

export type RegistryProviderId =
  | "anthropic"
  | "minimax"
  | "minimaxLong"
  | "xai"
  | "openrouter";
