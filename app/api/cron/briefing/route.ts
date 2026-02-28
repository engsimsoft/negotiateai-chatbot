// ТЗ-TG4a + TG4b: Vercel Cron handler — background briefing generation + Telegram delivery
// Hobby plan: runs once daily (0 5 * * *), generates briefings, delivers to Telegram.

import { runBriefingPipeline } from "@/lib/briefing/briefing-pipeline";
import { CRON_CONCURRENCY_LIMIT } from "@/lib/briefing/briefing-config";
import {
  getBriefingHistory,
  getUsersForDelivery,
  updateBriefingDeliveryStatus,
} from "@/lib/db/queries";
import { deliverBriefingToTelegram } from "@/lib/telegram/briefing-delivery";
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
 * - On success: delivers to Telegram, updates deliveryStatus
 * - If deliveryFormat includes audio: starts podcast pipeline non-blocking via waitUntil
 *   NOTE (MVP limitation): audio is NOT delivered from cron because podcast generation
 *   runs in waitUntil() AFTER delivery. Audio only available in web UI.
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

    // NOTE: Podcast generation is NOT possible in Vercel serverless (lamejs requires fs access).
    // Audio-only users get a notification with link to listen in app.
    // Podcast can be generated from the browser UI.

    // Deliver to Telegram
    let deliveryStatus = "pending";
    try {
      const delivery = await deliverBriefingToTelegram({
        userId,
        briefingId,
        deliveryFormat: deliveryFormat as "text" | "audio" | "text_audio",
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
