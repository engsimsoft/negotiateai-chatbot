/**
 * Ben API Endpoint
 *
 * Streaming chat endpoint for the Ben (help) modal assistant.
 * Helps users understand Simply platform.
 *
 * Uses new Skills + Agents architecture (v2).
 */

import { convertToModelMessages, streamText } from "ai";
import { auth } from "@/app/(auth)/auth";
import {
  getMaxOutputTokensForTask,
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { buildBenPrompt } from "@/lib/prompts/server";
import { logUsage } from "@/lib/ai/usage-utils";
import { stripIncompleteToolParts } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { messages, isFirstTime } = await request.json();

    // ТЗ-CACHE2: Get userId for logging (optional — don't block if no session)
    const session = await auth();
    const userId = session?.user?.id;

    // Build prompt using new builder. Ben model is resolved via ТЗ-1 task-assignments
    // (`service-chat:ben`) — prompt.model field from buildBenPrompt is no longer used.
    const prompt = buildBenPrompt({}, isFirstTime === true);
    const resolvedModelId = getModelIdForTask("service-chat:ben");

    const result = streamText({
      model: getModel("service-chat:ben"),
      maxOutputTokens: getMaxOutputTokensForTask("service-chat:ben"),
      system: prompt.systemPrompt,
      // ТЗ-1 hotfix: strip failed/in-flight tool parts before conversion
      messages: await convertToModelMessages(stripIncompleteToolParts(messages)),
      temperature: 1.0,
      // ТЗ-PIPELINE1: Use totalUsage (sum of all steps)
      onFinish: async ({ totalUsage }) => {
        if (userId) {
          logUsage({
            userId,
            usage: totalUsage,
            modelId: resolvedModelId,
            provider: getProviderForTask("service-chat:ben"),
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
