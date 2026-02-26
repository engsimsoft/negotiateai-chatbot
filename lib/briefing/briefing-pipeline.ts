// ТЗ-TG4a: Reusable briefing generation pipeline
// Extracted from app/(chat)/api/briefing/generate/route.ts
// Can be called with onProgress (browser streaming) or without (background/cron)

import "server-only";

import { generateArticle } from "@/lib/briefing/briefing-author";
import { MAX_BRIEFING_ITEMS } from "@/lib/briefing/briefing-config";
import { filterContent } from "@/lib/briefing/briefing-filter";
import type {
  BriefingPipelineResult,
  BriefingProgressEvent,
} from "@/lib/briefing/briefing-types";
import { getSimplyNewsData } from "@/lib/briefing/simply-news-utils";
import { fetchSource } from "@/lib/briefing/source-fetchers";
import type { RawContent } from "@/lib/briefing/source-fetchers/types";
import { getDefaultSources, getTopicIds } from "@/lib/briefing/topics-catalog";
import {
  deleteOldBriefingHistory,
  getBriefingSettings,
  getBriefingSources,
  getBriefingTopics,
  getPreviousBriefing,
  saveBriefingHistory,
} from "@/lib/db/queries";

/**
 * Run the full briefing generation pipeline.
 *
 * @param userId - The user to generate for
 * @param onProgress - Optional callback for streaming progress events (browser mode).
 *                     If omitted, pipeline runs silently (background/cron mode).
 * @returns Pipeline result with article, stats, and status
 */
export async function runBriefingPipeline({
  userId,
  onProgress,
}: {
  userId: string;
  onProgress?: (event: BriefingProgressEvent) => void;
}): Promise<BriefingPipelineResult> {
  const emit = onProgress ?? (() => {});

  try {
    // Step 1: Connecting — load settings, topics, sources
    emit({
      step: "connecting",
      message: "Подключаемся к источникам...",
    });

    const [settings, userTopics] = await Promise.all([
      getBriefingSettings({ userId }),
      getBriefingTopics({ userId }),
    ]);
    const language = settings?.language ?? "ru";
    const maxItems = settings?.maxItems ?? MAX_BRIEFING_ITEMS;

    const userSources = await getBriefingSources({ userId });

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

    // ТЗ-BF5: Load previous briefing for dedup BEFORE deleting old records
    const previousBriefing = await getPreviousBriefing({ userId });

    // ТЗ-BF5: Keep last ready briefing for dedup context (sliding window)
    await deleteOldBriefingHistory({ userId, keepLast: 1 });

    await saveBriefingHistory({
      userId,
      briefingJson: {},
      sourcesChecked: sourcesToFetch.length,
      status: "generating",
    });

    emit({
      step: "connecting",
      message: "Подключаемся к источникам...",
      done: true,
      detail: `${sourcesToFetch.length} источников`,
    });

    // Step 2: Fetching — parallel fetch all sources
    emit({
      step: "fetching",
      message: "Собираем новости...",
    });

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
        briefingJson: {
          error: "No content fetched",
          errors: allErrors,
        },
        sourcesChecked: sourcesToFetch.length,
        itemsIncluded: 0,
        status: "failed",
      });

      emit({
        step: "error",
        message: "Не удалось собрать новости. Попробуйте позже.",
      });

      return {
        status: "failed",
        sourcesChecked: sourcesToFetch.length,
        itemsIncluded: 0,
        duplicatesRemoved: 0,
        tokensUsed: 0,
        error: "No content fetched",
      };
    }

    // Assign unique itemId to each item for reliable lookup
    allItems.forEach((item, i) => {
      item.itemId = `src-${i}`;
    });

    emit({
      step: "fetching",
      message: "Собираем новости...",
      done: true,
      detail: `${allItems.length} статей`,
    });

    // Step 3: Filtering (Gemini Flash)
    emit({
      step: "filtering",
      message: "Фильтруем и отбираем лучшее...",
    });

    const topicIds =
      userTopics.length > 0
        ? userTopics.map((t) => t.topicId)
        : getTopicIds();

    const { candidates, tokensUsed: filterTokens } = await filterContent(
      allItems,
      topicIds,
    );

    emit({
      step: "filtering",
      message: "Фильтруем и отбираем лучшее...",
      done: true,
      detail: `${candidates.length} прошли отбор`,
    });

    // Step 4: Writing (Claude Sonnet)
    emit({
      step: "writing",
      message: "Пишем статью...",
    });

    const fullTextsMap = new Map<string, RawContent>();
    for (const item of allItems) {
      fullTextsMap.set(item.itemId!, item);
    }

    const hits = candidates.filter((c) =>
      fullTextsMap.has(c.sourceItemId),
    ).length;
    console.log(
      `[Briefing] Full text hit: ${hits}/${candidates.length} candidates`,
    );
    console.log(
      `[Briefing] volume: ${settings?.volume ?? "standard"} (raw: ${settings?.volume})`,
    );

    const today = new Date().toISOString().split("T")[0];

    const { article, tokensUsed: authorTokens } = await generateArticle({
      candidates,
      fullTexts: fullTextsMap,
      tierMap,
      userTopics,
      language,
      maxItems,
      volume: settings?.volume ?? "standard",
      date: today,
      previousBriefing,
    });

    // ТЗ-BF2: Inject simply-news as last section (if hasUpdate)
    const simplyNews = getSimplyNewsData();
    if (simplyNews.meta.hasUpdate) {
      article.sections.push({
        topicId: "simply_news",
        topicName: simplyNews.meta.title,
        emoji: "🔔",
        content: simplyNews.content,
        newsCount: 0,
        sources: [],
      });
      article.meta.topicsCount += 1;
    }

    const totalTokens = filterTokens + authorTokens;
    const duplicatesRemoved = allItems.length - candidates.length;

    emit({
      step: "writing",
      message: "Пишем статью...",
      done: true,
      detail: `${article.meta.topicsCount} тем, ${article.meta.totalNews} новостей`,
    });

    // Save final result
    await saveBriefingHistory({
      userId,
      briefingJson: article,
      sourcesChecked: sourcesToFetch.length,
      itemsIncluded: article.meta.totalNews,
      duplicatesRemoved,
      tokensUsed: totalTokens,
      status: "ready",
    });

    // Step 5: Complete
    emit({
      step: "complete",
      message: "Готово!",
      redirectUrl: "/briefing",
    });

    return {
      status: "ready",
      article,
      sourcesChecked: sourcesToFetch.length,
      itemsIncluded: article.meta.totalNews,
      duplicatesRemoved,
      tokensUsed: totalTokens,
    };
  } catch (err) {
    console.error("[Briefing] Generation failed:", err);

    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    await saveBriefingHistory({
      userId,
      briefingJson: { error: errorMessage },
      status: "failed",
    }).catch(() => {
      // Don't let save failure mask the original error
    });

    emit({
      step: "error",
      message: "Не удалось сгенерировать брифинг. Попробуйте позже.",
    });

    return {
      status: "failed",
      sourcesChecked: 0,
      itemsIncluded: 0,
      duplicatesRemoved: 0,
      tokensUsed: 0,
      error: errorMessage,
    };
  }
}
