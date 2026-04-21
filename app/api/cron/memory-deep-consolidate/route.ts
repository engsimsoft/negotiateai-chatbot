// ТЗ-MindDeepConsolidation: ночной tiered-consolidation cron.
// Schedule: 0 22 * * * (22:00 UTC = 01:00 MSK). 2ч gap перед memory-profile
// (0 0 * * * = 03:00 MSK), чтобы reasoning-прогон успел до summary-прогона.
//
// Отличия от hot-path consolidate (Grok 4.1 Fast, event-triggered):
// - reasoning-модель (Grok 4.20 по умолчанию, A/B через /dev/models)
// - действие `rephrase` (сжатие длинных фактов с сохранением id)
// - snapshot cursor runStartTs защищает от race condition с hot path
// - idempotency: пользователь skipped если прогон был <12h назад

import { deepConsolidateUserMemory } from "@/lib/ai/memory/consolidate";
import {
  getUsersForDeepConsolidation,
  saveCronRunLog,
  updateMemorySettings,
} from "@/lib/db/queries";
import pLimit from "p-limit";

export const maxDuration = 240;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const startedAt = new Date();
  console.log(
    `[cron/memory-deep-consolidate] Triggered at ${startedAt.toISOString()}`,
  );

  type UserResult = {
    userId: string;
    status: "consolidated" | "failed";
    reviewed?: number;
    merged?: number;
    superseded?: number;
    removed?: number;
    rephrased?: number;
    durationMs?: number;
    error?: string;
  };

  const results: UserResult[] = [];
  let usersFailed = 0;

  try {
    const candidates = await getUsersForDeepConsolidation({
      activeWithinHours: 24,
      idempotencyHours: 12,
      minFacts: 5,
    });

    if (candidates.length === 0) {
      console.log(
        "[cron/memory-deep-consolidate] No active users eligible, nothing to do",
      );
      const finishedAt = new Date();
      await saveCronRunLog({
        cronName: "memory-deep-consolidate",
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
      `[cron/memory-deep-consolidate] Found ${candidates.length} eligible user(s)`,
    );

    const limit = pLimit(3);
    const tasks = candidates.map(({ userId }) =>
      limit(async () => {
        try {
          const stats = await deepConsolidateUserMemory(userId, startedAt);

          await updateMemorySettings({
            userId,
            patch: { lastDeepConsolidatedAt: startedAt },
          });

          results.push({
            userId,
            status: "consolidated",
            reviewed: stats.reviewed,
            merged: stats.merged,
            superseded: stats.superseded,
            removed: stats.removed,
            rephrased: stats.rephrased,
            durationMs: stats.durationMs,
          });
        } catch (err) {
          usersFailed++;
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[cron/memory-deep-consolidate] User ${userId} failed:`,
            message,
          );
          results.push({ userId, status: "failed", error: message });
        }
      }),
    );

    await Promise.allSettled(tasks);
  } catch (err) {
    console.error(
      "[cron/memory-deep-consolidate] Candidate query failed:",
      err instanceof Error ? err.message : err,
    );
  }

  const finishedAt = new Date();

  await saveCronRunLog({
    cronName: "memory-deep-consolidate",
    startedAt,
    finishedAt,
    usersProcessed: results.filter((r) => r.status === "consolidated").length,
    usersSkipped: 0,
    usersFailed,
    results,
  });

  return Response.json({
    ok: true,
    usersProcessed: results.filter((r) => r.status === "consolidated").length,
    usersFailed,
    results,
  });
}
