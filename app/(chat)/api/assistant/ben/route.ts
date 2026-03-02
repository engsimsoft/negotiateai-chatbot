/**
 * Ben API Endpoint
 *
 * Streaming chat endpoint for the Ben (help) modal assistant.
 * Helps users understand Simply platform.
 *
 * Uses new Skills + Agents architecture (v2).
 */

import { convertToCoreMessages, streamText } from "ai";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import { buildBenPrompt } from "@/lib/prompts/server";
import { logUsage } from "@/lib/ai/usage-utils";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { messages, isFirstTime } = await request.json();

    // ТЗ-CACHE2: Get userId for logging (optional — don't block if no session)
    const session = await auth();
    const userId = session?.user?.id;

    // Build prompt using new builder
    const prompt = buildBenPrompt({}, isFirstTime === true);
    const resolvedModelId = myProvider.languageModel(prompt.model).modelId;

    const result = streamText({
      model: myProvider.languageModel(prompt.model),
      system: prompt.systemPrompt,
      messages: convertToCoreMessages(messages),
      temperature: 1.0,
      onFinish: async ({ usage }) => {
        // ТЗ-CACHE2: Usage logging (skip if no auth)
        if (userId) {
          logUsage({
            userId,
            usage,
            modelId: resolvedModelId,
            chatMode: "legacy:ben",
          });
        }
      },
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
