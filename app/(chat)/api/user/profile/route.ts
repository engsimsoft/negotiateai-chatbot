import { auth } from "@/app/(auth)/auth";
import { getUserById, updateUserProfile } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * GET /api/user/profile
 * Returns the current user's profile data
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
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      pronouns: profile.pronouns,
      occupation: profile.occupation,
      bio: profile.bio,
      theme: profile.theme,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get profile"
    ).toResponse();
  }
}

/**
 * PATCH /api/user/profile
 * Updates the current user's profile data
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const body = await request.json();
    const { displayName, pronouns, occupation, bio, theme } = body;

    // Validate fields
    if (pronouns !== undefined && pronouns !== null && !["ты", "вы"].includes(pronouns)) {
      return new ChatSDKError(
        "bad_request:api",
        "Invalid pronouns value"
      ).toResponse();
    }
    if (theme !== undefined && theme !== null && !["light", "dark", "system"].includes(theme)) {
      return new ChatSDKError(
        "bad_request:api",
        "Invalid theme value"
      ).toResponse();
    }
    if (displayName && typeof displayName === "string" && displayName.length > 100) {
      return new ChatSDKError(
        "bad_request:api",
        "Display name too long"
      ).toResponse();
    }
    if (bio && typeof bio === "string" && bio.length > 1000) {
      return new ChatSDKError(
        "bad_request:api",
        "Bio too long"
      ).toResponse();
    }

    const [updated] = await updateUserProfile({
      id: session.user.id,
      displayName,
      pronouns,
      occupation,
      bio,
      theme,
    });

    return Response.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      pronouns: updated.pronouns,
      occupation: updated.occupation,
      bio: updated.bio,
      theme: updated.theme,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) return error.toResponse();
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update profile"
    ).toResponse();
  }
}
