import type { NextRequest } from "next/server";
import type { LanguageModelUsage } from "ai";

import { auth } from "@/app/(auth)/auth";
import { calculateDeepgramCostUsd } from "@/lib/ai/providers";
import { logUsage } from "@/lib/ai/usage-utils";
import { ChatSDKError } from "@/lib/errors";

/**
 * ТЗ-BILLING1: Log Deepgram voice-to-text usage from the browser.
 *
 * The voice recorder WebSocket runs client-side (use-voice-recorder.ts).
 * After recording stops, the hook POSTs the duration here so we can
 * log the cost in ai_usage_log (same table as all other AI costs).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:api").toResponse();
  }

  let durationSeconds: number;
  try {
    const body = await request.json();
    durationSeconds = Number(body.durationSeconds);
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > 300
  ) {
    return Response.json(
      { error: "durationSeconds must be >0 and ≤300" },
      { status: 400 },
    );
  }

  const costUsd = calculateDeepgramCostUsd(durationSeconds);

  // Fire-and-forget — logUsage never throws
  logUsage({
    userId: session.user.id,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    } as LanguageModelUsage,
    modelId: "deepgram-nova-3",
    chatMode: "tool:voice-input",
    durationMs: Math.round(durationSeconds * 1000),
    costUsdOverride: costUsd,
  });

  return Response.json({ ok: true, costUsd });
}
