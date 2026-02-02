import { auth } from "@/app/(auth)/auth";
import { getUserById, updateUserBenIntro } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/user/ben-intro
 * Returns the current user's Ben intro status
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const profile = await getUserById(session.user.id);
    if (!profile) {
      return new ChatSDKError("not_found:api").toResponse();
    }

    return Response.json({
      hasSeenBenIntro: profile.hasSeenBenIntro ?? false,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get Ben intro status"
    ).toResponse();
  }
}

/**
 * PATCH /api/user/ben-intro
 * Updates the current user's Ben intro status
 * Body: { hasSeenBenIntro: boolean }
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const body = await request.json();
    const { hasSeenBenIntro } = body;

    if (typeof hasSeenBenIntro !== "boolean") {
      return new ChatSDKError(
        "bad_request:api",
        "hasSeenBenIntro must be a boolean"
      ).toResponse();
    }

    const [updated] = await updateUserBenIntro({
      id: session.user.id,
      hasSeenBenIntro,
    });

    return Response.json({
      hasSeenBenIntro: updated.hasSeenBenIntro,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update Ben intro status"
    ).toResponse();
  }
}
