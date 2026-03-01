// ТЗ-Б1 + ТЗ-TG4a + ТЗ-DEV2: POST /api/briefing/podcast/generate — streaming podcast generation
// Thin wrapper: auth + stream. Core logic in lib/podcast/podcast-pipeline.ts

import { auth } from "@/app/(auth)/auth";
import { isSimplyDevMode } from "@/lib/constants";
import type { PodcastProgressEvent } from "@/lib/podcast/types";
import { runPodcastPipeline } from "@/lib/podcast/podcast-pipeline";
import { updateBriefingAudio } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;
  const body = (await request.json()) as { topicIds?: string[] };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: PodcastProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        // ТЗ-DEV2: Pass onTrace for dev mode NDJSON streaming
        const onTrace = isSimplyDevMode
          ? (data: Record<string, unknown>) => {
              controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
            }
          : undefined;

        await runPodcastPipeline({
          userId,
          topicIds: body.topicIds,
          onProgress: emit,
          onTrace,
        });

        controller.close();
      } catch (err) {
        console.error("[podcast/generate] Pipeline failed:", err);
        emit({
          step: "error",
          message: `Ошибка генерации: ${err instanceof Error ? err.message : "неизвестная ошибка"}`,
        });

        // Reset status on total failure
        try {
          await updateBriefingAudio({
            userId,
            audioStatus: "none",
          });
        } catch {
          // Best effort
        }

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
