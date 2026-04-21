// ТЗ-MindOnVisit: Nightly cron — safety net для пользователей со стратегией
// 'always' (on-visit + cron) и 'cron' (только cron). Пользователи со стратегией
// 'on-visit' НЕ обрабатываются ночью — они выбрали обработку только при визитах.
//
// Покрытие: все 4 chat-режима (simply / expertise / create / project) — раньше
// был только simply, что оставляло 3 режима без safety net.
//
// Schedule: 0 0 * * * (0:00 UTC = 3:00 MSK, before briefing at 5:00 UTC)

import { batchExtractFacts } from "@/lib/ai/memory/extract";
import {
  getUnextractedMessagesForUser,
  getUsersWithStaleMessagesByStrategy,
  saveCronRunLog,
} from "@/lib/db/queries";
import pLimit from "p-limit";

/** 24 hours in milliseconds */
const STALE_MESSAGE_AGE_MS = 24 * 60 * 60 * 1000;

const SOURCE_TYPES = ["simply", "expertise", "create", "project"] as const;

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

  const extractResults: Array<{
    userId: string;
    processed: number;
    extracted: number;
    stored: number;
  }> = [];

  try {
    // Только пользователи со стратегией 'always' или 'cron' — пропускаем 'on-visit'
    const staleUsers = await getUsersWithStaleMessagesByStrategy({
      strategies: ["always", "cron"],
      minAgeMs: STALE_MESSAGE_AGE_MS,
    });

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
      `[cron/memory-profile] Found ${staleUsers.length} user(s) with stale messages (strategies: always, cron)`,
    );

    const limit = pLimit(3);
    const tasks = staleUsers.map(({ userId }) =>
      limit(async () => {
        try {
          let userProcessed = 0;
          let userExtracted = 0;
          let userStored = 0;
          let userChatId: string | null = null;

          // Идём по всем 4 sourceType, обрабатываем хвосты каждого
          for (const sourceType of SOURCE_TYPES) {
            const { chatId, messages } = await getUnextractedMessagesForUser({
              userId,
              sourceType,
              limit: 50,
            });
            if (messages.length === 0) continue;

            const result = await batchExtractFacts({
              userId,
              chatId: chatId ?? "",
              sourceType,
              messages,
            });
            userProcessed += result.processed;
            userExtracted += result.extracted;
            userStored += result.stored;
            userChatId = chatId ?? userChatId;

            console.log(
              `[cron/memory-profile] User ${userId} sourceType=${sourceType}: ` +
                `extracted ${result.extracted} facts from ${result.processed} messages`,
            );
          }

          if (userProcessed > 0) {
            extractResults.push({
              userId,
              processed: userProcessed,
              extracted: userExtracted,
              stored: userStored,
            });
          }
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
