// ТЗ-TG4a: Reusable podcast generation pipeline
// Extracted from app/(chat)/api/briefing/podcast/generate/route.ts
// Can be called with onProgress (browser streaming) or without (background/cron)

import "server-only";

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
import pLimit from "p-limit";

export interface PodcastPipelineResult {
  status: "ready" | "partial" | "failed";
  readyCount: number;
  failedCount: number;
  totalSections: number;
}

/**
 * Run the full podcast generation pipeline.
 *
 * @param userId - User to generate podcast for
 * @param briefingId - Optional specific briefing ID (for background mode).
 *                     If omitted, uses latest ready briefing.
 * @param topicIds - Optional filter: only generate for these topics (re-record mode)
 * @param onProgress - Optional callback for streaming progress events (browser mode).
 *                     If omitted, pipeline runs silently (background/cron mode).
 * @returns Pipeline result with counts
 */
export async function runPodcastPipeline({
  userId,
  briefingId,
  topicIds,
  onProgress,
}: {
  userId: string;
  briefingId?: string;
  topicIds?: string[];
  onProgress?: (event: PodcastProgressEvent) => void;
}): Promise<PodcastPipelineResult> {
  const emit = onProgress ?? (() => {});

  // 1. Load briefing (by ID or latest ready)
  let article: BriefingArticle;

  if (briefingId) {
    // Background mode: load specific briefing by ID
    const history = await getBriefingHistory({
      userId,
      limit: 1,
      status: "ready",
    });
    const briefing = history.find((h) => h.id === briefingId);
    if (!briefing) {
      emit({ step: "error", message: "Брифинг не найден" });
      return { status: "failed", readyCount: 0, failedCount: 0, totalSections: 0 };
    }
    article = briefing.briefingJson as BriefingArticle;
  } else {
    // Browser mode: latest ready briefing
    const history = await getBriefingHistory({
      userId,
      limit: 1,
      status: "ready",
    });
    if (history.length === 0) {
      emit({ step: "error", message: "Нет готового брифинга для озвучки" });
      return { status: "failed", readyCount: 0, failedCount: 0, totalSections: 0 };
    }
    article = history[0].briefingJson as BriefingArticle;
  }

  if (!article?.sections?.length) {
    emit({ step: "error", message: "Брифинг не содержит секций" });
    return { status: "failed", readyCount: 0, failedCount: 0, totalSections: 0 };
  }

  // 2. Filter sections by requested topicIds (or all)
  const isRerecord = !!topicIds?.length;
  const sections = isRerecord
    ? article.sections.filter((s) => topicIds!.includes(s.topicId))
    : article.sections;

  if (sections.length === 0) {
    emit({ step: "error", message: "Не найдены указанные темы в брифинге" });
    return { status: "failed", readyCount: 0, failedCount: 0, totalSections: 0 };
  }

  // 3. Mark as generating
  await updateBriefingAudio({ userId, audioStatus: "generating" });

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

  const tasks = sections.map((section) => {
    return limit(async () => {
      const originalIndex = article.sections.findIndex(
        (s) => s.topicId === section.topicId,
      );
      const context: ScriptContext = {
        isFirst: !isRerecord && originalIndex === 0,
        isLast:
          !isRerecord && originalIndex === article.sections.length - 1,
        sectionTitles,
        briefingDate: today,
      };

      try {
        emit({
          step: "script",
          topicId: section.topicId,
          message: `Пишем сценарий: ${section.emoji} ${section.topicName}`,
        });

        const segment = await generatePodcastSegment(section, context);

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
          audioDurations: { [section.topicId]: segment.durationSeconds },
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
          `[podcast-pipeline] Failed for topic ${section.topicId}:`,
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

  await updateBriefingAudio({ userId, audioStatus: finalStatus });

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

  return {
    status: finalStatus === "none" ? "failed" : finalStatus as "ready" | "partial",
    readyCount,
    failedCount,
    totalSections: sections.length,
  };
}
