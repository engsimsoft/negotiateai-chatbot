// ТЗ-А5: POST /api/briefing/generate — streaming progress + generation pipeline
// ТЗ-TG4a: Refactored to use shared runBriefingPipeline()
// ТЗ-DEV2: +onTrace for pipeline observability in dev mode

import { auth } from "@/app/(auth)/auth";
import { runBriefingPipeline } from "@/lib/briefing/briefing-pipeline";
import type { BriefingProgressEvent } from "@/lib/briefing/briefing-types";
import { isSimplyDevMode } from "@/lib/constants";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 240; // ТЗ-Briefing-1: MiniMax M2.7 thinking model needs more time

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;

  const encoder = new TextEncoder();

  // ТЗ-PIPELINE1: SafeEmit prevents "Controller is already closed" crash
  // when pipeline throws after partial stream output
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const safeEnqueue = (data: string) => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            closed = true;
          }
        }
      };

      const emit = (event: BriefingProgressEvent) => {
        safeEnqueue(JSON.stringify(event) + "\n");
      };

      const emitTrace = isSimplyDevMode
        ? (data: Record<string, unknown>) => {
            safeEnqueue(JSON.stringify(data) + "\n");
          }
        : undefined;

      try {
        await runBriefingPipeline({ userId, onProgress: emit, onTrace: emitTrace });
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
