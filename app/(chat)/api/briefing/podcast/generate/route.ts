// ТЗ-Б1: POST /api/briefing/podcast/generate — streaming podcast generation

import { auth } from "@/app/(auth)/auth";
import { generatePodcastSegment } from "@/lib/podcast";
import type {
  PodcastProgressEvent,
  ScriptContext,
} from "@/lib/podcast/types";
import type { BriefingArticle } from "@/lib/briefing/briefing-types";
import {
  getBriefingHistory,
  updateBriefingAudio,
} from "@/lib/db/queries";
import { put } from "@vercel/blob";
import { ChatSDKError } from "@/lib/errors";
import pLimit from "p-limit";

export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const userId = session.user.id;
  const body = (await request.json()) as { topicIds?: string[] };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: PodcastProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        // 1. Load latest ready briefing
        const history = await getBriefingHistory({
          userId,
          limit: 1,
          status: "ready",
        });

        if (history.length === 0) {
          emit({
            step: "error",
            message: "Нет готового брифинга для озвучки",
          });
          controller.close();
          return;
        }

        const briefing = history[0];
        const article = briefing.briefingJson as BriefingArticle;

        if (!article?.sections?.length) {
          emit({
            step: "error",
            message: "Брифинг не содержит секций",
          });
          controller.close();
          return;
        }

        // 2. Filter sections by requested topicIds (or all)
        const sections = body.topicIds?.length
          ? article.sections.filter((s) =>
              body.topicIds!.includes(s.topicId),
            )
          : article.sections;

        if (sections.length === 0) {
          emit({
            step: "error",
            message: "Не найдены указанные темы в брифинге",
          });
          controller.close();
          return;
        }

        // 3. Mark as generating
        await updateBriefingAudio({
          userId,
          audioStatus: "generating",
        });

        // 4. Build section titles for script context
        const sectionTitles = article.sections.map(
          (s) => `${s.emoji} ${s.topicName}`,
        );

        const today = new Date().toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        // 5. Process sections with p-limit(2)
        const limit = pLimit(2);
        let readyCount = 0;
        let failedCount = 0;

        const tasks = sections.map((section, index) => {
          return limit(async () => {
            const context: ScriptContext = {
              isFirst: index === 0,
              isLast: index === sections.length - 1,
              sectionTitles,
              briefingDate: today,
            };

            try {
              // Step: script
              emit({
                step: "script",
                topicId: section.topicId,
                message: `Пишем сценарий: ${section.emoji} ${section.topicName}`,
              });

              const segment = await generatePodcastSegment(
                section,
                context,
              );

              // Step: recording (TTS already done inside generatePodcastSegment)
              emit({
                step: "recording",
                topicId: section.topicId,
                message: `Записано: ${section.emoji} ${section.topicName}`,
                replicaCount: segment.replicaCount,
              });

              // Upload MP3 to Vercel Blob
              const timestamp = Date.now();
              const blobPath = `briefing-podcast/${userId}/${section.topicId}-${timestamp}.mp3`;

              const blob = await put(blobPath, segment.mp3Buffer, {
                access: "public",
                contentType: "audio/mpeg",
              });

              // Update DB incrementally
              await updateBriefingAudio({
                userId,
                audioUrls: { [section.topicId]: blob.url },
                audioDurations: {
                  [section.topicId]: segment.durationSeconds,
                },
              });

              readyCount++;

              emit({
                step: "done",
                topicId: section.topicId,
                message: `Готово: ${section.emoji} ${section.topicName}`,
                url: blob.url,
                durationSeconds: segment.durationSeconds,
              });
            } catch (err) {
              failedCount++;
              console.error(
                `[podcast/generate] Failed for topic ${section.topicId}:`,
                err,
              );
              emit({
                step: "error",
                topicId: section.topicId,
                message: `Ошибка: ${section.emoji} ${section.topicName} — ${err instanceof Error ? err.message : "неизвестная ошибка"}`,
              });
            }
          });
        });

        await Promise.allSettled(tasks);

        // 6. Update final audio status
        const finalStatus =
          readyCount === 0
            ? "none"
            : failedCount > 0
              ? "partial"
              : "ready";

        await updateBriefingAudio({
          userId,
          audioStatus: finalStatus,
        });

        // 7. Complete event
        emit({
          step: "complete",
          message:
            readyCount === sections.length
              ? "Подкаст готов!"
              : `Готово ${readyCount} из ${sections.length} тем`,
          readyCount,
          failedCount,
        });

        controller.close();
      } catch (err) {
        console.error("[podcast/generate] Pipeline failed:", err);
        emit({
          step: "error",
          message: `Ошибка генерации: ${err instanceof Error ? err.message : "неизвестная ошибка"}`,
        });

        // Reset status on total failure
        try {
          await updateBriefingAudio({
            userId,
            audioStatus: "none",
          });
        } catch {
          // Best effort
        }

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
