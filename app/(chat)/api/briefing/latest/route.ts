import { auth } from "@/app/(auth)/auth";
import { getBriefingHistory, getBriefingSettings } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;

  const [historyRows, settings] = await Promise.all([
    getBriefingHistory({ userId, limit: 1, status: "ready" }),
    getBriefingSettings({ userId }),
  ]);

  const briefing = historyRows[0] ?? null;

  return Response.json({ briefing, settings });
}
