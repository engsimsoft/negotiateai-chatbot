import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;
    const filename = (formData.get("filename") as string) || `meeting-${Date.now()}.webm`;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 200MB." },
        { status: 400 },
      );
    }

    const blob = await put(`meeting-audio/${session.user.id}/${filename}`, file, {
      access: "public",
      contentType: file.type || "audio/webm",
    });

    return NextResponse.json({ url: blob.url, size: file.size });
  } catch (error) {
    console.error("[meeting/upload] Error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
