/**
 * ТЗ-MindOnVisit: on-visit trigger для обработки хвостов памяти.
 *
 * Запускается через Next.js `after()` из chat route handlers после отправки
 * ответа пользователю. Не блокирует UI, не держит stream.
 *
 * Логика:
 *   1. Читаем `factExtractionStrategy` из `memory_settings`.
 *      - Если `'cron'` — skip (пользователь выбрал обработку только ночью).
 *      - Если `'always'` или `'on-visit'` — продолжаем.
 *   2. Атомарный `claimMindCheck` (30-мин дебаунс). Если недавно уже проверяли — skip.
 *   3. Цикл: достаём до 50 сообщений с `extractedAt=NULL` → `batchExtractFacts`
 *      → повторяем, пока не кончатся хвосты или не сработает safety-лимит итераций.
 *
 * Model: Grok 4.1 Fast non-reasoning (через `batchExtractFacts` → taskId `memory:extract-batch`).
 */

import "server-only";

import { MIND_CHECK_DEBOUNCE_MS } from "@/lib/ai/context-limits";
import {
  claimMindCheck,
  getMemorySettings,
  getUnextractedMessagesForUser,
} from "@/lib/db/queries";
import { batchExtractFacts } from "./extract";

const MAX_ITERATIONS = 6; // 6 × 50 = до 300 сообщений за один визит.

/** Четыре реальных chat-режима (legacy 'chat' из MemorySourceType исключён — он не используется для on-visit). */
export type OnVisitSourceType = "simply" | "expertise" | "create" | "project";

interface ProcessStaleFactsOnVisitInput {
  userId: string;
  sourceType: OnVisitSourceType;
  chatId: string;
}

export async function processStaleFactsOnVisit(
  input: ProcessStaleFactsOnVisitInput,
): Promise<void> {
  const { userId, sourceType, chatId } = input;

  try {
    const settings = await getMemorySettings({ userId });

    if (!settings.memoryEnabled) {
      return;
    }

    if (settings.factExtractionStrategy === "cron") {
      console.info(`[MIND on-visit] user=${userId} strategy=cron, skip`);
      return;
    }

    const claimed = await claimMindCheck({
      userId,
      debounceMs: MIND_CHECK_DEBOUNCE_MS,
    });
    if (!claimed) {
      console.info(`[MIND on-visit] user=${userId} debounced (<30min)`);
      return;
    }

    let iterations = 0;
    let totalProcessed = 0;
    let totalStored = 0;

    while (iterations < MAX_ITERATIONS) {
      const { chatId: tailChatId, messages } = await getUnextractedMessagesForUser({
        userId,
        sourceType,
        limit: 50,
      });

      if (messages.length === 0) {
        break;
      }

      const result = await batchExtractFacts({
        userId,
        chatId: tailChatId ?? chatId,
        sourceType,
        messages,
      });

      totalProcessed += result.processed;
      totalStored += result.stored;
      iterations += 1;

      // Если batchExtractFacts обработал меньше 50 — это последняя пачка
      if (result.processed < 50) {
        break;
      }
    }

    console.info(
      `[MIND on-visit] user=${userId} strategy=${settings.factExtractionStrategy} ` +
        `sourceType=${sourceType} iterations=${iterations} processed=${totalProcessed} stored=${totalStored}`,
    );
  } catch (err) {
    console.warn(
      `[MIND on-visit] user=${userId} failed (non-blocking):`,
      err instanceof Error ? err.message : err,
    );
  }
}
