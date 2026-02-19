// ТЗ-BR1: POST /api/briefing/generate — generate morning briefing

import { auth } from "@/app/(auth)/auth";
import { analyzeContent } from "@/lib/briefing/briefing-analyzer";
import { MAX_BRIEFING_ITEMS } from "@/lib/briefing/briefing-config";
import { filterContent } from "@/lib/briefing/briefing-filter";
import { fetchSource } from "@/lib/briefing/source-fetchers";
import type { RawContent } from "@/lib/briefing/source-fetchers/types";
import { getDefaultSources, getTopicIds } from "@/lib/briefing/topics-catalog";
import {
  getBriefingSettings,
  getBriefingSources,
  saveBriefingHistory,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export const maxDuration = 60;

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;

  try {
    // 1. Get user settings
    const settings = await getBriefingSettings({ userId });
    const language = settings?.language ?? "ru";
    const maxItems = settings?.maxItems ?? MAX_BRIEFING_ITEMS;

    // 2. Get user sources (or defaults)
    const userSources = await getBriefingSources({ userId });

    const sourcesToFetch =
      userSources.length > 0
        ? userSources.map((s) => ({
            fetchMethod: s.fetchMethod as "rss" | "jina" | "telegram_parse",
            url: s.sourceUrl,
            rssUrl: s.rssUrl ?? undefined,
            sourceName: s.sourceName,
            sourceLanguage: s.sourceLanguage ?? "ru",
          }))
        : getDefaultSources().map((d) => ({
            fetchMethod: d.source.fetchMethod,
            url: d.source.url,
            rssUrl: d.source.rss,
            sourceName: d.source.name,
            sourceLanguage: d.source.language,
          }));

    // 3. Create initial history record (status: generating)
    const historyRecord = await saveBriefingHistory({
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
      // No content fetched — mark as failed
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
    const topicIds = getTopicIds();
    const { candidates, tokensUsed: filterTokens } = await filterContent(
      allItems,
      topicIds,
    );

    // 6. Stage 2: Analyze (Gemini Pro)
    const fullTextsMap = new Map<string, RawContent>();
    for (const item of allItems) {
      fullTextsMap.set(item.url, item);
    }

    const { briefing, tokensUsed: analyzerTokens } = await analyzeContent({
      candidates,
      fullTexts: fullTextsMap,
      language,
      maxItems,
      totalSourcesChecked: sourcesToFetch.length,
    });

    const totalItems = briefing.blocks.reduce(
      (sum, block) => sum + block.items.length,
      0,
    );

    // 7. Save final result
    await saveBriefingHistory({
      userId,
      briefingJson: briefing,
      sourcesChecked: sourcesToFetch.length,
      itemsIncluded: totalItems,
      duplicatesRemoved: allItems.length - candidates.length,
      tokensUsed: filterTokens + analyzerTokens,
      status: "ready",
    });

    return Response.json({
      briefingJson: briefing,
      meta: {
        sourcesChecked: sourcesToFetch.length,
        rawItems: allItems.length,
        candidates: candidates.length,
        finalItems: totalItems,
        tokensUsed: filterTokens + analyzerTokens,
        errors: allErrors.length,
      },
    });
  } catch (err) {
    console.error("[Briefing] Generation failed:", err);

    // Save failure record
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
