// ТЗ-TG4a: Vercel Cron handler — background briefing generation
// Runs every 15 minutes, finds users due for delivery, generates briefings

import { runBriefingPipeline } from "@/lib/briefing/briefing-pipeline";
import { CRON_CONCURRENCY_LIMIT } from "@/lib/briefing/briefing-config";
import {
  getBriefingHistory,
  getUsersForDelivery,
  updateBriefingDeliveryStatus,
} from "@/lib/db/queries";
import { runPodcastPipeline } from "@/lib/podcast/podcast-pipeline";
import { waitUntil } from "@vercel/functions";
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

  // Find users whose delivery window matches the current 15-min slot
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
    error?: string;
  }> = [];

  const tasks = users.map((user) =>
    limit(async () => {
      const result = await generateForUser(user.userId, user.deliveryFormat);
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
 * Generate briefing for a single user (background mode).
 * - Idempotency: skips if a ready briefing already exists for today (in user's TZ)
 * - On success: marks deliveryStatus as 'pending'
 * - If deliveryFormat is 'text_audio': starts podcast pipeline non-blocking via waitUntil
 */
async function generateForUser(
  userId: string,
  deliveryFormat: string,
): Promise<{ userId: string; status: string; error?: string }> {
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

    // Pipeline succeeded — get the briefing ID for delivery status update
    const latestBriefing = await getBriefingHistory({
      userId,
      limit: 1,
      status: "ready",
    });

    if (latestBriefing.length > 0) {
      const briefingId = latestBriefing[0].id;

      // Mark as pending delivery (text is ready)
      await updateBriefingDeliveryStatus({
        briefingId,
        deliveryStatus: "pending",
      });

      // If user wants audio, generate podcast non-blocking
      if (deliveryFormat === "text_audio") {
        console.log(
          `[cron/briefing] User ${userId}: starting podcast pipeline (non-blocking)`,
        );
        waitUntil(
          runPodcastPipeline({ userId, briefingId }).catch((err) => {
            console.error(
              `[cron/briefing] User ${userId}: podcast pipeline failed:`,
              err,
            );
          }),
        );
      }
    }

    console.log(
      `[cron/briefing] User ${userId}: done (${result.itemsIncluded} items, ${result.tokensUsed} tokens)`,
    );
    return { userId, status: "generated" };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`[cron/briefing] User ${userId}: error:`, err);
    return { userId, status: "error", error: errorMessage };
  }
}
