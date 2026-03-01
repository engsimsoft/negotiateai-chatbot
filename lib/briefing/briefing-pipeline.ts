// ТЗ-TG4a + ТЗ-DEV2: Reusable briefing generation pipeline with trace instrumentation
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
  TraceCollector,
  verifyArticleUrls,
  type FetchTrace,
  type PipelineStageTrace,
} from "@/lib/ai/pipeline-trace";
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
 * @param onTrace - Optional callback for streaming trace events (dev mode only).
 * @returns Pipeline result with article, stats, status, and traceSummary
 */
export async function runBriefingPipeline({
  userId,
  onProgress,
  onTrace,
}: {
  userId: string;
  onProgress?: (event: BriefingProgressEvent) => void;
  onTrace?: (data: Record<string, unknown>) => void;
}): Promise<BriefingPipelineResult> {
  const emit = onProgress ?? (() => {});
  const trace = new TraceCollector("briefing");
  const emitTrace = onTrace ?? (() => {});

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

    const fetchStartTime = Date.now();
    const fetchResults = await Promise.allSettled(
      sourcesToFetch.map((source) => fetchSource(source)),
    );

    const allItems: RawContent[] = [];
    const allErrors: string[] = [];
    const fetchTraces: FetchTrace[] = [];

    for (const result of fetchResults) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value.items);
        allErrors.push(...result.value.errors);
        if (result.value.trace) {
          fetchTraces.push(result.value.trace);
        }
      } else {
        allErrors.push(`Fetch rejected: ${result.reason}`);
      }
    }

    // ТЗ-DEV2: Add fetch stage trace
    if (trace.isEnabled) {
      const fetchStage: PipelineStageTrace = {
        stage: "fetch",
        startedAt: new Date(fetchStartTime).toISOString(),
        durationMs: Date.now() - fetchStartTime,
        fetches: fetchTraces,
        dataFlow: {
          inputCount: sourcesToFetch.length,
          outputCount: allItems.length,
          droppedCount: sourcesToFetch.length - fetchResults.filter((r) => r.status === "fulfilled" && r.value.items.length > 0).length,
        },
        errors: allErrors,
        warnings: fetchTraces.flatMap((ft) => ft.warnings),
      };
      trace.addStage(fetchStage);
      emitTrace({ trace: trace.getLatestStage() });
    }

    if (allErrors.length > 0) {
      console.warn(`[Briefing] Fetch errors:`, allErrors);
    }

    if (allItems.length === 0) {
      const failTraceSummary = trace.isEnabled ? trace.getSummary() : undefined;
      const failFullTrace = trace.isEnabled ? trace.getFullTrace() : undefined;
      await saveBriefingHistory({
        userId,
        briefingJson: {
          error: "No content fetched",
          errors: allErrors,
        },
        sourcesChecked: sourcesToFetch.length,
        itemsIncluded: 0,
        status: "failed",
        metadata: failFullTrace ? { briefingTrace: failFullTrace } : undefined,
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
        traceSummary: failTraceSummary,
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

    const { candidates, tokensUsed: filterTokens, trace: filterTrace } = await filterContent(
      allItems,
      topicIds,
    );

    // ТЗ-DEV2: Add filter stage trace
    if (trace.isEnabled && filterTrace) {
      trace.addStage(filterTrace);
      emitTrace({ trace: trace.getLatestStage() });
    }

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

    // ТЗ-DEV2: Per-item fullTexts miss logging (instead of just hit rate)
    const misses = candidates.filter((c) => !fullTextsMap.has(c.sourceItemId));
    if (misses.length > 0) {
      const missIds = misses.map((m) => m.sourceItemId).join(", ");
      console.warn(`[Briefing] Full text miss for: ${missIds}`);
    }
    const hits = candidates.length - misses.length;
    console.log(
      `[Briefing] Full text hit: ${hits}/${candidates.length} candidates`,
    );
    console.log(
      `[Briefing] volume: ${settings?.volume ?? "standard"} (raw: ${settings?.volume})`,
    );

    const today = new Date().toISOString().split("T")[0];

    const { article, tokensUsed: authorTokens, trace: authorTrace } = await generateArticle({
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

    // ТЗ-DEV2: Add author stage trace
    if (trace.isEnabled && authorTrace) {
      trace.addStage(authorTrace);
      emitTrace({ trace: trace.getLatestStage() });
    }

    // ТЗ-DEV2: URL verification — compare article URLs vs fetched URLs
    if (trace.isEnabled) {
      const fetchedUrls = new Set(allItems.map((it) => it.url));
      const filterOutputUrls = new Set(candidates.map((c) => c.url));
      const verification = verifyArticleUrls(article.sections, fetchedUrls, filterOutputUrls);
      trace.setUrlVerification(verification);
      emitTrace({ urlVerification: verification });
    }

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

    // ТЗ-DEV2: Compute full trace BEFORE save → store as metadata (stages + summary + urlVerification)
    const traceSummary = trace.isEnabled ? trace.getSummary() : undefined;
    const fullTrace = trace.isEnabled ? trace.getFullTrace() : undefined;

    // Save final result (with full trace metadata if dev mode)
    await saveBriefingHistory({
      userId,
      briefingJson: article,
      sourcesChecked: sourcesToFetch.length,
      itemsIncluded: article.meta.totalNews,
      duplicatesRemoved,
      tokensUsed: totalTokens,
      status: "ready",
      metadata: fullTrace ? { briefingTrace: fullTrace } : undefined,
    });

    // ТЗ-DEV2: Emit final trace summary (streaming to browser)
    if (traceSummary) {
      emitTrace({ traceSummary });
    }

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
      traceSummary,
    };
  } catch (err) {
    console.error("[Briefing] Generation failed:", err);

    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // ТЗ-DEV2: Fix silent catch — surface DB save errors as warnings
    await saveBriefingHistory({
      userId,
      briefingJson: { error: errorMessage },
      status: "failed",
    }).catch((saveErr) => {
      console.error("[Briefing] Failed to save error status to DB:", saveErr);
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
      traceSummary: trace.isEnabled ? trace.getSummary() : undefined,
    };
  }
}
