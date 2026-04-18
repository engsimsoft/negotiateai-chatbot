import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/artifact-prompts";
import { getMaxOutputTokensForTask, getModel, getModelIdForTask } from "@/lib/ai/getModel";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { logUsage } from "@/lib/ai/usage-utils";
import { emitArtifactDebugStep } from "@/lib/ai/debug-events";

const ARTIFACT_TASK = "artifact:text" as const;
const ARTIFACT_KIND = "text" as const;

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, dataStream, session }) => {
    let draftContent = "";
    const startTime = Date.now();

    const result = streamText({
      model: getModel(ARTIFACT_TASK),
      maxOutputTokens: getMaxOutputTokensForTask(ARTIFACT_TASK),
      system: `Write about the given topic in PLAIN TEXT format.

IMPORTANT RULES:
- DO NOT use Markdown formatting (no #, **, *, -, etc.)
- Use emoji for visual structure instead of bullets: ✅ 📌 🔹 💡 ⭐ 🎯
- Use blank lines to separate sections
- Use CAPS or emoji for section titles instead of ## headers
- Text must copy-paste perfectly to VK, Telegram, Instagram
- Keep formatting simple and clean

Example format:
🎯 ЗАГОЛОВОК

Первый параграф текста здесь.

📌 ВАЖНЫЕ ПУНКТЫ

✅ Первый пункт
✅ Второй пункт
✅ Третий пункт

💡 ИТОГ

Заключительный текст.`,
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: title,
    });

    for await (const delta of result.fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    // ТЗ-PIPELINE1: Log artifact usage (was completely missing)
    const modelId = getModelIdForTask(ARTIFACT_TASK);
    const usage = await result.totalUsage;
    const durationMs = Date.now() - startTime;
    if (session?.user?.id) {
      logUsage({ userId: session.user.id, usage, modelId, chatMode: "artifact:text" });
    }
    // Surface the artifact sub-call in DevPanel (hidden before — side-stream).
    emitArtifactDebugStep(dataStream, { taskId: ARTIFACT_TASK, modelId, usage, operation: "create", artifactKind: ARTIFACT_KIND, durationMs });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, session }) => {
    let draftContent = "";
    const startTime = Date.now();

    const result = streamText({
      model: getModel(ARTIFACT_TASK),
      maxOutputTokens: getMaxOutputTokensForTask(ARTIFACT_TASK),
      system: updateDocumentPrompt(document.content, "text"),
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content,
          },
        },
      },
    });

    for await (const delta of result.fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    // ТЗ-PIPELINE1: Log artifact usage (was completely missing)
    const modelId = getModelIdForTask(ARTIFACT_TASK);
    const usage = await result.totalUsage;
    const durationMs = Date.now() - startTime;
    if (session?.user?.id) {
      logUsage({ userId: session.user.id, usage, modelId, chatMode: "artifact:text" });
    }
    emitArtifactDebugStep(dataStream, { taskId: ARTIFACT_TASK, modelId, usage, operation: "update", artifactKind: ARTIFACT_KIND, durationMs });

    return draftContent;
  },
});
