import { smoothStream, streamText } from "ai";
import { loadArtifactSkill } from "@/lib/prompts/skills/artifact-generation/loader";
import { getMaxOutputTokensForTask, getModel, getModelIdForTask } from "@/lib/ai/getModel";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { logUsage } from "@/lib/ai/usage-utils";
import { emitArtifactDebugStep } from "@/lib/ai/debug-events";

const ARTIFACT_TASK = "artifact:markdown" as const;
const ARTIFACT_KIND = "markdown" as const;

export const markdownDocumentHandler = createDocumentHandler<"markdown">({
  kind: "markdown",
  onCreateDocument: async ({ title, dataStream, session }) => {
    let draftContent = "";
    const startTime = Date.now();

    const result = streamText({
      model: getModel(ARTIFACT_TASK),
      maxOutputTokens: getMaxOutputTokensForTask(ARTIFACT_TASK),
      system: loadArtifactSkill("markdown", "create"),
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: title,
    });

    for await (const delta of result.fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-markdownDelta",
          data: text,
          transient: true,
        });
      }
    }

    const modelId = getModelIdForTask(ARTIFACT_TASK);
    const usage = await result.totalUsage;
    const durationMs = Date.now() - startTime;
    if (session?.user?.id) {
      logUsage({ userId: session.user.id, usage, modelId, chatMode: "artifact:markdown" });
    }
    emitArtifactDebugStep(dataStream, { taskId: ARTIFACT_TASK, modelId, usage, operation: "create", artifactKind: ARTIFACT_KIND, durationMs });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, session }) => {
    let draftContent = "";
    const startTime = Date.now();

    const result = streamText({
      model: getModel(ARTIFACT_TASK),
      maxOutputTokens: getMaxOutputTokensForTask(ARTIFACT_TASK),
      system: loadArtifactSkill("markdown", "update", {
        currentContent: document.content ?? "",
      }),
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
          type: "data-markdownDelta",
          data: text,
          transient: true,
        });
      }
    }

    const modelId = getModelIdForTask(ARTIFACT_TASK);
    const usage = await result.totalUsage;
    const durationMs = Date.now() - startTime;
    if (session?.user?.id) {
      logUsage({ userId: session.user.id, usage, modelId, chatMode: "artifact:markdown" });
    }
    emitArtifactDebugStep(dataStream, { taskId: ARTIFACT_TASK, modelId, usage, operation: "update", artifactKind: ARTIFACT_KIND, durationMs });

    return draftContent;
  },
});
