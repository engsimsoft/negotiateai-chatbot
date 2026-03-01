import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getUserById, getGeneralChatsCount, getBriefingHistory, getBriefingSettings, getMeetingRecords, getMeetingRecordsCount } from "@/lib/db/queries";
import { getSimplyNewsData } from "@/lib/briefing/simply-news-utils";
import {
  GlavnayaHeader,
  GlavnayaGreeting,
  GlavnayaInput,
  ModeCardsSection,
  ChatHistoryCard,
  ToolsSection,
} from "@/components/glavnaya";

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // Get user profile, chat count, latest briefing, and meeting records from database
  const [userProfile, generalChatsCount, briefingHistoryRows, briefingSettings, meetingRecords, meetingRecordCount] = await Promise.all([
    getUserById(session.user.id),
    getGeneralChatsCount({ userId: session.user.id }),
    getBriefingHistory({ userId: session.user.id, limit: 1 }),
    getBriefingSettings({ userId: session.user.id }),
    getMeetingRecords({ userId: session.user.id, limit: 1 }),
    getMeetingRecordsCount({ userId: session.user.id }),
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
          <div className="flex items-stretch gap-3">
            {generalChatsCount > 0 && (
              <ChatHistoryCard count={generalChatsCount} />
            )}
            <GlavnayaInput />
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
