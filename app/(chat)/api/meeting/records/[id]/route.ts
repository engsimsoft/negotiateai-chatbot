// ТЗ-MR: GET/DELETE /api/meeting/records/[id] — fetch or delete a single meeting record

import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getMeetingRecordById, deleteMeetingRecord } from "@/lib/db/queries";

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const deleted = await deleteMeetingRecord({
    id,
    userId: session.user.id,
  });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
