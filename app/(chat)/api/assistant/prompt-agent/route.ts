/**
 * Prompt-Agent API Endpoint
 *
 * Streaming chat endpoint for the Prompt-agent modal assistant.
 * Helps users formulate better prompts.
 */

import { convertToModelMessages, streamText } from "ai";
import { myProvider } from "@/lib/ai/providers";
import { promptAgentConfig } from "@/lib/prompts/assistants/prompt-agent/config";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const result = streamText({
      model: myProvider.languageModel(promptAgentConfig.defaultModel),
      system: promptAgentConfig.systemPrompt,
      messages: convertToModelMessages(messages),
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
