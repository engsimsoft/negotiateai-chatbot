// ТЗ-KITT: Memory context API — facts grouped by category + profile
import { auth } from "@/app/(auth)/auth";
import { getMemorySummaryByCategory } from "@/lib/ai/memory/memory-queries";
import { getProfileSummary } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/user/memory/context
 * Returns facts grouped by category (count + top-2 preview) + profile summary.
 * Used by /context dashboard.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const [categories, profile] = await Promise.all([
      getMemorySummaryByCategory(session.user.id),
      getProfileSummary({ userId: session.user.id }),
    ]);

    return Response.json({
      categories,
      profile: profile
        ? {
            content: profile.content,
            generatedAt: profile.generatedAt.toISOString(),
            factCount: profile.factCount,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get memory context",
    ).toResponse();
  }
}
