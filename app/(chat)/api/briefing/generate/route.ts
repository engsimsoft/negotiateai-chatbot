// ТЗ-А5: POST /api/briefing/generate — streaming progress + generation pipeline
// ТЗ-TG4a: Refactored to use shared runBriefingPipeline()

import { auth } from "@/app/(auth)/auth";
import { runBriefingPipeline } from "@/lib/briefing/briefing-pipeline";
import type { BriefingProgressEvent } from "@/lib/briefing/briefing-types";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 90;

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: BriefingProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        await runBriefingPipeline({ userId, onProgress: emit });
      } finally {
        controller.close();
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
