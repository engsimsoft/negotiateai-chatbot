import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const markdownDocumentHandler = createDocumentHandler<"markdown">({
  kind: "markdown",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: myProvider.languageModel("artifact-model"),
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

    for await (const delta of fullStream) {
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

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: myProvider.languageModel("artifact-model"),
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

    for await (const delta of fullStream) {
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

    return draftContent;
  },
});
