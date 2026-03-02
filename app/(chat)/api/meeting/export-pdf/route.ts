// ТЗ-MR2 Этап 3: POST /api/meeting/export-pdf — generate and download PDF

import { auth } from "@/app/(auth)/auth";
import { getMeetingRecordById } from "@/lib/db/queries";
import { generateMeetingPdf, transliterate } from "@/lib/meeting/pdf-generator";

export const maxDuration = 30;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await request.json();
  const { recordId } = body as { recordId?: string };

  if (!recordId || typeof recordId !== "string") {
    return new Response(
      JSON.stringify({ error: "recordId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const record = await getMeetingRecordById({
    id: recordId,
    userId: session.user.id,
  });

  if (!record) {
    return new Response(
      JSON.stringify({ error: "Record not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const pdfBuffer = await generateMeetingPdf({
      title: record.title,
      summary: record.summary,
      createdAt: record.createdAt,
    });

    const filename = `${transliterate(record.title) || "meeting"}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("[export-pdf] Failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate PDF" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
