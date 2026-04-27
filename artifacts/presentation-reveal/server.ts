import { smoothStream, streamText } from "ai";
import { getMaxOutputTokensForTask, getModel, getModelIdForTask } from "@/lib/ai/getModel";
import { emitArtifactDebugStep } from "@/lib/ai/debug-events";
import { loadArtifactSkill } from "@/lib/prompts/skills/artifact-generation/loader";

const ARTIFACT_TASK = "artifact:reveal" as const;
const ARTIFACT_KIND = "reveal" as const;
import { logUsage } from "@/lib/ai/usage-utils";
import { createDocumentHandler } from "@/lib/artifacts/server";
import {
  type Slide,
  defaultTheme,
  generateRevealHTML,
  getThemeById,
} from "@/lib/presentations/themes";

function parseSlides(content: string): Slide[] {
  try {
    // Clean up content - remove markdown code blocks if present
    let cleaned = content.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed as Slide[];
    }
    return [];
  } catch {
    // If parsing fails, return a default error slide
    return [
      {
        type: "title",
        title: "Presentation",
        subtitle: "Content is being generated...",
      },
    ];
  }
}

function extractThemeFromTitle(title: string): string {
  const themeMappings: Record<string, string[]> = {
    dark: ["тёмн", "темн", "dark", "night"],
    creative: ["креатив", "creative", "яркий", "bright", "colorful"],
    modern: ["современн", "modern", "модерн"],
    minimal: ["минимал", "minimal", "простой", "simple", "clean"],
    corporate: ["корпоратив", "бизнес", "corporate", "business", "professional"],
  };

  const lowerTitle = title.toLowerCase();
  for (const [themeId, keywords] of Object.entries(themeMappings)) {
    if (keywords.some((keyword) => lowerTitle.includes(keyword))) {
      return themeId;
    }
  }
  return "corporate"; // default
}

export const presentationRevealDocumentHandler =
  createDocumentHandler<"presentation-reveal">({
    kind: "presentation-reveal",
    onCreateDocument: async ({ title, dataStream, session }) => {
      let fullContent = "";

      // Detect theme from title
      const themeId = extractThemeFromTitle(title);
      const theme = getThemeById(themeId);

      const startTime = Date.now();
      const result = streamText({
        model: getModel(ARTIFACT_TASK),
        maxOutputTokens: getMaxOutputTokensForTask(ARTIFACT_TASK),
        system: loadArtifactSkill("reveal", "create"),
        experimental_transform: smoothStream({ chunking: "word" }),
        prompt: `Create a presentation about: ${title}`,
      });

      for await (const delta of result.fullStream) {
        if (delta.type === "text-delta") {
          fullContent += delta.text;

          // Send intermediate updates
          dataStream.write({
            type: "data-presentationDelta",
            data: {
              jsonContent: fullContent,
              themeId: theme.id,
            },
            transient: true,
          });
        }
      }

      // ТЗ-PIPELINE1: Log artifact usage (was completely missing)
      const modelId = getModelIdForTask(ARTIFACT_TASK);
      const usage = await result.totalUsage;
      const durationMs = Date.now() - startTime;
      if (session?.user?.id) {
        logUsage({ userId: session.user.id, usage, modelId, chatMode: "artifact:reveal" });
      }
      emitArtifactDebugStep(dataStream, { taskId: ARTIFACT_TASK, modelId, usage, operation: "create", artifactKind: ARTIFACT_KIND, durationMs });

      // Parse slides and generate final HTML
      const slides = parseSlides(fullContent);
      const html = generateRevealHTML(slides, theme);

      // Store as JSON with theme info for later editing
      const storedContent = JSON.stringify({
        slides,
        themeId: theme.id,
        html,
      });

      // Send final content
      dataStream.write({
        type: "data-presentationDelta",
        data: {
          jsonContent: JSON.stringify(slides),
          themeId: theme.id,
          html,
          isComplete: true,
        },
        transient: true,
      });

      return storedContent;
    },
    onUpdateDocument: async ({ document, description, dataStream, session }) => {
      let fullContent = "";

      // Parse existing content
      let existingData: { slides: Slide[]; themeId: string } = {
        slides: [],
        themeId: "corporate",
      };
      try {
        existingData = JSON.parse(document.content || "{}");
      } catch {
        // ignore
      }

      const theme = getThemeById(existingData.themeId);

      const startTime = Date.now();
      const result = streamText({
        model: getModel(ARTIFACT_TASK),
        maxOutputTokens: getMaxOutputTokensForTask(ARTIFACT_TASK),
        system: loadArtifactSkill("reveal", "update", {
          currentSlides: JSON.stringify(existingData.slides, null, 2),
          description,
        }),
        experimental_transform: smoothStream({ chunking: "word" }),
        prompt: description,
      });

      for await (const delta of result.fullStream) {
        if (delta.type === "text-delta") {
          fullContent += delta.text;

          dataStream.write({
            type: "data-presentationDelta",
            data: {
              jsonContent: fullContent,
              themeId: theme.id,
            },
            transient: true,
          });
        }
      }

      // ТЗ-PIPELINE1: Log artifact usage (was completely missing)
      const modelId = getModelIdForTask(ARTIFACT_TASK);
      const usage = await result.totalUsage;
      const durationMs = Date.now() - startTime;
      if (session?.user?.id) {
        logUsage({ userId: session.user.id, usage, modelId, chatMode: "artifact:reveal" });
      }
      emitArtifactDebugStep(dataStream, { taskId: ARTIFACT_TASK, modelId, usage, operation: "update", artifactKind: ARTIFACT_KIND, durationMs });

      const slides = parseSlides(fullContent);
      const html = generateRevealHTML(slides, theme);

      const storedContent = JSON.stringify({
        slides,
        themeId: theme.id,
        html,
      });

      dataStream.write({
        type: "data-presentationDelta",
        data: {
          jsonContent: JSON.stringify(slides),
          themeId: theme.id,
          html,
          isComplete: true,
        },
        transient: true,
      });

      return storedContent;
    },
  });
