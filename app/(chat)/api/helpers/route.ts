import { auth } from "@/app/(auth)/auth";
import { getHelpersByUserId } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { PRESET_HELPERS } from "@/lib/helpers";
import type { CustomHelper, HelpersListResponse } from "@/lib/helpers";

/**
 * GET /api/helpers
 * Get all helpers for the current user (presets + custom)
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    // Get custom helpers from DB
    const dbHelpers = await getHelpersByUserId({ userId: session.user.id });

    // Transform DB helpers to CustomHelper type
    const customHelpers: CustomHelper[] = dbHelpers.map((h) => ({
      id: h.id,
      type: "custom" as const,
      userId: h.userId,
      name: h.name,
      emoji: h.emoji,
      instruction: h.instruction,
      skills: h.skills,
      createdAt: h.createdAt,
    }));

    const response: HelpersListResponse = {
      presets: PRESET_HELPERS,
      custom: customHelpers,
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get helpers"
    ).toResponse();
  }
}
