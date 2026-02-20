// ТЗ-А3: POST /api/briefing/generate — generate morning briefing (article format)

import { auth } from "@/app/(auth)/auth";
import { generateArticle } from "@/lib/briefing/briefing-author";
import { MAX_BRIEFING_ITEMS } from "@/lib/briefing/briefing-config";
import { filterContent } from "@/lib/briefing/briefing-filter";
import { fetchSource } from "@/lib/briefing/source-fetchers";
import type { RawContent } from "@/lib/briefing/source-fetchers/types";
import { getDefaultSources, getTopicIds } from "@/lib/briefing/topics-catalog";
import {
  getBriefingSettings,
  getBriefingSources,
  getBriefingTopics,
  saveBriefingHistory,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 90;

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;

  try {
    // 1. Get user settings + topics
    const [settings, userTopics] = await Promise.all([
      getBriefingSettings({ userId }),
      getBriefingTopics({ userId }),
    ]);
    const language = settings?.language ?? "ru";
    const maxItems = settings?.maxItems ?? MAX_BRIEFING_ITEMS;

    // 2. Get user sources (or defaults)
    const userSources = await getBriefingSources({ userId });

    // Build tierMap alongside sourcesToFetch
    const tierMap = new Map<string, string>();

    const sourcesToFetch =
      userSources.length > 0
        ? userSources.map((s) => {
            tierMap.set(s.sourceName, s.tier ?? "unknown");
            return {
              fetchMethod: s.fetchMethod as "rss" | "jina" | "telegram_parse",
              url: s.sourceUrl,
              rssUrl: s.rssUrl ?? undefined,
              sourceName: s.sourceName,
              sourceLanguage: s.sourceLanguage ?? "ru",
            };
          })
        : getDefaultSources().map((d) => {
            tierMap.set(d.source.name, d.source.tier);
            return {
              fetchMethod: d.source.fetchMethod,
              url: d.source.url,
              rssUrl: d.source.rss,
              sourceName: d.source.name,
              sourceLanguage: d.source.language,
            };
          });

    // 3. Create initial history record (status: generating)
    await saveBriefingHistory({
      userId,
      briefingJson: {},
      sourcesChecked: sourcesToFetch.length,
      status: "generating",
    });

    // 4. Fetch all sources in parallel
    const fetchResults = await Promise.allSettled(
      sourcesToFetch.map((source) => fetchSource(source)),
    );

    const allItems: RawContent[] = [];
    const allErrors: string[] = [];

    for (const result of fetchResults) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value.items);
        allErrors.push(...result.value.errors);
      } else {
        allErrors.push(`Fetch rejected: ${result.reason}`);
      }
    }

    if (allErrors.length > 0) {
      console.warn(`[Briefing] Fetch errors:`, allErrors);
    }

    if (allItems.length === 0) {
      await saveBriefingHistory({
        userId,
        briefingJson: { error: "No content fetched", errors: allErrors },
        sourcesChecked: sourcesToFetch.length,
        itemsIncluded: 0,
        status: "failed",
      });

      return Response.json(
        { error: "No content could be fetched from any source" },
        { status: 502 },
      );
    }

    // 5. Stage 1: Filter (Gemini Flash)
    // Use user topics if available, fallback to catalog topics
    const topicIds =
      userTopics.length > 0
        ? userTopics.map((t) => t.topicId)
        : getTopicIds();

    const { candidates, tokensUsed: filterTokens } = await filterContent(
      allItems,
      topicIds,
    );

    // 6. Stage 2: Author (Gemini Pro) — generate article
    const fullTextsMap = new Map<string, RawContent>();
    for (const item of allItems) {
      fullTextsMap.set(item.url, item);
    }

    const today = new Date().toISOString().split("T")[0];

    const { article, tokensUsed: authorTokens } = await generateArticle({
      candidates,
      fullTexts: fullTextsMap,
      tierMap,
      userTopics,
      language,
      maxItems,
      date: today,
    });

    // 7. Save final result
    await saveBriefingHistory({
      userId,
      briefingJson: article,
      sourcesChecked: sourcesToFetch.length,
      itemsIncluded: article.meta.totalNews,
      duplicatesRemoved: allItems.length - candidates.length,
      tokensUsed: filterTokens + authorTokens,
      status: "ready",
    });

    return Response.json({
      briefingJson: article,
      meta: {
        sourcesChecked: sourcesToFetch.length,
        rawItems: allItems.length,
        candidates: candidates.length,
        finalItems: article.meta.totalNews,
        tokensUsed: filterTokens + authorTokens,
        errors: allErrors.length,
      },
    });
  } catch (err) {
    console.error("[Briefing] Generation failed:", err);

    await saveBriefingHistory({
      userId,
      briefingJson: {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      status: "failed",
    });

    return Response.json(
      {
        error: "Briefing generation failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
