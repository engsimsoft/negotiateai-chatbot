import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/artifact-prompts";
import { getModel, getModelIdForTask } from "@/lib/ai/getModel";
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
      system: `Напиши документ на тему, используя Markdown форматирование.

ПРАВИЛА ОФОРМЛЕНИЯ:
- Используй заголовки: # для главного, ## для разделов, ### для подразделов
- Используй списки: - для маркированных, 1. для нумерованных
- Используй **жирный** для важных терминов
- Используй *курсив* для акцентов
- Используй \`код\` для технических терминов
- Используй таблицы там где это уместно (GFM формат)
- Используй > для цитат
- Разделяй разделы пустыми строками

СТРУКТУРА ДОКУМЕНТА:
1. Начни с заголовка #
2. Добавь краткое введение
3. Разбей на логичные разделы с ## заголовками
4. Используй подразделы ### если нужно
5. Заверши итогами или выводами

Документ должен быть:
- Структурированным и легко читаемым
- Профессиональным по тону
- С чёткой иерархией информации`,
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
      system: updateDocumentPrompt(document.content, "markdown"),
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
