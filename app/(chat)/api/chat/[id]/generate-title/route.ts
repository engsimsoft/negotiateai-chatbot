import { generateObject } from "ai";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  getModel,
  getModelIdForTask,
  getProviderForTask,
} from "@/lib/ai/getModel";
import { logUsage } from "@/lib/ai/usage-utils";
import {
  getChatById,
  getMessagesByChatId,
  updateChatTitleAndSummary,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

/**
 * POST /api/chat/[id]/generate-title
 *
 * ТЗ-07A: Автонейминг чатов
 *
 * Генерирует название чата на основе контекста разговора.
 * Вызывается после 2-го ответа AI, только если isRenamed=false.
 *
 * Название: 2-4 слова, существительное или именная группа, без глаголов.
 * Примеры: "Маркетинг кофейни", "Перевод договора", "Анализ конкурентов"
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;
  console.log("[generate-title] Called for chat:", chatId);

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    // Check chat exists and belongs to user
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      return new ChatSDKError("not_found:database", "Chat not found").toResponse();
    }
    if (chat.userId !== session.user.id) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    // Skip if user has manually renamed the chat
    if (chat.isRenamed) {
      return Response.json({ title: chat.title, skipped: true });
    }

    // Get messages for context
    const messages = await getMessagesByChatId({ id: chatId });
    console.log("[generate-title] Messages count:", messages.length);
    if (messages.length < 4) {
      // Not enough messages for auto-naming (need at least 2 exchanges)
      console.log("[generate-title] Skipped - not enough messages");
      return Response.json({ title: chat.title, skipped: true });
    }

    // Take first 4 messages for context (2 user + 2 assistant)
    const contextMessages = messages.slice(0, 4);
    const contextSummary = contextMessages
      .map((m) => {
        const role = m.role === "user" ? "Пользователь" : "Ассистент";
        // Extract text from parts
        const text = Array.isArray(m.parts)
          ? m.parts
              .filter((p: { type: string }) => p.type === "text")
              .map((p: { type: string; text?: string }) => p.text || "")
              .join(" ")
          : "";
        // Truncate long messages
        const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
        return `${role}: ${truncated}`;
      })
      .join("\n");

    // ТЗ-1 CoreRegistry: model now resolved via getModel(taskId)
    const resolvedModelId = getModelIdForTask("util:title");

    // Generate title and summary using Claude Haiku (fast and cheap)
    const { object, usage } = await generateObject({
      model: getModel("util:title"),
      schema: z.object({
        title: z.string().describe("Короткое название чата (2-4 слова)"),
        summary: z.string().describe("Краткое описание темы разговора (1-2 предложения)"),
      }),
      system: `Ты анализируешь чаты и генерируешь для них название и краткое описание на русском языке.

Правила для title (названия):
- 2-4 слова максимум
- Используй существительные или именные группы
- НЕ используй глаголы (не "Написать текст", а "Текст для сайта")
- НЕ используй кавычки, двоеточия, точки
- Отражай суть разговора, не первое сообщение

Примеры хороших названий:
- Маркетинг кофейни
- Перевод договора
- Анализ конкурентов

Правила для summary (описания):
- 1-2 коротких предложения
- Опиши о чём конкретно шёл разговор
- Используй нейтральный тон`,
      prompt: `Проанализируй этот чат и сгенерируй название и краткое описание:\n\n${contextSummary}`,
    });

    // ТЗ-CACHE2: Usage logging
    logUsage({
      userId: session.user.id!,
      usage,
      modelId: resolvedModelId,
      provider: getProviderForTask("util:title"),
      chatMode: "util:auto-naming",
      chatId,
    });

    // Clean up the title (remove quotes, colons, etc.)
    const cleanTitle = object.title
      .replace(/["«»:]/g, "")
      .replace(/^\s+|\s+$/g, "")
      .slice(0, 80);

    const cleanSummary = object.summary
      .replace(/^\s+|\s+$/g, "")
      .slice(0, 300);

    // Update chat title and summary (keep isRenamed=false since it's auto-generated)
    await updateChatTitleAndSummary({
      chatId,
      title: cleanTitle,
      summary: cleanSummary,
    });

    return Response.json({ title: cleanTitle, summary: cleanSummary, generated: true });
  } catch (error) {
    console.error("[generate-title] Error:", error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to generate title"
    ).toResponse();
  }
}
