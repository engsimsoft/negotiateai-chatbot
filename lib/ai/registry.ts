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

// DEBUG: временный fetch-wrapper для диагностики image payload.
// Пишет в stdout с маркером [PAYLOAD-DEBUG] — снимаем после ответа.
const debugFetch: typeof fetch = async (url, init) => {
  try {
    const u = String(url);
    if ((u.includes("api.x.ai") || u.includes("api.anthropic.com")) && init?.body) {
      const body = typeof init.body === "string" ? init.body : "";
      const hasAttachment =
        body.includes("image_url") ||
        body.includes('"image"') ||
        body.includes("base64") ||
        body.includes("application/pdf") ||
        body.includes('"input_file"') ||
        body.includes('"file_url"') ||
        body.includes('"file_id"') ||
        body.includes('"file"');
      if (hasAttachment) {
        let imgStats = "no-match";
        try {
          const j = JSON.parse(body);
          const messages = j.messages || j.input || [];
          const flat = JSON.stringify(messages);
          const m = flat.match(/"(image_url|image|source|input_file|file_url|file_id|file)"\s*:\s*\{[^}]{0,200}/);
          const partTypes = (flat.match(/"type"\s*:\s*"[^"]+"/g) || [])
            .map(s => s.replace(/"type"\s*:\s*/, ""))
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 20);
          imgStats = `messages=${messages.length} partTypes=[${partTypes.join(",")}] firstAttachmentSnippet=${m ? m[0].slice(0, 300) : "none"}`;
        } catch {}
        console.log(`[PAYLOAD-DEBUG] url=${u} bodySize=${body.length} ${imgStats}`);
        console.log(`[PAYLOAD-DEBUG-HEAD] ${body.slice(0, 1200)}`);
        console.log(`[PAYLOAD-DEBUG-TAIL] ${body.slice(-400)}`);
      }
    }
  } catch {}
  return fetch(url as any, init);
};

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  fetch: debugFetch,
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
  fetch: debugFetch,
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
