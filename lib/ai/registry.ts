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
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createXai } from "@ai-sdk/xai";
import { createProviderRegistry } from "ai";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Moonshot AI / Kimi K2.6 — официальный @ai-sdk/moonshotai (Vercel monorepo,
// dist-tag ai-v6 = 2.0.11). Все 3 briefing-задачи (author/section/podcast-script)
// — длинные кухонные генерации до 32K output, занимающие 60-120 сек. Custom
// fetch с 180s AbortSignal.timeout — иначе default fetch timeout (~30s)
// прервёт длинные генерации.
const moonshotai = createMoonshotAI({
  apiKey: process.env.MOONSHOT_API_KEY ?? "",
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

export const registry = createProviderRegistry(
  {
    anthropic,
    moonshotai,
    xai,
    openrouter,
  },
  { separator: ":" },
);

export type RegistryProviderId =
  | "anthropic"
  | "moonshotai"
  | "xai"
  | "openrouter";
