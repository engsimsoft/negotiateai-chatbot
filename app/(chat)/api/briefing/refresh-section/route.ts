// ТЗ-BF4 + ТЗ-DEV2: POST /api/briefing/refresh-section — refresh a single topic section

import { auth } from "@/app/(auth)/auth";
import { isSimplyDevMode } from "@/lib/constants";
import { TraceCollector } from "@/lib/ai/pipeline-trace";
import { generateSection } from "@/lib/briefing/briefing-section-author";
import { filterContent } from "@/lib/briefing/briefing-filter";
import { fetchSource } from "@/lib/briefing/source-fetchers";
import type { RawContent } from "@/lib/briefing/source-fetchers/types";
import { getDefaultSources } from "@/lib/briefing/topics-catalog";
import { buildPreviousHeadlines } from "@/lib/briefing/briefing-author";
import type { BriefingArticle } from "@/lib/briefing/briefing-types";
import {
  getBriefingHistory,
  getBriefingSettings,
  getBriefingSources,
  getBriefingTopics,
  getPreviousBriefing,
  updateBriefingAudio,
  updateBriefingSection,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { getTokenlensCatalog } from "@/lib/ai/tokenlens-catalog";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;
  const { topicId } = (await request.json()) as { topicId: string };

  if (!topicId) {
    return new Response(
      JSON.stringify({ error: "topicId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    // 1. Load user settings and topics
    const [settings, userTopics] = await Promise.all([
      getBriefingSettings({ userId }),
      getBriefingTopics({ userId }),
    ]);

    const topic = userTopics.find((t) => t.topicId === topicId);
    if (!topic) {
      return new Response(
        JSON.stringify({ error: "Topic not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const otherTopicNames = userTopics
      .filter((t) => t.topicId !== topicId)
      .map((t) => `${t.emoji} ${t.topicName}`);

    // 2. Get sources for this topic only
    const userSources = await getBriefingSources({ userId });
    const tierMap = new Map<string, string>();

    const topicSources =
      userSources.length > 0
        ? userSources
            .filter((s) => s.topicId === topicId)
            .map((s) => {
              tierMap.set(s.sourceName, s.tier ?? "unknown");
              return {
                fetchMethod: s.fetchMethod as "rss" | "jina" | "telegram_parse",
                url: s.sourceUrl,
                rssUrl: s.rssUrl ?? undefined,
                sourceName: s.sourceName,
                sourceLanguage: s.sourceLanguage ?? "ru",
              };
            })
        : getDefaultSources()
            .filter((d) => d.topicId === topicId)
            .map((d) => {
              tierMap.set(d.source.name, d.source.tier);
              return {
                fetchMethod: d.source.fetchMethod,
                url: d.source.url,
                rssUrl: d.source.rss,
                sourceName: d.source.name,
                sourceLanguage: d.source.language,
              };
            });

    if (topicSources.length === 0) {
      return new Response(
        JSON.stringify({ error: "No sources found for this topic" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`[Refresh Section] topicId=${topicId}, sources=${topicSources.length}`);

    // 3. Fetch sources for this topic
    const fetchResults = await Promise.allSettled(
      topicSources.map((source) => fetchSource(source)),
    );

    const allItems: RawContent[] = [];
    for (const result of fetchResults) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value.items);
      }
    }

    // Assign unique itemIds
    allItems.forEach((item, i) => {
      item.itemId = `refresh-${i}`;
    });

    if (allItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "No content fetched from sources" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`[Refresh Section] fetched ${allItems.length} items`);

    // ТЗ-CACHE3: Fetch TokenLens catalog once for SSOT cost calculation
    const catalog = await getTokenlensCatalog();

    // ТЗ-DEV2: Trace collector for section refresh
    const trace = new TraceCollector("section-refresh", catalog);

    // 4. Filter (Gemini Flash, single topic)
    const { candidates, trace: filterTrace } = await filterContent(allItems, [topicId], userId, catalog);

    // ТЗ-DEV2: Collect filter trace
    if (trace.isEnabled && filterTrace) {
      trace.addStage(filterTrace);
    }

    console.log(`[Refresh Section] ${candidates.length} candidates after filter`);

    // 5. Generate section (Claude Sonnet)
    const fullTextsMap = new Map<string, RawContent>();
    for (const item of allItems) {
      fullTextsMap.set(item.itemId!, item);
    }

    // ТЗ-BF5: Load previous briefing headlines + URLs for this topic (dedup)
    let previousTopicHeadlines: string | null = null;
    let previousUrls: Set<string> | undefined;
    const prevBriefing = await getPreviousBriefing({ userId });
    if (prevBriefing) {
      const prevSection = prevBriefing.article.sections.find(
        (s) => s.topicId === topicId,
      );
      if (prevSection) {
        // Build headlines for just this one topic using the shared helper
        const singleTopicArticle: BriefingArticle = {
          ...prevBriefing.article,
          sections: [prevSection],
        };
        previousTopicHeadlines = buildPreviousHeadlines(singleTopicArticle);
        // Collect URLs for candidate marking
        previousUrls = new Set(prevSection.sources.map((src) => src.url).filter(Boolean));
      }
    }

    const { section, tokensUsed, trace: authorTrace } = await generateSection({
      candidates,
      fullTexts: fullTextsMap,
      tierMap,
      topic,
      otherTopicNames,
      volume: settings?.volume ?? "standard",
      previousTopicHeadlines,
      previousUrls,
      userId,
      catalog,
    });

    // ТЗ-DEV2: Collect author trace
    if (trace.isEnabled && authorTrace) {
      trace.addStage(authorTrace);
    }

    console.log(`[Refresh Section] generated section, tokens=${tokensUsed}`);

    // 6. Patch DB (JSONB update)
    await updateBriefingSection({
      userId,
      topicId,
      newSection: section,
    });

    // 6b. ТЗ-Б1: Mark podcast as outdated if it exists
    const latest = await getBriefingHistory({ userId, limit: 1, status: "ready" });
    if (latest.length > 0) {
      const audioStatus = latest[0].audioStatus as string | null;
      if (audioStatus === "ready" || audioStatus === "partial") {
        await updateBriefingAudio({ userId, audioStatus: "outdated" });
      }
    }

    // 7. Return updated section to client (+ trace in dev mode)
    const responseBody = isSimplyDevMode
      ? { ...section, _trace: trace.getSummary() }
      : section;

    return new Response(JSON.stringify(responseBody), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Refresh Section] Failed:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Failed to refresh section",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
