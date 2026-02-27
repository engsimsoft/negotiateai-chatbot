// ТЗ-FIX3: POST /api/briefing/save-profile — save briefing profile from UI button

import { auth } from "@/app/(auth)/auth";
import {
  saveBriefingProfile,
  type SaveBriefingProfileInput,
} from "@/lib/briefing/save-briefing-profile";
import { ChatSDKError } from "@/lib/errors";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;
  const body: SaveBriefingProfileInput = await request.json();

  if (!body.topics?.length || !body.sources?.length) {
    return Response.json(
      { error: "At least 1 topic and 1 source required" },
      { status: 400 },
    );
  }

  const result = await saveBriefingProfile(userId, body);

  return Response.json(result);
}
