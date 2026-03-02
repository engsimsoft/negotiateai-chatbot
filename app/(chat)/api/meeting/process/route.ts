// ТЗ-MR Этап 3: POST /api/meeting/process — streaming progress + meeting pipeline
// Pattern: /api/briefing/generate/route.ts (NDJSON streaming)

import { auth } from "@/app/(auth)/auth";
import { runMeetingPipeline } from "@/lib/meeting/meeting-pipeline";
import type { MeetingProgressEvent, SummaryLevel } from "@/lib/meeting/meeting-types";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 300;

const VALID_LEVELS: SummaryLevel[] = ["compact", "standard", "detailed"];

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const body = await request.json();
  const { blobUrl, summaryLevel, durationSeconds, userInstructions } = body as {
    blobUrl?: string;
    summaryLevel?: string;
    durationSeconds?: number;
    userInstructions?: string;
  };

  if (!blobUrl || typeof blobUrl !== "string") {
    return new Response(
      JSON.stringify({ error: "blobUrl is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!summaryLevel || !VALID_LEVELS.includes(summaryLevel as SummaryLevel)) {
    return new Response(
      JSON.stringify({ error: "Invalid summaryLevel" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ТЗ-MR2: validate userInstructions length
  const trimmedInstructions = userInstructions?.trim() || null;
  if (trimmedInstructions && trimmedInstructions.length > 2000) {
    return new Response(
      JSON.stringify({ error: "userInstructions too long (max 2000)" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: MeetingProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        await runMeetingPipeline(
          {
            blobUrl,
            summaryLevel: summaryLevel as SummaryLevel,
            durationSeconds: durationSeconds ?? 0,
            userId,
            userInstructions: trimmedInstructions,
          },
          emit,
        );
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
