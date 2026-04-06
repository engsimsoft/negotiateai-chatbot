// ТЗ-RAG2: Nightly cron — consolidation (Sonnet) → profile generation (Opus)
// Schedule: 0 0 * * * (0:00 UTC = 3:00 MSK, before briefing at 5:00 UTC)

import { consolidateUserMemory } from "@/lib/ai/memory/consolidate";
import { generateUserProfile } from "@/lib/ai/memory/profile";
import { getUsersForMemoryProfile, saveCronRunLog } from "@/lib/db/queries";
import pLimit from "p-limit";

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

  // Find eligible users (memoryEnabled + >= 10 facts + facts updated since last profile)
  const users = await getUsersForMemoryProfile({ minFacts: 10 });

  if (users.length === 0) {
    console.log("[cron/memory-profile] No eligible users");
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
    `[cron/memory-profile] Found ${users.length} eligible user(s):`,
    users.map((u) => `${u.userId}(${u.factCount} facts)`),
  );

  // Process users with concurrency limit
  const limit = pLimit(3);
  const results: Array<{
    userId: string;
    status: string;
    consolidation?: { superseded: number; merged: number; removed: number };
    profile?: { factCount: number; tokenCount: number; costUsd: number };
    error?: string;
  }> = [];

  const tasks = users.map((user) =>
    limit(async () => {
      const result = await processUser(user.userId);
      results.push(result);
    }),
  );

  await Promise.allSettled(tasks);

  const finishedAt = new Date();
  const usersProcessed = results.filter((r) => r.status === "done").length;
  const usersFailed = results.filter((r) => r.status === "error").length;

  console.log("[cron/memory-profile] Results:", results);

  await saveCronRunLog({
    cronName: "memory-profile",
    startedAt,
    finishedAt,
    usersProcessed,
    usersSkipped: 0,
    usersFailed,
    results,
  });

  return Response.json({
    ok: true,
    usersProcessed: users.length,
    results,
  });
}

async function processUser(userId: string): Promise<{
  userId: string;
  status: string;
  consolidation?: { superseded: number; merged: number; removed: number };
  profile?: { factCount: number; tokenCount: number; costUsd: number };
  error?: string;
}> {
  try {
    // Step 1: Consolidation (Sonnet review)
    console.log(`[cron/memory-profile] User ${userId}: consolidating...`);
    const consolidation = await consolidateUserMemory(userId);

    // Step 2: Profile generation (Opus)
    console.log(`[cron/memory-profile] User ${userId}: generating profile...`);
    const profile = await generateUserProfile(userId);

    console.log(
      `[cron/memory-profile] User ${userId}: done — ${profile.factCount} facts, ${profile.tokenCount} tokens, $${profile.costUsd.toFixed(4)}`,
    );

    return {
      userId,
      status: "done",
      consolidation: {
        superseded: consolidation.superseded,
        merged: consolidation.merged,
        removed: consolidation.removed,
      },
      profile: {
        factCount: profile.factCount,
        tokenCount: profile.tokenCount,
        costUsd: profile.costUsd,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[cron/memory-profile] User ${userId}: error:`, err);
    return { userId, status: "error", error: errorMessage };
  }
}
