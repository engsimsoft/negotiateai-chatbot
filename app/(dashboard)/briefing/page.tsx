import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import {
  getBriefingSettings,
  getBriefingHistory,
  getSavedBriefingTopics,
  getUserById,
} from "@/lib/db/queries";
import { getSimplyNewsData, getSimplyOverviewContent } from "@/lib/briefing/simply-news-utils";
import { BriefingPage } from "@/components/briefing/briefing-page";
import { BriefingPageClient, type SimplyData } from "@/components/briefing/briefing-page-client";
import type { BriefingArticle, SavedBriefingTopicClient, AudioStatus, AudioUrls, AudioDurations } from "@/lib/briefing/briefing-types";
import type { PipelineTrace } from "@/lib/ai/pipeline-trace";

export default async function BriefingRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const [settings, userProfile] = await Promise.all([
    getBriefingSettings({ userId }),
    getUserById(userId),
  ]);

  // ТЗ-BF2: Load simply content data (sync fs reads, fast)
  const simplyNews = getSimplyNewsData();
  const simplyOverview = getSimplyOverviewContent();
  const hasUnreadNews =
    simplyNews.meta.hasUpdate &&
    simplyNews.meta.version !== userProfile?.lastSeenSimplyVersion;
  const simplyData: SimplyData = {
    overviewContent: simplyOverview,
    newsContent: simplyNews.meta.hasUpdate ? simplyNews.content : null,
    newsMeta: {
      version: simplyNews.meta.version,
      title: simplyNews.meta.title,
      hasUpdate: simplyNews.meta.hasUpdate,
      hasUnread: hasUnreadNews,
    },
  };

  // ТЗ-А2: профиль активен → показываем выпуск / заглушку, нет → лендинг
  if (!settings?.isActive) {
    return (
      <BriefingPage
        simplyNewsTitle={simplyData.newsMeta?.hasUpdate ? simplyData.newsMeta.title : null}
        simplyNewsContent={simplyData.newsContent}
      />
    );
  }

  // Load latest briefing + saved topics in parallel
  const [readyBriefings, savedTopicsRaw] = await Promise.all([
    getBriefingHistory({ userId, limit: 1, status: "ready" }),
    getSavedBriefingTopics({ userId }),
  ]);
  const latestBriefing = readyBriefings[0] ?? null;

  // Parse article, guard against old format
  const article = latestBriefing
    ? (latestBriefing.briefingJson as unknown as BriefingArticle)
    : null;
  const hasValidArticle = !!(article?.sections && article.sections.length > 0);
  const briefingGeneratedAt = latestBriefing?.generatedAt.toISOString() ?? null;

  // ТЗ-Б2: Extract audio fields for podcast UI
  const audioStatus = (latestBriefing?.audioStatus as AudioStatus) ?? "none";
  const audioUrls = (latestBriefing?.audioUrls as AudioUrls) ?? {};
  const audioDurations = (latestBriefing?.audioDurations as AudioDurations) ?? {};

  // ТЗ-DEV2: Extract full trace metadata for persistent dev panel
  // Backwards-compatible: old records have PipelineTraceSummary, new have PipelineTrace (with .stages)
  const metadata = latestBriefing?.metadata as Record<string, unknown> | null;
  const rawBriefingTrace = metadata?.briefingTrace as (PipelineTrace | Record<string, unknown>) | undefined;
  const rawPodcastTrace = metadata?.podcastTrace as (PipelineTrace | Record<string, unknown>) | undefined;
  // Normalize: if old format (no .stages), wrap summary into PipelineTrace shape
  const briefingTrace: PipelineTrace | null = rawBriefingTrace
    ? "stages" in rawBriefingTrace && Array.isArray(rawBriefingTrace.stages)
      ? rawBriefingTrace as PipelineTrace
      : { traceId: "", pipeline: "briefing", startedAt: "", stages: [], summary: rawBriefingTrace as unknown as PipelineTrace["summary"] }
    : null;
  const podcastTrace: PipelineTrace | null = rawPodcastTrace
    ? "stages" in rawPodcastTrace && Array.isArray(rawPodcastTrace.stages)
      ? rawPodcastTrace as PipelineTrace
      : { traceId: "", pipeline: "podcast", startedAt: "", stages: [], summary: rawPodcastTrace as unknown as PipelineTrace["summary"] }
    : null;

  // ТЗ-BF1: serialize saved topics for client (Date → ISO string)
  const savedTopics: SavedBriefingTopicClient[] = savedTopicsRaw.map((t) => ({
    id: t.id,
    topicId: t.topicId,
    topicName: t.topicName,
    emoji: t.emoji,
    title: t.title,
    content: t.content,
    sources: (t.sources ?? []) as SavedBriefingTopicClient["sources"],
    briefingGeneratedAt: t.briefingGeneratedAt.toISOString(),
    savedAt: t.savedAt.toISOString(),
  }));

  // ТЗ-А5: delegate rendering to client wrapper for generation state management
  return (
    <BriefingPageClient
      article={article}
      hasValidArticle={hasValidArticle}
      initialSavedTopics={savedTopics}
      briefingGeneratedAt={briefingGeneratedAt}
      simplyData={simplyData}
      initialAudioStatus={audioStatus}
      initialAudioUrls={audioUrls}
      initialAudioDurations={audioDurations}
      initialBriefingTrace={briefingTrace}
      initialPodcastTrace={podcastTrace}
    />
  );
}
