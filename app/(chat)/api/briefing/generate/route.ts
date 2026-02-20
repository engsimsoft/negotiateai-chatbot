// ТЗ-А5: POST /api/briefing/generate — streaming progress + generation pipeline

import { auth } from "@/app/(auth)/auth";
import { generateArticle } from "@/lib/briefing/briefing-author";
import { MAX_BRIEFING_ITEMS } from "@/lib/briefing/briefing-config";
import { filterContent } from "@/lib/briefing/briefing-filter";
import type { BriefingProgressEvent } from "@/lib/briefing/briefing-types";
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: BriefingProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

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
                  fetchMethod: s.fetchMethod as
                    | "rss"
                    | "jina"
                    | "telegram_parse",
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
          controller.close();
          return;
        }

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

        // Step 4: Writing (Gemini Pro)
        emit({
          step: "writing",
          message: "Пишем статью...",
        });

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
          duplicatesRemoved: allItems.length - candidates.length,
          tokensUsed: filterTokens + authorTokens,
          status: "ready",
        });

        // Step 5: Complete
        emit({
          step: "complete",
          message: "Готово!",
          redirectUrl: "/briefing",
        });
      } catch (err) {
        console.error("[Briefing] Generation failed:", err);

        await saveBriefingHistory({
          userId,
          briefingJson: {
            error: err instanceof Error ? err.message : "Unknown error",
          },
          status: "failed",
        }).catch(() => {
          // Don't let save failure mask the original error
        });

        emit({
          step: "error",
          message: "Не удалось сгенерировать брифинг. Попробуйте позже.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
