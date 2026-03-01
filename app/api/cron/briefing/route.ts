// ТЗ-TG4a + TG4b: Vercel Cron handler — background briefing generation + Telegram delivery
// Hobby plan: runs once daily (0 5 * * *), generates briefings, delivers to Telegram.

import { runBriefingPipeline } from "@/lib/briefing/briefing-pipeline";
import { runPodcastPipeline } from "@/lib/podcast/podcast-pipeline";
import { mergeAndUploadPodcast } from "@/lib/podcast/audio-merger";
import { CRON_CONCURRENCY_LIMIT } from "@/lib/briefing/briefing-config";
import {
  getBriefingHistory,
  getUsersForDelivery,
  updateBriefingDeliveryStatus,
  updateBriefingMetadata,
} from "@/lib/db/queries";
import { deliverBriefingToTelegram } from "@/lib/telegram/briefing-delivery";
import type { BriefingArticle } from "@/lib/briefing/briefing-types";
import pLimit from "p-limit";

// Next.js requires literal values for segment config (no imported constants)
export const maxDuration = 240;

export async function GET(request: Request) {
  // Verify CRON_SECRET (Vercel sends it as Authorization: Bearer <secret>)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  console.log(`[cron/briefing] Triggered at ${now.toISOString()}`);

  // Find users due for delivery (Hobby: all with deliveryEnabled=true)
  const users = await getUsersForDelivery({ currentUtcTime: now });

  if (users.length === 0) {
    console.log("[cron/briefing] No users due for delivery");
    return Response.json({ ok: true, usersProcessed: 0 });
  }

  console.log(
    `[cron/briefing] Found ${users.length} user(s) for delivery:`,
    users.map((u) => u.userId),
  );

  // Process users with concurrency limit
  const limit = pLimit(CRON_CONCURRENCY_LIMIT);
  const results: Array<{
    userId: string;
    status: string;
    deliveryStatus?: string;
    error?: string;
  }> = [];

  const tasks = users.map((user) =>
    limit(async () => {
      const result = await generateAndDeliver(
        user.userId,
        user.deliveryFormat,
      );
      results.push(result);
    }),
  );

  await Promise.allSettled(tasks);

  console.log("[cron/briefing] Results:", results);

  return Response.json({
    ok: true,
    usersProcessed: users.length,
    results,
  });
}

/**
 * Generate briefing for a single user + deliver to Telegram.
 * - Idempotency: skips if a ready briefing already exists for today (UTC)
 * - On success: generates podcast (if audio format), merges tracks, delivers to Telegram
 */
async function generateAndDeliver(
  userId: string,
  deliveryFormat: string,
): Promise<{
  userId: string;
  status: string;
  deliveryStatus?: string;
  error?: string;
}> {
  try {
    // Idempotency check: is there already a ready briefing for today?
    const existing = await getBriefingHistory({
      userId,
      limit: 1,
      status: "ready",
    });

    if (existing.length > 0) {
      const lastGenerated = existing[0].generatedAt;
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      if (lastGenerated >= todayStart) {
        console.log(
          `[cron/briefing] User ${userId}: already has today's briefing, skipping`,
        );
        return { userId, status: "skipped" };
      }
    }

    // Run the pipeline (no onProgress — silent background mode)
    console.log(`[cron/briefing] User ${userId}: starting pipeline...`);
    const result = await runBriefingPipeline({ userId });

    if (result.status === "failed") {
      console.error(
        `[cron/briefing] User ${userId}: pipeline failed:`,
        result.error,
      );
      return { userId, status: "failed", error: result.error };
    }

    // Pipeline succeeded — get the briefing ID for delivery
    const latestBriefing = await getBriefingHistory({
      userId,
      limit: 1,
      status: "ready",
    });

    if (latestBriefing.length === 0) {
      return { userId, status: "generated", deliveryStatus: "none" };
    }

    const briefingId = latestBriefing[0].id;

    // Mark as pending delivery (text is ready)
    await updateBriefingDeliveryStatus({
      briefingId,
      deliveryStatus: "pending",
    });

    // Generate podcast if user wants audio
    const wantsAudio =
      deliveryFormat === "audio" || deliveryFormat === "text_audio";
    let mergedAudioUrl: string | undefined;
    let podcastStatus = "skipped";

    if (wantsAudio) {
      try {
        const podcastResult = await runPodcastPipeline({
          userId,
          briefingId,
        });
        podcastStatus = `${podcastResult.status}(${podcastResult.readyCount}/${podcastResult.totalSections})`;
        console.log(
          `[cron/briefing] User ${userId}: podcast ${podcastStatus}`,
        );

        // ТЗ-DEV2: Merge podcast trace into briefing metadata
        if (podcastResult.traceSummary) {
          await updateBriefingMetadata({
            briefingId,
            metadata: { podcastTrace: podcastResult.traceSummary },
          }).catch((err) => {
            console.warn(`[cron/briefing] User ${userId}: failed to save podcast trace:`, err);
          });
        }

        if (podcastResult.readyCount > 0) {
          // Re-read briefing with updated audioUrls
          const updated = await getBriefingHistory({
            userId,
            limit: 1,
            status: "ready",
          });
          const audioUrls = updated[0]?.audioUrls as Record<string, string>;
          const audioDurations = updated[0]?.audioDurations as Record<
            string,
            number
          >;
          const article = updated[0]?.briefingJson as BriefingArticle;

          if (audioUrls && Object.keys(audioUrls).length > 0 && article) {
            const sectionOrder = article.sections.map((s) => s.topicId);
            const merged = await mergeAndUploadPodcast({
              userId,
              audioUrls,
              audioDurations,
              sectionOrder,
            });
            mergedAudioUrl = merged.url;
            podcastStatus += `,merged`;
            console.log(
              `[cron/briefing] User ${userId}: merged podcast ${Math.round(merged.totalDuration / 60)}min`,
            );
          }
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : String(err);
        podcastStatus = `error:${errMsg.slice(0, 200)}`;
        console.error(
          `[cron/briefing] User ${userId}: podcast failed:`,
          err,
        );
        // text_audio: text will still be delivered below
        // audio: mergedAudioUrl stays undefined → delivery returns podcast_not_ready
      }
    }

    // Deliver to Telegram
    let deliveryStatus = "pending";
    try {
      const delivery = await deliverBriefingToTelegram({
        userId,
        briefingId,
        deliveryFormat: deliveryFormat as "text" | "audio" | "text_audio",
        mergedAudioUrl,
      });

      deliveryStatus = delivery.success ? "sent" : "failed";

      if (delivery.success) {
        console.log(
          `[cron/briefing] User ${userId}: delivered to Telegram`,
        );
      } else {
        console.warn(
          `[cron/briefing] User ${userId}: Telegram delivery failed: ${delivery.error}`,
        );
        // deliveryStatus already updated to "failed" inside deliverBriefingToTelegram
        // for send errors, but "no_connection" leaves it as "pending" (briefing ready, just not sent)
        if (
          delivery.error === "no_connection" ||
          delivery.error === "briefing_not_found"
        ) {
          deliveryStatus = "pending";
        }
      }
    } catch (err) {
      // Telegram delivery failure must NOT break cron for other users
      console.error(
        `[cron/briefing] User ${userId}: Telegram delivery error (non-critical):`,
        err,
      );
      deliveryStatus = "failed";
      await updateBriefingDeliveryStatus({
        briefingId,
        deliveryStatus: "failed",
      });
    }

    console.log(
      `[cron/briefing] User ${userId}: done (${result.itemsIncluded} items, ${result.tokensUsed} tokens, delivery: ${deliveryStatus})`,
    );
    return { userId, status: "generated", deliveryStatus };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`[cron/briefing] User ${userId}: error:`, err);
    return { userId, status: "error", error: errorMessage };
  }
}
