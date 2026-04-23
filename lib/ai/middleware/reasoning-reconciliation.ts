import type { LanguageModelMiddleware } from "ai";

/**
 * Чинит orphan reasoning-delta/end, приходящие от xAI провайдера для Grok 4.20
 * reasoning при параллельных tool calls: если приходит reasoning-delta или
 * reasoning-end для id, для которого ещё не эмитнут reasoning-start — синтезируем
 * недостающий reasoning-start перед тем как прокинуть chunk дальше. Иначе AI SDK
 * streamText выбрасывает "reasoning part {id} not found" (vercel/ai#12054),
 * стрим завершается HTTP 200 без ответа, клиент виснет.
 */
export const reasoningReconciliationMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();
    const activeReasoningIds = new Set<string>();

    const transformStream = new TransformStream({
      transform(chunk: unknown, controller) {
        const typed = chunk as { type?: string; id?: string };

        if (typeof typed.type === "string" && typed.type.startsWith("reasoning")) {
          console.log("[ReasoningMW]", {
            type: typed.type,
            id: typed.id,
            active: Array.from(activeReasoningIds),
          });
        }

        if (typed.type === "reasoning-start" && typed.id) {
          activeReasoningIds.add(typed.id);
          controller.enqueue(chunk);
          return;
        }

        if (
          (typed.type === "reasoning-delta" || typed.type === "reasoning-end") &&
          typed.id &&
          !activeReasoningIds.has(typed.id)
        ) {
          console.warn("[ReasoningMW] synthesizing reasoning-start for orphan", typed.type, typed.id);
          controller.enqueue({ type: "reasoning-start", id: typed.id });
          activeReasoningIds.add(typed.id);
        }

        controller.enqueue(chunk);
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};
