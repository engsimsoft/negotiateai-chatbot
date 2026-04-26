import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { STUCK_THRESHOLD_MINUTES } from "@/lib/briefing/briefing-config";
import { getUserById, getBriefingHistory, getBriefingSettings, getMeetingRecords, getMeetingRecordsCount, markStuckBriefingsAsFailed } from "@/lib/db/queries";
import { countUserMemories } from "@/lib/ai/memory/memory-queries";
import {
  listLibraryCollectionsByUser,
  listLibraryDocumentsByUser,
} from "@/lib/ai/library/db";
import { getSimplyNewsData } from "@/lib/briefing/simply-news-utils";
import {
  GlavnayaHeader,
  GlavnayaGreeting,
  GlavnayaInput,
  ModeCardsSection,
  ContextCard,
  LibraryCard,
  ToolsSection,
} from "@/components/glavnaya";

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // ТЗ-BriefingStuckRecovery: per-user watchdog before reading state
  // (BriefingCard reads latest of any status — stuck `generating` would block navigation)
  await markStuckBriefingsAsFailed({
    userId: session.user.id,
    thresholdMinutes: STUCK_THRESHOLD_MINUTES,
  });

  // Get user profile, chat count, latest briefing, and meeting records from database
  const [userProfile, memoryFactCount, briefingHistoryRows, briefingSettings, meetingRecords, meetingRecordCount, libraryCollections, libraryDocsPage] = await Promise.all([
    getUserById(session.user.id),
    countUserMemories(session.user.id),
    getBriefingHistory({ userId: session.user.id, limit: 1 }),
    getBriefingSettings({ userId: session.user.id }),
    getMeetingRecords({ userId: session.user.id, limit: 1 }),
    getMeetingRecordsCount({ userId: session.user.id }),
    listLibraryCollectionsByUser(session.user.id),
    listLibraryDocumentsByUser(session.user.id, { limit: 1 }),
  ]);
  const latestBriefing = briefingHistoryRows[0] ?? null;

  // ТЗ-BF2: Show unread Simply News only for active briefing users
  const simplyNews = getSimplyNewsData();
  const hasSimplyUpdate =
    briefingSettings?.isActive &&
    simplyNews.meta.hasUpdate &&
    simplyNews.meta.version !== userProfile?.lastSeenSimplyVersion;

  // User was deleted from DB but JWT still valid — force re-auth
  if (!userProfile) {
    redirect("/api/auth/signout");
  }

  const displayName = userProfile.displayName || session.user.email?.split("@")[0] || "друг";

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <GlavnayaHeader />

      <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-10 lg:px-6">
        {/* Greeting + Input */}
        <section className="mb-12">
          <GlavnayaGreeting displayName={displayName} />
          <div className="flex items-start gap-3">
            <div className="flex shrink-0 flex-col gap-2">
              <ContextCard factCount={memoryFactCount} />
              <LibraryCard
                documentCount={libraryDocsPage.total}
                collectionCount={libraryCollections.length}
              />
            </div>
            <div className="flex-1">
              <GlavnayaInput />
            </div>
          </div>
        </section>

        {/* Mode cards */}
        <ModeCardsSection />

        {/* Tools */}
        <ToolsSection latestBriefing={latestBriefing} hasSimplyUpdate={hasSimplyUpdate} meetingRecordCount={meetingRecordCount} lastMeetingTitle={meetingRecords[0]?.title ?? null} />
      </main>
    </div>
  );
}
