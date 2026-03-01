// ТЗ-MR: GET /api/meeting/records/[id] — fetch a single meeting record

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getMeetingRecordById } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const record = await getMeetingRecordById({
    id,
    userId: session.user.id,
  });

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}
