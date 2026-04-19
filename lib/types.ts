import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type {
  DebugStepData,
  DebugFinishData,
  DebugGuardianData,
  DebugPromptData,
} from "./ai/debug-events";
import type { CompactionEvent } from "./ai/compaction/types";
import type { getWeather } from "./ai/tools/get-weather";
import type { updateDocument } from "./ai/tools/update-document";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  markdownDelta: string;
  presentationDelta: {
    jsonContent?: string;
    themeId?: string;
    html?: string;
    isComplete?: boolean;
  };
  pptxStatus: {
    status: string;
    message: string;
    pptxUrl?: string;
  };
  pptxComplete: {
    pptxUrl: string;
    previewUrls: string[];
    slideCount: number;
    themeId: string;
  };
  excelDelta: {
    excelData?: string; // JSON stringified ExcelData
    fileUrl?: string;
    isComplete?: boolean;
  };
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  // ТЗ-07: Tool activity started event (sent from instrumentedStream)
  "tool-activity": {
    toolName: string;
    toolCallId: string;
    args?: any;
  };
  // Dev: model info for dev badge (emitted per response)
  "model-info": {
    modelId: string;
    modelName: string;
  };
  // ТЗ-PX: Research depth override (dev-mode, emitted when researchDepth is set)
  "research-depth": {
    depth: string;
  };
  // ТЗ-C3: Context usage indicator
  "context-usage": { percent: number; tokens: number };
  // ТЗ-DEV1: Developer Panel debug events (transient, dev-mode only)
  "debug-prompt": DebugPromptData;
  "debug-step": DebugStepData;
  "debug-guardian": DebugGuardianData;
  "debug-finish": DebugFinishData;
  // ТЗ-COMPACTION-1: user-visible Simply Compaction event (always on).
  // Эмитится из `emitCompactionEvent` в lib/ai/compaction/events.ts, слушается
  // в components/elements/context.tsx для индикатора в виджете контекста.
  compaction: CompactionEvent;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
