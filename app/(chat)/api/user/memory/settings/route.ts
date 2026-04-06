// ТЗ-RAG2: Memory settings API — get/update memoryEnabled toggle
import { auth } from "@/app/(auth)/auth";
import {
  getMemorySettings,
  updateMemorySettings,
  getProfileSummary,
} from "@/lib/db/queries";
import { countUserMemories } from "@/lib/ai/memory/memory-queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/user/memory/settings
 * Returns current memory settings + stats.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const [settings, factCount, profile] = await Promise.all([
      getMemorySettings({ userId: session.user.id }),
      countUserMemories(session.user.id),
      getProfileSummary({ userId: session.user.id }),
    ]);

    return Response.json({
      memoryEnabled: settings.memoryEnabled,
      factCount,
      profile: profile
        ? {
            generatedAt: profile.generatedAt.toISOString(),
            factCount: profile.factCount,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError("bad_request:api", "Failed to get memory settings").toResponse();
  }
}

/**
 * PATCH /api/user/memory/settings
 * Body: { memoryEnabled: boolean }
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const body = await request.json();

    if (typeof body.memoryEnabled !== "boolean") {
      return Response.json(
        { error: "memoryEnabled must be a boolean" },
        { status: 400 },
      );
    }

    // Ensure settings row exists
    await getMemorySettings({ userId: session.user.id });

    await updateMemorySettings({
      userId: session.user.id,
      patch: { memoryEnabled: body.memoryEnabled },
    });

    return Response.json({ ok: true, memoryEnabled: body.memoryEnabled });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError("bad_request:api", "Failed to update memory settings").toResponse();
  }
}
