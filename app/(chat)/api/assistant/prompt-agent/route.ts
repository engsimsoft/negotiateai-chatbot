/**
 * Prompt-Agent API Endpoint
 *
 * Streaming chat endpoint for the Prompt-agent modal assistant.
 * Helps users formulate better prompts.
 *
 * Uses new Skills + Agents architecture (v2).
 */

import { convertToCoreMessages, streamText } from "ai";
import { myProvider } from "@/lib/ai/providers";
import { buildPromptAgentPrompt } from "@/lib/prompts/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    // Build prompt using new skill-based builder
    const prompt = buildPromptAgentPrompt({});

    const result = streamText({
      model: myProvider.languageModel(prompt.model),
      system: prompt.systemPrompt,
      messages: convertToCoreMessages(messages),
      temperature: 1.0,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Prompt-agent error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
