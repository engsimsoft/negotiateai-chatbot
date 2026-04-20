// ТЗ-ExtractCompression V2: Nightly cron — ONLY safety net for stale simply messages
// Consolidation + profile are now event-triggered (inside batchExtractFacts chain)
// Schedule: 0 0 * * * (0:00 UTC = 3:00 MSK, before briefing at 5:00 UTC)

import { batchExtractFacts } from "@/lib/ai/memory/extract";
import {
  getUsersWithStaleSimplyMessages,
  getUnextractedSimplyMessages,
  saveCronRunLog,
} from "@/lib/db/queries";
import pLimit from "p-limit";

/** 24 hours in milliseconds */
const STALE_MESSAGE_AGE_MS = 24 * 60 * 60 * 1000;

export const maxDuration = 240;

export async function GET(request: Request) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const startedAt = new Date();
  console.log(
    `[cron/memory-profile] Triggered at ${startedAt.toISOString()}`,
  );

  // Find users with unextracted simply messages older than 24h
  const extractResults: Array<{
    userId: string;
    processed: number;
    extracted: number;
    stored: number;
  }> = [];

  try {
    const staleUsers = await getUsersWithStaleSimplyMessages(STALE_MESSAGE_AGE_MS);

    if (staleUsers.length === 0) {
      console.log("[cron/memory-profile] No stale messages found, nothing to do");
      const finishedAt = new Date();
      await saveCronRunLog({
        cronName: "memory-profile",
        startedAt,
        finishedAt,
        usersProcessed: 0,
        usersSkipped: 0,
        usersFailed: 0,
        results: [],
      });
      return Response.json({ ok: true, usersProcessed: 0 });
    }

    console.log(
      `[cron/memory-profile] Found ${staleUsers.length} user(s) with stale simply messages`,
    );

    // batchExtractFacts handles the full chain:
    // extract → consolidation (if ≥10 stored) → profile (if ≥10 changed)
    const limit = pLimit(3);
    const tasks = staleUsers.map((userId) =>
      limit(async () => {
        try {
          const { chatId, messages } = await getUnextractedSimplyMessages(userId, 50);
          if (messages.length === 0) return;

          const result = await batchExtractFacts({
            userId,
            chatId,
            sourceType: "simply",
            messages,
          });
          extractResults.push({
            userId,
            processed: result.processed,
            extracted: result.extracted,
            stored: result.stored,
          });
          console.log(
            `[cron/memory-profile] User ${userId}: batch extracted ${result.extracted} facts from ${result.processed} messages`,
          );
        } catch (err) {
          console.error(
            `[cron/memory-profile] User ${userId}: batch extract failed:`,
            err instanceof Error ? err.message : err,
          );
        }
      }),
    );

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error(
      "[cron/memory-profile] Stale message check failed:",
      err instanceof Error ? err.message : err,
    );
  }

  const finishedAt = new Date();

  await saveCronRunLog({
    cronName: "memory-profile",
    startedAt,
    finishedAt,
    usersProcessed: extractResults.length,
    usersSkipped: 0,
    usersFailed: 0,
    results: extractResults.map((r) => ({ ...r, status: "extracted" })),
  });

  return Response.json({
    ok: true,
    usersProcessed: extractResults.length,
    extractResults,
  });
}
