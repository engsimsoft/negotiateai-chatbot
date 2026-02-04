/**
 * Ben API Endpoint
 *
 * Streaming chat endpoint for the Ben (help) modal assistant.
 * Helps users understand Simply platform.
 *
 * Uses new Skills + Agents architecture (v2).
 */

import { convertToCoreMessages, streamText } from "ai";
import { myProvider } from "@/lib/ai/providers";
import { buildBenPrompt } from "@/lib/prompts/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { messages, isFirstTime } = await request.json();

    // Build prompt using new builder
    const prompt = buildBenPrompt({}, isFirstTime === true);

    const result = streamText({
      model: myProvider.languageModel(prompt.model),
      system: prompt.systemPrompt,
      messages: convertToCoreMessages(messages),
      temperature: 1.0,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Ben error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
