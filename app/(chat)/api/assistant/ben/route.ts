/**
 * Ben API Endpoint
 *
 * Streaming chat endpoint for the Ben (help) modal assistant.
 * Helps users understand Simply platform.
 */

import { convertToModelMessages, streamText } from "ai";
import { myProvider } from "@/lib/ai/providers";
import { benConfig } from "@/lib/prompts/ben/config";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { messages, isFirstTime } = await request.json();

    // Add context about first-time user if needed
    const systemWithContext = isFirstTime
      ? `${benConfig.systemPrompt}\n\n## КОНТЕКСТ\nЭто новый пользователь, который только что прошёл онбординг. Будь особенно дружелюбным и объясняй всё подробнее.`
      : benConfig.systemPrompt;

    const result = streamText({
      model: myProvider.languageModel(benConfig.defaultModel),
      system: systemWithContext,
      messages: convertToModelMessages(messages),
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
