// Client-side upload handler for Vercel Blob
// Files go directly from browser → Vercel Blob (no server body size limit)

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Only allow audio uploads under meeting-audio/
        if (!pathname.startsWith("meeting-audio/")) {
          throw new Error("Invalid upload path");
        }

        return {
          maximumSizeInBytes: MAX_FILE_SIZE,
          allowedContentTypes: [
            "audio/webm",
            "audio/mp4",
            "audio/mpeg",
            "audio/ogg",
            "audio/wav",
            "audio/x-m4a",
            "audio/mp3",
            "video/webm",
          ],
        };
      },
      onUploadCompleted: async () => {
        // No post-upload processing needed
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[meeting/upload] Error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
