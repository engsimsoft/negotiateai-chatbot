import { auth } from "@/app/(auth)/auth";
import { STUCK_THRESHOLD_MINUTES } from "@/lib/briefing/briefing-config";
import {
  getBriefingHistory,
  getBriefingSettings,
  markStuckBriefingsAsFailed,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;

  // ТЗ-BriefingStuckRecovery: per-user watchdog before reading state
  await markStuckBriefingsAsFailed({
    userId,
    thresholdMinutes: STUCK_THRESHOLD_MINUTES,
  });

  const [historyRows, settings] = await Promise.all([
    getBriefingHistory({ userId, limit: 1, status: "ready" }),
    getBriefingSettings({ userId }),
  ]);

  const briefing = historyRows[0] ?? null;

  return Response.json({ briefing, settings });
}
