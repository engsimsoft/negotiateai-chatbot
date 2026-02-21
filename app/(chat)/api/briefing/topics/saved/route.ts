// ТЗ-BF1: GET /api/briefing/topics/saved — list saved briefing topics

import { auth } from "@/app/(auth)/auth";
import { getSavedBriefingTopics } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const topics = await getSavedBriefingTopics({ userId: session.user.id });

  return Response.json(topics);
}
