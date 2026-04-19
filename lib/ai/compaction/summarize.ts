/**
 * ТЗ-COMPACTION-1: Генерация summary через Grok 4.1 Fast (non-reasoning).
 *
 * Паттерн зеркалирует MIND extract ([lib/ai/memory/extract.ts](../memory/extract.ts)):
 * `generateObject` с Zod schema, `maxRetries: 0`, logUsage через SSOT usage-utils.
 *
 * Архитектурный источник: specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md
 * §Модель для сжатия + §Формат Summary + §Реализация через AI SDK.
 *
 * Примечание по AI SDK v6: `generateObject` в node_modules/ai/dist/index.d.ts:5154
 * помечен `@deprecated` в пользу `generateText({ output: Output.object(...) })`.
 * Следуем существующему паттерну MIND extract для consistency — миграция всего
 * кодбейса на Output API выносится в backlog (см. FINDINGS.md).
 */

import "server-only";

import { generateObject, type LanguageModelUsage } from "ai";
import { z } from "zod";

import {
  getMaxOutputTokensForTask,
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";
import type { ChatMessage } from "@/lib/types";
import { estimateTokenCount } from "@/lib/utils";

import {
  COMPACTION_SUMMARY_SYSTEM_PROMPT,
  buildCompactionUserPrompt,
} from "./prompt";

const COMPACTION_TASK = "compaction:summarize" as const;

// ---------------------------------------------------------------------------
// Zod schema — 5 секций summary
// ---------------------------------------------------------------------------

const compactionSummarySchema = z.object({
  context: z
    .string()
    .describe(
      "Контекст задачи — что пользователь решает, над чем работает, цели.",
    ),
  materials: z
    .string()
    .describe(
      "Загруженные материалы — содержимое документов/файлов, ключевые данные.",
    ),
  decisions: z
    .string()
    .describe(
      "Ключевые решения и выводы — что решили, ограничения, важные факты.",
    ),
  focus: z
    .string()
    .describe("Текущий фокус — на чём остановились, что обсуждается."),
  openQuestions: z
    .string()
    .describe("Открытые вопросы — что не решено, планы на дальнейшее."),
});

type CompactionSummaryObject = z.infer<typeof compactionSummarySchema>;

// ---------------------------------------------------------------------------
// Форматирование conversation block (для user prompt)
// ---------------------------------------------------------------------------

/**
 * Склеивает ChatMessage[] в текстовый блок для подачи в prompt.
 * Игнорирует non-text parts (file, tool-call и пр.) — для summary нужно только
 * текстовое содержание разговора.
 */
function formatConversationBlock(messages: ChatMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      const text = msg.parts
        .filter(
          (p): p is Extract<typeof p, { type: "text"; text: string }> =>
            p.type === "text" && typeof (p as { text?: unknown }).text === "string",
        )
        .map((p) => p.text)
        .join("\n")
        .trim();
      return text ? `[${role}]\n${text}` : "";
    })
    .filter((block) => block.length > 0)
    .join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Форматирование summary-объекта в markdown (5 секций)
// ---------------------------------------------------------------------------

/**
 * Преобразует структурированный Zod-результат в единый markdown-текст,
 * который потом попадает в messages массив как synthetic assistant-message.
 */
function formatSummaryMarkdown(obj: CompactionSummaryObject): string {
  return [
    "## Контекст задачи",
    obj.context.trim(),
    "",
    "## Загруженные материалы",
    obj.materials.trim(),
    "",
    "## Ключевые решения и выводы",
    obj.decisions.trim(),
    "",
    "## Текущий фокус",
    obj.focus.trim(),
    "",
    "## Открытые вопросы",
    obj.openQuestions.trim(),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateCompactionSummaryInput {
  /** Для логирования в ai_usage_log; если не передан — лог пропускается. */
  userId?: string | null;
  chatId: string;
  messagesToCompact: ChatMessage[];
  /** Summary предыдущей compaction-итерации для rolling update, или null. */
  previousSummary: string | null;
}

export interface GenerateCompactionSummaryResult {
  /** Готовый markdown (5 секций) для вставки в messages array. */
  summary: string;
  /** Оценка размера summary в токенах (через estimateTokenCount). */
  summaryTokens: number;
  /** AI SDK usage для caller'а — может пригодиться caller'у для aggregation. */
  usage: LanguageModelUsage;
}

/**
 * Генерирует структурированный summary для compaction через Grok 4.1 Fast.
 *
 * Бросает ошибку (в т.ч. `NoObjectGeneratedError` от AI SDK) — caller
 * (`prepare-messages.ts`) ловит в try/catch и делает graceful fallback
 * (возвращает оригинальные messages + emitDebugWarning).
 */
export async function generateCompactionSummary(
  input: GenerateCompactionSummaryInput,
): Promise<GenerateCompactionSummaryResult> {
  const { userId, chatId, messagesToCompact, previousSummary } = input;

  const conversationBlock = formatConversationBlock(messagesToCompact);
  const userPrompt = buildCompactionUserPrompt(
    conversationBlock,
    previousSummary,
  );

  const startTime = Date.now();

  const { object, usage } = await generateObject({
    model: getModel(COMPACTION_TASK),
    maxOutputTokens: getMaxOutputTokensForTask(COMPACTION_TASK),
    maxRetries: 0,
    schema: compactionSummarySchema,
    system: COMPACTION_SUMMARY_SYSTEM_PROMPT,
    prompt: userPrompt,
    // 0.3 — чуть выше MIND extract (0.1): summary требует минимальной свободы
    // формулировки, но не creative writing. Grok 4.1 Fast стабилен в этом диапазоне.
    temperature: 0.3,
  });

  const durationMs = Date.now() - startTime;
  const summary = formatSummaryMarkdown(object);
  const summaryTokens = estimateTokenCount(summary);

  if (userId) {
    logUsage({
      userId,
      usage,
      modelId: getModelIdForTask(COMPACTION_TASK),
      provider: getProviderForTask(COMPACTION_TASK),
      chatMode: "compaction:summarize",
      chatId,
      durationMs,
    }).catch((err) =>
      console.warn(
        "[Compaction] logUsage failed (non-blocking):",
        err instanceof Error ? err.message : err,
      ),
    );
  }

  console.log(
    `[Compaction] Summary generated for chat ${chatId}: ~${summaryTokens} tokens (${durationMs}ms)`,
  );

  return { summary, summaryTokens, usage };
}
