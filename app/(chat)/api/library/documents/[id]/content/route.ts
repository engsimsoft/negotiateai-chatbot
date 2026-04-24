import { auth } from "@/app/(auth)/auth";
import { getLibraryDocumentById } from "@/lib/ai/library/db";
import { getFileContent } from "@/lib/ai/library/xai-collections";
import { ChatSDKError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const doc = await getLibraryDocumentById(id);
    if (!doc) {
      return new ChatSDKError("not_found:database", "Document not found").toResponse();
    }
    if (doc.userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "You don't have access to this document",
      ).toResponse();
    }

    const upstream = await getFileContent(doc.xaiFileId);
    const dbType = doc.mimeType ?? "application/octet-stream";
    const contentType = dbType.startsWith("text/")
      ? "text/plain; charset=utf-8"
      : dbType;

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Failed to fetch document content",
    ).toResponse();
  }
}
