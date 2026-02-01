/**
 * Test Anthropic (Claude) via OpenRouter
 *
 * GET /api/test-anthropic
 *
 * Tests that Claude models work correctly through OpenRouter.
 */

import { generateText } from "ai";
import { claudeSonnet } from "@/lib/ai/providers";

export async function GET() {
  try {
    // Check if API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json(
        { success: false, error: "OPENROUTER_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Test Claude Sonnet via OpenRouter
    const result = await generateText({
      model: claudeSonnet,
      prompt: "Скажи 'Привет, я Claude!' на русском языке. Ответь одним предложением.",
    });

    return Response.json({
      success: true,
      model: "claude-sonnet-4.5 (via OpenRouter)",
      response: result.text,
    });
  } catch (error) {
    console.error("Test Anthropic error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
