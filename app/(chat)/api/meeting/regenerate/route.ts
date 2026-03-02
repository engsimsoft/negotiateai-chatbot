// ТЗ-MR2 Этап 2: POST /api/meeting/regenerate — re-summarize existing transcript with new format/instructions
// No re-transcription — reuses transcript from original record

import { auth } from "@/app/(auth)/auth";
import { getMeetingRecordById, saveMeetingRecord } from "@/lib/db/queries";
import { summarizeTranscript } from "@/lib/meeting/meeting-pipeline";
import type { SummaryLevel } from "@/lib/meeting/meeting-types";

export const maxDuration = 120;

const VALID_LEVELS: SummaryLevel[] = ["compact", "standard", "detailed"];

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await request.json();
  const { recordId, summaryLevel, userInstructions } = body as {
    recordId?: string;
    summaryLevel?: string;
    userInstructions?: string;
  };

  // Validate recordId
  if (!recordId || typeof recordId !== "string") {
    return new Response(
      JSON.stringify({ error: "recordId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate summaryLevel
  if (!summaryLevel || !VALID_LEVELS.includes(summaryLevel as SummaryLevel)) {
    return new Response(
      JSON.stringify({ error: "Invalid summaryLevel" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate userInstructions length
  const trimmedInstructions = userInstructions?.trim() || null;
  if (trimmedInstructions && trimmedInstructions.length > 2000) {
    return new Response(
      JSON.stringify({ error: "userInstructions too long (max 2000)" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const userId = session.user.id;

  // Load original record
  const sourceRecord = await getMeetingRecordById({ id: recordId, userId });

  if (!sourceRecord) {
    return new Response(
      JSON.stringify({ error: "Record not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // Determine root: if source already has originalRecordId, use it; otherwise source IS the root
  const rootId = sourceRecord.originalRecordId ?? sourceRecord.id;

  try {
    // Summarize with new format/instructions (no re-transcription)
    const { title, summary, usage } = await summarizeTranscript(
      sourceRecord.transcript,
      summaryLevel as SummaryLevel,
      trimmedInstructions,
    );

    // Save as new record linked to root
    const newRecord = await saveMeetingRecord({
      userId,
      title,
      durationSeconds: sourceRecord.durationSeconds,
      speakerCount: sourceRecord.speakerCount,
      summaryLevel: summaryLevel as SummaryLevel,
      transcript: sourceRecord.transcript,
      summary,
      userInstructions: trimmedInstructions,
      originalRecordId: rootId,
      metadata: {
        modelId: "claude-sonnet-4-6",
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        regeneratedFrom: recordId,
      },
    });

    return new Response(
      JSON.stringify(newRecord),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[meeting-regenerate] Failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to regenerate summary" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
