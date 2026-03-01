// ТЗ-MR Этап 4: GET /api/meeting/records — list meeting records for user

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getMeetingRecords } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await getMeetingRecords({
    userId: session.user.id,
    limit: 50,
  });

  // Return lightweight list (no transcript/summary to save bandwidth)
  const list = records.map((r) => ({
    id: r.id,
    title: r.title,
    durationSeconds: r.durationSeconds,
    speakerCount: r.speakerCount,
    summaryLevel: r.summaryLevel,
    createdAt: r.createdAt,
  }));

  return NextResponse.json(list);
}
