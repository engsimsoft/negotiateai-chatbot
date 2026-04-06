// ТЗ-RAG2: Memory facts API — list + delete
import { auth } from "@/app/(auth)/auth";
import {
  getMemoryEntriesByUser,
  countUserMemories,
  deleteMemoryEntry,
  deleteAllUserMemories,
} from "@/lib/ai/memory/memory-queries";
import { getProfileSummary } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { MemoryCategory } from "@/lib/ai/memory/types";

/**
 * GET /api/user/memory
 * Returns paginated list of memory facts + profile summary date.
 * Query params: category?, limit=50, offset=0
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const url = new URL(request.url);
    const category = url.searchParams.get("category") as MemoryCategory | null;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const [facts, total, profile] = await Promise.all([
      getMemoryEntriesByUser(session.user.id, {
        category: category ?? undefined,
        activeOnly: true,
        limit: limit + offset, // fetch enough to slice
      }),
      countUserMemories(session.user.id),
      getProfileSummary({ userId: session.user.id }),
    ]);

    // Apply offset manually (getMemoryEntriesByUser doesn't support offset)
    const slicedFacts = facts.slice(offset, offset + limit);

    return Response.json({
      facts: slicedFacts.map((f) => ({
        id: f.id,
        content: f.content,
        category: f.category,
        confidence: Number(f.confidence ?? 1),
        sourceType: f.sourceType,
        sourceChatId: f.sourceChatId,
        createdAt: f.createdAt.toISOString(),
      })),
      total,
      profile: profile
        ? {
            generatedAt: profile.generatedAt.toISOString(),
            factCount: profile.factCount,
            tokenCount: profile.tokenCount,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError("bad_request:api", "Failed to get memory").toResponse();
  }
}

/**
 * DELETE /api/user/memory
 * Body: { id: string } — delete one fact
 * Body: { all: true } — delete all facts
 */
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const body = await request.json();

    if (body.all === true) {
      const count = await deleteAllUserMemories(session.user.id);
      return Response.json({ deleted: count });
    }

    if (body.id && typeof body.id === "string") {
      await deleteMemoryEntry(body.id);
      return Response.json({ deleted: 1 });
    }

    return Response.json({ error: "Provide { id } or { all: true }" }, { status: 400 });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError("bad_request:api", "Failed to delete memory").toResponse();
  }
}
