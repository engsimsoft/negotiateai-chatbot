/**
 * ТЗ-C1.5: Tool createSnapshot
 *
 * Called by the Expert to capture a progress snapshot when context is filling up.
 * Snapshot data is saved to Chat.snapshots[] and contextState is reset.
 * The tool call itself is persisted as part of the assistant message (via onFinish parts filter).
 */

import { tool } from "ai";
import { z } from "zod";
import { addChatSnapshot, resetChatContextState } from "@/lib/db/queries";
import { wrapToolExecution } from "./tool-wrapper";

interface CreateSnapshotProps {
  chatId: string;
  messageId: string;
}

/**
 * Build a full markdown summary from structured params.
 * This markdown is injected into system prompt as <previous_context> on next turn.
 */
function buildFullMarkdown(params: {
  shortSummary: string;
  decisions: string[];
  currentState: string;
  artifacts: string[];
  openQuestions: string[];
  nextSteps: string[];
}): string {
  const sections: string[] = [];

  sections.push(`## Итог\n${params.shortSummary}`);

  if (params.decisions.length > 0) {
    sections.push(
      `## Ключевые решения\n${params.decisions.map((d) => `- ${d}`).join("\n")}`
    );
  }

  sections.push(`## Текущее состояние\n${params.currentState}`);

  if (params.artifacts.length > 0) {
    sections.push(
      `## Созданные артефакты\n${params.artifacts.map((a) => `- ${a}`).join("\n")}`
    );
  }

  if (params.openQuestions.length > 0) {
    sections.push(
      `## Открытые вопросы\n${params.openQuestions.map((q) => `- ${q}`).join("\n")}`
    );
  }

  if (params.nextSteps.length > 0) {
    sections.push(
      `## Следующие шаги\n${params.nextSteps.map((s) => `- ${s}`).join("\n")}`
    );
  }

  return sections.join("\n\n");
}

export const createSnapshot = ({ chatId, messageId }: CreateSnapshotProps) =>
  tool({
    description:
      "Зафиксировать прогресс диалога (snapshot). Вызывай когда пользователь согласился подвести итог, или когда системный сигнал указывает на заполнение контекста. Snapshot сжимает историю — модель будет видеть только этот итог + новые сообщения.",

    inputSchema: z.object({
      shortSummary: z
        .string()
        .describe("Краткий итог работы (2-3 предложения)"),
      decisions: z
        .array(z.string())
        .describe("Ключевые решения, принятые в диалоге"),
      currentState: z
        .string()
        .describe("Текущее состояние работы — где остановились"),
      artifacts: z
        .array(z.string())
        .default([])
        .describe("Созданные артефакты (документы, таблицы)"),
      openQuestions: z
        .array(z.string())
        .default([])
        .describe("Открытые вопросы, которые остались"),
      nextSteps: z
        .array(z.string())
        .describe("Конкретные следующие шаги"),
    }),

    execute: wrapToolExecution(
      { name: "createSnapshot", timeout: 10000, enableLogging: true },
      async (params) => {
        const fullMarkdown = buildFullMarkdown(params);

        // Save snapshot to Chat.snapshots[]
        await addChatSnapshot({
          chatId,
          messageId,
          summary: params.shortSummary,
        });

        // Reset contextState (suggestion tracking)
        await resetChatContextState({ chatId });

        console.log(
          `[createSnapshot] Chat ${chatId}: snapshot saved (${params.decisions.length} decisions, ${params.nextSteps.length} next steps)`
        );

        // Return structured data — will be in tool result part of the message
        return {
          status: "snapshot_created",
          shortSummary: params.shortSummary,
          fullMarkdown,
          message:
            "Итог зафиксирован. Контекст обновлён. Продолжай работу с учётом зафиксированных решений.",
        };
      }
    ),
  });
