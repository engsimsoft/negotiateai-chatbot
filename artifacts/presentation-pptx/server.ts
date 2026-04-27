import { smoothStream, streamText } from "ai";
import { getMaxOutputTokensForTask, getModel, getModelIdForTask } from "@/lib/ai/getModel";
import { emitArtifactDebugStep } from "@/lib/ai/debug-events";
import { loadArtifactSkill } from "@/lib/prompts/skills/artifact-generation/loader";

const ARTIFACT_TASK = "artifact:pptx" as const;
const ARTIFACT_KIND = "pptx" as const;
import { logUsage } from "@/lib/ai/usage-utils";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { put } from "@vercel/blob";
import pptxgen from "pptxgenjs";
import {
  type PptxSlide,
  defaultPptxTheme,
  getPptxThemeById,
  generatePptxFromSlides,
} from "@/lib/presentations/pptx-themes";
import { generatePptxPreview } from "@/lib/services/pptx-preview";

function parseSlides(content: string): PptxSlide[] {
  try {
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
      return parsed as PptxSlide[];
    }
    return [];
  } catch {
    return [
      {
        type: "title",
        title: "Презентация",
        subtitle: "Генерация...",
      },
    ];
  }
}

function extractThemeFromTitle(title: string): string {
  const themeMappings: Record<string, string[]> = {
    dark: ["тёмн", "темн", "dark", "night", "ночь", "космос", "space"],
    creative: ["креатив", "creative", "яркий", "bright", "дизайн", "маркетинг"],
    modern: ["современн", "modern", "модерн", "технолог", "tech", "стартап"],
    minimal: ["минимал", "minimal", "простой", "simple", "clean", "чистый"],
    corporate: ["корпоратив", "бизнес", "corporate", "business", "инвестор", "питч"],
  };

  const lowerTitle = title.toLowerCase();
  for (const [themeId, keywords] of Object.entries(themeMappings)) {
    if (keywords.some((keyword) => lowerTitle.includes(keyword))) {
      return themeId;
    }
  }
  return "corporate";
}

interface PptxDocumentContent {
  slides: PptxSlide[];
  themeId: string;
  pptxUrl: string;
  previewUrls: string[];
}

export const presentationPptxDocumentHandler =
  createDocumentHandler<"presentation-pptx">({
    kind: "presentation-pptx",
    onCreateDocument: async ({ title, dataStream, session }) => {
      let fullContent = "";

      // Detect theme from title
      const themeId = extractThemeFromTitle(title);
      const theme = getPptxThemeById(themeId);

      // Send initial status
      dataStream.write({
        type: "data-pptxStatus",
        data: {
          status: "generating",
          message: "Генерация слайдов...",
        },
        transient: true,
      });

      // Generate slides using AI
      const startTime = Date.now();
      const result = streamText({
        model: getModel(ARTIFACT_TASK),
        maxOutputTokens: getMaxOutputTokensForTask(ARTIFACT_TASK),
        system: loadArtifactSkill("pptx", "create"),
        experimental_transform: smoothStream({ chunking: "word" }),
        prompt: `Create a presentation about: ${title}`,
      });

      for await (const delta of result.fullStream) {
        if (delta.type === "text-delta") {
          fullContent += delta.text;
        }
      }

      // ТЗ-PIPELINE1: Log artifact usage (was completely missing)
      const modelId = getModelIdForTask(ARTIFACT_TASK);
      const usage = await result.totalUsage;
      const durationMs = Date.now() - startTime;
      if (session?.user?.id) {
        logUsage({ userId: session.user.id, usage, modelId, chatMode: "artifact:pptx" });
      }
      emitArtifactDebugStep(dataStream, { taskId: ARTIFACT_TASK, modelId, usage, operation: "create", artifactKind: ARTIFACT_KIND, durationMs });

      const slides = parseSlides(fullContent);

      // Update status
      dataStream.write({
        type: "data-pptxStatus",
        data: {
          status: "creating",
          message: "Создание PPTX файла...",
        },
        transient: true,
      });

      // Create PPTX file
      const pres = new pptxgen();
      pres.author = "Simply";
      pres.title = title;

      generatePptxFromSlides(pres, slides, theme);

      // Generate PPTX buffer
      const pptxData = await pres.write({ outputType: "nodebuffer" });
      const pptxBuffer = Buffer.from(pptxData as ArrayBuffer);

      // Upload PPTX to Vercel Blob
      const fileName = `${title.replace(/[^a-zA-Zа-яА-Я0-9]/g, "-")}-${Date.now()}.pptx`;
      const blobResult = await put(
        `presentations/pptx/${fileName}`,
        pptxBuffer,
        {
          access: "public",
          contentType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }
      );

      // Update status for preview generation
      dataStream.write({
        type: "data-pptxStatus",
        data: {
          status: "preview",
          message: "Генерация превью слайдов...",
          pptxUrl: blobResult.url,
        },
        transient: true,
      });

      // Generate preview images via CloudConvert
      let previewUrls: string[] = [];
      try {
        previewUrls = await generatePptxPreview(pptxBuffer, fileName);
      } catch (error) {
        console.error("Preview generation failed:", error);
        // Continue without previews
      }

      // Store document content
      const storedContent: PptxDocumentContent = {
        slides,
        themeId: theme.id,
        pptxUrl: blobResult.url,
        previewUrls,
      };

      // Send final update
      dataStream.write({
        type: "data-pptxComplete",
        data: {
          pptxUrl: blobResult.url,
          previewUrls,
          slideCount: slides.length,
          themeId: theme.id,
        },
        transient: true,
      });

      return JSON.stringify(storedContent);
    },

    onUpdateDocument: async ({ document, description, dataStream, session }) => {
      let fullContent = "";

      // Parse existing content
      let existingData: PptxDocumentContent = {
        slides: [],
        themeId: "corporate",
        pptxUrl: "",
        previewUrls: [],
      };
      try {
        existingData = JSON.parse(document.content || "{}");
      } catch {
        // ignore
      }

      const theme = getPptxThemeById(existingData.themeId);

      dataStream.write({
        type: "data-pptxStatus",
        data: {
          status: "updating",
          message: "Обновление презентации...",
        },
        transient: true,
      });

      const startTime = Date.now();
      const result = streamText({
        model: getModel(ARTIFACT_TASK),
        maxOutputTokens: getMaxOutputTokensForTask(ARTIFACT_TASK),
        system: loadArtifactSkill("pptx", "update", {
          currentSlides: JSON.stringify(existingData.slides, null, 2),
          description,
        }),
        experimental_transform: smoothStream({ chunking: "word" }),
        prompt: description,
      });

      for await (const delta of result.fullStream) {
        if (delta.type === "text-delta") {
          fullContent += delta.text;
        }
      }

      // ТЗ-PIPELINE1: Log artifact usage (was completely missing)
      const modelId = getModelIdForTask(ARTIFACT_TASK);
      const usage = await result.totalUsage;
      const durationMs = Date.now() - startTime;
      if (session?.user?.id) {
        logUsage({ userId: session.user.id, usage, modelId, chatMode: "artifact:pptx" });
      }
      emitArtifactDebugStep(dataStream, { taskId: ARTIFACT_TASK, modelId, usage, operation: "update", artifactKind: ARTIFACT_KIND, durationMs });

      const slides = parseSlides(fullContent);

      // Create updated PPTX
      const pres = new pptxgen();
      pres.author = "Simply";
      pres.title = document.title;

      generatePptxFromSlides(pres, slides, theme);

      const pptxData = await pres.write({ outputType: "nodebuffer" });
      const pptxBuffer = Buffer.from(pptxData as ArrayBuffer);

      const fileName = `${document.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, "-")}-${Date.now()}.pptx`;
      const blobResult = await put(
        `presentations/pptx/${fileName}`,
        pptxBuffer,
        {
          access: "public",
          contentType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }
      );

      // Generate new previews
      let previewUrls: string[] = [];
      try {
        previewUrls = await generatePptxPreview(pptxBuffer, fileName);
      } catch (error) {
        console.error("Preview generation failed:", error);
      }

      const storedContent: PptxDocumentContent = {
        slides,
        themeId: theme.id,
        pptxUrl: blobResult.url,
        previewUrls,
      };

      dataStream.write({
        type: "data-pptxComplete",
        data: {
          pptxUrl: blobResult.url,
          previewUrls,
          slideCount: slides.length,
          themeId: theme.id,
        },
        transient: true,
      });

      return JSON.stringify(storedContent);
    },
  });
