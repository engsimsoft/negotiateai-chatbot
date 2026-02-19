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
    getBriefingHistory({ userId, limit: 1 }),
    getBriefingSettings({ userId }),
  ]);

  const briefing = historyRows.find((h) => h.status === "ready") ?? null;

  return Response.json({ briefing, settings });
}
